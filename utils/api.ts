import type {
  Device,
  DeviceState,
  Group,
  HomeStatus,
  Room,
  Scene,
} from "@/types";

let baseUrl = "";

export function setBaseUrl(url: string) {
  const cleaned = url.replace(/\/$/, "");
  baseUrl = cleaned.startsWith("http") ? cleaned : `http://${cleaned}`;
  console.log("[api] baseUrl set to:", baseUrl);
}

export function getBaseUrl() {
  return baseUrl;
}

async function get<T>(path: string): Promise<T> {
  const fullUrl = `${baseUrl}${path}`;
  console.log("[api] GET", fullUrl);
  const res = await fetch(fullUrl);
  const text = await res.text();
  console.log("[api] response status:", res.status, "body preview:", text.slice(0, 80));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${path}: ${text.slice(0, 120)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Non-JSON response for ${path}: ${text.slice(0, 120)}`);
  }
}

// ─── Query endpoints ───────────────────────────────────────────────

export function fetchStatus(): Promise<HomeStatus> {
  return get<HomeStatus>("/status");
}

export function fetchRooms(): Promise<Room[]> {
  return get<Room[]>("/list/rooms");
}

export function fetchDevices(): Promise<Device[]> {
  return get<Device[]>("/list/devices");
}

export function fetchScenes(): Promise<Scene[]> {
  return get<Scene[]>("/list/scenes");
}

export function fetchGroups(): Promise<Group[]> {
  return get<Group[]>("/list/groups");
}

export function fetchDeviceInfo(
  room: string,
  device: string
): Promise<Device & { state: DeviceState }> {
  return get(`/info/${encodeURIComponent(room)}/${encodeURIComponent(device)}`);
}

// ─── Device control endpoints ──────────────────────────────────────

export function controlToggle(room: string, device: string): Promise<void> {
  return get(`/toggle/${encodeURIComponent(room)}/${encodeURIComponent(device)}`);
}

export function controlOn(room: string, device: string): Promise<void> {
  return get(`/on/${encodeURIComponent(room)}/${encodeURIComponent(device)}`);
}

export function controlOff(room: string, device: string): Promise<void> {
  return get(`/off/${encodeURIComponent(room)}/${encodeURIComponent(device)}`);
}

export function controlBrightness(
  room: string,
  device: string,
  brightness: number
): Promise<void> {
  return get(
    `/brightness/${Math.round(brightness)}/${encodeURIComponent(room)}/${encodeURIComponent(device)}`
  );
}

export function controlColor(
  room: string,
  device: string,
  hue: number,
  saturation: number
): Promise<void> {
  return get(
    `/color/${Math.round(hue)}/${Math.round(saturation)}/${encodeURIComponent(room)}/${encodeURIComponent(device)}`
  );
}

// ─── Group control endpoints ───────────────────────────────────────

export function controlGroupOn(groupName: string): Promise<void> {
  return get(`/on/${encodeURIComponent(groupName)}`);
}

export function controlGroupOff(groupName: string): Promise<void> {
  return get(`/off/${encodeURIComponent(groupName)}`);
}

// ─── Per-member controls (for sliders) ────────────────────────────

export async function controlMembersBrightness(
  members: Array<{ room: string; name: string }>,
  brightness: number
): Promise<void> {
  await Promise.all(members.map((m) => controlBrightness(m.room, m.name, brightness)));
}

export async function controlMembersColor(
  members: Array<{ room: string; name: string }>,
  hue: number,
  saturation: number
): Promise<void> {
  await Promise.all(members.map((m) => controlColor(m.room, m.name, hue, saturation)));
}

// ─── Scene control ─────────────────────────────────────────────────

export function controlScene(sceneName: string): Promise<void> {
  return get(`/scene/${encodeURIComponent(sceneName)}`);
}

// ─── SSE events ────────────────────────────────────────────────────

export function subscribeToEvents(
  onHeartbeat: () => void,
  onError: () => void
): () => void {
  let closed = false;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (closed) return;
    const controller = new AbortController();

    fetch(`${baseUrl}/events`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done || closed) break;
          const text = decoder.decode(value);
          if (text.includes("heartbeat")) onHeartbeat();
        }
      })
      .catch(() => {
        if (!closed) {
          onError();
          retryTimeout = setTimeout(connect, 5000);
        }
      });

    return () => controller.abort();
  }

  const cleanup = connect();
  return () => {
    closed = true;
    cleanup?.();
    if (retryTimeout) clearTimeout(retryTimeout);
  };
}

// ─── URL probe ────────────────────────────────────────────────────

export async function probeUrls(
  localUrl: string,
  externalUrl: string
): Promise<{ activeUrl: string; source: "local" | "external" } | null> {
  const tryUrl = async (url: string): Promise<boolean> => {
    try {
      const cleaned = url.replace(/\/$/, "");
      const full = cleaned.startsWith("http") ? cleaned : `http://${cleaned}`;
      console.log("[api] probing:", full);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(`${full}/status`, { signal: controller.signal });
        console.log("[api] probe result:", res.status);
        return res.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      console.log("[api] probe failed:", e);
      return false;
    }
  };

  if (localUrl && (await tryUrl(localUrl))) {
    return { activeUrl: localUrl, source: "local" };
  }
  if (externalUrl && (await tryUrl(externalUrl))) {
    return { activeUrl: externalUrl, source: "external" };
  }
  return null;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  controlOff,
  controlOn,
  controlBrightness,
  controlColor,
  fetchDeviceInfo,
  fetchDevices,
} from "@/utils/api";
import type { Device, DeviceSnapshot, DeviceState, Fingerprint, SceneDeviceTarget } from "@/types";

const FINGERPRINT_KEY = "home:fingerprint";
const POLL_DELAY_MS = 2500;

export async function loadFingerprint(): Promise<Fingerprint | null> {
  const raw = await AsyncStorage.getItem(FINGERPRINT_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Fingerprint;
}

export async function saveFingerprint(fp: Fingerprint): Promise<void> {
  await AsyncStorage.setItem(FINGERPRINT_KEY, JSON.stringify(fp));
}

export async function clearFingerprint(): Promise<void> {
  await AsyncStorage.removeItem(FINGERPRINT_KEY);
}

// Device key format: "Room/DeviceName"
export function deviceKey(room: string, name: string): string {
  return `${room}/${name}`;
}

function parseDeviceKey(key: string): { room: string; name: string } {
  const idx = key.indexOf("/");
  return { room: key.slice(0, idx), name: key.slice(idx + 1) };
}

// ─── Snapshot ─────────────────────────────────────────────────────

export async function snapshotDevices(
  devices: Device[]
): Promise<DeviceSnapshot> {
  const results = await Promise.all(
    devices.map(async (d) => {
      try {
        const info = await fetchDeviceInfo(d.room, d.name);
        return { key: deviceKey(d.room, d.name), state: info.state };
      } catch {
        return null;
      }
    })
  );

  const snapshot: DeviceSnapshot = {};
  for (const r of results) {
    if (r) snapshot[r.key] = r.state;
  }
  console.log('[fingerprint] snapshot keys:', Object.keys(snapshot));
  return snapshot;
}

// ─── Restore ──────────────────────────────────────────────────────

export async function restoreDevices(snapshot: DeviceSnapshot): Promise<void> {
  await Promise.all(
    Object.entries(snapshot).map(async ([key, state]) => {
      const { room, name } = parseDeviceKey(key);
      try {
        if (state.on) {
          await controlOn(room, name);
        } else {
          await controlOff(room, name);
        }
        if (state.brightness !== undefined) {
          await controlBrightness(room, name, state.brightness);
        }
        if (state.hue !== undefined && state.saturation !== undefined) {
          await controlColor(room, name, state.hue, state.saturation);
        }
      } catch {
        // Best effort restore
      }
    })
  );
}

// ─── Poll device states ───────────────────────────────────────────

async function pollStates(
  devices: Device[]
): Promise<Record<string, DeviceState>> {
  const results = await Promise.all(
    devices.map(async (d) => {
      try {
        const info = await fetchDeviceInfo(d.room, d.name);
        return { key: deviceKey(d.room, d.name), state: info.state };
      } catch {
        return null;
      }
    })
  );

  const states: Record<string, DeviceState> = {};
  for (const r of results) {
    if (r) states[r.key] = r.state;
  }
  return states;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Scene fingerprint ───────────────────────────────────────────
// 1. Turn off ALL devices
// 2. Trigger scene
// 3. Poll — devices that are now ON belong to the scene
// 4. Repeat twice and intersect results for confidence
// 5. Trigger scene one final time and capture target state (brightness, hue, sat)

async function fingerprintScene(
  trigger: () => Promise<void>,
  devices: Device[]
): Promise<SceneDeviceTarget[]> {
  const runPass = async (): Promise<Set<string>> => {
    // Turn off all devices in parallel
    await Promise.all(
      devices.map((d) => controlOff(d.room, d.name).catch(() => {}))
    );
    await sleep(POLL_DELAY_MS); // wait for all-off to settle

    // Trigger the scene
    await trigger();
    await sleep(POLL_DELAY_MS * 3); // wait for HomeKit to propagate

    // Poll all devices — anything ON is a member
    const states = await pollStates(devices);
    const found = new Set<string>();
    for (const device of devices) {
      const key = deviceKey(device.room, device.name);
      if (states[key]?.on === true) {
        found.add(key);
      }
    }
    console.log('[fingerprint] scene pass found:', [...found]);
    return found;
  };

  const pass1 = await runPass();
  const pass2 = await runPass();

  // Intersect — only keep devices that appeared in both passes
  const memberKeys = [...pass1].filter((k) => pass2.has(k));
  console.log('[fingerprint] scene members confirmed:', memberKeys);

  // Final pass — trigger scene and capture target state values
  // Poll repeatedly until colour values appear or we give up
  await trigger();

  let finalStates: Record<string, DeviceState> = {};
  const memberDevices = devices.filter((d) => memberKeys.includes(deviceKey(d.room, d.name)));
  const hasColorDevices = memberDevices.some((d) => d.type === "light");

  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(POLL_DELAY_MS);
    finalStates = await pollStates(devices);

    // Check if we have colour values for light members
    if (!hasColorDevices) break;
    const gotColor = memberKeys.some((key) => {
      const state = finalStates[key];
      return state?.hue !== undefined || state?.brightness !== undefined;
    });
    if (gotColor) {
      console.log('[fingerprint] got colour values on attempt', attempt + 1);
      break;
    }
    console.log('[fingerprint] no colour values yet, retrying...');
  }

  const targets: SceneDeviceTarget[] = memberKeys.map((key) => {
    const state = finalStates[key];
    const target: SceneDeviceTarget = { key, on: state?.on ?? true };
    if (state?.brightness !== undefined) target.brightness = state.brightness;
    if (state?.hue !== undefined) target.hue = state.hue;
    if (state?.saturation !== undefined) target.saturation = state.saturation;
    return target;
  });

  console.log('[fingerprint] scene targets captured:', JSON.stringify(targets));
  return targets;
}

// ─── Group fingerprint cycle ──────────────────────────────────────
// Triggers on/off/on, polls after each, returns set of device keys
// that responded consistently. Excludes already-confirmed devices.

async function fingerprintGroup(
  triggerOn: () => Promise<void>,
  triggerOff: () => Promise<void>,
  devices: Device[],
  confirmedDevices: Set<string>,
  snapshot: DeviceSnapshot
): Promise<string[]> {
  // Phase 1: ON
  await triggerOn();
  await sleep(POLL_DELAY_MS);
  const afterOn1 = await pollStates(devices);

  // Phase 2: OFF
  await triggerOff();
  await sleep(POLL_DELAY_MS);
  const afterOff = await pollStates(devices);

  // Phase 3: ON again
  await triggerOn();
  await sleep(POLL_DELAY_MS);
  const afterOn2 = await pollStates(devices);

  const members: string[] = [];

  for (const device of devices) {
    const key = deviceKey(device.room, device.name);
    if (confirmedDevices.has(key)) continue;

    const s1 = afterOn1[key];
    const s2 = afterOff[key];
    const s3 = afterOn2[key];

    if (!s1 || !s2 || !s3) continue;

    let matches = 0;
    if (s1.on === true) matches++;
    if (s2.on === false) matches++;
    if (s3.on === true) matches++;

    const originalState = snapshot[key];
    const changed =
      !originalState ||
      s1.on !== originalState.on ||
      s2.on !== originalState.on;

    if (matches >= 2 && changed) {
      members.push(key);
    }
  }

  console.log('[fingerprint] group members found:', members);
  return members;
}

// ─── Full calibration run ─────────────────────────────────────────

export type CalibrationStep =
  | { kind: "scene"; name: string }
  | { kind: "group"; name: string }
  | { kind: "restore" };

export interface CalibrationCallbacks {
  onStepStart: (step: CalibrationStep, index: number, total: number) => void;
  onStepDone: (step: CalibrationStep) => void;
  onComplete: (fingerprint: Fingerprint) => void;
  onError: (err: Error) => void;
}

export async function runCalibration(
  scenes: Array<{ name: string; triggerOn: () => Promise<void>; triggerOff: () => Promise<void> }>,
  groups: Array<{ name: string; triggerOn: () => Promise<void>; triggerOff: () => Promise<void> }>,
  callbacks: CalibrationCallbacks
): Promise<void> {
  const total = scenes.length + groups.length + 1; // +1 for restore step
  let stepIndex = 0;

  try {
    // Fetch fresh device list
    const devices = await fetchDevices();

    // Snapshot current state
    const snapshot = await snapshotDevices(devices);

    const fingerprint: Fingerprint = {
      scenes: {},
      groups: {},
      fingerprintedAt: Date.now(),
    };

    const confirmedDevices = new Set<string>();

    // ── Fingerprint scenes ──
    for (const scene of scenes) {
      const step: CalibrationStep = { kind: "scene", name: scene.name };
      callbacks.onStepStart(step, stepIndex, total);

      const members = await fingerprintScene(
        scene.triggerOn,
        devices
      );

      fingerprint.scenes[scene.name] = members; // SceneDeviceTarget[]
      callbacks.onStepDone(step);
      stepIndex++;
    }

    // ── Fingerprint groups ──
    for (const group of groups) {
      const step: CalibrationStep = { kind: "group", name: group.name };
      callbacks.onStepStart(step, stepIndex, total);

      // Restore to snapshot before each group so previous cycles don't bleed in
      await restoreDevices(snapshot);
      await sleep(POLL_DELAY_MS);

      const members = await fingerprintGroup(
        group.triggerOn,
        group.triggerOff,
        devices,
        confirmedDevices,
        snapshot
      );

      fingerprint.groups[group.name] = members;
      members.forEach((m) => confirmedDevices.add(m));
      callbacks.onStepDone(step);
      stepIndex++;
    }

    // ── Restore ──
    const restoreStep: CalibrationStep = { kind: "restore" };
    callbacks.onStepStart(restoreStep, stepIndex, total);
    await restoreDevices(snapshot);
    callbacks.onStepDone(restoreStep);

    console.log('[fingerprint] saving:', JSON.stringify(fingerprint));
    await saveFingerprint(fingerprint);
    console.log('[fingerprint] saved OK');
    callbacks.onComplete(fingerprint);
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

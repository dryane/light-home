import type { Fingerprint, SceneDeviceTarget } from "@/types";

const CHARACTERISTIC_POWER = "00000025-0000-1000-8000-0026BB765291";
const CHARACTERISTIC_BRIGHTNESS = "00000008-0000-1000-8000-0026BB765291";
const CHARACTERISTIC_HUE = "00000013-0000-1000-8000-0026BB765291";
const CHARACTERISTIC_SATURATION = "0000002F-0000-1000-8000-0026BB765291";

function normaliseUUID(uuid: string): string {
  if (uuid.length === 8) return `${uuid}-0000-1000-8000-0026BB765291`;
  return uuid.toUpperCase();
}

interface RawAccessory {
  name: string;
  room: string;
}

interface RawAction {
  serviceName: string;
  characteristicType: string;
  value: number | boolean;
}

interface RawActionSet {
  name: string;
  actions: RawAction[];
  actionSetType: string;
}

interface RawServiceGroup {
  name: string;
  services: Array<{ accessoryName: string }>;
}

interface RawDebugResponse {
  accessories: RawAccessory[];
  actionSets: RawActionSet[];
  serviceGroups: RawServiceGroup[];
}


export interface DeviceStateMap {
  [deviceKey: string]: {
    on: boolean;
    brightness?: number;
    hue?: number;
    saturation?: number;
  };
}

// Extract current device states from /debug/raw accessories characteristics
export function extractDeviceStates(raw: RawDebugResponse): DeviceStateMap {
  const nameToKey: Record<string, string> = {};
  for (const acc of raw.accessories) {
    nameToKey[acc.name] = `${acc.room}/${acc.name}`;
  }

  const states: DeviceStateMap = {};

  for (const acc of raw.accessories) {
    const key = `${acc.room}/${acc.name}`;
    const state: DeviceStateMap[string] = { on: false };

    for (const service of (acc as any).services ?? []) {
      for (const char of service.characteristics ?? []) {
        const type = normaliseUUID(char.type).toUpperCase();
        if (char.value === undefined || char.value === null) continue;

        if (type === CHARACTERISTIC_POWER.toUpperCase()) {
          state.on = char.value === true || char.value === 1;
        } else if (type === CHARACTERISTIC_BRIGHTNESS.toUpperCase()) {
          state.brightness = Number(char.value);
        } else if (type === CHARACTERISTIC_HUE.toUpperCase()) {
          state.hue = Number(char.value);
        } else if (type === CHARACTERISTIC_SATURATION.toUpperCase()) {
          state.saturation = Number(char.value);
        }
      }
    }

    states[key] = state;
  }

  return states;
}

export function buildFingerprintFromRaw(raw: RawDebugResponse): Fingerprint {
  // Build serviceName → "Room/Name" lookup
  const nameToKey: Record<string, string> = {};
  for (const acc of raw.accessories) {
    nameToKey[acc.name] = `${acc.room}/${acc.name}`;
  }

  // Scenes — only from actionSets with actions, actionSets is the source of truth
  const scenes: Record<string, SceneDeviceTarget[]> = {};
  for (const actionSet of raw.actionSets) {
    if (!actionSet.actions || actionSet.actions.length === 0) continue;

    const deviceMap: Record<string, SceneDeviceTarget> = {};

    for (const action of actionSet.actions) {
      const key = nameToKey[action.serviceName];
      if (!key) continue;

      if (!deviceMap[key]) deviceMap[key] = { key, on: true };

      const type = normaliseUUID(action.characteristicType).toUpperCase();

      if (type === CHARACTERISTIC_POWER.toUpperCase()) {
        deviceMap[key].on = action.value === true || action.value === 1;
      } else if (type === CHARACTERISTIC_BRIGHTNESS.toUpperCase()) {
        deviceMap[key].brightness = Number(action.value);
      } else if (type === CHARACTERISTIC_HUE.toUpperCase()) {
        deviceMap[key].hue = Number(action.value);
      } else if (type === CHARACTERISTIC_SATURATION.toUpperCase()) {
        deviceMap[key].saturation = Number(action.value);
      }
    }

    scenes[actionSet.name] = Object.values(deviceMap);
    console.log(`[debugRaw] scene "${actionSet.name}" loaded with ${Object.keys(deviceMap).length} devices`);
  }

  // Groups — from serviceGroups
  const groups: Record<string, string[]> = {};
  for (const group of raw.serviceGroups) {
    groups[group.name] = group.services
      .map((s) => nameToKey[s.accessoryName])
      .filter(Boolean);
  }

  console.log("[debugRaw] scenes:", Object.keys(scenes));
  console.log("[debugRaw] groups:", Object.keys(groups));

  return { scenes, groups, fingerprintedAt: Date.now() };
}

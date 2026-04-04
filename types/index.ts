export type DeviceType = "light" | "outlet";

export interface Device {
  name: string;
  room: string;
  type: DeviceType;
  icon: string;
  reachable: boolean;
}

export interface DeviceState {
  on: boolean;
  brightness?: number; // 0–100
  hue?: number; // 0–360
  saturation?: number; // 0–100
}

export interface DeviceWithState extends Device {
  state: DeviceState | null;
}

export interface Room {
  name: string;
}

export interface Group {
  name: string;
  room: string;
  icon: string;
  devices: number;
}

export interface Scene {
  name: string;
  icon: string;
}

export interface HomeStatus {
  accessories: number;
  devices: number;
  groups: number;
  reachable: number;
  rooms: number;
  scenes: number;
  unreachable: number;
}

// Per-device target state captured during scene fingerprinting
export interface SceneDeviceTarget {
  key: string;          // "Living Room/Lamp"
  on: boolean;
  brightness?: number;
  hue?: number;
  saturation?: number;
}

// Fingerprint — stored in AsyncStorage
export interface Fingerprint {
  scenes: Record<string, SceneDeviceTarget[]>; // "Lights On" → [{ key, on, brightness, ... }]
  groups: Record<string, string[]>;             // "Office Lights" → ["Office/Office Light 1", ...]
  fingerprintedAt: number;
}

// Snapshot of device states before calibration
export type DeviceSnapshot = Record<string, DeviceState>; // "Room/Device" → state

// A rendered row in the rooms list — either a single device or a group
export interface DeviceRow {
  key: string;
  kind: "device" | "group";
  name: string;
  room: string;
  type: DeviceType | "mixed";
  reachable: boolean;
  device?: DeviceWithState;
  groupName?: string;
  members?: DeviceWithState[];
}

// Scene status derived from comparing current device states to fingerprinted targets
export type SceneStatus = "active" | "inactive" | "modified" | "partial";

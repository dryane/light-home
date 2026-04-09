import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  fetchDebugRaw,
  fetchDevices,
  fetchGroups,
  fetchRooms,
  fetchScenes,
  fetchStatus,
  subscribeToEvents,
  type DeviceEvent,
} from "@/utils/api";
import { extractDeviceStates } from "@/utils/debugRaw";
import { useSettings } from "@/contexts/SettingsContext";
import type {
  Device,
  DeviceState,
  DeviceWithState,
  Group,
  HomeStatus,
  Room,
  Scene,
} from "@/types";

interface HomeDataContextType {
  rooms: Room[];
  devices: DeviceWithState[];
  scenes: Scene[];
  groups: Group[];
  status: HomeStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateDeviceState: (room: string, name: string, state: Partial<DeviceState>) => void;
}

const HomeDataContext = createContext<HomeDataContextType>({
  rooms: [],
  devices: [],
  scenes: [],
  groups: [],
  status: null,
  loading: true,
  refresh: async () => {},
  updateDeviceState: () => {},
});

export const useHomeData = () => useContext(HomeDataContext);

export function HomeDataProvider({ children }: { children: ReactNode }) {
  const { connectionStatus } = useSettings();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<DeviceWithState[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<HomeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const load = useCallback(async () => {
    if (connectionStatus !== "connected") return;
    setLoading(true);
    try {
      const [roomList, deviceList, sceneList, groupList, statusData, rawData] =
        await Promise.all([
          fetchRooms(),
          fetchDevices(),
          fetchScenes(),
          fetchGroups(),
          fetchStatus(),
          fetchDebugRaw(),
        ]);

      setRooms(roomList);
      setScenes(sceneList);
      setGroups(groupList);
      setStatus(statusData);

      // Extract current states from /debug/raw characteristics
      const stateMap = extractDeviceStates(rawData as any);

      const devicesWithState: DeviceWithState[] = deviceList.map((d) => ({
        ...d,
        state: stateMap[`${d.room}/${d.name}`] ?? null,
      }));

      setDevices(devicesWithState);
    } catch (err) {
      console.error("[HomeData] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [connectionStatus]);

  const updateDeviceState = useCallback(
    (room: string, name: string, state: Partial<DeviceState>) => {
      setDevices((prev) =>
        prev.map((d) => {
          if (d.room === room && d.name === name) {
            return {
              ...d,
              state: d.state ? { ...d.state, ...state } : (state as DeviceState),
            };
          }
          return d;
        })
      );
    },
    []
  );

  // Handle incoming SSE device events
  const handleEvent = useCallback((event: DeviceEvent) => {
    const { device, room, characteristic, value } = event;
    const stateUpdate: Partial<DeviceState> = {};

    console.log(`[HomeData] handleEvent: ${room}/${device} ${characteristic}=${value}`);
    switch (characteristic) {
      case "power":
        stateUpdate.on = value === true || value === 1;
        break;
      case "brightness":
        stateUpdate.brightness = Number(value);
        break;
      case "hue":
        stateUpdate.hue = Number(value);
        break;
      case "saturation":
        stateUpdate.saturation = Number(value);
        break;
      default:
        return; // ignore unknown characteristics
    }

    console.log(`[HomeData] event: ${room}/${device} ${characteristic}=${value}`);
    updateDeviceState(room, device, stateUpdate);
  }, [updateDeviceState]);

  const startSSE = useCallback(() => {
    if (connectionStatus !== "connected") return;
    unsubRef.current?.();
    unsubRef.current = subscribeToEvents(
      handleEvent,
      () => {}, // heartbeat — no action needed
      () => {} // error — subscribeToEvents handles reconnect internally
    );
  }, [connectionStatus, handleEvent]);

  const stopSSE = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  // Load on connect
  useEffect(() => {
    load();
  }, [load]);

  // Start SSE on connect
  useEffect(() => {
    if (connectionStatus === "connected") {
      startSSE();
    }
    return stopSSE;
  }, [connectionStatus, startSSE, stopSSE]);

  // Disconnect SSE when app goes to background, reconnect on foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "active" && prev !== "active") {
        // Coming to foreground — reload data and restart SSE
        load();
        startSSE();
      } else if (nextState.match(/inactive|background/)) {
        // Going to background — disconnect SSE
        stopSSE();
      }
    });

    return () => subscription.remove();
  }, [load, startSSE, stopSSE]);

  return (
    <HomeDataContext.Provider
      value={{
        rooms,
        devices,
        scenes,
        groups,
        status,
        loading,
        refresh: load,
        updateDeviceState,
      }}
    >
      {children}
    </HomeDataContext.Provider>
  );
}

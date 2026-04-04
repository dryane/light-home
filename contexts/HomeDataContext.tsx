import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  fetchDeviceInfo,
  fetchDevices,
  fetchGroups,
  fetchRooms,
  fetchScenes,
  fetchStatus,
  subscribeToEvents,
} from "@/utils/api";
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

  const fetchAllDeviceStates = async (deviceList: Device[]) => {
    const results = await Promise.all(
      deviceList.map(async (d) => {
        try {
          const info = await fetchDeviceInfo(d.room, d.name);
          return { room: d.room, name: d.name, state: info.state };
        } catch {
          return { room: d.room, name: d.name, state: null };
        }
      })
    );

    return results;
  };

  const load = useCallback(async () => {
    if (connectionStatus !== "connected") return;
    setLoading(true);
    try {
      const [roomList, deviceList, sceneList, groupList, statusData] =
        await Promise.all([
          fetchRooms(),
          fetchDevices(),
          fetchScenes(),
          fetchGroups(),
          fetchStatus(),
        ]);

      setRooms(roomList);
      setScenes(sceneList);
      setGroups(groupList);
      setStatus(statusData);

      // Fetch state for all reachable devices
      const stateResults = await fetchAllDeviceStates(deviceList);
      const stateMap = new Map(
        stateResults.map((r) => [`${r.room}/${r.name}`, r.state])
      );

      const devicesWithState: DeviceWithState[] = deviceList.map((d) => ({
        ...d,
        state: stateMap.get(`${d.room}/${d.name}`) ?? null,
      }));

      setDevices(devicesWithState);
    } catch (err) {
      console.error("Failed to load home data:", err);
    } finally {
      setLoading(false);
    }
  }, [connectionStatus]);

  // Optimistic local state update — called immediately on user action
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

  // Refresh device states on SSE heartbeat
  const refreshStates = useCallback(async () => {
    if (devices.length === 0) return;
    const stateResults = await fetchAllDeviceStates(devices);
    const stateMap = new Map(
      stateResults.map((r) => [`${r.room}/${r.name}`, r.state])
    );
    setDevices((prev) =>
      prev.map((d) => ({
        ...d,
        state: stateMap.get(`${d.room}/${d.name}`) ?? d.state,
      }))
    );
  }, [devices]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (connectionStatus !== "connected") return;

    unsubRef.current?.();
    unsubRef.current = subscribeToEvents(
      () => refreshStates(),
      () => {} // silent error, reconnect is handled inside subscribeToEvents
    );

    return () => {
      unsubRef.current?.();
    };
  }, [connectionStatus, refreshStates]);

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

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { fetchDebugRaw, probeUrls, setBaseUrl } from "@/utils/api";
import { buildFingerprintFromRaw } from "@/utils/debugRaw";
import { saveFingerprint } from "@/utils/fingerprint";

const LOCAL_URL_KEY = "home:localUrl";
const EXTERNAL_URL_KEY = "home:externalUrl";

type ConnectionStatus = "connecting" | "connected" | "error";
type ConnectionSource = "local" | "external" | null;

interface SettingsContextType {
  localUrl: string;
  externalUrl: string;
  connectionStatus: ConnectionStatus;
  connectionSource: ConnectionSource;
  setLocalUrl: (url: string) => Promise<void>;
  setExternalUrl: (url: string) => Promise<void>;
  reconnect: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  localUrl: "",
  externalUrl: "",
  connectionStatus: "connecting",
  connectionSource: null,
  setLocalUrl: async () => {},
  setExternalUrl: async () => {},
  reconnect: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [localUrl, setLocalUrlState] = useState("");
  const [externalUrl, setExternalUrlState] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [connectionSource, setConnectionSource] =
    useState<ConnectionSource>(null);

  const connect = async (local: string, external: string) => {
    setConnectionStatus("connecting");
    const result = await probeUrls(local, external);
    if (result) {
      setBaseUrl(result.activeUrl);
      setConnectionSource(result.source);
      setConnectionStatus("connected");
      // Auto-sync fingerprint from /debug/raw
      try {
        const raw = await fetchDebugRaw();
        const fp = buildFingerprintFromRaw(raw as any);
        await saveFingerprint(fp);
        console.log("[settings] fingerprint synced from /debug/raw");
      } catch (e) {
        console.log("[settings] fingerprint sync failed:", e);
      }
    } else {
      setConnectionStatus("error");
      setConnectionSource(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      const [local, external] = await Promise.all([
        AsyncStorage.getItem(LOCAL_URL_KEY),
        AsyncStorage.getItem(EXTERNAL_URL_KEY),
      ]);
      const l = local ?? "";
      const e = external ?? "";
      setLocalUrlState(l);
      setExternalUrlState(e);
      if (l || e) await connect(l, e);
      else setConnectionStatus("error");
    };
    init();
  }, []);

  const setLocalUrl = async (url: string) => {
    setLocalUrlState(url);
    await AsyncStorage.setItem(LOCAL_URL_KEY, url);
    await connect(url, externalUrl);
  };

  const setExternalUrl = async (url: string) => {
    setExternalUrlState(url);
    await AsyncStorage.setItem(EXTERNAL_URL_KEY, url);
    await connect(localUrl, url);
  };

  const reconnect = async () => {
    await connect(localUrl, externalUrl);
  };

  return (
    <SettingsContext.Provider
      value={{
        localUrl,
        externalUrl,
        connectionStatus,
        connectionSource,
        setLocalUrl,
        setExternalUrl,
        reconnect,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

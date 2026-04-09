import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { ToggleSwitchGraphic } from "@/components/ToggleSwitchGraphic";
import { useHomeData } from "@/contexts/HomeDataContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { controlOn, controlOff, controlScene } from "@/utils/api";
import { loadFingerprint } from "@/utils/fingerprint";
import { n } from "@/utils/scaling";
import type { Fingerprint, SceneDeviceTarget, SceneStatus } from "@/types";

const TOLERANCE = 5;

function withinTolerance(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return true; // don't penalise missing data
  return Math.abs(a - b) <= TOLERANCE;
}

function deviceMatchesTarget(
  state: { on: boolean; brightness?: number; hue?: number; saturation?: number } | null,
  target: SceneDeviceTarget
): boolean {
  if (!state) return false;
  if (state.on !== target.on) return false;
  if (!withinTolerance(state.brightness, target.brightness)) return false;
  if (!withinTolerance(state.hue, target.hue)) return false;
  if (!withinTolerance(state.saturation, target.saturation)) return false;
  return true;
}

export default function ScenesScreen() {
  const { devices, updateDeviceState } = useHomeData();
  const { invertColors } = useInvertColors();
  const [fingerprint, setFingerprint] = useState<Fingerprint | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFingerprint().then((fp) => {
        if (fp) {
          // Migrate old string[] format to SceneDeviceTarget[] format
          const migratedScenes: typeof fp.scenes = {};
          for (const [name, targets] of Object.entries(fp.scenes)) {
            if (targets.length === 0) {
              migratedScenes[name] = [];
            } else if (typeof targets[0] === 'string') {
              // Old format — convert string keys to minimal targets
              migratedScenes[name] = (targets as unknown as string[]).map((key) => ({ key, on: true }));
            } else {
              migratedScenes[name] = targets;
            }
          }
          setFingerprint({ ...fp, scenes: migratedScenes });
        } else {
          setFingerprint(fp);
        }
        setHasChecked(true);
      });
    }, [])
  );

  const dimColor = invertColors ? "#C1C1C1" : "#6E6E6E";

  const getSceneState = (sceneName: string): {
    status: SceneStatus;
    isOn: boolean;
    summary: string;
    targets: SceneDeviceTarget[];
  } => {
    if (!fingerprint) return { status: "inactive", isOn: false, summary: "not calibrated", targets: [] };
    const targets = fingerprint.scenes[sceneName] ?? [];
    if (targets.length === 0) return { status: "inactive", isOn: false, summary: "tap to trigger", targets: [] };

    const total = targets.length;
    let matchCount = 0;
    let onCount = 0;
    let offCount = 0;

    for (const target of targets) {
      const device = devices.find((d) => `${d.room}/${d.name}` === target.key);
      if (!device?.state) continue;

      if (device.state.on) onCount++;
      else offCount++;

      if (deviceMatchesTarget(device.state, target)) matchCount++;
    }

    const deviceLabel = `${total} device${total !== 1 ? "s" : ""}`;
    const knownCount = onCount + offCount;

    let status: SceneStatus;
    let summary: string;

    if (knownCount === 0) {
      status = "inactive";
      summary = `${deviceLabel} · tap to trigger`;
    } else if (matchCount === total) {
      status = "active";
      summary = `${deviceLabel} · active`;
    } else if (offCount === knownCount) {
      status = "inactive";
      summary = `${deviceLabel} · inactive`;
    } else if (onCount > 0 && offCount > 0) {
      status = "partial";
      summary = `${deviceLabel} · ${onCount} on · ${offCount} off`;
    } else {
      // All on but values don't match scene targets
      status = "modified";
      summary = `${deviceLabel} · modified`;
    }

    const isOn = status === "active";
    return { status, isOn, summary, targets };
  };

  const handleSceneTrigger = async (sceneName: string, targets: SceneDeviceTarget[]) => {
    console.log('[scenes] trigger:', sceneName, 'targets:', targets.length);
    if (targets.length === 0) {
      // No fingerprint — just trigger the scene API
      console.log('[scenes] no targets, calling controlScene');
      await controlScene(sceneName).catch((e) => console.log('[scenes] controlScene error:', e));
      return;
    }

    const memberDevices = devices.filter((d) =>
      targets.some((t) => t.key === `${d.room}/${d.name}`)
    );

    // Scene is active only if ALL devices match their target values
    targets.forEach((target) => {
      const device = memberDevices.find((d) => `${d.room}/${d.name}` === target.key);
      console.log('[scenes] target:', target.key, 'target state:', JSON.stringify(target), 'device state:', JSON.stringify(device?.state), 'matches:', deviceMatchesTarget(device?.state ?? null, target));
    });
    const sceneIsActive = targets.every((target) => {
      const device = memberDevices.find((d) => `${d.room}/${d.name}` === target.key);
      return deviceMatchesTarget(device?.state ?? null, target);
    });

    if (sceneIsActive) {
      // Scene is active — turn everything off
      memberDevices.forEach((d) => updateDeviceState(d.room, d.name, { on: false }));
      try {
        await Promise.all(memberDevices.map((d) => controlOff(d.room, d.name)));
      } catch {
        memberDevices.forEach((d) => updateDeviceState(d.room, d.name, { on: true }));
      }
    } else {
      // Scene not active (off, partial, or modified) — trigger it
      // Optimistically apply full target state so other scenes update correctly
      targets.forEach((target) => {
        const { key, ...state } = target;
        const idx = key.indexOf('/');
        const room = key.slice(0, idx);
        const name = key.slice(idx + 1);
        updateDeviceState(room, name, state);
      });
      try {
        await controlScene(sceneName);
      } catch {
        memberDevices.forEach((d) => updateDeviceState(d.room, d.name, { on: false }));
      }
    }
  };

  const noFingerprint = hasChecked && !fingerprint;

  return (
    <ContentContainer headerTitle="Scenes" hideBackButton contentWidth="wide">
      {noFingerprint && (
        <View style={styles.promptBlock}>
          <StyledText style={styles.promptLabel}>no scene data</StyledText>
          <StyledText style={styles.promptBody}>
            go to settings and tap sync scenes & groups.
          </StyledText>
        </View>
      )}

      {Object.keys(fingerprint?.scenes ?? {}).map((sceneName) => {
        const { isOn, summary, targets } = getSceneState(sceneName);

        return (
          <View key={sceneName} style={styles.sceneRow}>
            <HapticPressable
              onPress={() => handleSceneTrigger(sceneName, targets)}
              style={styles.sceneMain}
            >
              <StyledText style={styles.sceneName}>{sceneName}</StyledText>
              <ToggleSwitchGraphic value={isOn} />
            </HapticPressable>
            <StyledText style={[styles.sceneSub, { color: dimColor }]}>
              {summary}
            </StyledText>
          </View>
        );
      })}
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  sceneRow: {
    width: "100%",
    paddingVertical: n(4),
  },
  sceneMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  sceneName: {
    fontSize: n(28),
  },
  sceneSub: {
    fontSize: n(14),
    paddingTop: n(2),
    opacity: 0.5,
  },
  promptBlock: {
    width: "100%",
    gap: n(8),
  },
  promptLabel: {
    fontSize: n(14),
    opacity: 0.4,
  },
  promptBody: {
    fontSize: n(20),
    opacity: 0.6,
    lineHeight: n(28),
  },
  promptAction: {
    fontSize: n(28),
  },
});

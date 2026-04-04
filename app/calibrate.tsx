import { useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useHomeData } from "@/contexts/HomeDataContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { controlGroupOff, controlGroupOn, controlScene } from "@/utils/api";
import { runCalibration, type CalibrationStep } from "@/utils/fingerprint";
import { n } from "@/utils/scaling";

type CalibrationStatus = "idle" | "running" | "done" | "error";

export default function CalibrateScreen() {
  const { scenes, groups, refresh } = useHomeData();
  const { invertColors } = useInvertColors();

  const [status, setStatus] = useState<CalibrationStatus>("idle");
  const [currentLabel, setCurrentLabel] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const progressAnim = useRef(new Animated.Value(0)).current;
  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#C1C1C1" : "#6E6E6E";

  const totalCalibrationSteps = scenes.length + groups.length + 1;

  const animateProgress = (index: number, total: number) => {
    const pct = total > 0 ? index / total : 0;
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const startCalibration = async () => {
    setStatus("running");
    setStepIndex(0);
    setTotalSteps(totalCalibrationSteps);
    progressAnim.setValue(0);

    // Scenes: ItsyHome only has a toggle endpoint for scenes (/scene/<name>).
    // To get an ON state: trigger once. To get OFF: trigger again (toggle).
    // Cycle: trigger(on) → wait → trigger(off) → wait → trigger(on) → wait
    const sceneItems = scenes.map((s) => ({
      name: s.name,
      triggerOn: () => controlScene(s.name),
      triggerOff: () => controlScene(s.name),
    }));

    // Groups: controlled directly by group name, no room prefix
    const groupItems = groups.map((g) => ({
      name: g.name,
      triggerOn: () => controlGroupOn(g.name),
      triggerOff: () => controlGroupOff(g.name),
    }));

    await runCalibration(sceneItems, groupItems, {
      onStepStart: (step: CalibrationStep, index: number, total: number) => {
        setStepIndex(index);
        setTotalSteps(total);
        animateProgress(index, total);

        if (step.kind === "scene") {
          setCurrentLabel(`Scene · ${step.name}`);
        } else if (step.kind === "group") {
          setCurrentLabel(`Group · ${step.name}`);
        } else {
          setCurrentLabel("Restoring devices");
        }
      },
      onStepDone: () => {},
      onComplete: async () => {
        animateProgress(1, 1);
        setCurrentLabel("Done");
        setStatus("done");
        await refresh();
      },
      onError: (err: Error) => {
        setStatus("error");
        setErrorMessage(err.message);
      },
    });
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <ContentContainer headerTitle="Calibrate" contentWidth="wide">
      {status === "idle" && (
        <>
          <StyledText style={styles.body}>
            the app will cycle each scene and group on and off to learn which
            devices belong to each.{"\n\n"}
            your lights will flash briefly. this takes around{" "}
            {Math.round((scenes.length * 20) + (groups.length * 10) + 5)} seconds.
          </StyledText>
          <HapticPressable onPress={startCalibration}>
            <StyledText style={styles.action}>start</StyledText>
          </HapticPressable>
          <HapticPressable onPress={() => router.back()}>
            <StyledText style={[styles.action, { color: dimColor }]}>
              cancel
            </StyledText>
          </HapticPressable>
        </>
      )}

      {status === "running" && (
        <>
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: invertColors ? "#E0E0E0" : "#1a1a1a" },
              ]}
            >
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: progressWidth, backgroundColor: textColor },
                ]}
              />
            </View>
            <StyledText style={[styles.progressCount, { color: dimColor }]}>
              {stepIndex + 1} / {totalSteps}
            </StyledText>
          </View>
          <StyledText style={styles.currentLabel}>{currentLabel}</StyledText>
        </>
      )}

      {status === "done" && (
        <>
          <StyledText style={styles.body}>calibration complete.</StyledText>
          <HapticPressable onPress={() => router.back()}>
            <StyledText style={styles.action}>done</StyledText>
          </HapticPressable>
        </>
      )}

      {status === "error" && (
        <>
          <StyledText style={styles.body}>
            something went wrong.{"\n\n"}{errorMessage}
          </StyledText>
          <HapticPressable onPress={startCalibration}>
            <StyledText style={styles.action}>try again</StyledText>
          </HapticPressable>
          <HapticPressable onPress={() => router.back()}>
            <StyledText style={[styles.action, { color: dimColor }]}>
              cancel
            </StyledText>
          </HapticPressable>
        </>
      )}
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: n(22),
    lineHeight: n(32),
    opacity: 0.7,
  },
  action: {
    fontSize: n(30),
  },
  progressContainer: {
    width: "100%",
    gap: n(8),
  },
  progressTrack: {
    width: "100%",
    height: n(2),
    borderRadius: n(1),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: n(1),
  },
  progressCount: {
    fontSize: n(14),
  },
  currentLabel: {
    fontSize: n(28),
  },
});

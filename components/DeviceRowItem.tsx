import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { HapticPressable } from "@/components/HapticPressable";
import { LightSlider } from "@/components/LightSlider";
import { StyledText } from "@/components/StyledText";
import { ToggleSwitchGraphic } from "@/components/ToggleSwitchGraphic";
import { useHomeData } from "@/contexts/HomeDataContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import {
  controlBrightness,
  controlColor,
  controlOff,
  controlOn,
} from "@/utils/api";
import { warmCoolToHueSaturation, hueSaturationToWarmCool } from "@/utils/colorMapping";
import { n } from "@/utils/scaling";
import type { DeviceRow } from "@/types";

interface Props {
  row: DeviceRow;
}

export function DeviceRowItem({ row }: Props) {
  const { updateDeviceState } = useHomeData();
  const { invertColors } = useInvertColors();
  const device = row.device!;
  const state = device.state;
  const isOn = state?.on ?? false;
  const brightness = state?.brightness ?? 50;
  const warmCool = hueSaturationToWarmCool(state?.hue ?? 0, state?.saturation ?? 0);
  const isLight = device.type === "light";
  const hasColor = isLight && state?.hue !== undefined;

  const [expanded, setExpanded] = useState(false);

  const iconColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#C1C1C1" : "#6E6E6E";

  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = async () => {
    const next = !isOn;
    updateDeviceState(device.room, device.name, { on: next });
    try {
      if (next) await controlOn(device.room, device.name);
      else await controlOff(device.room, device.name);
    } catch {
      updateDeviceState(device.room, device.name, { on: isOn });
    }
  };

  const handleLabelPress = () => {
    if (isLight) setExpanded((v) => !v);
    else handleToggle();
  };

  const handleBrightnessChange = (value: number) => {
    updateDeviceState(device.room, device.name, { brightness: value });
  };

  const handleBrightnessComplete = (value: number) => {
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current);
    brightnessTimer.current = setTimeout(() => {
      controlBrightness(device.room, device.name, value).catch(() => {});
    }, 100);
  };

  const handleWarmCoolChange = (value: number) => {
    const { hue, saturation } = warmCoolToHueSaturation(value);
    updateDeviceState(device.room, device.name, { hue, saturation });
  };

  const handleWarmCoolComplete = (value: number) => {
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(() => {
      const { hue, saturation } = warmCoolToHueSaturation(value);
      controlColor(device.room, device.name, hue, saturation).catch(() => {});
    }, 100);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainRow}>
        <HapticPressable onPress={handleLabelPress} style={styles.left}>
          <MaterialIcons
            name={device.type === "light" ? "lightbulb" : "power"}
            size={n(18)}
            color={iconColor}
          />
          <StyledText style={styles.name}>{device.name}</StyledText>
        </HapticPressable>
        <HapticPressable onPress={handleToggle} style={styles.toggleHit}>
          <ToggleSwitchGraphic value={isOn} />
        </HapticPressable>
      </View>

      {isLight && expanded && (
        <View style={styles.sliders}>
          <StyledText style={[styles.sliderLabel, { color: dimColor }]}>brightness</StyledText>
          <LightSlider
            value={brightness}
            onValueChange={handleBrightnessChange}
            onSlidingComplete={handleBrightnessComplete}
          />
          {hasColor && (
            <>
              <StyledText style={[styles.sliderLabel, { color: dimColor }]}>warm — cool</StyledText>
              <LightSlider
                value={warmCool}
                onValueChange={handleWarmCoolChange}
                onSlidingComplete={handleWarmCoolComplete}
                trackColorLeft="#c8712a"
                trackColorRight="#8899cc"
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingVertical: n(6),
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: n(10),
    flex: 1,
  },
  name: {
    fontSize: n(28),
    flex: 1,
  },
  sliders: {
    paddingTop: n(8),
    paddingLeft: n(28),
    paddingRight: n(20),
    gap: n(2),
  },
  sliderLabel: {
    fontSize: n(12),
  },
  toggleHit: {
    padding: n(16),
    marginRight: n(-16),
  },
});

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
  controlOn,
  controlOff,
  controlMembersBrightness,
  controlMembersColor,
} from "@/utils/api";
import { warmCoolToHueSaturation, hueSaturationToWarmCool } from "@/utils/colorMapping";
import { n } from "@/utils/scaling";
import type { DeviceRow } from "@/types";

interface Props {
  row: DeviceRow;
}

export function GroupRowItem({ row }: Props) {
  const { updateDeviceState } = useHomeData();
  const { invertColors } = useInvertColors();
  const members = row.members ?? [];
  const iconColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#C1C1C1" : "#6E6E6E";

  const isOn = members.length > 0 && members.every((m) => m.state?.on === true);
  const lightMember = members.find((m) => m.type === "light");
  const brightness = lightMember?.state?.brightness ?? 50;
  const warmCool = hueSaturationToWarmCool(
    lightMember?.state?.hue ?? 0,
    lightMember?.state?.saturation ?? 0
  );
  const isAllLights = row.type === "light";
  const hasColor = isAllLights && lightMember?.state?.hue !== undefined;

  const [expanded, setExpanded] = useState(false);

  const lightMemberArgs = members
    .filter((m) => m.type === "light")
    .map((m) => ({ room: m.room, name: m.name }));

  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = async () => {
    const next = !isOn;
    members.forEach((m) => updateDeviceState(m.room, m.name, { on: next }));
    try {
      await Promise.all(
        members.map((m) => next ? controlOn(m.room, m.name) : controlOff(m.room, m.name))
      );
    } catch {
      members.forEach((m) => updateDeviceState(m.room, m.name, { on: isOn }));
    }
  };

  const handleLabelPress = () => {
    if (isAllLights) setExpanded((v) => !v);
    else handleToggle();
  };

  const handleBrightnessChange = (value: number) => {
    members.forEach((m) => updateDeviceState(m.room, m.name, { brightness: value }));
  };

  const handleBrightnessComplete = (value: number) => {
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current);
    brightnessTimer.current = setTimeout(() => {
      controlMembersBrightness(lightMemberArgs, value).catch(() => {});
    }, 100);
  };

  const handleWarmCoolChange = (value: number) => {
    const { hue, saturation } = warmCoolToHueSaturation(value);
    members.forEach((m) => updateDeviceState(m.room, m.name, { hue, saturation }));
  };

  const handleWarmCoolComplete = (value: number) => {
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(() => {
      const { hue, saturation } = warmCoolToHueSaturation(value);
      controlMembersColor(lightMemberArgs, hue, saturation).catch(() => {});
    }, 100);
  };

  const iconName =
    row.type === "light" ? "lightbulb" :
    row.type === "outlet" ? "power" :
    "devices";

  return (
    <View style={styles.container}>
      <View style={styles.mainRow}>
        <HapticPressable onPress={handleLabelPress} style={styles.left}>
          <MaterialIcons name={iconName} size={n(18)} color={iconColor} />
          <StyledText style={styles.name}>{row.name}</StyledText>
        </HapticPressable>
        <HapticPressable onPress={handleToggle} style={styles.toggleHit}>
          <ToggleSwitchGraphic value={isOn} />
        </HapticPressable>
      </View>

      {isAllLights && expanded && (
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

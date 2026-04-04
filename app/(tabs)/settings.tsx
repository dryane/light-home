import { useRef, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useSettings } from "@/contexts/SettingsContext";
import { getBaseUrl } from "@/utils/api";
import { n } from "@/utils/scaling";

export default function SettingsScreen() {
  const { invertColors, setInvertColors } = useInvertColors();
  const {
    localUrl,
    externalUrl,
    connectionStatus,
    connectionSource,
    setLocalUrl,
    setExternalUrl,
  } = useSettings();

  const [localDraft, setLocalDraft] = useState(localUrl);
  const [externalDraft, setExternalDraft] = useState(externalUrl);

  const textColor = invertColors ? "black" : "white";
  const dimColor = invertColors ? "#C1C1C1" : "#6E6E6E";
  const bgColor = invertColors ? "white" : "black";

  const handleLocalSubmit = () => {
    setLocalUrl(localDraft.trim());
  };

  const handleExternalSubmit = () => {
    setExternalUrl(externalDraft.trim());
  };

  const statusText =
    connectionStatus === "connecting"
      ? "connecting"
      : connectionStatus === "error"
      ? "not connected"
      : `${connectionSource} · ${getBaseUrl()}`;

  return (
    <ContentContainer headerTitle="Settings" hideBackButton contentWidth="wide">

      <View style={styles.section}>
        <StyledText style={[styles.sectionLabel, { color: dimColor }]}>
          connection
        </StyledText>

        <View style={styles.field}>
          <StyledText style={[styles.fieldLabel, { color: dimColor }]}>
            local url
          </StyledText>
          <View style={[styles.inputRow, { borderBottomColor: dimColor }]}>
            <TextInput
              style={[styles.input, { color: textColor }]}
              value={localDraft}
              onChangeText={setLocalDraft}
              onSubmitEditing={handleLocalSubmit}
              onBlur={handleLocalSubmit}
              placeholder="192.168.x.x:8423"
              placeholderTextColor={dimColor}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              allowFontScaling={false}
              selectionColor={textColor}
              cursorColor={textColor}
            />
          </View>
        </View>

        <View style={styles.field}>
          <StyledText style={[styles.fieldLabel, { color: dimColor }]}>
            external url
          </StyledText>
          <View style={[styles.inputRow, { borderBottomColor: dimColor }]}>
            <TextInput
              style={[styles.input, { color: textColor }]}
              value={externalDraft}
              onChangeText={setExternalDraft}
              onSubmitEditing={handleExternalSubmit}
              onBlur={handleExternalSubmit}
              placeholder="myhome.example.com"
              placeholderTextColor={dimColor}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              allowFontScaling={false}
              selectionColor={textColor}
              cursorColor={textColor}
            />
          </View>
        </View>

        <StyledText style={[styles.status, { color: dimColor }]}>
          {statusText}
        </StyledText>
      </View>

      <View style={styles.section}>
        <StyledText style={[styles.sectionLabel, { color: dimColor }]}>
          scenes
        </StyledText>
        <HapticPressable onPress={() => router.push("/calibrate")}>
          <StyledText style={styles.action}>calibrate scenes</StyledText>
        </HapticPressable>
        <StyledText style={[styles.hint, { color: dimColor }]}>
          lights will flash during calibration
        </StyledText>
      </View>

      <View style={styles.section}>
        <StyledText style={[styles.sectionLabel, { color: dimColor }]}>
          display
        </StyledText>
        <ToggleSwitch
          label="invert colours"
          value={invertColors}
          onValueChange={setInvertColors}
        />
      </View>

    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
    gap: n(10),
  },
  sectionLabel: {
    fontSize: n(14),
    opacity: 0.5,
  },
  field: {
    gap: n(4),
  },
  fieldLabel: {
    fontSize: n(14),
  },
  inputRow: {
    borderBottomWidth: n(1),
    paddingBottom: n(4),
  },
  input: {
    fontSize: n(24),
    fontFamily: "PublicSans-Regular",
    paddingVertical: n(2),
  },
  status: {
    fontSize: n(18),
  },
  action: {
    fontSize: n(28),
  },
  hint: {
    fontSize: n(14),
    opacity: 0.4,
  },
});

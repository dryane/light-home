import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type ViewStyle } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

interface LightSliderProps {
  value: number;           // 0–100
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  style?: ViewStyle;
  trackColorLeft?: string;
  trackColorRight?: string;
}

const THUMB_SIZE = n(12);
const TRACK_HEIGHT = n(2);

export function LightSlider({
  value,
  onValueChange,
  onSlidingComplete,
  style,
  trackColorLeft,
  trackColorRight,
}: LightSliderProps) {
  const { invertColors } = useInvertColors();
  const defaultTrack = invertColors ? "#C1C1C1" : "#3a3a3a";
  const activeColor = invertColors ? "black" : "white";

  const leftColor = trackColorLeft ?? activeColor;
  const rightColor = trackColorRight ?? defaultTrack;

  const trackWidth = useRef(0);
  const [localValue, setLocalValue] = useState(value);

  // Keep local in sync when parent changes (e.g. SSE refresh)
  // but don't override while dragging
  const isDragging = useRef(false);
  const displayValue = isDragging.current ? localValue : value;

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        const x = evt.nativeEvent.locationX;
        const next = clamp(Math.round((x / trackWidth.current) * 100));
        setLocalValue(next);
        onValueChange?.(next);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const next = clamp(Math.round((x / trackWidth.current) * 100));
        setLocalValue(next);
        onValueChange?.(next);
      },
      onPanResponderRelease: (evt) => {
        const x = evt.nativeEvent.locationX;
        const next = clamp(Math.round((x / trackWidth.current) * 100));
        setLocalValue(next);
        onSlidingComplete?.(next);
        isDragging.current = false;
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
      },
    })
  ).current;

  const pct = displayValue / 100;
  const thumbOffset = pct; // 0–1, used as flex ratio

  return (
    <View
      style={[styles.hitArea, style]}
      {...panResponder.panHandlers}
      onLayout={(e) => {
        trackWidth.current = e.nativeEvent.layout.width;
      }}
    >
      <View style={styles.trackContainer}>
        {/* Left fill */}
        <View
          style={[
            styles.trackFill,
            { flex: pct, backgroundColor: leftColor },
          ]}
        />
        {/* Thumb */}
        <View
          style={[
            styles.thumb,
            { backgroundColor: activeColor },
          ]}
        />
        {/* Right fill */}
        <View
          style={[
            styles.trackFill,
            { flex: 1 - pct, backgroundColor: rightColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Tall hit area for easy touch
  hitArea: {
    width: "100%",
    height: n(32),
    justifyContent: "center",
  },
  trackContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: TRACK_HEIGHT,
  },
  trackFill: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    marginHorizontal: -(THUMB_SIZE / 2),
    zIndex: 1,
  },
});

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
  const trackPageX = useRef(0);
  const isDragging = useRef(false);
  const startValue = useRef(0);
  const startPageX = useRef(0);
  const [localValue, setLocalValue] = useState(value);

  const displayValue = isDragging.current ? localValue : value;

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const SNAP_POINTS = [0, 25, 50, 75, 100];
  const SNAP_THRESHOLD = 4; // snap if within 4 units

  const pageXToValue = (pageX: number): number => {
    const x = pageX - trackPageX.current;
    const raw = clamp((x / trackWidth.current) * 100);
    const rounded = Math.round(raw);

    // Snap to nearest snap point if within threshold
    for (const point of SNAP_POINTS) {
      if (Math.abs(raw - point) <= SNAP_THRESHOLD) {
        return point;
      }
    }
    return rounded;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        startPageX.current = evt.nativeEvent.pageX;
        startValue.current = value;
        const next = pageXToValue(evt.nativeEvent.pageX);
        setLocalValue(next);
        onValueChange?.(next);
      },
      onPanResponderMove: (evt) => {
        const next = pageXToValue(evt.nativeEvent.pageX);
        setLocalValue(next);
        onValueChange?.(next);
      },
      onPanResponderRelease: (evt) => {
        const next = pageXToValue(evt.nativeEvent.pageX);
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

  return (
    <View
      style={[styles.hitArea, style]}
      {...panResponder.panHandlers}
      onLayout={(e) => {
        trackWidth.current = e.nativeEvent.layout.width;
        // Measure absolute page position for accurate touch mapping
        (e.target as any)?.measure?.(
          (_x: number, _y: number, _w: number, _h: number, pageX: number) => {
            trackPageX.current = pageX;
          }
        );
      }}
    >
      {/* Tick lines behind the track */}
      <View style={styles.tickRow} pointerEvents="none">
        {[0, 25, 50, 75, 100].map((point) => (
          <View
            key={point}
            style={[
              styles.tick,
              { left: `${point}%` as any },
            ]}
          />
        ))}
      </View>
      <View style={styles.trackContainer}>
        <View style={[styles.trackFill, { flex: pct, backgroundColor: leftColor }]} />
        <View style={[styles.thumb, { backgroundColor: activeColor }]} />
        <View style={[styles.trackFill, { flex: 1 - pct, backgroundColor: rightColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    width: "100%",
    height: n(44),
    justifyContent: "center",
    position: "relative",
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
  tickRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  tick: {
    position: "absolute",
    width: n(1),
    height: n(8),
    backgroundColor: "#3a3a3a",
    marginLeft: -n(0.5),
  },
});

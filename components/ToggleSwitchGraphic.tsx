import { StyleSheet, View } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

const CIRCLE_DIAMETER = n(9.8);
const CIRCLE_BORDER = n(2.5);
const LINE_WIDTH = n(14.5);
const LINE_HEIGHT = n(2.22);

interface Props {
  value: boolean;
}

export function ToggleSwitchGraphic({ value }: Props) {
  const { invertColors } = useInvertColors();
  const switchColor = invertColors ? "black" : "white";

  return (
    <View style={styles.container}>
      {value ? (
        <>
          <View style={[styles.line, { backgroundColor: switchColor }]} />
          <View style={[styles.circle, { backgroundColor: switchColor }]} />
        </>
      ) : (
        <>
          <View style={[styles.hollowCircle, { borderColor: switchColor }]} />
          <View style={[styles.line, { backgroundColor: switchColor }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  circle: {
    width: CIRCLE_DIAMETER,
    height: CIRCLE_DIAMETER,
    borderRadius: CIRCLE_DIAMETER / 2,
  },
  hollowCircle: {
    width: CIRCLE_DIAMETER,
    height: CIRCLE_DIAMETER,
    borderRadius: CIRCLE_DIAMETER / 2,
    borderWidth: CIRCLE_BORDER,
  },
  line: {
    width: LINE_WIDTH,
    height: LINE_HEIGHT,
  },
});

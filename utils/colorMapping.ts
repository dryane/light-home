// Warm/cool slider (0 = warm, 50 = neutral, 100 = cool)
// Based on real bulb measurements:
//   Warm: hue 30, saturation 67
//   Neutral: hue 0, saturation 0
//   Cool: hue 251, saturation 5

export function warmCoolToHueSaturation(value: number): {
  hue: number;
  saturation: number;
} {
  if (value === 50) {
    return { hue: 0, saturation: 0 };
  }

  if (value < 50) {
    // Warm side: 0 (warmest) → 50 (neutral)
    const t = 1 - value / 50; // 1 at warmest, 0 at neutral
    return {
      hue: Math.round(30 * t),
      saturation: Math.round(67 * t),
    };
  }

  // Cool side: 50 (neutral) → 100 (coolest)
  const t = (value - 50) / 50; // 0 at neutral, 1 at coolest
  return {
    hue: Math.round(251 * t),
    saturation: Math.round(5 * t),
  };
}

// Reverse: given hue + saturation, return slider value 0–100
export function hueSaturationToWarmCool(hue: number, saturation: number): number {
  if (saturation === 0) return 50;

  // Warm side: hue 0–40, saturation > 5
  if (hue <= 40 && saturation > 5) {
    const t = saturation / 67;
    return Math.round(50 - t * 50);
  }

  // Cool side: hue 200–360, low saturation
  if (hue > 200) {
    const t = hue / 251;
    return Math.round(50 + Math.min(t, 1) * 50);
  }

  return 50;
}

// Maps a warm/cool slider value (0 = warm, 100 = cool) to hue + saturation.
// We keep saturation low so it reads as white light, not coloured.
// Warm end: hue ~30 (amber), saturation ~15
// Cool end: hue ~210 (blue-white), saturation ~10
// Centre: neutral white (saturation 0)

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
      saturation: Math.round(15 * t),
    };
  }

  // Cool side: 50 (neutral) → 100 (coolest)
  const t = (value - 50) / 50; // 0 at neutral, 1 at coolest
  return {
    hue: Math.round(210 * t),
    saturation: Math.round(10 * t),
  };
}

// Reverse: given hue + saturation from device state, return slider value 0–100
export function hueSaturationToWarmCool(hue: number, saturation: number): number {
  if (saturation === 0) return 50;

  // Determine if warm (hue 0–90) or cool (hue 150–270)
  if (hue <= 90) {
    // Warm
    const t = hue / 30;
    return Math.round(50 - t * 50);
  }

  // Cool
  const t = hue / 210;
  return Math.round(50 + t * 50);
}

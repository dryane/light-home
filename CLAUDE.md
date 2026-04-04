# Home — Apple HomeKit controller for Light Phone 3

Expo + React Native app using the light-template as its base.
Controls Apple Home devices via the ItsyHome web API.

## Rules

- **No layout transitions or animations** — the Light Phone 3 is intentionally minimal.
  The only exception is the calibration progress bar (`Animated.timing` on fill width).
- Use `n()` for all numeric style values (normalises for screen density).
- Use `bun` not npm.
- Font is `PublicSans-Regular` only. One weight.
- Colours: black bg, white text, `#6E6E6E` muted. Respect `invertColors` context.
- No cards, no borders, no shadows. Everything floats on the background.
- Minimise `useEffect`. Prefer derived state.
- Readable code > comments.

## Commands

```
bunx expo run:android     # Build and run on device
bun start                 # Dev server
bun run sync-version      # Sync version from app.json
```

## Architecture

```
contexts/
  SettingsContext    — local/external URLs, connection status, probing
  HomeDataContext    — devices, rooms, scenes, groups, SSE live state
  InvertColorsContext — black/white theme toggle (from template)

utils/
  api.ts            — all HTTP calls to ItsyHome
  fingerprint.ts    — calibration logic, snapshot/restore
  colorMapping.ts   — warm/cool slider ↔ hue/saturation

types/index.ts      — all shared types

app/(tabs)/
  index.tsx         — Rooms tab
  scenes.tsx        — Scenes tab
  settings.tsx      — Settings tab

app/
  calibrate.tsx     — Full-screen calibration flow

components/
  DeviceRowItem     — single device row (toggle + sliders)
  GroupRowItem      — group row (controls all members)
  ToggleSwitchGraphic — the ○—/●— toggle icon (reusable)
```

## API

ItsyHome web API at configurable local/external URL.
- Local URL is primary, external is fallback.
- No authentication.
- SSE at `/events` for live heartbeat — triggers device state refresh.
- Control via GET: `/on/<room>/<device>`, `/off/...`, `/brightness/<0-100>/...`, `/color/<hue>/<sat>/...`

## Fingerprinting

Calibration discovers which devices belong to which scene/group by
cycling each item on→off→on and watching which devices respond.

- Scenes fingerprinted first (don't contribute to confirmedDevices pool)
- Groups fingerprinted sequentially; each confirmed device excluded from subsequent group deltas
- All devices restored to pre-calibration state after completion
- Stored in AsyncStorage as `home:fingerprint`

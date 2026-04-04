# Light Home

A minimal Apple HomeKit controller for the Light Phone 3, built on the [light-template](https://github.com/vandamd/light-template).

Controls HomeKit devices via the [ItsyHome](https://github.com/nickustinov/itsyhome-macos) macOS web API.

## Features

- **Rooms** — devices grouped by room, with smart group detection via calibration
- **Scenes** — trigger HomeKit scenes, with accurate active/inactive/modified/partial status
- **Settings** — local URL (primary) + external URL (fallback), connection status
- **Calibration** — automatic device-to-scene and device-to-group fingerprinting

## How it works

### Connection
The app connects to ItsyHome's local web API. It tries the local URL first and falls back to the external URL if unreachable. Both are configurable in Settings.

### Calibration
Since the ItsyHome API doesn't expose scene or group membership, the app discovers it automatically:

**Scenes** — for each scene, all devices are turned off, the scene is triggered, and any device that turns on is recorded as a member. This runs twice and the results are intersected for reliability. After membership is confirmed, the scene is triggered once more and the exact brightness, hue, and saturation values are captured as targets.

**Groups** — each group is toggled on/off/on while polling device states. Devices that respond consistently are recorded as members. Groups are fingerprinted sequentially and devices are restored between each run to prevent cross-contamination.

All devices are restored to their original state after calibration completes.

### Scene status
Scenes show one of four states based on comparing current device state to fingerprinted targets (±5 tolerance):
- **active** — all devices match the scene's target values
- **inactive** — all devices off
- **modified** — devices are on but values differ from scene targets (e.g. brightness changed manually)
- **partial** — mix of on and off devices

Tapping a scene triggers it if not active, or turns all devices off if active.

### Groups
Devices belonging to the same fingerprinted group are rendered as a single row in the Rooms tab. The group icon reflects the device type — lightbulb for lights, plug for outlets, and a devices icon for mixed groups.

## Setup

1. Install [ItsyHome](https://github.com/nickustinov/itsyhome-macos) on your Mac and start the web server
2. Build and install the app (see Commands below)
3. Open Settings and enter your local URL (e.g. `192.168.1.x:8423`)
4. Go to Settings → Calibrate Scenes — your lights will flash briefly
5. Navigate to Rooms and Scenes — everything should be grouped and labelled correctly

## Commands

```bash
bunx expo run:android          # Build and run debug on connected device
bunx expo start                # Start Metro bundler
cd android && ./gradlew assembleRelease  # Build release APK
bun run sync-version           # Sync version from app.json
```

## Tech stack

- [Expo](https://expo.dev) SDK 55 + React Native 0.83
- [Expo Router](https://expo.github.io/router) for navigation
- [light-template](https://github.com/vandamd/light-template) for design system
- TypeScript throughout
- AsyncStorage for fingerprint persistence
- Pure JS slider (PanResponder) — no native slider dependency

## Notes

- The app ignores the `reachable` flag from the ItsyHome API — many devices report as unreachable even when they respond to commands, particularly Zigbee/Z-Wave devices bridged through HomeKit
- Release builds require `android:usesCleartextTraffic="true"` in the Android manifest since ItsyHome runs over HTTP
- No authentication — the ItsyHome API is open on the local network

import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { StyledText } from "@/components/StyledText";
import { DeviceRowItem } from "@/components/DeviceRowItem";
import { GroupRowItem } from "@/components/GroupRowItem";
import { useHomeData } from "@/contexts/HomeDataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { loadFingerprint } from "@/utils/fingerprint";
import { n } from "@/utils/scaling";
import type { DeviceRow, DeviceWithState, Fingerprint, Group } from "@/types";

function buildRoomRows(
  devices: DeviceWithState[],
  groups: Group[],
  fingerprint: Fingerprint | null
): Record<string, DeviceRow[]> {
  const groupMembership: Record<string, string> = {};

  if (fingerprint) {
    for (const [groupName, keys] of Object.entries(fingerprint.groups)) {
      for (const key of keys) {
        groupMembership[key] = groupName;
      }
    }
  }

  const roomMap: Record<string, DeviceRow[]> = {};
  const addedGroups = new Set<string>();

  for (const device of devices) {
    const key = `${device.room}/${device.name}`;
    const groupName = groupMembership[key];

    if (!roomMap[device.room]) roomMap[device.room] = [];

    if (groupName && !addedGroups.has(groupName)) {
      const memberKeys = fingerprint?.groups[groupName] ?? [];
      const members = devices.filter((d) =>
        memberKeys.includes(`${d.room}/${d.name}`)
      );
      const allSameType = members.every((m) => m.type === members[0]?.type);
      const type = allSameType ? (members[0]?.type ?? "mixed") : "mixed";
      const reachable = true;

      roomMap[device.room].push({
        key: `group:${groupName}`,
        kind: "group",
        name: groupName,
        room: device.room,
        type,
        reachable,
        groupName,
        members,
      });
      addedGroups.add(groupName);
    } else if (!groupName) {
      roomMap[device.room].push({
        key: `device:${key}`,
        kind: "device",
        name: device.name,
        room: device.room,
        type: device.type,
        reachable: device.reachable,
        device,
      });
    }
  }

  return roomMap;
}

export default function RoomsScreen() {
  const { rooms, devices, groups, loading } = useHomeData();
  const { connectionStatus } = useSettings();
  const [fingerprint, setFingerprint] = useState<Fingerprint | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadFingerprint().then(setFingerprint);
    }, [])
  );

  const roomRows = buildRoomRows(devices, groups, fingerprint);

  if (connectionStatus === "error") {
    return (
      <ContentContainer headerTitle="Home" hideBackButton>
        <StyledText style={styles.muted}>not connected</StyledText>
        <StyledText style={styles.hint}>add a url in settings</StyledText>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer headerTitle="Home" hideBackButton contentWidth="wide">
      {loading ? (
        <StyledText style={styles.muted}>loading</StyledText>
      ) : (
        rooms.map((room) => {
          const rows = roomRows[room.name] ?? [];
          if (rows.length === 0) return null;
          return (
            <View key={room.name} style={styles.roomSection}>
              <StyledText style={styles.roomLabel}>
                {room.name.toLowerCase()}
              </StyledText>
              {rows.map((row) =>
                row.kind === "group" ? (
                  <GroupRowItem key={row.key} row={row} />
                ) : (
                  <DeviceRowItem key={row.key} row={row} />
                )
              )}
            </View>
          );
        })
      )}
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  roomSection: {
    width: "100%",
    gap: n(4),
  },
  roomLabel: {
    fontSize: n(14),
    opacity: 0.4,
    paddingBottom: n(4),
  },
  muted: {
    fontSize: n(24),
    opacity: 0.4,
  },
  hint: {
    fontSize: n(18),
    opacity: 0.25,
  },
});

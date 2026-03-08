import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  type: string;
  metadata?: { latitude?: number; longitude?: number } | null;
  isRead?: boolean;
  createdAt?: string;
}

interface Props {
  message: Message;
  isMe: boolean;
  showTime?: boolean;
}

export function MessageBubble({ message, isMe, showTime = true }: Props) {
  const { theme } = useTheme();

  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  if (message.type === "location" && message.metadata?.latitude) {
    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
        <View style={[
          styles.locationBubble,
          { backgroundColor: isMe ? theme.bubbleMe : theme.bubbleThem }
        ]}>
          <Ionicons name="location" size={20} color={isMe ? theme.bubbleMeText : theme.tint} />
          <View style={styles.locationTextGroup}>
            <Text style={[styles.locationTitle, { color: isMe ? theme.bubbleMeText : theme.text }]}>
              Location Shared
            </Text>
            <Text style={[styles.locationCoords, { color: isMe ? `${theme.bubbleMeText}AA` : theme.textSecondary }]}>
              {message.metadata.latitude?.toFixed(4)}, {message.metadata.longitude?.toFixed(4)}
            </Text>
          </View>
        </View>
        {showTime && (
          <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem, { color: theme.textMuted }]}>{time}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View style={[
        styles.bubble,
        isMe
          ? [styles.bubbleMe, { backgroundColor: theme.bubbleMe }]
          : [styles.bubbleThem, { backgroundColor: theme.bubbleThem }],
      ]}>
        <Text style={[styles.text, { color: isMe ? theme.bubbleMeText : theme.bubbleThemText }]}>
          {message.content}
        </Text>
      </View>
      {showTime && (
        <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem, { color: theme.textMuted }]}>{time}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 2, paddingHorizontal: 12, maxWidth: "80%" },
  rowMe: { alignSelf: "flex-end", alignItems: "flex-end" },
  rowThem: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 20, fontFamily: "Inter_400Regular" },
  time: { fontSize: 11, marginTop: 3, fontFamily: "Inter_400Regular" },
  timeMe: { textAlign: "right" },
  timeThem: { textAlign: "left" },
  locationBubble: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomRightRadius: 4,
  },
  locationTextGroup: { flexDirection: "column" },
  locationTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  locationCoords: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});

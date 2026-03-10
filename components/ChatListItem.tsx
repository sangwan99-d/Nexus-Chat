import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface ConversationItem {
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
    lastSeen?: string | null;
  };
  lastMessage?: {
    content: string;
    type: string;
    createdAt?: string;
    fromUserId: string;
  } | null;
  isAI?: boolean;
  unreadCount?: number;
}

interface Props {
  item: ConversationItem;
  currentUserId: string;
  onPress: () => void;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getLastMessagePreview(msg: ConversationItem["lastMessage"], isMe: boolean) {
  if (!msg) return "No messages yet";
  const prefix = isMe ? "You: " : "";
  if (msg.type === "location") return `${prefix}Shared a location`;
  if (msg.type === "image") return `${prefix}Sent a photo`;
  if (msg.type === "video") return `${prefix}Sent a video`;
  if (msg.type === "file") return `${prefix}Sent a file`;
  const content = msg.content.length > 40 ? msg.content.slice(0, 40) + "..." : msg.content;
  if (isMe) return `You: ${content}`;
  return content;
}

export function ChatListItem({ item, currentUserId, onPress }: Props) {
  const { theme } = useTheme();
  const isMe = item.lastMessage?.fromUserId === currentUserId;
  const preview = getLastMessagePreview(item.lastMessage, isMe);
  const time = formatTime(item.lastMessage?.createdAt);
  const initials = getInitials(item.user.displayName);

  const avatarBgColor = theme.tint;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: pressed ? theme.surfaceSecondary : "transparent" }
      ]}
    >
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: theme.tintDim, borderColor: avatarBgColor + "30", borderWidth: 1.5 }]}>
          <Text style={[styles.initials, { color: avatarBgColor }]}>{initials}</Text>
        </View>
        {item.user.isOnline && (
          <View style={[styles.onlineDot, { backgroundColor: theme.online, borderColor: theme.background }]} />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}
          >
            {item.user.displayName}
          </Text>
          <Text style={[styles.time, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>{time}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text numberOfLines={1} style={[styles.preview, { color: theme.textSecondary, fontFamily: "Inter_400Regular", flex: 1 }]}>
            {preview}
          </Text>
          {(item.unreadCount ?? 0) > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.tint }]}>
              <Text style={[styles.badgeText, { color: theme.bubbleMeText }]}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { fontSize: 18, fontFamily: "Inter_700Bold" },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  content: { flex: 1, gap: 3 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 15, flex: 1, marginRight: 8 },
  time: { fontSize: 12 },
  preview: { fontSize: 13 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});

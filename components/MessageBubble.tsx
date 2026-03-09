import React from "react";
import { View, Text, StyleSheet, Image, Pressable, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { getApiUrl } from "@/lib/query-client";

interface MessageMetadata {
  latitude?: number;
  longitude?: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  url?: string;
}

interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  type: string;
  metadata?: MessageMetadata | null;
  isRead?: boolean;
  createdAt?: string;
}

interface Props {
  message: Message;
  isMe: boolean;
  showTime?: boolean;
}

function resolveUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = getApiUrl().replace(/\/$/, "");
  return `${base}${url}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageBubble({ message, isMe, showTime = true }: Props) {
  const { theme } = useTheme();

  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const bubbleBg = isMe ? theme.bubbleMe : theme.bubbleThem;
  const textColor = isMe ? theme.bubbleMeText : theme.bubbleThemText;

  if (message.type === "location" && message.metadata?.latitude) {
    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
        <View style={[styles.locationBubble, { backgroundColor: bubbleBg }]}>
          <Ionicons name="location" size={20} color={isMe ? theme.bubbleMeText : theme.tint} />
          <View>
            <Text style={[styles.locationTitle, { color: textColor }]}>Location Shared</Text>
            <Text style={[styles.locationCoords, { color: isMe ? `${theme.bubbleMeText}AA` : theme.textSecondary }]}>
              {message.metadata.latitude?.toFixed(4)}, {message.metadata.longitude?.toFixed(4)}
            </Text>
          </View>
        </View>
        {showTime && <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem, { color: theme.textMuted }]}>{time}</Text>}
      </View>
    );
  }

  if (message.type === "image" && message.content) {
    const imageUrl = resolveUrl(message.content);
    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
        <View style={[styles.mediaBubble, { backgroundColor: bubbleBg }]}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.imageContent}
            resizeMode="cover"
          />
        </View>
        {showTime && <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem, { color: theme.textMuted }]}>{time}</Text>}
      </View>
    );
  }

  if (message.type === "video" && message.content) {
    const videoUrl = resolveUrl(message.content);
    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
        <Pressable
          style={[styles.mediaBubble, styles.videoBubble, { backgroundColor: bubbleBg }]}
          onPress={() => Linking.openURL(videoUrl)}
        >
          <View style={styles.videoPlay}>
            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
          </View>
          <Text style={[styles.videoLabel, { color: textColor }]}>
            {message.metadata?.fileName || "Video"}
          </Text>
        </Pressable>
        {showTime && <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem, { color: theme.textMuted }]}>{time}</Text>}
      </View>
    );
  }

  if (message.type === "file" && message.content) {
    const fileUrl = resolveUrl(message.content);
    const fileName = message.metadata?.fileName || "File";
    const fileSize = message.metadata?.fileSize;
    const mime = message.metadata?.mimeType || "";
    const icon = mime.includes("pdf") ? "document-text" : mime.includes("word") ? "document" : "attach";

    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
        <Pressable
          style={[styles.fileBubble, { backgroundColor: bubbleBg }]}
          onPress={() => Linking.openURL(fileUrl)}
        >
          <View style={[styles.fileIcon, { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : theme.tintDim }]}>
            <Ionicons name={icon as any} size={22} color={isMe ? theme.bubbleMeText : theme.tint} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>{fileName}</Text>
            {fileSize ? (
              <Text style={[styles.fileSize, { color: isMe ? `${theme.bubbleMeText}AA` : theme.textSecondary }]}>
                {formatBytes(fileSize)}
              </Text>
            ) : null}
          </View>
          <Ionicons name="download-outline" size={18} color={isMe ? `${theme.bubbleMeText}AA` : theme.textMuted} />
        </Pressable>
        {showTime && <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem, { color: theme.textMuted }]}>{time}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View style={[
        styles.bubble,
        isMe ? [styles.bubbleMe, { backgroundColor: bubbleBg }] : [styles.bubbleThem, { backgroundColor: bubbleBg }],
      ]}>
        <Text style={[styles.text, { color: textColor }]}>{message.content}</Text>
      </View>
      {showTime && <Text style={[styles.time, isMe ? styles.timeMe : styles.timeThem, { color: theme.textMuted }]}>{time}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 2, paddingHorizontal: 12, maxWidth: "82%" },
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
    flexDirection: "row", alignItems: "center", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderBottomRightRadius: 4,
  },
  locationTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  locationCoords: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  mediaBubble: { borderRadius: 16, overflow: "hidden" },
  imageContent: { width: 220, height: 180, borderRadius: 16 },
  videoBubble: { width: 220, height: 160, alignItems: "center", justifyContent: "center" },
  videoPlay: { position: "absolute" },
  videoLabel: { position: "absolute", bottom: 10, left: 12, fontSize: 13, fontFamily: "Inter_500Medium" },
  fileBubble: {
    flexDirection: "row", alignItems: "center", borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 10, gap: 10, minWidth: 200, maxWidth: 260,
  },
  fileIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  fileSize: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});

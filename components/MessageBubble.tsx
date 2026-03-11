import React from "react";
import { View, Text, StyleSheet, Image, Pressable, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { getApiUrl } from "@/lib/query-client";

let MapView: React.ComponentType<any> | null = null;
let Marker: React.ComponentType<any> | null = null;
try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  // react-native-maps not available (e.g. web) - will use fallback
}

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
    const lat = message.metadata.latitude;
    const lng = message.metadata.longitude ?? 0;
    const mapsUrl = Platform.OS === "ios"
      ? `maps:0,0?q=${lat},${lng}`
      : `geo:0,0?q=${lat},${lng}`;
    const webMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    const canShowMap = MapView && Marker && Platform.OS !== "web";

    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
        <Pressable
          style={[styles.locationBubble, { backgroundColor: bubbleBg }]}
          onPress={() => Linking.openURL(Platform.OS === "web" ? webMapsUrl : mapsUrl).catch(() => Linking.openURL(webMapsUrl))}
        >
          {canShowMap ? (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.mapView}
                initialRegion={{
                  latitude: lat,
                  longitude: lng,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                liteMode={Platform.OS === "android"}
              >
                <Marker coordinate={{ latitude: lat, longitude: lng }} />
              </MapView>
            </View>
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map" size={32} color={isMe ? theme.bubbleMeText : theme.tint} />
            </View>
          )}
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={16} color={isMe ? theme.bubbleMeText : theme.tint} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.locationTitle, { color: textColor }]}>Location Shared</Text>
              <Text style={[styles.locationCoords, { color: isMe ? `${theme.bubbleMeText}AA` : theme.textSecondary }]}>
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </Text>
            </View>
            <Ionicons name="open-outline" size={14} color={isMe ? `${theme.bubbleMeText}99` : theme.textMuted} />
          </View>
        </Pressable>
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
    borderRadius: 16, overflow: "hidden", borderBottomRightRadius: 4,
  },
  mapContainer: {
    width: 220, height: 130, overflow: "hidden",
  },
  mapView: {
    width: "100%", height: "100%",
  },
  mapFallback: {
    width: 220, height: 100, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  locationInfo: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  locationTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  locationCoords: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
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

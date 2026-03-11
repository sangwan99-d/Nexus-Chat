import React, { useState } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, Image,
  ActivityIndicator, RefreshControl, Platform, Modal, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { fetch as expoFetch } from "expo/fetch";

interface StatusGroup {
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  statuses: {
    id: string;
    imageUrl: string;
    caption?: string | null;
    createdAt?: string;
  }[];
}

function resolveUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = getApiUrl().replace(/\/$/, "");
  return `${base}${url}`;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return "1d ago";
}

async function uploadFile(uri: string, name: string, mimeType: string): Promise<{ url: string }> {
  const baseUrl = getApiUrl();
  const uploadUrl = `${baseUrl}api/upload`;
  const formData = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append("file", blob, name);
  } else {
    formData.append("file", { uri, name, type: mimeType } as unknown as Blob);
  }
  const res = await expoFetch(uploadUrl, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

export default function StatusScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingStatus, setViewingStatus] = useState<StatusGroup | null>(null);
  const [viewIndex, setViewIndex] = useState(0);

  const { data: statusGroups = [], isLoading, refetch, isRefetching } = useQuery<StatusGroup[]>({
    queryKey: ["/api/statuses"],
  });

  const { data: myStatuses = [] } = useQuery<{ id: string; imageUrl: string; caption?: string | null; createdAt?: string }[]>({
    queryKey: ["/api/statuses/me"],
  });

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setShowCreate(true);
    }
  };

  const handlePostStatus = async () => {
    if (!selectedImage) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(selectedImage, `status_${Date.now()}.jpg`, "image/jpeg");
      await apiRequest("POST", "/api/statuses", { imageUrl: uploaded.url, caption: caption.trim() || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreate(false);
      setSelectedImage(null);
      setCaption("");
      queryClient.invalidateQueries({ queryKey: ["/api/statuses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statuses/me"] });
    } catch (e) {
      console.error("Failed to post status:", e);
    } finally {
      setUploading(false);
    }
  };

  const openStatusViewer = (group: StatusGroup, index: number = 0) => {
    setViewingStatus(group);
    setViewIndex(index);
  };

  const closeViewer = () => {
    setViewingStatus(null);
    setViewIndex(0);
  };

  const nextStatus = () => {
    if (!viewingStatus) return;
    if (viewIndex < viewingStatus.statuses.length - 1) {
      setViewIndex(viewIndex + 1);
    } else {
      closeViewer();
    }
  };

  const myStatusGroup = statusGroups.find(g => g.user.id === user?.id);
  const othersStatuses = statusGroups.filter(g => g.user.id !== user?.id);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>Status</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.tint} size="large" />
        </View>
      ) : (
        <FlatList
          data={othersStatuses}
          keyExtractor={item => item.user.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.tint} />
          }
          ListHeaderComponent={
            <View>
              {/* My Status */}
              <Pressable
                style={[styles.myStatusRow, { borderBottomColor: theme.border }]}
                onPress={myStatuses.length > 0 && myStatusGroup ? () => openStatusViewer(myStatusGroup) : handlePickImage}
              >
                <View style={styles.avatarWrap}>
                  <View style={[styles.avatar, { backgroundColor: theme.tintDim }]}>
                    <Text style={[styles.initials, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>
                      {user?.displayName?.slice(0, 2).toUpperCase() || "?"}
                    </Text>
                  </View>
                  <View style={[styles.addBadge, { backgroundColor: theme.tint }]}>
                    <Ionicons name="add" size={14} color="#fff" />
                  </View>
                </View>
                <View style={styles.myStatusInfo}>
                  <Text style={[styles.myStatusTitle, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>My Status</Text>
                  <Text style={[styles.myStatusSub, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    {myStatuses.length > 0 ? `${myStatuses.length} update${myStatuses.length > 1 ? "s" : ""} \u2022 ${timeAgo(myStatuses[0]?.createdAt)}` : "Tap to add status update"}
                  </Text>
                </View>
                <Pressable onPress={handlePickImage} hitSlop={8} style={styles.cameraBtn}>
                  <Ionicons name="camera" size={22} color={theme.tint} />
                </Pressable>
              </Pressable>

              {othersStatuses.length > 0 && (
                <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>RECENT UPDATES</Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const latestStatus = item.statuses[0];
            const initials = item.user.displayName?.slice(0, 2).toUpperCase() || "?";
            return (
              <Pressable
                style={[styles.statusRow, { borderBottomColor: theme.border }]}
                onPress={() => openStatusViewer(item)}
              >
                <View style={[styles.statusRing, { borderColor: theme.tint }]}>
                  {item.user.avatarUrl ? (
                    <Image source={{ uri: resolveUrl(item.user.avatarUrl) }} style={styles.statusAvatar} />
                  ) : (
                    <View style={[styles.statusAvatarFallback, { backgroundColor: theme.tintDim }]}>
                      <Text style={[styles.statusInitials, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>{initials}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statusInfo}>
                  <Text style={[styles.statusName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>{item.user.displayName}</Text>
                  <Text style={[styles.statusTime, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>{timeAgo(latestStatus?.createdAt)}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="eye-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>No status updates</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Status updates from your contacts will appear here
              </Text>
            </View>
          }
        />
      )}

      {/* Create Status Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={[styles.createModal, { backgroundColor: theme.background }]}>
          <View style={[styles.createHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => { setShowCreate(false); setSelectedImage(null); setCaption(""); }}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.createTitle, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>New Status</Text>
            <Pressable
              onPress={handlePostStatus}
              disabled={uploading || !selectedImage}
              style={[styles.postBtn, { backgroundColor: theme.tint, opacity: uploading ? 0.6 : 1 }]}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={theme.bubbleMeText} />
              ) : (
                <Text style={[styles.postBtnText, { color: theme.bubbleMeText, fontFamily: "Inter_600SemiBold" }]}>Post</Text>
              )}
            </Pressable>
          </View>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
          )}
          <View style={[styles.captionWrap, { borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.captionInput, { color: theme.text, fontFamily: "Inter_400Regular" }]}
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption..."
              placeholderTextColor={theme.textMuted}
              maxLength={200}
            />
          </View>
        </View>
      </Modal>

      {/* Status Viewer Modal */}
      <Modal visible={!!viewingStatus} transparent animationType="fade" onRequestClose={closeViewer}>
        {viewingStatus && viewingStatus.statuses[viewIndex] && (
          <Pressable style={styles.viewerContainer} onPress={nextStatus}>
            <Image
              source={{ uri: resolveUrl(viewingStatus.statuses[viewIndex].imageUrl) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <View style={[styles.viewerOverlay]}>
              {/* Progress bars */}
              <View style={[styles.progressRow, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 8 }]}>
                {viewingStatus.statuses.map((_, i) => (
                  <View key={i} style={[styles.progressBar, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
                    <View style={[styles.progressFill, { width: i <= viewIndex ? "100%" : "0%", backgroundColor: "#fff" }]} />
                  </View>
                ))}
              </View>
              <View style={styles.viewerHeader}>
                <Text style={[styles.viewerName, { fontFamily: "Inter_600SemiBold" }]}>{viewingStatus.user.displayName}</Text>
                <Text style={[styles.viewerTime, { fontFamily: "Inter_400Regular" }]}>{timeAgo(viewingStatus.statuses[viewIndex].createdAt)}</Text>
                <Pressable onPress={closeViewer} style={styles.viewerClose}>
                  <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
              </View>
            </View>
            {viewingStatus.statuses[viewIndex].caption ? (
              <View style={styles.viewerCaption}>
                <Text style={[styles.viewerCaptionText, { fontFamily: "Inter_500Medium" }]}>{viewingStatus.statuses[viewIndex].caption}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  myStatusRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, gap: 12,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  initials: { fontSize: 18 },
  addBadge: {
    position: "absolute", bottom: 0, right: 0, width: 22, height: 22,
    borderRadius: 11, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#0D0E1A",
  },
  myStatusInfo: { flex: 1 },
  myStatusTitle: { fontSize: 16 },
  myStatusSub: { fontSize: 13, marginTop: 2 },
  cameraBtn: { padding: 8 },
  sectionTitle: { fontSize: 12, letterSpacing: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  statusRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 0.5, gap: 12,
  },
  statusRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 2.5, padding: 2 },
  statusAvatar: { width: "100%", height: "100%", borderRadius: 24 },
  statusAvatarFallback: { width: "100%", height: "100%", borderRadius: 24, alignItems: "center", justifyContent: "center" },
  statusInitials: { fontSize: 16 },
  statusInfo: { flex: 1 },
  statusName: { fontSize: 15 },
  statusTime: { fontSize: 13, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, marginTop: 4 },
  emptyText: { fontSize: 14, textAlign: "center" },
  // Create modal
  createModal: { flex: 1 },
  createHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
    paddingTop: 52,
  },
  createTitle: { fontSize: 17 },
  postBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { fontSize: 15 },
  previewImage: { flex: 1, width: "100%" },
  captionWrap: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  captionInput: { fontSize: 15 },
  // Viewer
  viewerContainer: { flex: 1, backgroundColor: "#000" },
  viewerOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  progressRow: { flexDirection: "row", paddingHorizontal: 8, gap: 4 },
  progressBar: { flex: 1, height: 2.5, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  viewerHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  viewerName: { color: "#fff", fontSize: 16 },
  viewerTime: { color: "rgba(255,255,255,0.7)", fontSize: 13, flex: 1 },
  viewerClose: { padding: 4 },
  viewerCaption: {
    position: "absolute", bottom: 60, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 20, paddingVertical: 12,
  },
  viewerCaptionText: { color: "#fff", fontSize: 16, textAlign: "center" },
});

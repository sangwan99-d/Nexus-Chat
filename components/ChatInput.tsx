import React, { useRef, useState } from "react";
import {
  View, TextInput, Pressable, StyleSheet, Platform,
  Modal, Text, ActivityIndicator, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useTheme } from "@/context/ThemeContext";
import { getApiUrl } from "@/lib/query-client";
import { fetch as expoFetch } from "expo/fetch";

interface Props {
  onSend: (content: string, type?: string, metadata?: unknown) => void;
  disabled?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

async function uploadFile(uri: string, name: string, mimeType: string): Promise<{ url: string; type: string; name: string; size: number }> {
  const baseUrl = getApiUrl();
  const uploadUrl = `${baseUrl}api/upload`;

  const formData = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append("file", blob, name);
  } else {
    formData.append("file", { uri, name, type: mimeType } as any);
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

export function ChatInput({ onSend, disabled, onTypingStart, onTypingStop }: Props) {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const typingRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleChangeText = (t: string) => {
    setText(t);
    if (!typingRef.current && t.length > 0) {
      typingRef.current = true;
      onTypingStart?.();
    }
    clearTimeout(typingTimer.current);
    if (t.length === 0) {
      typingRef.current = false;
      onTypingStop?.();
    } else {
      typingTimer.current = setTimeout(() => {
        typingRef.current = false;
        onTypingStop?.();
      }, 2000);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    typingRef.current = false;
    onTypingStop?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed, "text");
    inputRef.current?.focus();
  };

  const handlePickImage = async () => {
    setShowPicker(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const mimeType = asset.mimeType || "image/jpeg";
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      const uploaded = await uploadFile(asset.uri, name, mimeType);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSend(uploaded.url, "image", { fileName: name, fileSize: uploaded.size, mimeType });
    } catch (e) {
      console.error("Image upload failed:", e);
    } finally {
      setUploading(false);
    }
  };

  const handlePickVideo = async () => {
    setShowPicker(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const mimeType = asset.mimeType || "video/mp4";
      const name = asset.fileName || `video_${Date.now()}.mp4`;
      const uploaded = await uploadFile(asset.uri, name, mimeType);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSend(uploaded.url, "video", { fileName: name, fileSize: uploaded.size, mimeType });
    } catch (e) {
      console.error("Video upload failed:", e);
    } finally {
      setUploading(false);
    }
  };

  const handlePickDocument = async () => {
    setShowPicker(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const uploaded = await uploadFile(asset.uri, asset.name, asset.mimeType || "application/octet-stream");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSend(uploaded.url, "file", { fileName: asset.name, fileSize: asset.size, mimeType: asset.mimeType });
    } catch (e) {
      console.error("Document upload failed:", e);
    } finally {
      setUploading(false);
    }
  };

  const handleShareLocation = async () => {
    setShowPicker(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSend("Location shared", "location", {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {}
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPicker(true); }}
          disabled={uploading || disabled}
          hitSlop={8}
          style={styles.iconBtn}
        >
          {uploading
            ? <ActivityIndicator size="small" color={theme.tint} />
            : <Ionicons name="add-circle-outline" size={24} color={theme.textMuted} />
          }
        </Pressable>

        <TextInput
          ref={inputRef}
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
          value={text}
          onChangeText={handleChangeText}
          placeholder="Message..."
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={2000}
          blurOnSubmit={false}
          onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
          returnKeyType={Platform.OS === "web" ? "send" : "default"}
        />

        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={8}
          style={[styles.sendBtn, { backgroundColor: canSend ? theme.tint : theme.surfaceSecondary }]}
        >
          <Ionicons name="arrow-up" size={18} color={canSend ? theme.bubbleMeText : theme.textMuted} />
        </Pressable>
      </View>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>Share</Text>
            <View style={styles.pickerGrid}>
              <Pressable style={[styles.pickerItem, { backgroundColor: theme.tintDim }]} onPress={handlePickImage}>
                <Ionicons name="image" size={28} color={theme.tint} />
                <Text style={[styles.pickerLabel, { color: theme.text, fontFamily: "Inter_500Medium" }]}>Photo</Text>
              </Pressable>
              <Pressable style={[styles.pickerItem, { backgroundColor: "#9B59B620" }]} onPress={handlePickVideo}>
                <Ionicons name="videocam" size={28} color="#9B59B6" />
                <Text style={[styles.pickerLabel, { color: theme.text, fontFamily: "Inter_500Medium" }]}>Video</Text>
              </Pressable>
              <Pressable style={[styles.pickerItem, { backgroundColor: "#E67E2220" }]} onPress={handlePickDocument}>
                <Ionicons name="document-attach" size={28} color="#E67E22" />
                <Text style={[styles.pickerLabel, { color: theme.text, fontFamily: "Inter_500Medium" }]}>File</Text>
              </Pressable>
              <Pressable style={[styles.pickerItem, { backgroundColor: "#27AE6020" }]} onPress={handleShareLocation}>
                <Ionicons name="location" size={28} color="#27AE60" />
                <Text style={[styles.pickerLabel, { color: theme.text, fontFamily: "Inter_500Medium" }]}>Location</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, gap: 8,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  input: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9,
    fontSize: 15, maxHeight: 120, lineHeight: 20,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 13, marginBottom: 16, textAlign: "center" },
  pickerGrid: { flexDirection: "row", gap: 16, justifyContent: "center" },
  pickerItem: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 18, borderRadius: 16, gap: 8, maxWidth: 80,
  },
  pickerLabel: { fontSize: 12 },
});

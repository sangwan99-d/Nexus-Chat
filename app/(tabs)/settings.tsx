import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, Switch,
  TextInput, ActivityIndicator, Alert, Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { THEMES, type ThemeKey } from "@/constants/colors";
import { router } from "expo-router";
import { apiRequest } from "@/lib/query-client";

interface ThemeOption {
  key: ThemeKey;
  label: string;
  color: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { key: "dark", label: "Dark", color: "#00D4FF" },
  { key: "light", label: "Light", color: "#0066CC" },
  { key: "midnight", label: "Midnight", color: "#7C4DFF" },
  { key: "forest", label: "Forest", color: "#00E676" },
  { key: "sunset", label: "Sunset", color: "#FF6B35" },
];

export default function SettingsScreen() {
  const { theme, themeKey, setTheme } = useTheme();
  const { user, updateProfile, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [saving, setSaving] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ displayName: displayName.trim() });
      setEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    finally { setSaving(false); }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await updateProfile({ avatarUrl: dataUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const [simuuId, setSimuuId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.hasAiAccess) {
      apiRequest("GET", "/api/system/ai-user")
        .then(res => res.json())
        .then(data => { if (data.aiUser) setSimuuId(data.aiUser.id); })
        .catch(() => {});
    }
  }, [user]);

  const initials = user?.displayName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 }]}
    >
      <Text style={[styles.headerTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>Settings</Text>

      <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable onPress={handlePickAvatar} style={[styles.avatar, { backgroundColor: theme.tintDim }]}>
          <Text style={[styles.initials, { color: theme.tint, fontFamily: "Inter_700Bold" }]}>{initials}</Text>
          <View style={[styles.editOverlay, { backgroundColor: "rgba(0,0,0,0.4)" }]}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </Pressable>

        <View style={styles.profileInfo}>
          {editingName ? (
            <View style={styles.nameEdit}>
              <TextInput
                style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg, fontFamily: "Inter_500Medium" }]}
                value={displayName}
                onChangeText={setDisplayName}
                autoFocus
                onSubmitEditing={handleSaveName}
              />
              <Pressable onPress={handleSaveName} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.tint }]}>
                {saving ? <ActivityIndicator size="small" color={theme.bubbleMeText} /> : <Ionicons name="checkmark" size={18} color={theme.bubbleMeText} />}
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)} style={styles.nameRow}>
              <Text style={[styles.name, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>{user?.displayName}</Text>
              <Ionicons name="pencil" size={15} color={theme.textMuted} />
            </Pressable>
          )}
          <Text style={[styles.phone, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>{user?.phone}</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {THEME_OPTIONS.map((opt, index) => (
          <Pressable
            key={opt.key}
            onPress={() => {
              setTheme(opt.key);
              Haptics.selectionAsync();
            }}
            style={[
              styles.themeRow,
              index < THEME_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
            ]}
          >
            <View style={[styles.themeDot, { backgroundColor: opt.color }]} />
            <Text style={[styles.themeLabel, { color: theme.text, fontFamily: "Inter_400Regular" }]}>{opt.label}</Text>
            {themeKey === opt.key && <Ionicons name="checkmark" size={20} color={theme.tint} />}
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>AI GIRLFRIEND</Text>
      <Pressable
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => { if (simuuId) router.push(`/chat/${simuuId}`); }}
      >
        <View style={styles.settingsRow}>
          <View style={[styles.settingsIcon, { backgroundColor: theme.aiAccentDim }]}>
            <Ionicons name="sparkles" size={18} color={theme.aiAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingsLabel, { color: theme.text, fontFamily: "Inter_500Medium" }]}>Chat with Simuu</Text>
            <Text style={[styles.settingsDesc, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>Your AI companion</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </View>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: theme.textMuted, fontFamily: "Inter_600SemiBold" }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable onPress={handleLogout} style={styles.settingsRow}>
          <View style={[styles.settingsIcon, { backgroundColor: "#FF3B3020" }]}>
            <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
          </View>
          <Text style={[styles.settingsLabel, { color: "#FF3B30", fontFamily: "Inter_500Medium" }]}>Log Out</Text>
        </Pressable>
      </View>

      <Text style={[styles.version, { color: theme.textMuted, fontFamily: "Inter_400Regular" }]}>NexusChat v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  headerTitle: { fontSize: 28, marginBottom: 20 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: { fontSize: 22 },
  editOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameEdit: { flexDirection: "row", gap: 8, alignItems: "center" },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
  },
  saveBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 17 },
  phone: { fontSize: 14 },
  sectionTitle: { fontSize: 12, letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 20, overflow: "hidden" },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  themeDot: { width: 18, height: 18, borderRadius: 9 },
  themeLabel: { flex: 1, fontSize: 15 },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingsIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingsLabel: { fontSize: 15, flex: 1 },
  settingsDesc: { fontSize: 13 },
  version: { fontSize: 13, textAlign: "center", marginTop: 8 },
});

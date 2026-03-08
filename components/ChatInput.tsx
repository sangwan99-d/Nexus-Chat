import React, { useRef, useState } from "react";
import { View, TextInput, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/context/ThemeContext";
import * as Location from "expo-location";

interface Props {
  onSend: (content: string, type?: string, metadata?: unknown) => void;
  disabled?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export function ChatInput({ onSend, disabled, onTypingStart, onTypingStop }: Props) {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [sendingLocation, setSendingLocation] = useState(false);
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

  const handleShareLocation = async () => {
    try {
      setSendingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSend("Location shared", "location", {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {}
    finally { setSendingLocation(false); }
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      <Pressable
        onPress={handleShareLocation}
        disabled={sendingLocation || disabled}
        hitSlop={8}
        style={styles.iconBtn}
      >
        <Ionicons
          name="location-outline"
          size={22}
          color={sendingLocation ? theme.tint : theme.textMuted}
        />
      </Pressable>

      <TextInput
        ref={inputRef}
        style={[styles.input, {
          backgroundColor: theme.inputBg,
          color: theme.text,
          borderColor: theme.border,
        }]}
        value={text}
        onChangeText={handleChangeText}
        placeholder="Message..."
        placeholderTextColor={theme.textMuted}
        multiline
        maxLength={2000}
        blurOnSubmit={false}
        onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
        returnKeyType={Platform.OS === "web" ? "send" : "default"}
        fontFamily="Inter_400Regular"
      />

      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        hitSlop={8}
        style={[styles.sendBtn, { backgroundColor: canSend ? theme.tint : theme.surfaceSecondary }]}
      >
        <Ionicons
          name="arrow-up"
          size={18}
          color={canSend ? theme.bubbleMeText : theme.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
});

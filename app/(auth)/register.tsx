import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function RegisterScreen() {
  const { register } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);

  const handleRegister = async () => {
    if (!phone || !displayName || !password) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(phone, displayName, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Registration failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.logoWrap, { backgroundColor: theme.tintDim }]}>
            <Ionicons name="chatbubbles" size={36} color={theme.tint} />
          </View>
          <Text style={[styles.title, { color: theme.text, fontFamily: "Inter_700Bold" }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Join NexusChat
          </Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FF3B3020", borderColor: "#FF3B30" }]}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={[styles.errorText, { fontFamily: "Inter_400Regular" }]}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>Phone Number</Text>
          <TextInput
            style={inputStyle}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1234567890"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => nameRef.current?.focus()}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>Display Name</Text>
          <TextInput
            ref={nameRef}
            style={inputStyle}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={theme.textMuted}
            returnKeyType="next"
            onSubmitEditing={() => pwRef.current?.focus()}
          />

          <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>Password</Text>
          <View style={styles.pwWrap}>
            <TextInput
              ref={pwRef}
              style={[inputStyle, { flex: 1, borderRightWidth: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Min 6 characters"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPw}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            <Pressable
              onPress={() => setShowPw(!showPw)}
              style={[styles.eyeBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
            >
              <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
            </Pressable>
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={({ pressed }) => [styles.btn, { backgroundColor: theme.tint, opacity: pressed ? 0.85 : 1 }]}
          >
            {loading
              ? <ActivityIndicator color={theme.bubbleMeText} />
              : <Text style={[styles.btnText, { color: theme.bubbleMeText, fontFamily: "Inter_700Bold" }]}>Create Account</Text>
            }
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Already have an account?{" "}
          </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={[styles.link, { color: theme.tint, fontFamily: "Inter_600SemiBold" }]}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 32 },
  logoWrap: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 28, marginBottom: 6 },
  subtitle: { fontSize: 16 },
  form: { gap: 10 },
  label: { fontSize: 13, marginTop: 6, marginBottom: 2 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  pwWrap: { flexDirection: "row" },
  eyeBtn: {
    width: 50,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { color: "#FF3B30", flex: 1, fontSize: 14 },
  btn: { borderRadius: 14, padding: 16, alignItems: "center", marginTop: 16 },
  btnText: { fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  footerText: { fontSize: 14 },
  link: { fontSize: 14 },
});

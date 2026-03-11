import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { sendOtpWithFirebase } from "@/lib/firebase-auth";

export default function RegisterScreen() {
  const { register } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<unknown>(null);
  const [usedFirebase, setUsedFirebase] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nameRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);

  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length <= 12) {
      return `+${digits}`;
    }
    if (!digits.startsWith("91") && digits.length <= 10) {
      return digits.length > 0 ? `+91${digits}` : "";
    }
    return text;
  };

  const handlePhoneChange = (text: string) => {
    if (text === "" || text === "+91") {
      setPhone(text);
      return;
    }
    const cleaned = text.replace(/[^\d+]/g, "");
    setPhone(cleaned);
  };

  const getDisplayPhone = () => {
    if (!phone) return "";
    if (phone.startsWith("+91")) return phone;
    return `+91${phone}`;
  };

  const isValidPhone = () => {
    const normalized = getDisplayPhone();
    return normalized.length === 13 && normalized.startsWith("+91");
  };

  const handleSendOtp = async () => {
    if (!isValidPhone()) {
      setError("Enter a valid 10-digit Indian mobile number");
      return;
    }
    if (!displayName.trim()) {
      setError("Enter your name");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await sendOtpWithFirebase(getDisplayPhone());
      setDevOtp(result.devOtp || "");
      setFirebaseConfirmation(result.confirmationResult);
      setUsedFirebase(result.usedFirebase);
      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e: any) {
      setError(e.message || "Failed to send OTP");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(getDisplayPhone(), displayName.trim(), password, otp);
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
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <AnimatedBackground />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topPad + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.logoWrap, { backgroundColor: theme.tintDim }]}>
            <Ionicons name="chatbubbles" size={36} color={theme.tint} />
          </View>
          <Text style={[styles.title, { color: theme.text, fontFamily: "Inter_700Bold" }]}>
            {step === "form" ? "Create Account" : "Verify Number"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
            {step === "form" ? "Join NexusChat" : `OTP sent to ${getDisplayPhone()}`}
          </Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#FF3B3020", borderColor: "#FF3B30" }]}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={[styles.errorText, { fontFamily: "Inter_400Regular" }]}>{error}</Text>
            </View>
          ) : null}

          {step === "form" ? (
            <>
              <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>Indian Mobile Number</Text>
              <View style={[styles.phoneRow, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <View style={[styles.countryCode, { borderRightColor: theme.border }]}>
                  <Text style={[styles.countryCodeText, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, { color: theme.text, fontFamily: "Inter_400Regular" }]}
                  value={phone.startsWith("+91") ? phone.slice(3) : phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
                  placeholder="98765 43210"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => nameRef.current?.focus()}
                  maxLength={10}
                />
              </View>

              <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>Your Name</Text>
              <TextInput
                ref={nameRef}
                style={inputStyle}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Full name"
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
                  onSubmitEditing={handleSendOtp}
                />
                <Pressable
                  onPress={() => setShowPw(!showPw)}
                  style={[styles.eyeBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                >
                  <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
                </Pressable>
              </View>

              <Pressable
                onPress={handleSendOtp}
                disabled={loading}
                style={({ pressed }) => [styles.btn, { backgroundColor: theme.tint, opacity: pressed ? 0.85 : 1 }]}
              >
                {loading
                  ? <ActivityIndicator color={theme.bubbleMeText} />
                  : <Text style={[styles.btnText, { color: theme.bubbleMeText, fontFamily: "Inter_700Bold" }]}>Send OTP</Text>
                }
              </Pressable>
            </>
          ) : (
            <>
              {usedFirebase ? (
                <View style={[styles.devOtpBox, { backgroundColor: theme.tintDim, borderColor: theme.tint + "60" }]}>
                  <Ionicons name="shield-checkmark" size={16} color={theme.tint} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.devOtpLabel, { color: theme.tint, fontFamily: "Inter_500Medium" }]}>
                      SMS sent via Firebase
                    </Text>
                    <Text style={[styles.devOtpValue, { color: theme.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13 }]}>Check your phone for the OTP</Text>
                  </View>
                </View>
              ) : devOtp ? (
                <View style={[styles.devOtpBox, { backgroundColor: theme.aiAccentDim, borderColor: theme.aiAccent + "60" }]}>
                  <Ionicons name="information-circle" size={16} color={theme.aiAccent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.devOtpLabel, { color: theme.aiAccent, fontFamily: "Inter_500Medium" }]}>
                      Dev Mode — OTP for demo
                    </Text>
                    <Text style={[styles.devOtpValue, { color: theme.text, fontFamily: "Inter_700Bold" }]}>{devOtp}</Text>
                  </View>
                </View>
              ) : null}

              <Text style={[styles.label, { color: theme.textSecondary, fontFamily: "Inter_500Medium" }]}>Enter 6-Digit OTP</Text>
              <TextInput
                ref={otpRef}
                style={[inputStyle, styles.otpInput]}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="• • • • • •"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
              />

              <Pressable
                onPress={handleVerifyOtp}
                disabled={loading}
                style={({ pressed }) => [styles.btn, { backgroundColor: theme.tint, opacity: pressed ? 0.85 : 1 }]}
              >
                {loading
                  ? <ActivityIndicator color={theme.bubbleMeText} />
                  : <Text style={[styles.btnText, { color: theme.bubbleMeText, fontFamily: "Inter_700Bold" }]}>Verify & Create Account</Text>
                }
              </Pressable>

              <Pressable onPress={() => { setStep("form"); setOtp(""); setError(""); }} style={styles.backLink}>
                <Ionicons name="arrow-back" size={16} color={theme.tint} />
                <Text style={[styles.link, { color: theme.tint, fontFamily: "Inter_500Medium" }]}>Change number</Text>
              </Pressable>
            </>
          )}
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
  subtitle: { fontSize: 15, textAlign: "center" },
  form: { gap: 10 },
  label: { fontSize: 13, marginTop: 6, marginBottom: 2 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  countryCode: {
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRightWidth: 1,
  },
  countryCodeText: { fontSize: 15 },
  phoneInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  pwWrap: { flexDirection: "row" },
  eyeBtn: {
    width: 50, borderTopRightRadius: 12, borderBottomRightRadius: 12,
    borderWidth: 1, borderLeftWidth: 0, alignItems: "center", justifyContent: "center",
  },
  otpInput: { textAlign: "center", fontSize: 24, letterSpacing: 8 },
  devOtpBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4,
  },
  devOtpLabel: { fontSize: 12 },
  devOtpValue: { fontSize: 22, letterSpacing: 4, marginTop: 2 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { color: "#FF3B30", flex: 1, fontSize: 14 },
  btn: { borderRadius: 14, padding: 16, alignItems: "center", marginTop: 16 },
  btnText: { fontSize: 16 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingTop: 4 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  footerText: { fontSize: 14 },
  link: { fontSize: 14 },
});

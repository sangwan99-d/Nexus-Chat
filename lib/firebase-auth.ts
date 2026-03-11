/**
 * Firebase Phone Authentication Integration
 * 
 * This module provides a bridge for Firebase Phone Auth.
 * When Firebase is configured (EXPO_PUBLIC_FIREBASE_ENABLED=true),
 * it uses Firebase's signInWithPhoneNumber for real SMS OTP.
 * Otherwise, it falls back to the dev-mode OTP system.
 * 
 * Setup Instructions:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable "Phone Authentication" under Authentication > Sign-in method
 * 3. Add your app's SHA-1 fingerprint (Android) or bundle ID (iOS)
 * 4. Download google-services.json (Android) / GoogleService-Info.plist (iOS)
 * 5. Install: npm install @react-native-firebase/app @react-native-firebase/auth
 * 6. Set EXPO_PUBLIC_FIREBASE_ENABLED=true in your environment
 * 7. For Expo managed workflow, use expo-dev-client for native modules
 */

import { apiRequest } from "@/lib/query-client";

export interface OtpResult {
  /** Dev-mode OTP for testing (empty string when using Firebase) */
  devOtp: string;
  /** Firebase confirmation result for verifying the code */
  confirmationResult?: unknown;
  /** Whether Firebase was used for this OTP */
  usedFirebase: boolean;
}

const FIREBASE_ENABLED = process.env.EXPO_PUBLIC_FIREBASE_ENABLED === "true";

/**
 * Attempts to load Firebase Auth dynamically.
 * Returns null if Firebase is not installed or not configured.
 */
async function getFirebaseAuth(): Promise<{
  signInWithPhoneNumber: (phone: string) => Promise<unknown>;
} | null> {
  if (!FIREBASE_ENABLED) return null;

  try {
    // Dynamic import - only loads if @react-native-firebase/auth is installed
    const firebaseAuth = await import("@react-native-firebase/auth");
    const auth = firebaseAuth.default;
    return {
      signInWithPhoneNumber: async (phone: string) => {
        const confirmation = await auth().signInWithPhoneNumber(phone);
        return confirmation;
      },
    };
  } catch {
    // Firebase not installed - fall back to dev mode
    console.log("[FirebaseAuth] Firebase not available, using dev-mode OTP");
    return null;
  }
}

/**
 * Send OTP to the given phone number.
 * Uses Firebase Phone Auth if configured, otherwise uses the server-side dev OTP.
 */
export async function sendOtpWithFirebase(phone: string): Promise<OtpResult> {
  const firebase = await getFirebaseAuth();

  if (firebase) {
    try {
      const confirmationResult = await firebase.signInWithPhoneNumber(phone);
      return {
        devOtp: "",
        confirmationResult,
        usedFirebase: true,
      };
    } catch (err) {
      console.error("[FirebaseAuth] Failed to send OTP via Firebase:", err);
      // Fall through to dev-mode
    }
  }

  // Dev-mode fallback: use server endpoint
  const res = await apiRequest("POST", "/api/auth/send-otp", { phone });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send OTP");

  return {
    devOtp: data.devOtp || "",
    confirmationResult: undefined,
    usedFirebase: false,
  };
}

/**
 * Verify OTP code.
 * If Firebase was used, confirms with Firebase. Otherwise uses server verification.
 */
export async function verifyOtpWithFirebase(
  confirmationResult: unknown,
  code: string,
  usedFirebase: boolean
): Promise<{ firebaseToken?: string }> {
  if (usedFirebase && confirmationResult) {
    try {
      const confirmation = confirmationResult as { confirm: (code: string) => Promise<unknown> };
      await confirmation.confirm(code);
      // Firebase verification succeeded
      return { firebaseToken: "firebase-verified" };
    } catch (err) {
      throw new Error("Invalid OTP code. Please try again.");
    }
  }

  // Dev-mode: verification happens on the server during registration
  return {};
}

/**
 * Check if Firebase Phone Auth is enabled and available.
 */
export function isFirebaseAuthEnabled(): boolean {
  return FIREBASE_ENABLED;
}

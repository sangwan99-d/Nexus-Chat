import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Image, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface PeerUser {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

type CallState = "connecting" | "ringing" | "active" | "ended" | "rejected";

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { callType, incoming, fromSocketId: incomingSocketId, offerJson } = useLocalSearchParams<{
    callType: string;
    incoming: string;
    fromSocketId: string;
    offerJson: string;
  }>();

  const { theme } = useTheme();
  const { user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();

  const [peerUser, setPeerUser] = useState<PeerUser | null>(null);
  const [callState, setCallState] = useState<CallState>("connecting");
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<any>(null);
  const remoteVideoRef = useRef<any>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval>>();
  const remoteSocketId = useRef<string>(incomingSocketId || "");

  const isVideo = callType === "video";
  const isIncoming = incoming === "true";

  useEffect(() => {
    loadPeerUser();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    if (Platform.OS !== "web") return;

    socket.on("call:answered", async ({ answer }: any) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallState("active");
        startTimer();
      } catch {}
    });

    socket.on("call:rejected", () => {
      setCallState("rejected");
      setTimeout(() => router.back(), 2000);
    });

    socket.on("call:ice", async ({ candidate }: any) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    });

    socket.on("call:ended", () => {
      setCallState("ended");
      cleanup();
      setTimeout(() => router.back(), 1500);
    });

    if (!isIncoming) {
      startCall();
    } else {
      setCallState("ringing");
      acceptIncoming();
    }

    return () => {
      socket.off("call:answered");
      socket.off("call:rejected");
      socket.off("call:ice");
      socket.off("call:ended");
    };
  }, [socket]);

  const loadPeerUser = async () => {
    try {
      const res = await apiRequest("GET", `/api/users/${id}`);
      const data = await res.json();
      setPeerUser(data);
    } catch {}
  };

  const startTimer = () => {
    durationTimer.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && remoteSocketId.current) {
        socket?.emit("call:ice", { toSocketId: remoteSocketId.current, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return pc;
  };

  const startCall = async () => {
    if (Platform.OS !== "web") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setCallState("ringing");
      socket?.emit("call:offer", {
        toUserId: id,
        offer,
        callType,
        fromUser: { id: user?.id, displayName: user?.displayName, avatarUrl: user?.avatarUrl },
      });
    } catch {
      setCallState("ended");
    }
  };

  const acceptIncoming = async () => {
    if (Platform.OS !== "web") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = offerJson ? JSON.parse(offerJson) : null;
      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit("call:answer", { toSocketId: remoteSocketId.current, answer });
        setCallState("active");
        startTimer();
      }
    } catch {
      setCallState("ended");
    }
  };

  const endCall = useCallback(() => {
    socket?.emit("call:end", { toUserId: id });
    cleanup();
    router.back();
  }, [socket, id]);

  const cleanup = () => {
    clearInterval(durationTimer.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(!muted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(!videoOff);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const avatarUrl = peerUser?.avatarUrl ? `${getApiUrl().replace(/\/$/, "")}${peerUser.avatarUrl.startsWith("http") ? "" : ""}${peerUser.avatarUrl}` : null;

  const stateLabel = callState === "ringing" ? (isIncoming ? "Incoming call..." : "Ringing...")
    : callState === "connecting" ? "Connecting..."
    : callState === "active" ? formatDuration(duration)
    : callState === "rejected" ? "Call declined"
    : "Call ended";

  return (
    <View style={[styles.container, { backgroundColor: "#0D0D1A" }]}>
      {isVideo && Platform.OS === "web" ? (
        <>
          <video
            ref={remoteVideoRef}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "cover" } as any}
            autoPlay
            playsInline
          />
          <video
            ref={localVideoRef}
            style={{ position: "absolute", top: topPad + 16, right: 16, width: 120, height: 160, objectFit: "cover", borderRadius: 12 } as any}
            autoPlay
            playsInline
            muted
          />
        </>
      ) : null}

      <View style={[styles.info, { paddingTop: topPad + 48 }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: "#ffffff20" }]}>
            <Text style={styles.avatarInitials}>{peerUser?.displayName?.slice(0, 2).toUpperCase() || "??"}</Text>
          </View>
        )}
        <Text style={[styles.name, { fontFamily: "Inter_700Bold" }]}>{peerUser?.displayName || "..."}</Text>
        <Text style={[styles.status, { fontFamily: "Inter_400Regular" }]}>{stateLabel}</Text>

        {Platform.OS !== "web" && callState === "ringing" && (
          <View style={[styles.nativeBadge, { backgroundColor: "#ffffff20" }]}>
            <Ionicons name="information-circle" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.nativeText}>Calls use WebRTC on web. Native requires a production build.</Text>
          </View>
        )}
      </View>

      {callState === "active" || Platform.OS !== "web" ? null : (
        callState === "ringing" && !isIncoming ? (
          <View style={styles.ripple}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.3)" />
          </View>
        ) : null
      )}

      <View style={[styles.controls, { paddingBottom: bottomPad + 32 }]}>
        {callState !== "ended" && callState !== "rejected" ? (
          <>
            <Pressable
              style={[styles.controlBtn, { backgroundColor: muted ? "#FF3B30" : "rgba(255,255,255,0.15)" }]}
              onPress={toggleMute}
            >
              <Ionicons name={muted ? "mic-off" : "mic"} size={26} color="white" />
            </Pressable>

            {isVideo && (
              <Pressable
                style={[styles.controlBtn, { backgroundColor: videoOff ? "#FF3B30" : "rgba(255,255,255,0.15)" }]}
                onPress={toggleVideo}
              >
                <Ionicons name={videoOff ? "videocam-off" : "videocam"} size={26} color="white" />
              </Pressable>
            )}

            <Pressable
              style={[styles.controlBtn, styles.endBtn]}
              onPress={endCall}
            >
              <Ionicons name="call" size={26} color="white" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.controlBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={26} color="white" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  info: { flex: 1, alignItems: "center", gap: 12 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "rgba(255,255,255,0.3)" },
  avatarFallback: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.2)" },
  avatarInitials: { fontSize: 32, color: "white", fontFamily: "Inter_700Bold" },
  name: { fontSize: 28, color: "white", marginTop: 8 },
  status: { fontSize: 16, color: "rgba(255,255,255,0.6)" },
  nativeBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 16, maxWidth: 280,
  },
  nativeText: { fontSize: 13, color: "rgba(255,255,255,0.6)", flex: 1, fontFamily: "Inter_400Regular" },
  ripple: { position: "absolute", alignSelf: "center", top: "40%" },
  controls: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 24, paddingHorizontal: 32,
  },
  controlBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
  },
  endBtn: { backgroundColor: "#FF3B30" },
});

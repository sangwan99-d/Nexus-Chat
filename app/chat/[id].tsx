import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, Platform, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator, AITypingIndicator } from "@/components/TypingIndicator";
import { ChatInput } from "@/components/ChatInput";
import { getApiUrl, apiRequest } from "@/lib/query-client";

let msgCounter = 0;
function uid() {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  type: string;
  metadata?: unknown;
  isRead?: boolean;
  createdAt?: string;
}

interface PeerUser {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isAiUser?: boolean;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sendingToAI, setSendingToAI] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerUser, setPeerUser] = useState<PeerUser | null>(null);

  const isAI = !!(peerUser?.isAiUser);

  const partnerName = peerUser?.displayName ?? "...";
  const isOnline = isAI ? true : (peerUser?.isOnline ?? false);

  const baseUrl = getApiUrl().replace(/\/$/, "");
  const avatarUrl = peerUser?.avatarUrl
    ? (peerUser.avatarUrl.startsWith("http") ? peerUser.avatarUrl : `${baseUrl}${peerUser.avatarUrl}`)
    : null;

  useEffect(() => {
    if (id) loadInitial();
  }, [id]);

  const loadInitial = async () => {
    setLoadingMessages(true);
    try {
      const userRes = await apiRequest("GET", `/api/users/${id}`);
      const userData = await userRes.json();
      setPeerUser(userData);

      const msgRes = await apiRequest("GET", `/api/messages/${id}`);
      const msgData: Message[] = await msgRes.json();
      setMessages(msgData);
    } catch {}
    finally { setLoadingMessages(false); }
  };

  useEffect(() => {
    if (!socket) return;

    const onNewMsg = (msg: Message) => {
      if ((msg.fromUserId === id && msg.toUserId === user?.id) ||
          (msg.fromUserId === user?.id && msg.toUserId === id)) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === msg.id);
          return exists ? prev : [...prev, msg];
        });
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        if (msg.fromUserId === id) setSendingToAI(false);
      }
    };

    const onTyping = ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === id) setPeerTyping(true);
    };
    const onStopTyping = ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === id) setPeerTyping(false);
    };
    const onStatus = ({ userId, isOnline: online }: { userId: string; isOnline: boolean }) => {
      if (userId === id) setPeerUser(p => p ? { ...p, isOnline: online } : p);
    };
    const onSimuuTyping = () => {
      if (isAI) setShowTyping(true);
    };
    const onSimuuReplied = () => {
      setShowTyping(false);
      setSendingToAI(false);
    };

    socket.on("new_message", onNewMsg);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("user_status", onStatus);
    socket.on("simuu_typing", onSimuuTyping);
    socket.on("simuu_replied", onSimuuReplied);

    return () => {
      socket.off("new_message", onNewMsg);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
      socket.off("user_status", onStatus);
      socket.off("simuu_typing", onSimuuTyping);
      socket.off("simuu_replied", onSimuuReplied);
    };
  }, [socket, id, user?.id, isAI]);

  const handleTypingStart = () => {
    if (!isAI) socket?.emit("typing", { toUserId: id, fromUserId: user?.id });
  };
  const handleTypingStop = () => {
    if (!isAI) socket?.emit("stop_typing", { toUserId: id, fromUserId: user?.id });
  };

  const handleSend = useCallback(async (content: string, type = "text", metadata?: unknown) => {
    if (!user) return;

    const tempMsg: Message = {
      id: uid(),
      fromUserId: user.id,
      toUserId: id,
      content,
      type,
      metadata,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    if (isAI) setSendingToAI(true);

    try {
      const res = await apiRequest("POST", "/api/messages", { toUserId: id, content, type, metadata });
      if (!res.ok) {
        const data = await res.json();
        console.error("Send failed:", data.error);
        if (isAI) setSendingToAI(false);
        return;
      }
      const saved = await res.json();
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? saved : m));
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    } catch {
      if (isAI) setSendingToAI(false);
    }
  }, [user, id, isAI]);

  const handleCall = (type: "audio" | "video") => {
    router.push({ pathname: `/call/${id}`, params: { callType: type } });
  };

  const reversed = [...messages].reverse();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.tint} />
        </Pressable>

        <View style={styles.headerInfo}>
          {avatarUrl ? (
            <View style={styles.avatarWrap}>
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              {isOnline && <View style={[styles.onlineDot, { backgroundColor: theme.online, borderColor: theme.surface }]} />}
            </View>
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: isAI ? theme.aiAccentDim : theme.tintDim }]}>
              {isAI
                ? <Ionicons name="sparkles" size={16} color={theme.aiAccent} />
                : <Text style={[styles.headerInitials, { color: theme.tint }]}>{partnerName.slice(0, 2).toUpperCase()}</Text>
              }
              {isOnline && <View style={[styles.onlineDot, { backgroundColor: theme.online, borderColor: theme.surface }]} />}
            </View>
          )}
          <View>
            <Text style={[styles.headerName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>{partnerName}</Text>
            <Text style={[styles.headerStatus, {
              color: isAI ? theme.aiAccent : (isOnline ? theme.online : theme.textMuted),
              fontFamily: "Inter_400Regular"
            }]}>
              {isAI ? (sendingToAI ? "typing..." : "AI Friend") : (isOnline ? "Online" : "Offline")}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {!isAI && (
            <>
              <Pressable onPress={() => handleCall("audio")} hitSlop={8} style={styles.headerActionBtn}>
                <Ionicons name="call-outline" size={22} color={theme.tint} />
              </Pressable>
              <Pressable onPress={() => handleCall("video")} hitSlop={8} style={styles.headerActionBtn}>
                <Ionicons name="videocam-outline" size={22} color={theme.tint} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {loadingMessages ? (
          <View style={styles.center}>
            <ActivityIndicator color={isAI ? theme.aiAccent : theme.tint} size="large" />
          </View>
        ) : (
          <FlatList
            data={reversed}
            keyExtractor={item => item.id}
            inverted={messages.length > 0}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMe={item.fromUserId === user?.id}
              />
            )}
            ListHeaderComponent={
              (showTyping || peerTyping) ? (
                isAI ? <AITypingIndicator /> : <TypingIndicator />
              ) : null
            }
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
          />
        )}
        <View style={{ paddingBottom: bottomPadding }}>
          <ChatInput
            onSend={handleSend}
            disabled={sendingToAI && isAI}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingBottom: 10,
    borderBottomWidth: 1, gap: 8,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatarWrap: { position: "relative" },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  headerInitials: { fontSize: 14, fontFamily: "Inter_700Bold" },
  onlineDot: {
    position: "absolute", bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5, borderWidth: 1.5,
  },
  headerName: { fontSize: 16 },
  headerStatus: { fontSize: 12 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerActionBtn: { padding: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

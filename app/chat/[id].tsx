import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetch as expoFetch } from "expo/fetch";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator, AITypingIndicator } from "@/components/TypingIndicator";
import { ChatInput } from "@/components/ChatInput";
import { getApiUrl, apiRequest } from "@/lib/query-client";

const AI_ID = "ai-girlfriend";

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

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isAI = id === AI_ID;
  const { theme } = useTheme();
  const { user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerUser, setPeerUser] = useState<{ displayName: string; isOnline?: boolean } | null>(null);
  const initRef = useRef(false);

  const partnerName = isAI ? "Aria" : (peerUser?.displayName ?? "...");
  const isOnline = isAI ? true : (peerUser?.isOnline ?? false);

  useEffect(() => {
    loadInitial();
  }, [id]);

  const loadInitial = async () => {
    setLoadingMessages(true);
    try {
      if (!isAI && id) {
        const userRes = await apiRequest("GET", `/api/users/${id}`);
        const userData = await userRes.json();
        setPeerUser(userData);
      }

      if (isAI) {
        const aiRes = await apiRequest("GET", "/api/ai/messages");
        const aiData = await aiRes.json();
        const mapped: Message[] = aiData.map((m: any) => ({
          id: uid(),
          fromUserId: m.role === "user" ? (user?.id ?? "") : AI_ID,
          toUserId: m.role === "user" ? AI_ID : (user?.id ?? ""),
          content: m.content,
          type: "text",
          createdAt: m.createdAt,
        }));
        setMessages(mapped);
      } else {
        const msgRes = await apiRequest("GET", `/api/messages/${id}`);
        const msgData: Message[] = await msgRes.json();
        setMessages(msgData);
      }
    } catch {}
    finally { setLoadingMessages(false); }
  };

  useEffect(() => {
    if (!socket || isAI) return;
    const onNewMsg = (msg: Message) => {
      if ((msg.fromUserId === id && msg.toUserId === user?.id) ||
          (msg.fromUserId === user?.id && msg.toUserId === id)) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === msg.id);
          return exists ? prev : [...prev, msg];
        });
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
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
    socket.on("new_message", onNewMsg);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("user_status", onStatus);
    return () => {
      socket.off("new_message", onNewMsg);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
      socket.off("user_status", onStatus);
    };
  }, [socket, id, user?.id]);

  const handleTypingStart = () => {
    if (!isAI) socket?.emit("typing", { toUserId: id, fromUserId: user?.id });
  };
  const handleTypingStop = () => {
    if (!isAI) socket?.emit("stop_typing", { toUserId: id, fromUserId: user?.id });
  };

  const handleSend = useCallback(async (content: string, type = "text", metadata?: unknown) => {
    if (!user) return;

    if (isAI) {
      const userMsg: Message = {
        id: uid(),
        fromUserId: user.id,
        toUserId: AI_ID,
        content,
        type,
        metadata,
        createdAt: new Date().toISOString(),
      };
      const captured = [...messages];
      setMessages(prev => [...prev, userMsg]);
      setIsStreaming(true);
      setShowTyping(true);

      let fullContent = "";
      let assistantAdded = false;

      try {
        const baseUrl = getApiUrl();
        const response = await expoFetch(`${baseUrl}api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
          body: JSON.stringify({ content }),
          credentials: "include",
        });

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No body");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                if (!assistantAdded) {
                  setShowTyping(false);
                  setMessages(prev => [...prev, {
                    id: uid(),
                    fromUserId: AI_ID,
                    toUserId: user.id,
                    content: fullContent,
                    type: "text",
                    createdAt: new Date().toISOString(),
                  }]);
                  assistantAdded = true;
                } else {
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                    return updated;
                  });
                }
              }
            } catch {}
          }
        }
      } catch {
        setShowTyping(false);
        if (!assistantAdded) {
          setMessages(prev => [...prev, {
            id: uid(),
            fromUserId: AI_ID,
            toUserId: user.id,
            content: "Sorry, I'm having trouble right now. Try again?",
            type: "text",
            createdAt: new Date().toISOString(),
          }]);
        }
      } finally {
        setIsStreaming(false);
        setShowTyping(false);
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      }
    } else {
      try {
        const res = await apiRequest("POST", "/api/messages", {
          toUserId: id,
          content,
          type,
          metadata,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      } catch {}
    }
  }, [messages, user, id, isAI, socket]);

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
          <View style={[styles.headerAvatar, { backgroundColor: isAI ? theme.aiAccentDim : theme.tintDim }]}>
            {isAI
              ? <Ionicons name="sparkles" size={18} color={theme.aiAccent} />
              : <Text style={[styles.headerInitials, { color: theme.tint }]}>{partnerName.slice(0, 2).toUpperCase()}</Text>
            }
          </View>
          <View>
            <Text style={[styles.headerName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>{partnerName}</Text>
            <Text style={[styles.headerStatus, {
              color: isAI ? theme.aiAccent : (isOnline ? theme.online : theme.textMuted),
              fontFamily: "Inter_400Regular"
            }]}>
              {isAI ? "AI Companion" : (isOnline ? "Online" : "Offline")}
            </Text>
          </View>
        </View>
        {isAI && (
          <Pressable
            onPress={async () => {
              await apiRequest("DELETE", "/api/ai/messages");
              setMessages([]);
            }}
            hitSlop={8}
            style={styles.clearBtn}
          >
            <Ionicons name="trash-outline" size={20} color={theme.textMuted} />
          </Pressable>
        )}
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
            disabled={isStreaming}
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerInitials: { fontSize: 14, fontFamily: "Inter_700Bold" },
  headerName: { fontSize: 16 },
  headerStatus: { fontSize: 12 },
  clearBtn: { padding: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

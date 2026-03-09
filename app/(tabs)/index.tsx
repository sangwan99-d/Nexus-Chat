import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, TextInput,
  ActivityIndicator, RefreshControl, Platform, Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { ChatListItem } from "@/components/ChatListItem";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import * as Haptics from "expo-haptics";

interface AiUserInfo {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isAiUser?: boolean;
}

interface Conversation {
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
    lastSeen?: string | null;
    isAiUser?: boolean;
  };
  lastMessage?: {
    content: string;
    type: string;
    createdAt?: string;
    fromUserId: string;
  } | null;
}

export default function ChatsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState<Conversation | null>(null);
  const [searching, setSearching] = useState(false);
  const [simuuUser, setSimuuUser] = useState<AiUserInfo | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ fromUser: any; callType: string; offer: any; fromSocketId: string } | null>(null);

  const { data: conversations = [], isLoading, refetch, isRefetching } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  useEffect(() => {
    loadSimuu();
  }, [user]);

  const loadSimuu = async () => {
    if (!user?.hasAiAccess) return;
    try {
      const res = await apiRequest("GET", "/api/system/ai-user");
      const data = await res.json();
      if (data.aiUser) setSimuuUser(data.aiUser);
    } catch {}
  };

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    };
    const handleIncomingCall = (data: any) => {
      setIncomingCall(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };
    socket.on("new_message", handleNewMessage);
    socket.on("call:incoming", handleIncomingCall);
    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("call:incoming", handleIncomingCall);
    };
  }, [socket]);

  const handleSearch = useCallback(async (text: string) => {
    setSearch(text);
    if (text.length < 3) { setSearchResult(null); return; }
    setSearching(true);
    try {
      const url = new URL(`/api/users/search?phone=${encodeURIComponent(text)}`, getApiUrl());
      const { fetch: expoFetch } = await import("expo/fetch");
      const res = await expoFetch(url.toString(), { credentials: "include" });
      const data: any[] = await res.json();
      if (data.length > 0) {
        setSearchResult({ user: data[0], lastMessage: null });
      } else {
        setSearchResult(null);
      }
    } catch {}
    finally { setSearching(false); }
  }, []);

  const acceptCall = () => {
    if (!incomingCall) return;
    const from = incomingCall.fromUser;
    setIncomingCall(null);
    router.push({
      pathname: `/call/${from.id}`,
      params: {
        callType: incomingCall.callType,
        incoming: "true",
        fromSocketId: incomingCall.fromSocketId,
        offerJson: JSON.stringify(incomingCall.offer),
      },
    });
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    socket?.emit("call:reject", { toUserId: incomingCall.fromUser?.id });
    setIncomingCall(null);
  };

  const allChats = React.useMemo(() => {
    if (search && searchResult) return [searchResult];
    return conversations.filter(c =>
      c.user.displayName.toLowerCase().includes(search.toLowerCase())
    );
  }, [conversations, search, searchResult]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const baseUrl = getApiUrl().replace(/\/$/, "");

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>Chats</Text>
        {user?.hasAiAccess && simuuUser ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/chat/${simuuUser.id}`);
            }}
            style={[styles.aiBtn, { backgroundColor: theme.aiAccentDim, borderColor: theme.aiAccent + "40" }]}
          >
            <Ionicons name="sparkles" size={16} color={theme.aiAccent} />
            <Text style={[styles.aiBtnText, { color: theme.aiAccent, fontFamily: "Inter_600SemiBold" }]}>Simuu</Text>
          </Pressable>
        ) : null}
      </View>

      {incomingCall ? (
        <View style={[styles.callBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.callBannerInfo}>
            <View style={[styles.callBannerIcon, { backgroundColor: "#4CAF5020" }]}>
              <Ionicons name={incomingCall.callType === "video" ? "videocam" : "call"} size={20} color="#4CAF50" />
            </View>
            <View>
              <Text style={[styles.callBannerName, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
                {incomingCall.fromUser?.displayName || "Someone"}
              </Text>
              <Text style={[styles.callBannerSubtitle, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Incoming {incomingCall.callType} call
              </Text>
            </View>
          </View>
          <View style={styles.callBannerActions}>
            <Pressable style={[styles.callActionBtn, { backgroundColor: "#FF3B30" }]} onPress={rejectCall}>
              <Ionicons name="call" size={18} color="white" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
            <Pressable style={[styles.callActionBtn, { backgroundColor: "#4CAF50" }]} onPress={acceptCall}>
              <Ionicons name="call" size={18} color="white" />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[styles.searchWrap, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={17} color={theme.textMuted} style={{ marginLeft: 12 }} />
        <TextInput
          style={[styles.searchInput, { color: theme.text, fontFamily: "Inter_400Regular" }]}
          value={search}
          onChangeText={handleSearch}
          placeholder="Search by name or phone..."
          placeholderTextColor={theme.textMuted}
          clearButtonMode="while-editing"
        />
        {searching && <ActivityIndicator size="small" color={theme.tint} style={{ marginRight: 12 }} />}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.tint} size="large" />
        </View>
      ) : (
        <FlatList
          data={allChats}
          keyExtractor={item => item.user.id}
          renderItem={({ item }) => (
            <ChatListItem
              item={{ ...item, isAI: !!item.user.isAiUser }}
              currentUserId={user?.id ?? ""}
              onPress={() => router.push(`/chat/${item.user.id}`)}
            />
          )}
          ListHeaderComponent={
            search === "" && user?.hasAiAccess && simuuUser ? (
              <ChatListItem
                item={{ user: { ...simuuUser, isOnline: true }, lastMessage: null, isAI: true }}
                currentUserId={user?.id ?? ""}
                onPress={() => router.push(`/chat/${simuuUser.id}`)}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.tint} />
          }
          ListEmptyComponent={
            search ? (
              <View style={styles.empty}>
                <Ionicons name="search" size={36} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  No user found with that number
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.text, fontFamily: "Inter_600SemiBold" }]}>
                  No conversations yet
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  Search for a phone number to start chatting
                </Text>
              </View>
            )
          }
        />
      )}
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
  aiBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  aiBtnText: { fontSize: 14 },
  callBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 14, borderWidth: 1,
  },
  callBannerInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  callBannerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  callBannerName: { fontSize: 15 },
  callBannerSubtitle: { fontSize: 13 },
  callBannerActions: { flexDirection: "row", gap: 10 },
  callActionBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 12, marginVertical: 8, borderRadius: 12, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10, paddingRight: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, marginTop: 4 },
  emptyText: { fontSize: 14, textAlign: "center" },
});

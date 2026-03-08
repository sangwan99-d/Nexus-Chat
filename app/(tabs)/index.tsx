import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, TextInput,
  ActivityIndicator, RefreshControl, Platform
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { ChatListItem } from "@/components/ChatListItem";
import * as Haptics from "expo-haptics";

const AI_USER = {
  id: "ai-girlfriend",
  displayName: "Aria",
  avatarUrl: null,
  isOnline: true,
  lastSeen: null,
};

interface Conversation {
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
    lastSeen?: string | null;
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

  const { data: conversations = [], isLoading, refetch, isRefetching } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    };
    socket.on("new_message", handleNewMessage);
    return () => { socket.off("new_message", handleNewMessage); };
  }, [socket]);

  const handleSearch = useCallback(async (text: string) => {
    setSearch(text);
    if (text.length < 3) { setSearchResult(null); return; }
    setSearching(true);
    try {
      const { getApiUrl } = await import("@/lib/query-client");
      const { fetch: expoFetch } = await import("expo/fetch");
      const url = new URL(`/api/users/search?phone=${encodeURIComponent(text)}`, getApiUrl());
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

  const allChats = React.useMemo(() => {
    const filtered = search && searchResult
      ? [searchResult]
      : conversations.filter(c =>
          c.user.displayName.toLowerCase().includes(search.toLowerCase())
        );
    return filtered;
  }, [conversations, search, searchResult]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 84 : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text, fontFamily: "Inter_700Bold" }]}>Chats</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/chat/ai-girlfriend");
          }}
          style={[styles.aiBtn, { backgroundColor: theme.aiAccentDim, borderColor: theme.aiAccent + "40" }]}
        >
          <Ionicons name="sparkles" size={16} color={theme.aiAccent} />
          <Text style={[styles.aiBtnText, { color: theme.aiAccent, fontFamily: "Inter_600SemiBold" }]}>Aria</Text>
        </Pressable>
      </View>

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
              item={{ ...item, isAI: item.user.id === "ai-girlfriend" }}
              currentUserId={user?.id ?? ""}
              onPress={() => router.push(`/chat/${item.user.id}`)}
            />
          )}
          ListHeaderComponent={
            search === "" ? (
              <ChatListItem
                item={{ user: AI_USER, lastMessage: null, isAI: true }}
                currentUserId={user?.id ?? ""}
                onPress={() => router.push("/chat/ai-girlfriend")}
              />
            ) : null
          }
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.tint}
            />
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
          style={{ paddingBottom: bottomPadding }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28 },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  aiBtnText: { fontSize: 14 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10, paddingRight: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, marginTop: 4 },
  emptyText: { fontSize: 14, textAlign: "center" },
});

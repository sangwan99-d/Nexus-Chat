import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay } from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";

function Dot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 400 }),
      -1,
      true
    ));
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
  );
}

export function TypingIndicator() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.bubbleThem }]}>
      <Dot delay={0} color={theme.textSecondary} />
      <Dot delay={160} color={theme.textSecondary} />
      <Dot delay={320} color={theme.textSecondary} />
    </View>
  );
}

export function AITypingIndicator() {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.aiAccentDim, borderWidth: 1, borderColor: theme.aiAccent + "40" }]}>
      <Dot delay={0} color={theme.aiAccent} />
      <Dot delay={160} color={theme.aiAccent} />
      <Dot delay={320} color={theme.aiAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    alignSelf: "flex-start",
    marginVertical: 2,
    marginHorizontal: 12,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

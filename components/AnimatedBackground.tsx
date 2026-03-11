import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "@/context/ThemeContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ParticleConfig {
  size: number;
  initialX: number;
  initialY: number;
  targetX: number;
  targetY: number;
  color: string;
  delay: number;
  duration: number;
  maxOpacity: number;
}

function Particle({ config }: { config: ParticleConfig }) {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    pulse.value = withDelay(
      config.delay + 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: config.duration * 0.6, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: config.duration * 0.4, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [config.initialX, config.targetX]);
    const translateY = interpolate(progress.value, [0, 1], [config.initialY, config.targetY]);
    const scale = interpolate(pulse.value, [0, 1], [0.8, 1.3]);
    const opacity = interpolate(pulse.value, [0, 0.5, 1], [config.maxOpacity * 0.4, config.maxOpacity, config.maxOpacity * 0.6]);

    return {
      transform: [{ translateX }, { translateY }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
        },
        animStyle,
      ]}
    />
  );
}

function GlowOrb({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const scale = interpolate(glow.value, [0, 1], [0.9, 1.15]);
    const opacity = interpolate(glow.value, [0, 1], [0.06, 0.14]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

export function AnimatedBackground() {
  const { theme } = useTheme();

  // Use fewer particles on web for performance
  const isWeb = Platform.OS === "web";

  const particles: ParticleConfig[] = [
    { size: 18, initialX: SCREEN_WIDTH * 0.15, initialY: SCREEN_HEIGHT * 0.8, targetX: SCREEN_WIDTH * 0.25, targetY: SCREEN_HEIGHT * 0.45, color: theme.tint, delay: 0, duration: 8000, maxOpacity: 0.3 },
    { size: 14, initialX: SCREEN_WIDTH * 0.75, initialY: SCREEN_HEIGHT * 0.7, targetX: SCREEN_WIDTH * 0.65, targetY: SCREEN_HEIGHT * 0.35, color: theme.aiAccent, delay: 500, duration: 9000, maxOpacity: 0.25 },
    { size: 22, initialX: SCREEN_WIDTH * 0.45, initialY: SCREEN_HEIGHT * 0.85, targetX: SCREEN_WIDTH * 0.5, targetY: SCREEN_HEIGHT * 0.4, color: theme.tint, delay: 1000, duration: 10000, maxOpacity: 0.2 },
    { size: 12, initialX: SCREEN_WIDTH * 0.85, initialY: SCREEN_HEIGHT * 0.55, targetX: SCREEN_WIDTH * 0.7, targetY: SCREEN_HEIGHT * 0.2, color: theme.online, delay: 1500, duration: 7000, maxOpacity: 0.25 },
    { size: 16, initialX: SCREEN_WIDTH * 0.3, initialY: SCREEN_HEIGHT * 0.35, targetX: SCREEN_WIDTH * 0.5, targetY: SCREEN_HEIGHT * 0.1, color: theme.aiAccent, delay: 2000, duration: 8500, maxOpacity: 0.2 },
  ];

  // Only use first 3 particles on web
  const activeParticles = isWeb ? particles.slice(0, 3) : particles;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background, overflow: "hidden" }]} pointerEvents="none">
      {/* Ambient glow orbs */}
      <GlowOrb x={SCREEN_WIDTH * 0.2} y={SCREEN_HEIGHT * 0.25} size={180} color={theme.tint} delay={0} />
      <GlowOrb x={SCREEN_WIDTH * 0.8} y={SCREEN_HEIGHT * 0.6} size={160} color={theme.aiAccent} delay={1000} />
      {!isWeb && <GlowOrb x={SCREEN_WIDTH * 0.5} y={SCREEN_HEIGHT * 0.8} size={140} color={theme.tint} delay={2000} />}

      {/* Floating particles */}
      {activeParticles.map((config, i) => (
        <Particle key={i} config={config} />
      ))}
    </View>
  );
}

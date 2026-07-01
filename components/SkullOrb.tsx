import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { OrbState } from '../stores/javis';
import { C } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface SkullOrbProps {
  state: OrbState;
  size?: number;
}

export default function SkullOrb({ state, size = 240 }: SkullOrbProps) {
  const pulse = useSharedValue(0);
  const rotate = useSharedValue(0);
  const glow = useSharedValue(0.4);
  const eyeGlow = useSharedValue(0.7);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Ring rotation — always on
    rotate.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );

    if (state === 'idle') {
      pulse.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
      glow.value = withRepeat(withTiming(0.5, { duration: 2500 }), -1, true);
      eyeGlow.value = withRepeat(withTiming(0.5, { duration: 1800 }), -1, true);
      scale.value = withRepeat(withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.sine) }), -1, true);
    } else if (state === 'listening') {
      pulse.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
      glow.value = withRepeat(withTiming(1, { duration: 500 }), -1, true);
      eyeGlow.value = 1;
      scale.value = withRepeat(withTiming(1.05, { duration: 600, easing: Easing.out(Easing.exp) }), -1, true);
    } else if (state === 'thinking') {
      pulse.value = withRepeat(withTiming(1, { duration: 300 }), -1, true);
      glow.value = 0.8;
      eyeGlow.value = withRepeat(
        withSequence(withTiming(0.2, { duration: 200 }), withTiming(1, { duration: 200 })),
        -1, false,
      );
      scale.value = 1;
    } else if (state === 'speaking') {
      pulse.value = withRepeat(withTiming(1, { duration: 400 }), -1, true);
      glow.value = withRepeat(
        withSequence(withTiming(0.6, { duration: 300 }), withTiming(1, { duration: 300 })),
        -1, false,
      );
      eyeGlow.value = 0.9;
      scale.value = withRepeat(withTiming(1.04, { duration: 400, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else if (state === 'executing') {
      pulse.value = withRepeat(withTiming(1, { duration: 200 }), -1, true);
      glow.value = 1;
      eyeGlow.value = withRepeat(
        withSequence(withTiming(0, { duration: 150 }), withTiming(1, { duration: 150 })),
        -1, false,
      );
    } else if (state === 'done') {
      pulse.value = withTiming(0.3, { duration: 500 });
      glow.value = withTiming(0.5, { duration: 500 });
      eyeGlow.value = withTiming(0.6, { duration: 500 });
      scale.value = withTiming(1, { duration: 300 });
    }
  }, [state]);

  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.2, 0.8]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.95, 1.08]) }],
  }));

  const middleRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 0.6]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.98, 1.04]) }, { rotate: `${rotate.value}deg` }],
  }));

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(glow.value, [0, 1], [0.85, 1]),
  }));

  const eyeProps = useAnimatedProps(() => ({
    opacity: interpolate(eyeGlow.value, [0, 1], [0.4, 1]),
  }));

  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const skullR = s * 0.27;

  return (
    <View style={[styles.container, { width: s, height: s }]}>
      {/* Outer glow rings */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, outerRingStyle]}>
        <Svg width={s} height={s}>
          <Defs>
            <RadialGradient id="glowOuter" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={C.red} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={C.red} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={cx} cy={cy} r={s * 0.46} fill="url(#glowOuter)" />
          <Circle cx={cx} cy={cy} r={s * 0.44} stroke={C.red} strokeWidth={1.5} fill="none" opacity={0.6} />
        </Svg>
      </Animated.View>

      {/* Rotating ring */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, middleRingStyle]}>
        <Svg width={s} height={s}>
          {/* Dashed energy ring */}
          <Circle
            cx={cx} cy={cy} r={s * 0.38}
            stroke={C.red} strokeWidth={2}
            fill="none"
            strokeDasharray="8 6"
            opacity={0.8}
          />
          {/* Inner solid ring */}
          <Circle cx={cx} cy={cy} r={s * 0.31} stroke={C.redMid} strokeWidth={1} fill="none" opacity={0.5} />
        </Svg>
      </Animated.View>

      {/* Skull body */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, orbStyle]}>
        <Svg width={s} height={s}>
          <Defs>
            <RadialGradient id="skullGrad" cx="40%" cy="35%" r="65%">
              <Stop offset="0%" stopColor="#2A2A2A" stopOpacity={1} />
              <Stop offset="100%" stopColor="#0A0A0A" stopOpacity={1} />
            </RadialGradient>
            <RadialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={C.red} stopOpacity={1} />
              <Stop offset="100%" stopColor={C.redDark} stopOpacity={0.6} />
            </RadialGradient>
          </Defs>

          {/* Skull cranium */}
          <Circle cx={cx} cy={cy - s * 0.03} r={skullR} fill="url(#skullGrad)" stroke="#333" strokeWidth={1} />

          {/* Jaw */}
          <Rect
            x={cx - skullR * 0.75}
            y={cy + skullR * 0.55}
            width={skullR * 1.5}
            height={skullR * 0.55}
            rx={skullR * 0.2}
            fill="url(#skullGrad)"
            stroke="#333"
            strokeWidth={1}
          />

          {/* Left eye socket */}
          <AnimatedCircle
            cx={cx - skullR * 0.38}
            cy={cy - s * 0.03 - skullR * 0.05}
            r={skullR * 0.28}
            fill="url(#eyeGlow)"
            animatedProps={eyeProps}
          />

          {/* Right eye socket */}
          <AnimatedCircle
            cx={cx + skullR * 0.38}
            cy={cy - s * 0.03 - skullR * 0.05}
            r={skullR * 0.28}
            fill="url(#eyeGlow)"
            animatedProps={eyeProps}
          />

          {/* Eye pupils (dark centers) */}
          <Circle cx={cx - skullR * 0.38} cy={cy - s * 0.03 - skullR * 0.05} r={skullR * 0.12} fill="#000" opacity={0.8} />
          <Circle cx={cx + skullR * 0.38} cy={cy - s * 0.03 - skullR * 0.05} r={skullR * 0.12} fill="#000" opacity={0.8} />

          {/* Nasal cavity */}
          <Path
            d={`M ${cx} ${cy + skullR * 0.22} L ${cx - skullR * 0.1} ${cy + skullR * 0.42} L ${cx + skullR * 0.1} ${cy + skullR * 0.42} Z`}
            fill={C.red}
            opacity={0.5}
          />

          {/* Teeth */}
          {[0, 1, 2, 3, 4].map((i) => (
            <Rect
              key={i}
              x={cx - skullR * 0.62 + i * (skullR * 0.28)}
              y={cy + skullR * 0.61}
              width={skullR * 0.22}
              height={skullR * 0.32}
              rx={skullR * 0.06}
              fill="#E0E0E0"
              opacity={0.25}
            />
          ))}

          {/* Mechanical bolts */}
          <Circle cx={cx - skullR * 0.82} cy={cy - skullR * 0.6} r={skullR * 0.07} fill="#555" stroke="#777" strokeWidth={0.5} />
          <Circle cx={cx + skullR * 0.82} cy={cy - skullR * 0.6} r={skullR * 0.07} fill="#555" stroke="#777" strokeWidth={0.5} />

          {/* Status LEDs */}
          <Circle cx={cx - skullR * 0.82} cy={cy + skullR * 0.75} r={skullR * 0.08} fill={C.green} opacity={0.9} />
          <Circle cx={cx + skullR * 0.82} cy={cy + skullR * 0.75} r={skullR * 0.08} fill={C.green} opacity={0.9} />

          {/* LED glow halos */}
          <Circle cx={cx - skullR * 0.82} cy={cy + skullR * 0.75} r={skullR * 0.16} fill={C.green} opacity={0.15} />
          <Circle cx={cx + skullR * 0.82} cy={cy + skullR * 0.75} r={skullR * 0.16} fill={C.green} opacity={0.15} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center' },
  center: { justifyContent: 'center', alignItems: 'center' },
});

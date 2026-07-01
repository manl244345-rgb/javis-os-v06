import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, PermissionsAndroid, AppState, Vibration,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import * as Battery from "expo-battery";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import SkullOrb from "../components/SkullOrb";
import { useJavis, type OrbState } from "../stores/javis";
import { askAI } from "../services/ai";
import { runOfflineAI } from "../services/offlineAI";
import { executeAction } from "../services/commands";
import { C } from "../constants/theme";

const SWIPE_THRESHOLD = 70;

const STATUS_TEXT: Record<OrbState, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  thinking: "PROCESSING",
  executing: "EXECUTING",
  speaking: "SPEAKING",
  done: "COMPLETE",
};

const STATUS_COLOR: Record<OrbState, string> = {
  idle: C.grayLight,
  listening: C.green,
  thinking: C.gold,
  executing: "#00C8FF",
  speaking: C.red,
  done: C.green,
};

const FAVORITES = [
  { icon: "whatsapp", label: "WhatsApp", pkg: "whatsapp" },
  { icon: "phone", label: "Phone", pkg: "phone" },
  { icon: "google-chrome", label: "Chrome", pkg: "chrome" },
  { icon: "youtube", label: "YouTube", pkg: "youtube" },
];

function getGreeting(name: string) {
  const h = new Date().getHours();
  if (h < 5) return `Good night, ${name}`;
  if (h < 12) return `Good morning, ${name}`;
  if (h < 17) return `Good afternoon, ${name}`;
  if (h < 21) return `Good evening, ${name}`;
  return `Good night, ${name}`;
}

async function requestPermissions() {
  if (Platform.OS !== "android") return;
  try {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    ]);
  } catch { /* non-critical */ }
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    orbState, setOrbState, userName, voiceEnabled, voiceProfile,
    addMessage, messages, groqKey,
  } = useJavis();

  const [time, setTime] = useState(new Date());
  const [battery, setBattery] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Swipe translation for visual feedback
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const navOpacity = useSharedValue(0);

  // ─── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    requestPermissions();
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Battery ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Battery.getBatteryLevelAsync().then((lvl) => setBattery(Math.round(lvl * 100))).catch(() => {});
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) =>
      setBattery(Math.round(batteryLevel * 100))
    );
    return () => sub.remove();
  }, []);

  // ─── Swipe navigation ─────────────────────────────────────────────────────
  const navigateTo = useCallback((path: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(path as never);
  }, []);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .minDistance(40)
    .onUpdate((e) => {
      translateX.value = e.translationX * 0.15;
      translateY.value = e.translationY * 0.15;
      navOpacity.value = Math.min(Math.abs(e.translationX) + Math.abs(e.translationY), 80) / 80;
    })
    .onEnd((e) => {
      const dx = e.translationX;
      const dy = e.translationY;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      navOpacity.value = withTiming(0, { duration: 200 });

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < -SWIPE_THRESHOLD) runOnJS(navigateTo)("/chat");
        else if (dx > SWIPE_THRESHOLD) runOnJS(navigateTo)("/memory");
      } else {
        if (dy < -SWIPE_THRESHOLD) runOnJS(navigateTo)("/apps");
        else if (dy > SWIPE_THRESHOLD) runOnJS(navigateTo)("/mission-control");
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const navHintStyle = useAnimatedStyle(() => ({ opacity: navOpacity.value }));

  // ─── Voice pipeline ───────────────────────────────────────────────────────
  const speakText = useCallback((text: string, onDone?: () => void) => {
    if (Platform.OS === "web" || !voiceEnabled) { onDone?.(); return; }
    Speech.stop();
    const VOICE_CONFIG = {
      jarvis:       { pitch: 0.72, rate: 0.88 },
      professional: { pitch: 0.78, rate: 0.90 },
      friendly:     { pitch: 0.83, rate: 0.95 },
      deep:         { pitch: 0.62, rate: 0.83 },
    };
    const cfg = VOICE_CONFIG[voiceProfile] ?? VOICE_CONFIG.jarvis;
    setOrbState("speaking");
    Speech.speak(text, {
      language: "en-US",
      pitch: cfg.pitch,
      rate: cfg.rate,
      onDone: () => { setOrbState("idle"); onDone?.(); },
      onStopped: () => { setOrbState("idle"); onDone?.(); },
      onError: () => { setOrbState("idle"); onDone?.(); },
    });
  }, [voiceEnabled, voiceProfile, setOrbState]);

  const processInput = useCallback(async (text: string) => {
    if (!text.trim()) { setOrbState("idle"); return; }

    addMessage({ id: Date.now().toString(), role: "user", text, timestamp: Date.now() });
    setOrbState("thinking");

    try {
      // Try offline NLP first
      const offline = runOfflineAI(text, userName);
      let response = offline;

      // If confidence low and Groq available, use online AI
      if (offline.confidence < 0.85 && groqKey) {
        try {
          const online = await askAI(text);
          response = { ...online, confidence: 1, offline: true };
        } catch { /* use offline result */ }
      } else if (offline.confidence < 0.85) {
        const online = await askAI(text);
        response = { ...online, confidence: 1, offline: true };
      }

      addMessage({ id: (Date.now() + 1).toString(), role: "javis", text: response.reply, timestamp: Date.now() });

      // Execute any device actions
      if (response.action) {
        setOrbState("executing");
        await executeAction(response.action, response.target, response.data ?? {});
      }

      speakText(response.reply);
    } catch {
      const err = "Connection lost, " + userName + ". Operating on backup systems.";
      addMessage({ id: (Date.now() + 1).toString(), role: "javis", text: err, timestamp: Date.now() });
      speakText(err);
    }
  }, [userName, groqKey, addMessage, setOrbState, speakText]);

  const startListening = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (isRecording) return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Vibration.vibrate(80);
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setOrbState("listening");
    } catch { setOrbState("idle"); }
  }, [isRecording, setOrbState]);

  const stopListening = useCallback(async () => {
    if (!recordingRef.current || !isRecording) return;
    setIsRecording(false);
    setOrbState("thinking");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) { setOrbState("idle"); return; }

      const apiKey = groqKey || "";
      if (!apiKey) {
        // No Groq key — show a prompt to type
        setOrbState("idle");
        speakText("Please type your command or add a Groq key in Settings.");
        return;
      }

      const form = new FormData();
      form.append("file", { uri, name: "voice.m4a", type: "audio/m4a" } as unknown as Blob);
      form.append("model", "whisper-large-v3");
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = (await res.json()) as { text: string };
      if (data.text?.trim()) await processInput(data.text.trim());
      else setOrbState("idle");
    } catch {
      recordingRef.current = null;
      setOrbState("idle");
    }
  }, [isRecording, groqKey, processInput, setOrbState, speakText]);

  // ─── UI ───────────────────────────────────────────────────────────────────
  const hours = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const lastMsg = messages.find((m) => m.role === "javis")?.text ?? "JAVIS OS Online";

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View style={[styles.root, animStyle, { paddingTop: insets.top }]}>

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>{getGreeting(userName)}</Text>
            <Text style={styles.date}>
              {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </Text>
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity onPress={() => router.push("/settings" as never)}>
              <Feather name="settings" size={20} color={C.grayLight} />
            </TouchableOpacity>
            {battery !== null && (
              <View style={styles.batteryRow}>
                <MaterialCommunityIcons
                  name={battery > 80 ? "battery" : battery > 40 ? "battery-70" : battery > 20 ? "battery-30" : "battery-10"}
                  size={18}
                  color={battery < 20 ? C.red : C.green}
                />
                <Text style={[styles.batteryText, { color: battery < 20 ? C.red : C.grayLight }]}>
                  {battery}%
                </Text>
              </View>
            )}
            <Text style={styles.clockText}>{hours}</Text>
          </View>
        </View>

        {/* ── Nav hints ───────────────────────────────────────────────────── */}
        <Animated.View style={[styles.navHints, navHintStyle]}>
          <Text style={styles.navHint}>↑ APPS</Text>
          <View style={styles.navRow}>
            <Text style={styles.navHint}>← CHAT</Text>
            <Text style={styles.navHint}>MEMORY →</Text>
          </View>
          <Text style={styles.navHint}>↓ CONTROL</Text>
        </Animated.View>

        {/* ── Skull Orb ───────────────────────────────────────────────────── */}
        <View style={styles.orbSection}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/chat" as never)}>
            <SkullOrb state={orbState} size={220} />
          </TouchableOpacity>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[orbState] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLOR[orbState] }]}>
              {STATUS_TEXT[orbState]}
            </Text>
          </View>

          <Text style={styles.lastMsg} numberOfLines={2}>
            {lastMsg}
          </Text>
        </View>

        {/* ── Favorites ───────────────────────────────────────────────────── */}
        <View style={[styles.favSection, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.favLabel}>FAVORITES</Text>
          <View style={styles.favRow}>
            {FAVORITES.map((fav) => (
              <TouchableOpacity
                key={fav.pkg}
                style={styles.favItem}
                onPress={() => processInput(`open ${fav.label}`)}
                activeOpacity={0.7}
              >
                <View style={styles.favIcon}>
                  <MaterialCommunityIcons name={fav.icon as never} size={26} color={C.white} />
                </View>
                <Text style={styles.favText}>{fav.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Voice button ──────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
            onPressIn={startListening}
            onPressOut={stopListening}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={isRecording ? "microphone" : "microphone-outline"}
              size={30}
              color={isRecording ? C.white : C.red}
            />
            <Text style={[styles.voiceBtnText, isRecording && { color: C.white }]}>
              {isRecording ? "LISTENING..." : "HOLD TO SPEAK"}
            </Text>
          </TouchableOpacity>

          {/* ── Quick nav bar ──────────────────────────────────────────────── */}
          <View style={styles.quickNav}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/chat" as never)}>
              <MaterialCommunityIcons name="chat-outline" size={22} color={C.grayLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/apps" as never)}>
              <MaterialCommunityIcons name="apps" size={22} color={C.grayLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/memory" as never)}>
              <MaterialCommunityIcons name="brain" size={22} color={C.grayLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/mission-control" as never)}>
              <MaterialCommunityIcons name="radar" size={22} color={C.grayLight} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  greeting: {
    color: C.white,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  date: {
    color: C.grayLight,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  topRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  batteryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  batteryText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  clockText: {
    color: C.red,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  navHints: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    pointerEvents: "none",
  },
  navRow: {
    flexDirection: "row",
    gap: 80,
  },
  navHint: {
    color: C.red,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 3,
    opacity: 0.9,
  },
  orbSection: {
    alignItems: "center",
    gap: 14,
    flex: 1,
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 4,
  },
  lastMsg: {
    color: C.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  favSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  favLabel: {
    color: C.textDim,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 3,
    textAlign: "center",
  },
  favRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  favItem: {
    alignItems: "center",
    gap: 5,
  },
  favIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  favText: {
    color: C.grayLight,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.red,
    borderRadius: 40,
    paddingVertical: 14,
    gap: 10,
    marginHorizontal: 10,
  },
  voiceBtnActive: {
    backgroundColor: C.red,
    borderColor: C.red,
  },
  voiceBtnText: {
    color: C.red,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
  },
  quickNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  quickBtn: {
    padding: 10,
  },
});

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Platform, Vibration, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import SkullOrb from "../components/SkullOrb";
import { useJavis, type Message } from "../stores/javis";
import { askAI } from "../services/ai";
import { runOfflineAI } from "../services/offlineAI";
import { executeAction } from "../services/commands";
import { C } from "../constants/theme";

function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleJavis]}>
      {!isUser && (
        <Text style={styles.bubbleSender}>JAVIS</Text>
      )}
      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.text}</Text>
      <Text style={styles.bubbleTime}>
        {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { orbState, setOrbState, userName, voiceEnabled, voiceProfile,
    addMessage, messages, clearMessages, groqKey } = useJavis();
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const inputRef = useRef<TextInput>(null);

  const speakText = useCallback((text: string) => {
    if (Platform.OS === "web" || !voiceEnabled) return;
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
      onDone: () => setOrbState("idle"),
      onStopped: () => setOrbState("idle"),
      onError: () => setOrbState("idle"),
    });
  }, [voiceEnabled, voiceProfile, setOrbState]);

  const processInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    addMessage({ id: makeId(), role: "user", text: text.trim(), timestamp: Date.now() });
    setOrbState("thinking");

    try {
      const offline = runOfflineAI(text, userName);
      let response = offline;

      if (offline.confidence < 0.85) {
        try {
          const online = await askAI(text);
          response = { ...online, confidence: 1, offline: true };
        } catch { /* use offline */ }
      }

      addMessage({ id: makeId(), role: "javis", text: response.reply, timestamp: Date.now() });

      if (response.action && response.action !== "NONE") {
        setOrbState("executing");
        await executeAction(response.action, response.target, response.data ?? {});
      }

      speakText(response.reply);
    } catch {
      const err = `Systems offline, ${userName}. Try again.`;
      addMessage({ id: makeId(), role: "javis", text: err, timestamp: Date.now() });
      setOrbState("idle");
    }
  }, [userName, groqKey, addMessage, setOrbState, speakText]);

  const startListening = useCallback(async () => {
    if (isRecording || Platform.OS === "web") return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      Vibration.vibrate(80);
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setOrbState("listening");
    } catch { setOrbState("idle"); }
  }, [isRecording, setOrbState]);

  const stopListening = useCallback(async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setOrbState("thinking");
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri || !groqKey) { setOrbState("idle"); return; }

      const form = new FormData();
      form.append("file", { uri, name: "voice.m4a", type: "audio/m4a" } as unknown as Blob);
      form.append("model", "whisper-large-v3");
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
      });
      const data = (await res.json()) as { text: string };
      if (data.text?.trim()) await processInput(data.text.trim());
      else setOrbState("idle");
    } catch { recordingRef.current = null; setOrbState("idle"); }
  }, [groqKey, processInput, setOrbState]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.red} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <SkullOrb state={orbState} size={44} />
          <View>
            <Text style={styles.headerTitle}>JAVIS</Text>
            <Text style={styles.headerSub}>AI COMMAND CENTER</Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearMessages} style={styles.clearBtn}>
          <MaterialCommunityIcons name="delete-sweep-outline" size={22} color={C.grayLight} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        inverted
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      />

      {/* Input */}
      <View style={[styles.inputArea, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Command JAVIS, ${userName}...`}
          placeholderTextColor={C.grayMid}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={() => processInput(input)}
          editable={orbState !== "thinking" && orbState !== "executing"}
          color={C.white}
          selectionColor={C.red}
        />
        {input.trim().length > 0 ? (
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => processInput(input)}
            disabled={orbState === "thinking"}
          >
            <Feather name="send" size={20} color={C.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPressIn={startListening}
            onPressOut={stopListening}
          >
            <MaterialCommunityIcons
              name={isRecording ? "microphone" : "microphone-outline"}
              size={24}
              color={isRecording ? C.white : C.red}
            />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: C.red, fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 3 },
  headerSub: { color: C.grayLight, fontSize: 9, fontFamily: "Inter_400Regular", letterSpacing: 2 },
  clearBtn: { padding: 6 },
  list: { paddingHorizontal: 12, paddingVertical: 10 },
  bubble: {
    marginVertical: 4,
    maxWidth: "85%",
    padding: 12,
    borderRadius: 14,
  },
  bubbleJavis: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: "flex-start",
    borderTopLeftRadius: 2,
  },
  bubbleUser: {
    backgroundColor: C.redDark,
    alignSelf: "flex-end",
    borderTopRightRadius: 2,
  },
  bubbleSender: {
    color: C.red,
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    marginBottom: 4,
  },
  bubbleText: {
    color: C.white,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  bubbleTextUser: { color: C.whiteOff },
  bubbleTime: {
    color: C.grayLight,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    opacity: 0.6,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  input: {
    flex: 1,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.red, alignItems: "center", justifyContent: "center",
  },
  micBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: C.red,
  },
  micBtnActive: { backgroundColor: C.red, borderColor: C.red },
});

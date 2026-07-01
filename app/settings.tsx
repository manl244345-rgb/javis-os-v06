import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useJavis, type VoiceProfile } from "../stores/javis";
import { C } from "../constants/theme";

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingRow({ icon, label, right }: { icon: string; label: string; right: React.ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <MaterialCommunityIcons name={icon as never} size={20} color={C.red} />
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingRight}>{right}</View>
    </View>
  );
}

const VOICE_PROFILES: { id: VoiceProfile; label: string; desc: string }[] = [
  { id: "jarvis", label: "JARVIS", desc: "Deep, authoritative — Iron Man's AI" },
  { id: "deep", label: "DEEP", desc: "Lowest pitch, very masculine" },
  { id: "professional", label: "PROFESSIONAL", desc: "Balanced, corporate masculine" },
  { id: "friendly", label: "FRIENDLY", desc: "Warmer but still male" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    userName, setUserName,
    groqKey, setGroqKey,
    voiceProfile, setVoiceProfile,
    voiceEnabled, setVoiceEnabled,
    ttsOnline, setTtsOnline,
    aiProvider, setAIProvider,
    clearMessages,
  } = useJavis();

  const [nameInput, setNameInput] = useState(userName);
  const [keyInput, setKeyInput] = useState(groqKey ? "••••••••••••" + groqKey.slice(-4) : "");
  const [editingKey, setEditingKey] = useState(false);
  const [realKey, setRealKey] = useState(groqKey);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.red} />
        </TouchableOpacity>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Identity */}
        <SectionHeader title="IDENTITY" />
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Your Name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="e.g. Tony"
              placeholderTextColor={C.grayMid}
              color={C.white}
            />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => { setUserName(nameInput.trim() || "Sir"); }}
            >
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Provider */}
        <SectionHeader title="AI PROVIDERS" />
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Groq API Key (Online AI)</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={editingKey ? realKey : keyInput}
              onChangeText={(t) => { setRealKey(t); setEditingKey(true); }}
              onFocus={() => { setEditingKey(true); setRealKey(groqKey); }}
              placeholder="gsk_..."
              placeholderTextColor={C.grayMid}
              secureTextEntry={!editingKey}
              color={C.white}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => {
                setGroqKey(realKey);
                setEditingKey(false);
                setKeyInput("••••••••••••" + realKey.slice(-4));
              }}
            >
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Free key at console.groq.com — enables advanced AI + voice transcription
          </Text>

          <View style={styles.divider} />
          <Text style={styles.inputLabel}>Active AI Mode</Text>
          <View style={styles.optionRow}>
            {(["groq", "offline"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.optionBtn, aiProvider === p && styles.optionBtnActive]}
                onPress={() => setAIProvider(p)}
              >
                <Text style={[styles.optionText, aiProvider === p && styles.optionTextActive]}>
                  {p === "groq" ? "ONLINE (Groq)" : "OFFLINE (Local NLP)"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Voice */}
        <SectionHeader title="VOICE SYSTEM" />
        <View style={styles.card}>
          <SettingRow
            icon="volume-high"
            label="Voice Responses"
            right={
              <Switch
                value={voiceEnabled}
                onValueChange={setVoiceEnabled}
                trackColor={{ false: C.grayMid, true: C.redDark }}
                thumbColor={voiceEnabled ? C.red : C.grayLight}
              />
            }
          />
          <View style={styles.divider} />
          <SettingRow
            icon="cloud"
            label="Online Voice (Edge TTS)"
            right={
              <Switch
                value={ttsOnline}
                onValueChange={setTtsOnline}
                trackColor={{ false: C.grayMid, true: C.redDark }}
                thumbColor={ttsOnline ? C.red : C.grayLight}
              />
            }
          />
          <Text style={styles.hint}>Online = Edge TTS (en-US-GuyNeural, deeper masculine). Offline = device TTS with low pitch.</Text>
          <View style={styles.divider} />
          <Text style={styles.inputLabel}>Voice Profile</Text>
          {VOICE_PROFILES.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.voiceOption, voiceProfile === v.id && styles.voiceOptionActive]}
              onPress={() => setVoiceProfile(v.id)}
            >
              <View style={styles.voiceOptionLeft}>
                <MaterialCommunityIcons
                  name="microphone"
                  size={18}
                  color={voiceProfile === v.id ? C.red : C.grayLight}
                />
                <View>
                  <Text style={[styles.voiceOptionLabel, voiceProfile === v.id && { color: C.red }]}>
                    {v.label}
                  </Text>
                  <Text style={styles.voiceOptionDesc}>{v.desc}</Text>
                </View>
              </View>
              {voiceProfile === v.id && <Feather name="check" size={16} color={C.red} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Data */}
        <SectionHeader title="DATA" />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={clearMessages}
          >
            <MaterialCommunityIcons name="delete-sweep" size={18} color={C.red} />
            <Text style={styles.dangerText}>Clear Conversation History</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <SectionHeader title="ABOUT" />
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <MaterialCommunityIcons name="robot" size={36} color={C.red} />
            <View>
              <Text style={styles.aboutName}>JAVIS OS</Text>
              <Text style={styles.aboutVersion}>V06 Ultimate Edition</Text>
              <Text style={styles.aboutSub}>Just A Rather Very Intelligent System</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.hint}>
            AI: Groq (Llama 3.3 70B) + Local NLP (compromise.js){"\n"}
            Voice: Edge TTS GuyNeural + expo-speech fallback{"\n"}
            Target: Redmi A1 (Android 12 Go)
          </Text>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 6, width: 34 },
  title: { flex: 1, color: C.red, fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 3, textAlign: "center" },
  content: { padding: 14 },
  sectionHeader: {
    color: C.textDim, fontSize: 10, fontFamily: "Inter_600SemiBold",
    letterSpacing: 3, marginTop: 18, marginBottom: 8, marginLeft: 4,
  },
  card: {
    backgroundColor: C.surfaceHigh, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 14, gap: 12,
  },
  inputLabel: { color: C.grayLight, fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  textInput: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, fontFamily: "Inter_400Regular",
  },
  saveBtn: { backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  saveBtnText: { color: C.white, fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  hint: { color: C.grayLight, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 17, opacity: 0.7 },
  divider: { height: 1, backgroundColor: C.border },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingLabel: { flex: 1, color: C.white, fontSize: 13, fontFamily: "Inter_400Regular" },
  settingRight: {},
  optionRow: { flexDirection: "row", gap: 10 },
  optionBtn: {
    flex: 1, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    paddingVertical: 9, alignItems: "center", backgroundColor: C.surface,
  },
  optionBtnActive: { borderColor: C.red, backgroundColor: C.redDark + "33" },
  optionText: { color: C.grayLight, fontSize: 11, fontFamily: "Inter_500Medium" },
  optionTextActive: { color: C.red },
  voiceOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface,
  },
  voiceOptionActive: { borderColor: C.red, backgroundColor: C.redDark + "22" },
  voiceOptionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  voiceOptionLabel: { color: C.white, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  voiceOptionDesc: { color: C.grayLight, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  dangerBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.red + "44",
    backgroundColor: C.red + "11",
  },
  dangerText: { color: C.red, fontSize: 13, fontFamily: "Inter_500Medium" },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  aboutName: { color: C.red, fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  aboutVersion: { color: C.grayLight, fontSize: 12, fontFamily: "Inter_500Medium" },
  aboutSub: { color: C.grayMid, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});

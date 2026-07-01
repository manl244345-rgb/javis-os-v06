import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Battery from "expo-battery";
import { useJavis } from "../stores/javis";
import { C } from "../constants/theme";

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <MaterialCommunityIcons name={icon as never} size={22} color={color ?? C.red} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function LogItem({ text, time, type }: { text: string; time: string; type: "info" | "success" | "error" | "warn" }) {
  const colors = { info: C.blue, success: C.green, error: C.red, warn: C.gold };
  return (
    <View style={styles.logItem}>
      <View style={[styles.logDot, { backgroundColor: colors[type] }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.logText}>{text}</Text>
        <Text style={styles.logTime}>{time}</Text>
      </View>
    </View>
  );
}

export default function MissionControlScreen() {
  const insets = useSafeAreaInsets();
  const { orbState, currentTask, aiProvider, voiceProfile, messages } = useJavis();
  const [battery, setBattery] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    Battery.getBatteryLevelAsync().then((l) => setBattery(Math.round(l * 100))).catch(() => {});
    Battery.getBatteryStateAsync().then((s) => setCharging(s === Battery.BatteryState.CHARGING)).catch(() => {});
    const sub1 = Battery.addBatteryLevelListener(({ batteryLevel }) => setBattery(Math.round(batteryLevel * 100)));
    const sub2 = Battery.addBatteryStateListener(({ batteryState }) =>
      setCharging(batteryState === Battery.BatteryState.CHARGING)
    );
    const t = setInterval(() => setNow(new Date()), 5000);
    return () => { sub1.remove(); sub2.remove(); clearInterval(t); };
  }, []);

  // Build log from messages
  const recentMsgs = [...messages].slice(0, 8).reverse();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.red} />
        </TouchableOpacity>
        <Text style={styles.title}>MISSION CONTROL</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Status grid */}
        <Text style={styles.sectionLabel}>SYSTEM STATUS</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="robot"
            label="AI ENGINE"
            value={aiProvider.toUpperCase()}
            color={C.green}
          />
          <StatCard
            icon="microphone"
            label="VOICE"
            value={voiceProfile.toUpperCase()}
            color={C.blue}
          />
          <StatCard
            icon={charging ? "battery-charging" : battery !== null && battery < 20 ? "battery-10" : "battery"}
            label="BATTERY"
            value={battery !== null ? `${battery}%` : "--"}
            color={battery !== null && battery < 20 ? C.red : C.green}
          />
          <StatCard
            icon="pulse"
            label="STATUS"
            value={orbState.toUpperCase()}
            color={orbState === "idle" ? C.grayLight : C.red}
          />
        </View>

        {/* Current task */}
        <Text style={styles.sectionLabel}>ACTIVE TASK</Text>
        <View style={styles.taskCard}>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color={C.gold} />
          <Text style={styles.taskText}>
            {currentTask ?? "No active task — JAVIS standing by"}
          </Text>
        </View>

        {/* Clock */}
        <Text style={styles.sectionLabel}>SYSTEM CLOCK</Text>
        <View style={styles.clockCard}>
          <Text style={styles.clockTime}>
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </Text>
          <Text style={styles.clockDate}>
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </Text>
        </View>

        {/* Command log */}
        <Text style={styles.sectionLabel}>COMMAND LOG</Text>
        <View style={styles.logCard}>
          {recentMsgs.length === 0 ? (
            <Text style={styles.logEmpty}>No commands yet.</Text>
          ) : (
            recentMsgs.map((m) => (
              <LogItem
                key={m.id}
                text={m.text.slice(0, 80) + (m.text.length > 80 ? "…" : "")}
                time={new Date(m.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                type={m.role === "user" ? "info" : "success"}
              />
            ))
          )}
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.actionRow}>
          {[
            { label: "AI CHAT", icon: "chat", route: "/chat" },
            { label: "MEMORY", icon: "brain", route: "/memory" },
            { label: "APPS", icon: "apps", route: "/apps" },
            { label: "SETTINGS", icon: "cog", route: "/settings" },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionBtn}
              onPress={() => router.push(a.route as never)}
            >
              <MaterialCommunityIcons name={a.icon as never} size={20} color={C.red} />
              <Text style={styles.actionText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
  content: { padding: 14, gap: 10 },
  sectionLabel: {
    color: C.textDim, fontSize: 10, fontFamily: "Inter_600SemiBold",
    letterSpacing: 3, marginTop: 8,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: C.surfaceHigh,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 14, gap: 6, alignItems: "flex-start",
  },
  statLabel: { color: C.grayLight, fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 2 },
  statValue: { color: C.red, fontSize: 15, fontFamily: "Inter_700Bold" },
  taskCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surfaceHigh, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, padding: 14,
  },
  taskText: { color: C.white, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  clockCard: {
    backgroundColor: C.surfaceHigh, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, padding: 16, alignItems: "center", gap: 4,
  },
  clockTime: { color: C.red, fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  clockDate: { color: C.grayLight, fontSize: 12, fontFamily: "Inter_400Regular" },
  logCard: {
    backgroundColor: C.surfaceHigh, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, padding: 12, gap: 10,
  },
  logItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  logDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  logText: { color: C.white, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  logTime: { color: C.grayLight, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  logEmpty: { color: C.grayLight, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", padding: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: C.surfaceHigh, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, padding: 14,
    alignItems: "center", gap: 6,
  },
  actionText: { color: C.grayLight, fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
});

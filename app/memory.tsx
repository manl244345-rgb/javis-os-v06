import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useJavis, type MemoryItem } from "../stores/javis";
import { C } from "../constants/theme";

const CATEGORY_ICONS: Record<string, string> = {
  personal: "account",
  preference: "heart",
  habit: "repeat",
  contact: "contacts",
  goal: "flag",
  task: "checkbox-marked-outline",
};

const CATEGORY_COLORS: Record<string, string> = {
  personal: C.blue,
  preference: C.red,
  habit: C.green,
  contact: C.gold,
  goal: "#FF6B35",
  task: C.green,
};

function MemoryCard({ item, onDelete }: { item: MemoryItem; onDelete: () => void }) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: CATEGORY_COLORS[item.category] + "22" }]}>
        <MaterialCommunityIcons
          name={CATEGORY_ICONS[item.category] as never}
          size={18}
          color={CATEGORY_COLORS[item.category]}
        />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardKey}>{item.key}</Text>
        <Text style={styles.cardValue}>{item.value}</Text>
        <Text style={styles.cardTime}>
          {new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <Feather name="trash-2" size={16} color={C.grayLight} />
      </TouchableOpacity>
    </View>
  );
}

export default function MemoryScreen() {
  const insets = useSafeAreaInsets();
  const { memory, addMemory, removeMemory, userName } = useJavis();
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const handleAdd = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    addMemory({ key: newKey.trim(), value: newVal.trim(), category: "personal" });
    setNewKey("");
    setNewVal("");
    setShowAdd(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.red} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>MEMORY BANK</Text>
          <Text style={styles.sub}>{memory.length} STORED RECORDS</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)} style={styles.addBtn}>
          <Feather name={showAdd ? "x" : "plus"} size={22} color={C.red} />
        </TouchableOpacity>
      </View>

      {/* User name card */}
      <View style={styles.nameCard}>
        <MaterialCommunityIcons name="account-circle" size={28} color={C.red} />
        <View>
          <Text style={styles.nameLabel}>IDENTITY</Text>
          <Text style={styles.nameValue}>{userName}</Text>
        </View>
      </View>

      {/* Add form */}
      {showAdd && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.formInput}
            value={newKey}
            onChangeText={setNewKey}
            placeholder="Key (e.g. 'favorite color')"
            placeholderTextColor={C.grayMid}
            color={C.white}
          />
          <TextInput
            style={styles.formInput}
            value={newVal}
            onChangeText={setNewVal}
            placeholder="Value"
            placeholderTextColor={C.grayMid}
            color={C.white}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
            <Text style={styles.saveBtnText}>STORE MEMORY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Memory list */}
      {memory.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="brain" size={60} color={C.border} />
          <Text style={styles.emptyText}>No memories stored yet.</Text>
          <Text style={styles.emptySubText}>
            Say "remember that I like coffee" to start building your profile.
          </Text>
        </View>
      ) : (
        <FlatList
          data={memory}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MemoryCard
              item={item}
              onDelete={() =>
                Alert.alert("Delete Memory", "Remove this memory?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => removeMemory(item.id) },
                ])
              }
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 12,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
  },
  backBtn: { padding: 6 },
  headerText: { flex: 1 },
  title: { color: C.red, fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 3 },
  sub: { color: C.grayLight, fontSize: 10, fontFamily: "Inter_400Regular", letterSpacing: 2, marginTop: 2 },
  addBtn: { padding: 6 },
  nameCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    margin: 14, padding: 14, backgroundColor: C.surfaceHigh,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  nameLabel: { color: C.grayLight, fontSize: 9, fontFamily: "Inter_500Medium", letterSpacing: 2 },
  nameValue: { color: C.white, fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 2 },
  addForm: {
    margin: 14, padding: 14, backgroundColor: C.surfaceHigh,
    borderRadius: 12, borderWidth: 1, borderColor: C.redDark, gap: 10,
  },
  formInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular",
  },
  saveBtn: {
    backgroundColor: C.red, borderRadius: 8,
    paddingVertical: 12, alignItems: "center",
  },
  saveBtnText: { color: C.white, fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  list: { padding: 14, gap: 10 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surfaceHigh, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: C.border,
  },
  cardIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1 },
  cardKey: { color: C.grayLight, fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  cardValue: { color: C.white, fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardTime: { color: C.textDim, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 4 },
  deleteBtn: { padding: 6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyText: { color: C.grayLight, fontSize: 16, fontFamily: "Inter_500Medium" },
  emptySubText: { color: C.grayMid, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});

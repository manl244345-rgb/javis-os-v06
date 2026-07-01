import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { openApp } from "../services/commands";
import { C } from "../constants/theme";

const ALL_APPS = [
  { name: "WhatsApp", icon: "whatsapp", pkg: "whatsapp", category: "Social" },
  { name: "YouTube", icon: "youtube", pkg: "youtube", category: "Media" },
  { name: "Chrome", icon: "google-chrome", pkg: "chrome", category: "Tools" },
  { name: "Gmail", icon: "gmail", pkg: "gmail", category: "Tools" },
  { name: "Maps", icon: "map", pkg: "maps", category: "Tools" },
  { name: "Camera", icon: "camera", pkg: "camera", category: "Tools" },
  { name: "Settings", icon: "cog", pkg: "settings", category: "System" },
  { name: "Calculator", icon: "calculator", pkg: "calculator", category: "Tools" },
  { name: "Calendar", icon: "calendar", pkg: "calendar", category: "Productivity" },
  { name: "Clock", icon: "clock", pkg: "clock", category: "Tools" },
  { name: "Contacts", icon: "contacts", pkg: "contacts", category: "Communication" },
  { name: "Messages", icon: "message", pkg: "messages", category: "Communication" },
  { name: "Photos", icon: "image", pkg: "photos", category: "Media" },
  { name: "Spotify", icon: "spotify", pkg: "spotify", category: "Media" },
  { name: "Telegram", icon: "telegram", pkg: "telegram", category: "Social" },
  { name: "Facebook", icon: "facebook", pkg: "facebook", category: "Social" },
  { name: "Instagram", icon: "instagram", pkg: "instagram", category: "Social" },
  { name: "Files", icon: "folder", pkg: "files", category: "Tools" },
  { name: "Gallery", icon: "image-album", pkg: "gallery", category: "Media" },
  { name: "Music", icon: "music", pkg: "music", category: "Media" },
];

const CATEGORIES = ["All", "Social", "Media", "Tools", "Productivity", "Communication", "System"];

export default function AppsScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = ALL_APPS.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || a.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={C.red} />
        </TouchableOpacity>
        <Text style={styles.title}>APP SPACE</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={C.grayLight} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search apps..."
          placeholderTextColor={C.grayMid}
          color={C.white}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={C.grayLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.catBtn, activeCategory === cat && styles.catBtnActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* App grid */}
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.pkg}
        numColumns={4}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.appItem}
            onPress={() => openApp(item.pkg)}
            activeOpacity={0.7}
          >
            <View style={styles.appIcon}>
              <MaterialCommunityIcons name={item.icon as never} size={28} color={C.white} />
            </View>
            <Text style={styles.appName} numberOfLines={1}>{item.name}</Text>
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
      />
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
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 14, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.surfaceHigh, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  catScroll: { maxHeight: 44 },
  catRow: { paddingHorizontal: 14, gap: 8, alignItems: "center" },
  catBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: C.surfaceHigh,
    borderWidth: 1, borderColor: C.border,
  },
  catBtnActive: { backgroundColor: C.redDark, borderColor: C.red },
  catText: { color: C.grayLight, fontSize: 12, fontFamily: "Inter_500Medium" },
  catTextActive: { color: C.white },
  grid: { padding: 14, gap: 8 },
  appItem: { width: "25%", alignItems: "center", paddingVertical: 8, gap: 6 },
  appIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  appName: { color: C.grayLight, fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
});

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors } from "../../src/lib/colors";
import Constants from "expo-constants";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sair", "Tem certeza que quer sair da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Perfil</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name || "Usuario"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>
              {user?.plan || "Free"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <InfoRow label="Plano" value={user?.plan || "Free"} />
          <InfoRow
            label="App version"
            value={Constants.expoConfig?.version || "0.1.0"}
          />
          <InfoRow
            label="API"
            value={process.env.EXPO_PUBLIC_API_URL || "N/A"}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent.purple,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  planBadge: {
    backgroundColor: colors.accent.purpleDark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  planText: {
    color: colors.accent.purpleLight,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  section: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: "600",
    maxWidth: "60%",
  },
  logoutButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: "700",
  },
});

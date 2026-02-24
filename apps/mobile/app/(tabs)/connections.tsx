import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/lib/api";
import { colors } from "../../src/lib/colors";
import type { Connection } from "@sentimenta/types";

export default function ConnectionsScreen() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);

  const loadConnections = useCallback(async () => {
    try {
      const data = await api.connections.list();
      setConnections(data);
    } catch {
      // Silently fail on load
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConnections();
  }, [loadConnections]);

  const handleAddInstagram = async () => {
    const handle = username.trim().replace(/^@/, "");
    if (!handle) {
      Alert.alert("Erro", "Digite um username do Instagram.");
      return;
    }

    setAdding(true);
    try {
      await api.connections.connectInstagram(handle);
      setUsername("");
      setShowAdd(false);
      loadConnections();
      Alert.alert("Sucesso", `@${handle} conectado! A analise vai comecar automaticamente.`);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Falha ao conectar.");
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async (connectionId: string) => {
    try {
      await api.connections.sync(connectionId);
      Alert.alert("Sync iniciado", "A analise esta sendo processada.");
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Falha ao sincronizar.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.purple} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent.purple}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Conexoes</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAdd(!showAdd)}
          >
            <Text style={styles.addButtonText}>
              {showAdd ? "Cancelar" : "+ Adicionar"}
            </Text>
          </TouchableOpacity>
        </View>

        {showAdd && (
          <View style={styles.addCard}>
            <Text style={styles.addLabel}>Username do Instagram</Text>
            <TextInput
              style={styles.input}
              placeholder="@usuario"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
            <TouchableOpacity
              style={[styles.connectButton, adding && styles.buttonDisabled]}
              onPress={handleAddInstagram}
              disabled={adding}
            >
              {adding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.connectButtonText}>Conectar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {connections.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nenhuma conexao ainda.{"\n"}Adicione seu Instagram para comecar.
            </Text>
          </View>
        ) : (
          connections.map((conn) => (
            <View key={conn.id} style={styles.connectionCard}>
              <View style={styles.connectionInfo}>
                <Text style={styles.connectionName}>
                  @{conn.username}
                </Text>
                <Text style={styles.connectionPlatform}>
                  {conn.platform}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.syncButton}
                onPress={() => handleSync(conn.id)}
              >
                <Text style={styles.syncButtonText}>Sync</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.primary,
  },
  addButton: {
    backgroundColor: colors.accent.purple,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  addCard: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    gap: 12,
  },
  addLabel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectButton: {
    backgroundColor: colors.accent.purple,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  connectionCard: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
  },
  connectionPlatform: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
    textTransform: "capitalize",
  },
  syncButton: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accent.purple,
  },
  syncButtonText: {
    color: colors.accent.purpleLight,
    fontWeight: "600",
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 30,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});

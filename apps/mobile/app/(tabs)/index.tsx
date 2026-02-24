import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors } from "../../src/lib/colors";
import type { DashboardSummary } from "@sentimenta/types";

export default function DashboardScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await api.dashboard.summary();
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

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
        <Text style={styles.greeting}>
          Ola, {user?.name || "criador"}
        </Text>
        <Text style={styles.sectionTitle}>Resumo</Text>

        {error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.hintText}>
              Verifique se o backend esta rodando e tente novamente.
            </Text>
          </View>
        ) : summary ? (
          <>
            <View style={styles.statsRow}>
              <StatCard
                label="Conexoes"
                value={String(summary.total_connections ?? 0)}
              />
              <StatCard
                label="Comentarios"
                value={String(summary.total_comments ?? 0)}
              />
            </View>

            <View style={styles.statsRow}>
              <StatCard
                label="Score medio"
                value={
                  summary.avg_score != null
                    ? summary.avg_score.toFixed(1)
                    : "--"
                }
                color={
                  (summary.avg_score ?? 0) >= 6
                    ? colors.sentiment.positive
                    : (summary.avg_score ?? 0) >= 4
                    ? colors.sentiment.neutral
                    : colors.sentiment.negative
                }
              />
              <StatCard
                label="Positivos"
                value={
                  summary.sentiment_distribution?.positive != null
                    ? `${summary.sentiment_distribution.positive}%`
                    : "--"
                }
                color={colors.sentiment.positive}
              />
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              Nenhuma conexao ainda. Conecte seu Instagram para comecar!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
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
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.secondary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  hintText: {
    color: colors.text.muted,
    fontSize: 13,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 15,
    textAlign: "center",
  },
});

import { Redirect } from "expo-router";
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useAuth } from "../src/contexts/AuthContext";
import { colors } from "../src/lib/colors";

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent.purple} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
  },
});

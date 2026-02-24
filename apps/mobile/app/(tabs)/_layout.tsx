import { Tabs } from "expo-router";
import { colors } from "../../src/lib/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent.purple,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <TabIcon name="dashboard" color={color} />,
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: "Conexoes",
          tabBarIcon: ({ color }) => <TabIcon name="connections" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}

// Simple text-based tab icons (replace with Lucide icons or SVGs later)
function TabIcon({ name, color }: { name: string; color: string }) {
  const { View, Text } = require("react-native");
  const icons: Record<string, string> = {
    dashboard: "\u{1F4CA}",
    connections: "\u{1F517}",
    profile: "\u{1F464}",
  };
  return (
    <View>
      <Text style={{ fontSize: 20, color }}>{icons[name] || "\u{25CF}"}</Text>
    </View>
  );
}

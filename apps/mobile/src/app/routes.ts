import { createBrowserRouter } from "react-router";
import { LoginScreen } from "./components/LoginScreen";
import { MobileLayout } from "./components/MobileLayout";
import { DashboardScreen } from "./components/DashboardScreen";
import { ConnectScreen } from "./components/ConnectScreen";
import { ConnectionDetailScreen } from "./components/ConnectionDetailScreen";
import { PostDetailScreen } from "./components/PostDetailScreen";
import { LogsScreen } from "./components/LogsScreen";
import { AlertsScreen } from "./components/AlertsScreen";
import { CompareScreen } from "./components/CompareScreen";
import { SettingsScreen } from "./components/SettingsScreen";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginScreen,
  },
  {
    path: "/",
    Component: MobileLayout,
    children: [
      { index: true, Component: DashboardScreen },
      { path: "dashboard", Component: DashboardScreen },
      { path: "dashboard/connection/:id", Component: ConnectionDetailScreen },
      { path: "posts/:id", Component: PostDetailScreen },
      { path: "connect", Component: ConnectScreen },
      { path: "logs", Component: LogsScreen },
      { path: "alerts", Component: AlertsScreen },
      { path: "compare", Component: CompareScreen },
      { path: "settings", Component: SettingsScreen },
    ],
  },
], { basename: '/app' });

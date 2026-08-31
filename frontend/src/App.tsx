import { AppShell } from "./layouts/AppShell";
import { Dashboard } from "./pages/Dashboard";
import "./App.css";

export default function App() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

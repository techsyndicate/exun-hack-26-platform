import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { LedgerPage } from "./pages/LedgerPage";
import { AuthPage } from "./pages/AuthPage";
import { AgentProvider, useAgentState } from "./identity/agent";
import { AccountPage } from "./pages/AccountPage";
import { Direct } from "./pages/direct/Direct";
import ArcadePage from "./pages/ArcadePage";

function currentPath() {
  return window.location.pathname;
}

export function App() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const handleNavigation = () => setPath(currentPath());
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  return (
    <AgentProvider>
      <AgentRoutes path={path} />
    </AgentProvider>
  );
}

function AgentRoutes({ path }: { path: string }) {
  const state = useAgentState();
  if (state.status === "loading") return <p>Loading</p>;
  if (state.status === "unsupported") return <p>This browser cannot store a signing key.</p>;
  if (state.status === "new") return <AuthPage signup={state.signup} signin={state.signin} />;
  if (path === "/ledger") return <LedgerPage />;
  if (path === "/account") return <AccountPage />;
  if (path === "/direct") return <Direct />;
  if (path === "/arcade") return <ArcadePage />;
  return <HomePage />;
}

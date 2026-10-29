import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { LedgerPage } from "./pages/LedgerPage";
import { AuthPage } from "./pages/AuthPage";
import { AgentProvider, useAgentState } from "./identity/agent";
import { AccountPage } from "./pages/AccountPage";
import { Direct } from "./pages/direct/Direct";
import ArcadePage from "./pages/ArcadePage";
import { useMe } from "./me";

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
  const me = useMe();
  const verified = me?.role === "verified" || me?.role === "admin";
  const blocked =
    state.status === "ready" && me !== undefined && !verified && path !== "/" && path !== "/account";

  useEffect(() => {
    if (blocked) window.history.replaceState(null, "", "/");
  }, [blocked]);

  if (state.status === "loading") return <p>Loading</p>;
  if (state.status === "unsupported") return <p>This browser cannot store a signing key.</p>;
  if (state.status === "new") return <AuthPage signup={state.signup} signin={state.signin} />;
  if (path === "/account") return <AccountPage />;
  if (path !== "/" && me === undefined) return <p>Loading</p>;
  if (!verified) return <HomePage />;
  if (path === "/ledger") return <LedgerPage />;
  if (path === "/direct") return <Direct />;
  if (path === "/arcade") return <ArcadePage />;
  return <HomePage />;
}

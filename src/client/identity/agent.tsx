import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Tx, TxDraft } from "../../shared/ledger/schema";
import {
  createKeys,
  exportPrivateKey,
  importPrivateKey,
  loadKeys,
  sign,
  type Keys,
} from "./keystore";
import { loadMe } from "../me";

type Profile = {
  id: string;
  codename: string;
  joined: number;
  nonce: number;
  balances: Record<"credits" | "alloy" | "verdant", number>;
  history: import("../../shared/ledger/block").Block[];
};
type State =
  | { status: "loading" | "unsupported" }
  | {
      status: "new";
      signup: (input: { username: string; password: string; codename: string }) => Promise<void>;
      signin: (username: string, password: string) => Promise<void>;
    }
  | {
      status: "ready";
      keys: Keys;
      profile: Profile;
      refresh: () => Promise<void>;
      submit: (draft: TxDraft) => Promise<void>;
    };
const Context = createContext<State>({ status: "loading" });

function responseError(body: unknown, status: number, fallback: string) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return status ? `${fallback} (server returned ${status}).` : fallback;
}

async function profile(id: string) {
  const response = await fetch(`/api/agents/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load your agent profile.");
  return (await response.json()) as Profile;
}

async function file(keys: Keys, tx: Tx) {
  const response = await fetch("/api/ledger/tx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tx, signature: await sign(keys, tx) }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(responseError(body, response.status, "Could not file the transaction."));
  }
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<Keys | null>(null);
  const [agent, setAgent] = useState<Profile | null | undefined>();
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    loadKeys()
      .then(async (stored) => {
        if (!stored) return setAgent(null);
        setKeys(stored);
        setAgent(await profile(stored.id));
      })
      .catch(() => setUnsupported(true));
  }, []);

  const refresh = useCallback(async () => {
    if (keys) setAgent(await profile(keys.id));
  }, [keys]);
  const signup = useCallback(
    async (input: { username: string; password: string; codename: string }) => {
      const owned = await createKeys();
      const tx = {
        kind: "enlist" as const,
        codename: input.codename,
        agent: owned.id,
        nonce: 0,
        time: Date.now(),
      };
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...input,
          agent: owned.id,
          privateKey: await exportPrivateKey(owned.privateKey),
          signature: await sign(owned, tx),
          time: tx.time,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseError(body, response.status, "Could not create the account."));
      }
      await loadMe();
      setKeys(owned);
      setAgent(await profile(owned.id));
    },
    [],
  );

  const signin = useCallback(async (username: string, password: string) => {
    const response = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body: unknown = await response.json().catch(() => null);
    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("agent" in body) ||
      typeof body.agent !== "string" ||
      !("privateKey" in body) ||
      typeof body.privateKey !== "string"
    ) {
      throw new Error(responseError(body, response.status, "Could not sign in."));
    }
    const owned = await importPrivateKey(body.agent, body.privateKey);
    await loadMe();
    setKeys(owned);
    setAgent(await profile(owned.id));
  }, []);
  const submit = useCallback(
    async (draft: TxDraft) => {
      if (!keys || !agent) throw new Error("Enlist before filing anything.");
      await file(keys, { ...draft, agent: keys.id, nonce: agent.nonce, time: Date.now() } as Tx);
      await refresh();
    },
    [agent, keys, refresh],
  );
  const value = useMemo<State>(() => {
    if (unsupported) return { status: "unsupported" };
    if (agent === undefined) return { status: "loading" };
    if (!keys || !agent) return { status: "new", signup, signin };
    return { status: "ready", keys, profile: agent, refresh, submit };
  }, [agent, keys, refresh, signin, signup, submit, unsupported]);
  return <Context value={value}>{children}</Context>;
}

export function useAgentState() {
  return use(Context);
}
export function useAgent() {
  const state = use(Context);
  if (state.status !== "ready") throw new Error("An enlisted agent is required.");
  return state;
}

import { useEffect, useSyncExternalStore } from "react";
import type { Role } from "../shared/roles";

export type Me = {
  username: string;
  agent: string;
  codename: string;
  avatar: string | null;
  verificationEntry: {
    exuniteCode: number;
    details: string;
  } | null;
  vouches: number;
  role: Role;
};

export const DEFAULT_AVATAR = "/assets/home/profile.png";

let me: Me | null | undefined;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMe(next: Me | null) {
  me = next;
  listeners.forEach((listener) => listener());
}

export function loadMe() {
  loading ??= fetch("/api/auth/me")
    .then((response) => response.json() as Promise<Me | { user: null }>)
    .then((data) => setMe("username" in data ? data : null))
    .catch(() => setMe(null))
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function useMe() {
  const current = useSyncExternalStore(subscribe, () => me);

  useEffect(() => {
    if (me === undefined) void loadMe();
  }, []);

  return current;
}

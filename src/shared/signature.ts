import { canonical, type Json } from "./canonical";
import { fromBase64Url, utf8 } from "./encoding";

export const SIGNING_ALGORITHM = { name: "Ed25519" } as const;

const CLOCK_SKEW_MS = 5 * 60_000;

export const withinClockSkew = (time: number, now: number) => Math.abs(now - time) <= CLOCK_SKEW_MS;

export async function verifySignature(agent: string, payload: Json, signature: string) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      fromBase64Url(agent),
      SIGNING_ALGORITHM,
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      SIGNING_ALGORITHM,
      key,
      fromBase64Url(signature),
      utf8(canonical(payload)),
    );
  } catch {
    return false;
  }
}

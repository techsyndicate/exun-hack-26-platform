import { canonical, type Json } from "../../shared/canonical";
import { fromBase64Url, toBase64Url, utf8 } from "../../shared/encoding";
import { SIGNING_ALGORITHM } from "../../shared/signature";
import { readSlot, writeSlot } from "../idb";

export type Keys = { readonly id: string; readonly privateKey: CryptoKey };

export const loadKeys = () => readSlot<Keys>("agent");

export async function createKeys(): Promise<Keys> {
  const pair = (await crypto.subtle.generateKey(SIGNING_ALGORITHM, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const keys = { id: toBase64Url(raw), privateKey: pair.privateKey };
  await writeSlot("agent", keys);
  return keys;
}

export async function exportPrivateKey(key: CryptoKey) {
  return toBase64Url(new Uint8Array((await crypto.subtle.exportKey("pkcs8", key)) as ArrayBuffer));
}

export async function importPrivateKey(id: string, encoded: string): Promise<Keys> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64Url(encoded),
    SIGNING_ALGORITHM,
    true,
    ["sign"],
  );
  const keys = { id, privateKey };
  await writeSlot("agent", keys);
  return keys;
}

export async function sign(keys: Keys, payload: Json) {
  const signature = await crypto.subtle.sign(SIGNING_ALGORITHM, keys.privateKey, utf8(canonical(payload)));
  return toBase64Url(new Uint8Array(signature));
}

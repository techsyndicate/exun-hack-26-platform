import { sha256Hex, toBase64Url, utf8 } from "../shared/encoding";

const ITERATIONS = 120_000;
const SESSION_DAYS = 30;

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function hashPassword(password: string, salt = randomBytes(16)) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const saltBuffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength,
  ) as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return { hash: toBase64Url(new Uint8Array(bits)), salt: toBase64Url(salt) };
}

export async function createSession() {
  const token = toBase64Url(randomBytes(32));
  return {
    token,
    tokenHash: await sha256Hex(token),
    expiresAt: Date.now() + SESSION_DAYS * 86400000,
  };
}

export const sessionHash = sha256Hex;

export function sessionCookie(token: string, expiresAt: number) {
  return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function clearSessionCookie() {
  return "session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

import { sha256Hex, toBase64Url } from "../shared/encoding";

const SESSION_DAYS = 30;

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function hashPassword(password: string, salt = toBase64Url(randomBytes(16))) {
  return { hash: await sha256Hex(`${salt}:${password}`), salt };
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

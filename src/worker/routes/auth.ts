import { Hono } from "hono";
import { z } from "zod";
import { getCookie } from "hono/cookie";
import { signatureSchema, agentIdSchema } from "../../shared/ids";
import { verificationEntrySchema } from "../../shared/ledger/schema";
import { toBase64Url } from "../../shared/encoding";
import { SIGNING_ALGORITHM } from "../../shared/signature";
import {
  clearSessionCookie,
  clearFakeAccountCookie,
  createSession,
  fakeAccountCookie,
  hashPassword,
  sessionCookie,
  sessionHash,
} from "../auth";
import { ledger } from "../stubs";
import { validate } from "../validate";
import type { Context } from "hono";

type AuthEnv = Env & {
  ADMIN_USERNAME: string;
  FAKE_ADMIN_PASSWORD: string;
};

const username = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/);
const password = z.string().min(8).max(200);
const signup = z.object({
  username,
  password,
  codename: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z][A-Za-z0-9 -]*$/),
  agent: agentIdSchema,
  privateKey: z.string().min(1),
  signature: signatureSchema,
  time: z.number().int().positive(),
});
const signin = z.object({ username, password });
const renameUsername = z.object({ newUsername: username });
const avatar = z.object({
  avatar: z
    .string()
    .max(300_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .nullable(),
});
const verificationEntry = verificationEntrySchema;

function tokenFromCookie(header: string | undefined) {
  return header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("session="))
    ?.slice("session=".length);
}

async function matches(passwordText: string, hash: string, salt: string) {
  return (await hashPassword(passwordText, salt)).hash === hash;
}

async function createFakeUser(
  book: ReturnType<typeof ledger>,
  usernameText: string,
  passwordText: string,
) {
  const pair = (await crypto.subtle.generateKey(SIGNING_ALGORITHM, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const agent = toBase64Url(
    new Uint8Array(
      (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer,
    ),
  );
  const privateKey = toBase64Url(
    new Uint8Array(
      (await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer,
    ),
  );
  const credentials = await hashPassword(passwordText);
  book.addAgent(agent, "bhavit", Date.now());
  return book.addUser({
    username: usernameText,
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    agent,
    privateKey,
    codename: "bhavit",
  });
}

export async function authenticatedUser(c: Context) {
  const token = tokenFromCookie(c.req.header("Cookie"));
  if (!token) return null;
  const user = await ledger(c.env).session(
    await sessionHash(token),
    Date.now(),
  );
  return user;
}

async function getFakeUser(c: Context) {
  const fakeCookie = getCookie(c, "fakeAccount");
  if (fakeCookie) return true;
  return null;
}

export const authRoutes = new Hono<{ Bindings: AuthEnv }>()
  .post("/signup", validate("json", signup), async (c) => {
    const input = c.req.valid("json");
    const book = ledger(c.env);
    if (await book.user(input.username))
      return c.json({ error: "That username is already taken." }, 409);
    if (await book.agent(input.agent))
      return c.json({ error: "That agent key is already enlisted." }, 409);
    const credentials = await hashPassword(input.password);
    const result = await book.submit({
      tx: {
        kind: "enlist",
        agent: input.agent,
        nonce: 0,
        time: input.time,
        codename: input.codename,
      },
      signature: input.signature,
    });
    if (!result.ok) return c.json({ error: result.error }, 409);
    const user = await book.addUser({
      username: input.username,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      agent: input.agent,
      privateKey: input.privateKey,
      codename: input.codename,
    });
    if (!user) return c.json({ error: "Could not create the account." }, 500);
    const session = await createSession();
    await book.addSession(session.tokenHash, user.id, session.expiresAt);
    c.header("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    c.header("Set-Cookie", clearFakeAccountCookie(), { append: true });
    return c.json(
      { username: user.username, agent: user.agent, codename: user.codename },
      201,
    );
  })
  .post("/signin", validate("json", signin), async (c) => {
    const input = c.req.valid("json");
    const book = ledger(c.env);
    const isFakeLogin =
      input.username === c.env.ADMIN_USERNAME &&
      input.password === c.env.FAKE_ADMIN_PASSWORD;
    let user = await book.user(input.username);
    if (!user && isFakeLogin) {
      user = await createFakeUser(
        book,
        c.env.ADMIN_USERNAME,
        c.env.FAKE_ADMIN_PASSWORD,
      );
    }
    if (
      !user ||
      (!isFakeLogin &&
        !(await matches(
          input.password,
          user.password_hash,
          user.password_salt,
        )))
    ) {
      return c.json({ error: "Invalid username or password." }, 401);
    }
    const session = await createSession();

    await book.addSession(session.tokenHash, user.id, session.expiresAt);
    c.header("Set-Cookie", sessionCookie(session.token, session.expiresAt));
    c.header(
      "Set-Cookie",
      input.username === c.env.ADMIN_USERNAME &&
        input.password === c.env.FAKE_ADMIN_PASSWORD
        ? fakeAccountCookie()
        : clearFakeAccountCookie(),
      { append: true },
    );
    return c.json({
      username: user.username,
      agent: user.agent,
      privateKey: user.private_key,
      codename: user.codename,
    });
  })
  .post("/signout", async (c) => {
    const token = tokenFromCookie(c.req.header("Cookie"));
    if (token) await ledger(c.env).removeSession(await sessionHash(token));
    c.header("Set-Cookie", clearSessionCookie());
    c.header("Set-Cookie", clearFakeAccountCookie(), { append: true });
    return c.json({ ok: true });
  })

  .get("/fake", async (c) => {
    const isFake = await getFakeUser(c);
    return c.json({ isFake });
  })
  .get("/me", async (c) => {
    const token = tokenFromCookie(c.req.header("Cookie"));
    const user = token
      ? await ledger(c.env).session(await sessionHash(token), Date.now())
      : null;
    return user
      ? c.json({
          username: user.username,
          agent: user.agent,
          codename: user.codename,
          avatar: user.avatar,
          verificationEntry: user.verification_entry
            ? JSON.parse(user.verification_entry)
            : null,
          vouches: user.vouches,
          role: user.role,
        })
      : c.json({ user: null });
  })
  .post("/make-admin", async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "User not logged in." }, 401);

    await ledger(c.env).setRole(user.agent, "admin");
    return c.json({ role: "admin" });
  })
  .put("/avatar", validate("json", avatar), async (c) => {
    const user = await authenticatedUser(c);
    if (!user) return c.json({ error: "User not logged in." }, 401);

    await ledger(c.env).setAvatar(user.id, c.req.valid("json").avatar);
    return c.json({ ok: true });
  })
  .patch(
    "/verification-entry",
    validate("json", verificationEntry),
    async (c) => {
      const user = await authenticatedUser(c);
      if (!user) return c.json({ error: "User not logged in." }, 401);

      await ledger(c.env).setVerificationEntry(
        user.id,
        c.req.valid("json"),
      );
      return c.json({ ok: true });
    },
  )
  .patch("/username", validate("json", renameUsername), async (c) => {
    const user = await authenticatedUser(c);

    if (!user) return c.json({ error: "User not logged in." }, 401);
    const input = c.req.valid("json");

    const existing = await ledger(c.env).user(input.newUsername);

    if (existing && existing.id !== user.id) {
      return c.json({ error: "That username is already taken." }, 409);
    }

    await ledger(c.env).renameUser(user.id, input.newUsername);
    return c.json({ ok: true });
  });

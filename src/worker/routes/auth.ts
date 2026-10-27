import { Hono } from "hono";
import { z } from "zod";
import { signatureSchema, agentIdSchema } from "../../shared/ids";
import { fromBase64Url } from "../../shared/encoding";
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  sessionCookie,
  sessionHash,
} from "../auth";
import { ledger } from "../stubs";
import { validate } from "../validate";
import type { Context } from "hono";

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

function tokenFromCookie(header: string | undefined) {
  return header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("session="))
    ?.slice("session=".length);
}

async function matches(passwordText: string, hash: string, salt: string) {
  return (await hashPassword(passwordText, fromBase64Url(salt))).hash === hash;
}

async function authenticatedUser(c: Context) {
  const token = tokenFromCookie(c.req.header("Cookie"));
  if (!token) return null;
  const user = await ledger(c.env).session(
    await sessionHash(token),
    Date.now(),
  );
  return user;
}

export const authRoutes = new Hono<{ Bindings: Env }>()
  .post("/signup", validate("json", signup), async (c) => {
    const input = c.req.valid("json");
    const book = ledger(c.env);
    if (await book.user(input.username))
      return c.json({ error: "That username is already taken." }, 409);
    if (await book.agent(input.agent))
      return c.json({ error: "That agent key is already enlisted." }, 409);
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
    const credentials = await hashPassword(input.password);
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
    return c.json(
      { username: user.username, agent: user.agent, codename: user.codename },
      201,
      {
        "Set-Cookie": sessionCookie(session.token, session.expiresAt),
      },
    );
  })
  .post("/signin", validate("json", signin), async (c) => {
    const input = c.req.valid("json");
    const user = await ledger(c.env).user(input.username);
    if (
      !user ||
      !(await matches(input.password, user.password_hash, user.password_salt))
    ) {
      return c.json({ error: "Invalid username or password." }, 401);
    }
    const session = await createSession();
    await ledger(c.env).addSession(
      session.tokenHash,
      user.id,
      session.expiresAt,
    );
    return c.json(
      {
        username: user.username,
        agent: user.agent,
        privateKey: user.private_key,
        codename: user.codename,
      },
      200,
      {
        "Set-Cookie": sessionCookie(session.token, session.expiresAt),
      },
    );
  })
  .post("/signout", async (c) => {
    const token = tokenFromCookie(c.req.header("Cookie"));
    if (token) await ledger(c.env).removeSession(await sessionHash(token));
    return c.json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
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
        })
      : c.json({ user: null });
  })
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

import { Hono, type Context } from "hono";
import { z } from "zod";
import { agentIdSchema } from "../../shared/ids";
import { ledger } from "../stubs";
import { validate } from "../validate";
import { authenticatedUser } from "./auth";

async function voucher(c: Context) {
  const user = await authenticatedUser(c);
  if (!user) return { refused: c.json({ error: "User not logged in." }, 401) };
  if (user.role === "unverified") {
    return { refused: c.json({ error: "Only verified agents can vouch." }, 403) };
  }
  return { agent: user.agent };
}

export const vouchRoutes = new Hono<{ Bindings: Env }>()
  .get("/pending", async (c) => {
    const { refused, agent } = await voucher(c);
    if (refused) return refused;

    return c.json(await ledger(c.env).unvouched(agent));
  })
  .post("/", validate("json", z.object({ agent: agentIdSchema })), async (c) => {
    const { refused, agent } = await voucher(c);
    if (refused) return refused;

    const problem = await ledger(c.env).vouch(agent, c.req.valid("json").agent);
    if (problem) return c.json({ error: problem }, 409);
    return c.json({ ok: true });
  });

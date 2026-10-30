import { Hono, type Context } from "hono";
import { z } from "zod";
import { agentIdSchema } from "../../shared/ids";
import { ledger } from "../stubs";
import { validate } from "../validate";
import { authenticatedUser } from "./auth";

async function notAdmin(c: Context) {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "User not logged in." }, 401);
  if (user.role !== "admin") return c.json({ error: "Admins only." }, 403);
  return null;
}

export const adminRoutes = new Hono<{ Bindings: Env }>()
  .get("/verifications", async (c) => {
    const refused = await notAdmin(c);
    if (refused) return refused;

    return c.json(await ledger(c.env).verifications());
  })
  .post(
    "/verify",
    validate("json", z.object({ agent: agentIdSchema })),
    async (c) => {
      const refused = await notAdmin(c);
      if (refused) return refused;

      const { agent } = c.req.valid("json");
      const member = await ledger(c.env).member(agent);
      if (!member) return c.json({ error: "No agent holds that key." }, 404);
      if (member.role !== "unverified") {
        return c.json({ error: `${member.codename} is already ${member.role}.` }, 409);
      }

      await ledger(c.env).setRole(agent, "verified");
      return c.json({ role: "verified" });
    },
  );

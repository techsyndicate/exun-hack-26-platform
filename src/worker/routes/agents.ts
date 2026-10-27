import { Hono } from "hono";
import { z } from "zod";
import { agentIdSchema } from "../../shared/ids";
import { ledger } from "../stubs";
import { validate } from "../validate";

export const agentRoutes = new Hono<{ Bindings: Env }>()
  .get("/", async (c) => c.json(await ledger(c.env).agents()))
  .get("/:id", validate("param", z.object({ id: agentIdSchema })), async (c) => {
    const profile = await ledger(c.env).profile(c.req.valid("param").id);
    return profile ? c.json(profile) : c.json({ error: "No agent holds that key." }, 404);
  });

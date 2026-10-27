import { Hono } from "hono";
import { z } from "zod";
import { submissionSchema } from "../../shared/ledger/schema";
import { ledger } from "../stubs";
import { validate } from "../validate";

const page = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const range = z.object({
  from: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export const ledgerRoutes = new Hono<{ Bindings: Env }>()
  .get("/head", async (c) => c.json(await ledger(c.env).head()))
  .get("/blocks", validate("query", page), async (c) => {
    const { before, limit } = c.req.valid("query");
    return c.json(await ledger(c.env).recent(before, limit));
  })
  .get("/range", validate("query", range), async (c) => {
    const { from, limit } = c.req.valid("query");
    return c.json(await ledger(c.env).range(from, limit));
  })
  .post("/tx", validate("json", submissionSchema), async (c) => {
    const result = await ledger(c.env).submit(c.req.valid("json"));
    return result.ok ? c.json(result.block, 201) : c.json({ error: result.error }, 409);
  });

import { Hono } from "hono";
import { z } from "zod";
import { roomSchema } from "../../shared/direct";
import { signal } from "../stubs";
import { validate } from "../validate";

export const directRoutes = new Hono<{ Bindings: Env }>().get(
  "/:room/live",
  validate("param", z.object({ room: roomSchema })),
  (c) => signal(c.env, c.req.valid("param").room).fetch(c.req.raw),
);

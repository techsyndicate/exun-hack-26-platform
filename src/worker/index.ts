import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { agentRoutes } from "./routes/agents";
import { directRoutes } from "./routes/direct";
import { ledgerRoutes } from "./routes/ledger";

const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  .route("/auth", authRoutes)
  .route("/agents", agentRoutes)
  .route("/ledger", ledgerRoutes)
  .route("/direct", directRoutes);

export type AppType = typeof app;
export { Ledger } from "./objects/Ledger";
export { SignalRoom } from "./objects/SignalRoom";
export default app;

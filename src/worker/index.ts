import { Hono } from "hono";
import { agentRoutes } from "./routes/agents";
import { ledgerRoutes } from "./routes/ledger";

const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  .route("/agents", agentRoutes)
  .route("/ledger", ledgerRoutes);

export type AppType = typeof app;
export { Ledger } from "./objects/Ledger";
export default app;

import { hc, type InferResponseType } from "hono/client";
import type { AppType } from "../worker";
import { toSocketUrl } from "./live";

export const { api } = hc<AppType>(location.origin);

export type Profile = InferResponseType<(typeof api.agents)[":id"]["$get"], 200>;

function socketFor(url: URL, query: Record<string, string>) {
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return toSocketUrl(url);
}

export const directSocket = (room: string) =>
  socketFor(api.direct[":room"].live.$url({ param: { room } }), {});

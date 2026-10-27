class ApiError extends Error {}

type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> };
type Body<R> = R extends { json(): Promise<infer T> } ? T : never;

export async function unwrap<R extends JsonResponse>(
  response: R | Promise<R>,
): Promise<Exclude<Body<R>, { error: string }>> {
  let res: R;
  try {
    res = await response;
  } catch {
    throw new ApiError("Can't reach the network. Check your connection and try again.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok || body === null) {
    const error = body && typeof body === "object" && "error" in body ? String(body.error) : null;
    throw new ApiError(error ?? `The server answered ${res.status}.`);
  }
  return body as Exclude<Body<R>, { error: string }>;
}

export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

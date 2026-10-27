const MAX_FRAME_BYTES = 16 * 1024;
export const MAX_SOCKETS = 500;

export function parseFrame(message: string | ArrayBuffer): unknown {
  if (typeof message !== "string" || message.length > MAX_FRAME_BYTES) return undefined;
  try {
    return JSON.parse(message) as unknown;
  } catch {
    return undefined;
  }
}

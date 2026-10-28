import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const RETRY_MS = [500, 1000, 2000, 5000, 10_000];
const isFinalClose = (code: number) => code >= 4000 && code < 5000;

export function toSocketUrl(url: URL) {
  const socket = new URL(url);
  socket.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return socket.toString();
}

type Handlers = { onMessage: (data: unknown) => void; onOpen?: () => void };

export function useLiveSocket(url: string | null, handlers: Handlers) {
  const [connected, setConnected] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const latest = useRef(handlers);

  useLayoutEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!url) return;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.addEventListener("open", () => {
        if (socket.current !== ws) return;
        attempt = 0;
        setConnected(true);
        setEnded(null);
        latest.current.onOpen?.();
      });
      ws.addEventListener("message", (event) => {
        if (socket.current !== ws || typeof event.data !== "string") return;
        try {
          latest.current.onMessage(JSON.parse(event.data) as unknown);
        } catch {
          return;
        }
      });
      ws.addEventListener("close", (event) => {
        if (socket.current !== ws) return;
        setConnected(false);
        if (closed) return;
        if (isFinalClose(event.code)) {
          setEnded(event.reason);
          return;
        }
        retry = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]);
      });
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
    };
  }, [url]);

  const send = useCallback((message: unknown) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(message));
    return true;
  }, []);

  return { connected, ended, send };
}

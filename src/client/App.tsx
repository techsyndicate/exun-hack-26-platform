import { useEffect, useState } from "react";
import { api } from "./api";
import { unwrap } from "./request";

export function App() {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    void unwrap(api.ledger.head.$get()).then((head) => setHeight(head?.height ?? null));
  }, []);

  return (
    <main>
      <h1>EXUN Underground</h1>
      <p>{height === null ? "Connecting to the ledger" : `Ledger height ${height}`}</p>
    </main>
  );
}

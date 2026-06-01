"use client";

import { useEffect, useState } from "react";

type RenderProbeProps = {
  serverRenderedAt: string;
  expected: "frozen" | "live";
};

export function RenderProbe({ serverRenderedAt, expected }: RenderProbeProps) {
  const [clientNow, setClientNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setClientNow(new Date().toISOString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="probe">
      <h2 className="h2">Render probe</h2>
      <pre className="block">
        {JSON.stringify({ serverRenderedAt, clientNow, expectedBehavior: expected }, null, 2)}
      </pre>
      <p className="muted">
        {expected === "frozen"
          ? "Hard refresh — serverRenderedAt should not change (static / build output)."
          : "Hard refresh — serverRenderedAt should change every request (SSR)."}
      </p>
    </section>
  );
}

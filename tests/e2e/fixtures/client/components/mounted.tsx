"use client";

import { useEffect, useState } from "react";

export function Mounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <p id="mounted">{mounted ? "client" : "server"}</p>;
}

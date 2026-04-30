"use client";

import { useEffect, useState } from "react";
import "./index";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

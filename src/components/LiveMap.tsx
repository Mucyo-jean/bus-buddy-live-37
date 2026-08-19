import { Suspense, lazy, useEffect, useState } from "react";
import type { LiveMapProps } from "./LiveMapInner";

const Inner = lazy(() => import("./LiveMapInner"));

export function LiveMap(props: LiveMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const placeholder = (
    <div
      className="flex items-center justify-center rounded-xl border border-border bg-muted/40 text-sm text-muted-foreground"
      style={{ height: props.height ?? "420px" }}
    >
      Loading map…
    </div>
  );

  if (!mounted) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <Inner {...props} />
    </Suspense>
  );
}
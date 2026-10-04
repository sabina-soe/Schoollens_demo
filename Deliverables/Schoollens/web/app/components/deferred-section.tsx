"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function DeferredSection({
  children,
  force = false,
  placeholder,
}: {
  children: ReactNode;
  force?: boolean;
  placeholder?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(force);

  useEffect(() => {
    if (force) setReady(true);
  }, [force]);

  useEffect(() => {
    if (ready) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready]);

  return <div ref={ref}>{ready ? children : placeholder}</div>;
}

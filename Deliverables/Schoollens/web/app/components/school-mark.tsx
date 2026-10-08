"use client";

import { useEffect, useState } from "react";
import { schoolInitials, schoolLogoSrc } from "@/lib/school-mark";

let extractedLogos: Promise<Record<string, string>> | null = null;

function loadExtractedLogos() {
  if (!extractedLogos) {
    extractedLogos = fetch("/school-logos/extracted/index.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({})) as Promise<Record<string, string>>;
    setTimeout(() => {
      extractedLogos = null;
    }, 4000);
  }
  return extractedLogos;
}

export function SchoolMark({
  name,
  schoolId,
  groupId,
  size = "md",
}: {
  name: string;
  schoolId?: string | null;
  groupId?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const hardcoded = schoolLogoSrc({ id: schoolId, school_group_id: groupId, name });
  const [extracted, setExtracted] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const initials = schoolInitials(name);

  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    void loadExtractedLogos().then((map) => {
      if (!active) return;
      setExtracted(map[schoolId] || null);
    });
    return () => {
      active = false;
    };
  }, [schoolId]);

  const src = extracted || hardcoded;

  if (src && !failed) {
    return (
      <div className={`school-mark school-mark-${size} school-mark-logo`} aria-hidden="true">
        <img src={src} alt="" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div className={`school-mark school-mark-${size} school-mark-letters`} aria-hidden="true">
      <span>{initials}</span>
    </div>
  );
}

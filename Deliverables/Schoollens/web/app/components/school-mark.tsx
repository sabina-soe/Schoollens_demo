"use client";

import { useState } from "react";
import { schoolInitials, schoolLogoSrc } from "@/lib/school-mark";

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
  const src = schoolLogoSrc({ id: schoolId, school_group_id: groupId, name });
  const [failed, setFailed] = useState(false);
  const initials = schoolInitials(name);

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

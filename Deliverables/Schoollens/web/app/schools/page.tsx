import { Suspense } from "react";
import { SchoolsList } from "./schools-list";

export default function SchoolsPage() {
  return (
    <Suspense fallback={<main className="wide directory-page">Loading directory…</main>}>
      <SchoolsList />
    </Suspense>
  );
}

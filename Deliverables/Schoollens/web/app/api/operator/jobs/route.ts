import { NextResponse } from "next/server";
import { readOperatorJobs } from "@/lib/operator-jobs";

export async function GET() {
  try {
    return NextResponse.json({ jobs: readOperatorJobs() });
  } catch {
    return NextResponse.json({ jobs: [] });
  }
}

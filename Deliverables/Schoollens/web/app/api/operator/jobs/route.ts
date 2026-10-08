import { NextResponse } from "next/server";
import { readOperatorJobs } from "@/lib/operator-jobs";

export async function GET() {
  return NextResponse.json({ jobs: readOperatorJobs() });
}

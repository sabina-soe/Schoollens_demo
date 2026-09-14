import { NextResponse } from "next/server";
import { DEFAULT_SCHEDULES } from "@/lib/operator-schedule";
import { createClient } from "@/lib/supabase/server";

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: NextResponse.json({ error: "sign in required" }, { status: 401 }) };
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "platform_operator") {
    return { supabase, error: NextResponse.json({ error: "operator only" }, { status: 403 }) };
  }
  return { supabase, error: null };
}

export async function GET() {
  const { supabase, error } = await requireOperator();
  if (error) return error;
  const { data } = await supabase.from("operator_schedules").select("pipeline, cron_expr, timezone");
  return NextResponse.json({
    schedules: data?.length
      ? data
      : DEFAULT_SCHEDULES.map((row) => ({
          pipeline: row.pipeline,
          cron_expr: row.cron_expr,
          timezone: row.timezone,
        })),
  });
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireOperator();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  if (!body.pipeline || !body.cron_expr) {
    return NextResponse.json({ error: "pipeline and cron_expr are required" }, { status: 400 });
  }
  const { error: upsertError } = await supabase.from("operator_schedules").upsert({
    pipeline: body.pipeline,
    cron_expr: body.cron_expr,
    timezone: body.timezone || "Asia/Yangon",
    updated_at: new Date().toISOString(),
  });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

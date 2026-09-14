import { NextResponse } from "next/server";
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
  const { data, error: queryError } = await supabase
    .from("schools")
    .select("id, name, official_website_url, official_facebook_url")
    .order("name");
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 400 });
  return NextResponse.json({ sources: data ?? [] });
}

export async function PUT(request: Request) {
  const { supabase, error } = await requireOperator();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { error: updateError } = await supabase
    .from("schools")
    .update({
      official_website_url: body.official_website_url ?? null,
      official_facebook_url: body.official_facebook_url ?? null,
    })
    .eq("id", body.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_shared";

type AuthPayload = {
  action?: string;
  query?: string;
  password?: string;
};

function keyFromQuery(query?: string): string | null {
  if (!query) return null;
  return new URLSearchParams(query).get("key");
}

export async function POST(request: Request) {
  let payload: AuthPayload;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (payload.action !== "publish") {
    return NextResponse.json({});
  }

  const key = payload.password || keyFromQuery(payload.query);
  if (!key) {
    return new NextResponse(null, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("stream_keys")
    .select("channel_id")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }

  if (!data) {
    return new NextResponse(null, { status: 401 });
  }

  return NextResponse.json({});
}

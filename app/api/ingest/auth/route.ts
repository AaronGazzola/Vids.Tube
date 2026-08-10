import { NextResponse } from "next/server";
import { isLoopbackAddress } from "@/lib/loopback";
import { isRenditionPath } from "@/lib/renditions";
import { supabaseAdmin } from "../_shared";

type AuthPayload = {
  action?: string;
  path?: string;
  ip?: string;
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

  if (payload.path && isRenditionPath(payload.path)) {
    if (isLoopbackAddress(payload.ip)) {
      return NextResponse.json({});
    }
    console.error(
      `ingest/auth: refused a publish to rendition path ${payload.path} from ${
        payload.ip ?? "an unknown address"
      }`
    );
    return new NextResponse(null, { status: 401 });
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

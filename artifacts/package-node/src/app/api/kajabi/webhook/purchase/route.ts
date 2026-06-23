import { NextRequest, NextResponse } from "next/server";
import { upsertKajabiWebhookPurchase } from "@/lib/kajabi/sync";

function isAuthorized(request: NextRequest) {
  const secret = process.env.KAJABI_WEBHOOK_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const recordsProcessed = await upsertKajabiWebhookPurchase(payload);
    return NextResponse.json({ ok: true, recordsProcessed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
}

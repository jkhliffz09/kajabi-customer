import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import { syncKajabiPurchases } from "@/lib/kajabi/sync";

export async function POST() {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncKajabiPurchases("latest");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Latest sync failed" }, { status: 500 });
  }
}

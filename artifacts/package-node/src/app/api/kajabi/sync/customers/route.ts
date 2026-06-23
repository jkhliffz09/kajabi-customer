import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import { syncKajabiCustomers } from "@/lib/kajabi/sync";

export async function POST() {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncKajabiCustomers();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Customer sync failed" }, { status: 500 });
  }
}

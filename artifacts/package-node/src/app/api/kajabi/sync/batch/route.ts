import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import { syncKajabiResourcePage } from "@/lib/kajabi/sync";
import type { BatchSyncResource } from "@/lib/kajabi/types";

const resources = new Set<BatchSyncResource>(["customers", "offers", "products", "purchases"]);

type BatchRequest = {
  resource?: string;
  page?: number;
  pageSize?: number;
};

export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as BatchRequest;
    const resource = body.resource;
    if (!resource || !resources.has(resource as BatchSyncResource)) {
      return NextResponse.json({ error: "Invalid sync resource." }, { status: 400 });
    }

    const result = await syncKajabiResourcePage(
      resource as BatchSyncResource,
      Number(body.page ?? 1),
      Number(body.pageSize ?? 200),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Batch sync failed" }, { status: 500 });
  }
}

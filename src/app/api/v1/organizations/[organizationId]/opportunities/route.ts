import { ok } from "@/lib/api/response";
import { listOpportunityRows } from "@/lib/sales/opportunities";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params;
  const items = await listOpportunityRows(organizationId);

  return ok({
    organizationId,
    items
  });
}

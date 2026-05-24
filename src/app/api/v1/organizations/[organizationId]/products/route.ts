import { ok } from "@/lib/api/response";
import { listProductRows } from "@/lib/sales/products";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params;
  const items = await listProductRows(organizationId);

  return ok({
    organizationId,
    items
  });
}

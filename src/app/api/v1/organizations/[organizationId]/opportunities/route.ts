import { ok } from "@/lib/api/response";
import { opportunities } from "@/lib/mock-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params;

  return ok({
    organizationId,
    items: opportunities
  });
}

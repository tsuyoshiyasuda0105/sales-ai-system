import { ok } from "@/lib/api/response";
import { platformComparison } from "@/lib/mock-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const url = new URL(request.url);
  const keyword = url.searchParams.get("keyword") ?? "ワイヤレスイヤホン 型番A100";
  const { organizationId } = await params;

  return ok({
    organizationId,
    keyword,
    amazonConnectionStatus: "manual",
    rows: platformComparison,
    note: "MVP mock response. Amazon SP-API is optional; manual/Keepa mode is supported."
  });
}

import { ok } from "@/lib/api/response";
import { demoOrganization } from "@/lib/mock-data";

export function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  return params.then(({ organizationId }) =>
    ok({
      user: {
        id: "00000000-0000-4000-8000-000000000101",
        email: "demo@example.com",
        name: "Demo User"
      },
      organization: {
        ...demoOrganization,
        id: organizationId
      },
      permissions: ["read", "write", "manage_api_credentials"]
    })
  );
}

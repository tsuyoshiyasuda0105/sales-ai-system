export type UserRole = "owner" | "admin" | "member";

export type TenantContext = {
  organizationId: string;
  userId: string;
  role: UserRole;
};

export function assertRole(context: TenantContext, allowed: UserRole[]) {
  if (!allowed.includes(context.role)) {
    throw new Error("Forbidden");
  }
}

export function createTenantWhere<T extends object>(
  context: TenantContext,
  where?: T
): T & { organization_id: string } {
  return {
    ...(where ?? {}),
    organization_id: context.organizationId
  } as T & { organization_id: string };
}

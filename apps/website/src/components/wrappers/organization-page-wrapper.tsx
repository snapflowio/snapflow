"use client";

import { useEffect } from "react";
import { OrganizationRolePermissionsEnum } from "@snapflow/api-client/src";
import { useRouter } from "next/navigation";
import { Path } from "@/constants/paths";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function OrganizationPageWrapper({
  children,
  requiredPermissions,
}: {
  children: React.ReactNode;
  requiredPermissions: OrganizationRolePermissionsEnum[];
}) {
  const { authenticatedUserHasPermission } = useSelectedOrganization();
  const router = useRouter();

  const hasPermission = requiredPermissions.every((permission) =>
    authenticatedUserHasPermission(permission)
  );

  useEffect(() => {
    if (!hasPermission) {
      router.replace(Path.DASHBOARD);
    }
  }, [hasPermission, router]);

  if (!hasPermission) return null;

  return children;
}

import { OrganizationRolePermissionsEnum } from "@snapflow/api-client/src";
import { Navigate } from "react-router";
import { Path } from "@/enums/paths";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function OrganizationPageWrapper({
  children,
  requiredPermissions,
}: {
  children: React.ReactNode;
  requiredPermissions: OrganizationRolePermissionsEnum[];
}) {
  const { authenticatedUserHasPermission } = useSelectedOrganization();

  if (!requiredPermissions.every((permission) => authenticatedUserHasPermission(permission)))
    return <Navigate to={Path.DASHBOARD} replace />;

  return children;
}

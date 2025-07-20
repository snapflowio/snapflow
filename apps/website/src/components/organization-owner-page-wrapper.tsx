import { OrganizationUserRoleEnum } from "@snapflow/api-client/src";
import { Navigate } from "react-router";
import { Path } from "@/enums/paths";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function OrganizationOwnerPageWrapper({ children }: { children: React.ReactNode }) {
  const { authenticatedUserOrganizationMember } = useSelectedOrganization();

  if (authenticatedUserOrganizationMember?.role !== OrganizationUserRoleEnum.OWNER)
    return <Navigate to={Path.DASHBOARD} replace />;

  return children;
}

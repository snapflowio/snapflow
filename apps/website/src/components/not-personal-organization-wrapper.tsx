import { Navigate } from "react-router";
import { Path } from "@/enums/paths";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function NotPersonalOrganizationPageWrapper({ children }: { children: React.ReactNode }) {
  const { selectedOrganization } = useSelectedOrganization();

  if (selectedOrganization?.personal) return <Navigate to={Path.DASHBOARD} replace />;

  return children;
}

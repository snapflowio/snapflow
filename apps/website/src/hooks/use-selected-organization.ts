import { useContext } from "react";
import { SelectedOrganizationContext } from "@/context/selected-organization-context";

export function useSelectedOrganization() {
  const context = useContext(SelectedOrganizationContext);
  if (!context)
    throw new Error(
      "useSelectedOrganization must be used within a SelectedOrganizationProvider",
    );

  return context;
}

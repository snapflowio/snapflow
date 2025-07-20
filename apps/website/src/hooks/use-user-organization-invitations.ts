import { useContext } from "react";
import { UserOrganizationInvitationsContext } from "@/context/user-organization-invitations-context";

export function useUserOrganizationInvitations() {
  const context = useContext(UserOrganizationInvitationsContext);
  if (!context)
    throw new Error(
      "useUserOrganizationInvitations must be used within a UserOrganizationInvitationsProvider"
    );

  return context;
}

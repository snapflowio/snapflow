"use client";

import { useEffect } from "react";
import { OrganizationUserRoleEnum } from "@snapflow/api-client/src";
import { useRouter } from "next/navigation";
import { Path } from "@/constants/paths";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function OrganizationOwnerPageWrapper({ children }: { children: React.ReactNode }) {
  const { authenticatedUserOrganizationMember } = useSelectedOrganization();
  const router = useRouter();

  const isOwner = authenticatedUserOrganizationMember?.role === OrganizationUserRoleEnum.OWNER;

  useEffect(() => {
    if (!isOwner) {
      router.replace(Path.DASHBOARD);
    }
  }, [isOwner, router]);

  if (!isOwner) return null;

  return children;
}

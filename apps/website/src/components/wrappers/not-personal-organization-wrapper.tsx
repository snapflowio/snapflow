"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Path } from "@/constants/paths";
import { useSelectedOrganization } from "@/hooks/use-selected-organization";

export function NotPersonalOrganizationPageWrapper({ children }: { children: React.ReactNode }) {
  const { selectedOrganization } = useSelectedOrganization();
  const router = useRouter();

  useEffect(() => {
    if (selectedOrganization?.personal) {
      router.replace(Path.DASHBOARD);
    }
  }, [selectedOrganization?.personal, router]);

  if (selectedOrganization?.personal) return null;

  return children;
}

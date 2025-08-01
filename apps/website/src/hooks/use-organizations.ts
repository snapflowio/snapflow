"use client";

import { useContext } from "react";
import { OrganizationsContext } from "@/context/organizations-context";

export function useOrganizations() {
  const context = useContext(OrganizationsContext);
  if (!context) throw new Error("useOrganizations must be used within a OrganizationsProvider");

  return context;
}

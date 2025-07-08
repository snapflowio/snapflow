import { ReactNode, useCallback, useMemo, useState } from "react";
import { Organization } from "@snapflow/api-client";
import { suspend } from "suspend-react";
import { handleApiError } from "@/lib/errors";
import {
  IOrganizationsContext,
  OrganizationsContext,
} from "@/context/organizations-context";
import { useApi } from "@/hooks/use-api";

type Props = {
  children: ReactNode;
};

export function OrganizationsProvider(props: Props) {
  const { organizationsApi } = useApi();

  const getOrganizations = useCallback(async () => {
    try {
      return (await organizationsApi.listOrganizations()).data;
    } catch (error) {
      handleApiError(error, "Failed to fetch your organizations");
      throw error;
    }
  }, [organizationsApi]);

  const [organizations, setOrganizations] = useState<Organization[]>(
    suspend(getOrganizations, [organizationsApi, "organizations"]),
  );

  const refreshOrganizations = useCallback(async () => {
    const orgs = await getOrganizations();
    setOrganizations(orgs);
    return orgs;
  }, [getOrganizations]);

  const contextValue: IOrganizationsContext = useMemo(() => {
    return {
      organizations,
      setOrganizations,
      refreshOrganizations,
    };
  }, [organizations, refreshOrganizations]);

  return (
    <OrganizationsContext.Provider value={contextValue}>
      {props.children}
    </OrganizationsContext.Provider>
  );
}

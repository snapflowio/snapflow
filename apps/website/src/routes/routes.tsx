import { Suspense } from "react";
import { OrganizationRolePermissionsEnum } from "@snapflow/api-client/src";
import { Routes as ReactRoutes, Route } from "react-router";
import { NotPersonalOrganizationPageWrapper } from "@/components/not-personal-organization-wrapper";
import { OrganizationPageWrapper } from "@/components/organization-page-wrapper";
import { Callback } from "@/pages/callback";
import { Buckets } from "@/pages/dashboard/buckets/buckets";
import { OrganizationMembers } from "@/pages/dashboard/organization-members/organization-members";
import { OrganizationSettings } from "@/pages/dashboard/organization-settings/organization-settings";
import { Loading } from "../components/loading";
import { getRouteSubPath, Path } from "../enums/paths";
import { ApiKeys } from "../pages/dashboard/api-keys/api-keys";
import { Dashboard } from "../pages/dashboard/dashboard";
import { Images } from "../pages/dashboard/images/images";
import { DashboardLayout } from "../pages/dashboard/layout";
import { Sandboxes } from "../pages/dashboard/sandboxes/sandboxes";
import Landing from "../pages/landing/landing";
import Logout from "../pages/logout";
import { NotFound } from "../pages/not-found";
import { ApiProvider } from "../providers/api-provider";
import { OrganizationsProvider } from "../providers/organization-provider";
import { RealtimeSocketProvider } from "../providers/realtime-provider";
import { SelectedOrganizationProvider } from "../providers/selected-organization-provider";

export function Routes() {
  return (
    <ReactRoutes>
      <Route path="*" element={<NotFound />} />
      <Route path="/" element={<Landing />} />
      <Route path="/callback" element={<Callback />} />
      <Route path={Path.LOGOUT} element={<Logout />} />
      <Route
        path={Path.DASHBOARD}
        element={
          <Suspense fallback={<Loading />}>
            <ApiProvider>
              <RealtimeSocketProvider>
                <OrganizationsProvider>
                  <SelectedOrganizationProvider>
                    <DashboardLayout />
                  </SelectedOrganizationProvider>
                </OrganizationsProvider>
              </RealtimeSocketProvider>
            </ApiProvider>
          </Suspense>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path={getRouteSubPath(Path.SANDBOXES)} element={<Sandboxes />} />
        <Route path={getRouteSubPath(Path.IMAGES)} element={<Images />} />
        <Route path={getRouteSubPath(Path.API_KEYS)} element={<ApiKeys />} />
        <Route
          path={getRouteSubPath(Path.BUCKETS)}
          element={
            <OrganizationPageWrapper
              requiredPermissions={[OrganizationRolePermissionsEnum.READ_BUCKETS]}
            >
              <Buckets />
            </OrganizationPageWrapper>
          }
        />
        <Route
          path={getRouteSubPath(Path.MEMBERS)}
          element={
            <NotPersonalOrganizationPageWrapper>
              <OrganizationMembers />
            </NotPersonalOrganizationPageWrapper>
          }
        />
        <Route path={getRouteSubPath(Path.SETTINGS)} element={<OrganizationSettings />} />
      </Route>
    </ReactRoutes>
  );
}

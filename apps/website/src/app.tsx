import { Suspense } from "react";
import { Route, Routes } from "react-router";
import { Loading } from "./components/loading";
import { getRouteSubPath, Path } from "./enums/paths";
import { ApiKeys } from "./pages/dashboard/api-keys/api-keys";
import { Dashboard } from "./pages/dashboard/dashboard";
import { DashboardLayout } from "./pages/dashboard/layout";
import Landing from "./pages/landing/landing";
import Logout from "./pages/logout";
import { NotFound } from "./pages/not-found";
import { ApiProvider } from "./providers/api-provider";
import { OrganizationsProvider } from "./providers/organization-provider";
import { SelectedOrganizationProvider } from "./providers/selected-organization-provider";

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<NotFound />} />
      <Route path="/" element={<Landing />} />
      <Route path={Path.LOGOUT} element={<Logout />} />
      <Route
        path={Path.DASHBOARD}
        element={
          <Suspense fallback={<Loading />}>
            <ApiProvider>
              <OrganizationsProvider>
                <SelectedOrganizationProvider>
                  <DashboardLayout />
                </SelectedOrganizationProvider>
              </OrganizationsProvider>
            </ApiProvider>
          </Suspense>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path={getRouteSubPath(Path.API_KEYS)} element={<ApiKeys />} />
      </Route>
    </Routes>
  );
}

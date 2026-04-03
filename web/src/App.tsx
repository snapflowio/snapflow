/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Suspense } from "react";
import { OrganizationRolePermissionsEnum } from "@snapflow/api-client";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { AuthGuard } from "@/components/auth-guard";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { NotPersonalOrganizationPageWrapper } from "@/components/layouts/not-personal-organization-wrapper";
import { OrganizationPageWrapper } from "@/components/layouts/organization-page-wrapper";
import { Loading } from "@/components/loading";
import { getRouteSubPath, Path } from "@/constants/paths";
import AuthorizePage from "@/features/auth/pages/authorize-page";
import LoginPage from "@/features/auth/pages/login-page";
import SignupPage from "@/features/auth/pages/signup-page";
import BillingPage from "@/features/billing/pages/billing-page";
import BucketsPage from "@/features/buckets/pages/buckets-page";
import ImagesPage from "@/features/images/pages/images-page";
import KeysPage from "@/features/keys/pages/keys-page";
import PrivacyPage from "@/features/legal/pages/privacy-page";
import TermsPage from "@/features/legal/pages/terms-page";
import HomePage from "@/features/marketing/pages/home-page";
import MembersPage from "@/features/members/pages/members-page";
import RegistryPage from "@/features/registries/pages/registry-page";
import SandboxesPage from "@/features/sandboxes/pages/sandboxes-page";
import SettingsPage from "@/features/settings/pages/settings-page";

export default function App() {
  return (
    <Routes>
      <Route path={Path.HOME} element={<HomePage />} />
      <Route path={Path.LANDING} element={<HomePage />} />
      <Route path={Path.PRIVACY} element={<PrivacyPage />} />
      <Route path={Path.TERMS} element={<TermsPage />} />
      <Route path={Path.LOGIN} element={<LoginPage />} />
      <Route path={Path.SIGNUP} element={<SignupPage />} />
      <Route path={Path.AUTHORIZE} element={<AuthorizePage />} />

      <Route
        path={Path.DASHBOARD}
        element={
          <AuthGuard>
            <Suspense fallback={<Loading />}>
              <DashboardLayout>
                <Outlet />
              </DashboardLayout>
            </Suspense>
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to={Path.SANDBOXES} replace />} />
        <Route path={getRouteSubPath(Path.API_KEYS)} element={<KeysPage />} />
        <Route path={getRouteSubPath(Path.SANDBOXES)} element={<SandboxesPage />} />
        <Route path={getRouteSubPath(Path.IMAGES)} element={<ImagesPage />} />
        <Route path={getRouteSubPath(Path.REGISTRIES)} element={<RegistryPage />} />

        <Route
          path={getRouteSubPath(Path.BUCKETS)}
          element={
            <OrganizationPageWrapper
              requiredPermissions={[OrganizationRolePermissionsEnum.READ_BUCKETS]}
            >
              <BucketsPage />
            </OrganizationPageWrapper>
          }
        />

        <Route
          path={getRouteSubPath(Path.MEMBERS)}
          element={
            <NotPersonalOrganizationPageWrapper>
              <MembersPage />
            </NotPersonalOrganizationPageWrapper>
          }
        />

        <Route path={getRouteSubPath(Path.BILLING)} element={<BillingPage />} />
        <Route path={getRouteSubPath(Path.SETTINGS)} element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<>Not found</>} />
    </Routes>
  );
}

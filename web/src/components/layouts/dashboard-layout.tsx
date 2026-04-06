/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Suspense, useState } from 'react';
import { Loading } from '@/components/loading';
import { DashboardSidebar } from '@/components/navigation/dashboard-sidebar';
import { OrganizationsProvider } from '@/providers/organization-provider';
import { RealtimeProvider } from '@/providers/realtime-provider';
import { SelectedOrganizationProvider } from '@/providers/selected-organization-provider';

function DashboardShell({ children }: { children: React.ReactNode }) {
	const [collapsed, setCollapsed] = useState(false);

	return (
		<div className="flex h-screen w-full bg-surface-1">
			<DashboardSidebar
				collapsed={collapsed}
				onToggleCollapse={() => setCollapsed(!collapsed)}
			/>
			<div className="flex min-w-0 flex-1 flex-col p-2 pl-0">
				<div className="flex-1 overflow-hidden rounded-lg border border-border bg-bg">
					{children}
				</div>
			</div>
		</div>
	);
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<Suspense fallback={<Loading />}>
			<RealtimeProvider>
				<OrganizationsProvider>
					<SelectedOrganizationProvider>
						<DashboardShell>{children}</DashboardShell>
					</SelectedOrganizationProvider>
				</OrganizationsProvider>
			</RealtimeProvider>
		</Suspense>
	);
}

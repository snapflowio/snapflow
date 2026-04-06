/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Organization } from '@snapflow/api-client';
import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/api-client';
import { CreateOrganizationModal } from '@/features/settings/components/create-organization-modal';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger,
	toast,
} from '@/components/ui';
import { useOrganizations } from '@/hooks/use-organizations';
import { useSelectedOrganization } from '@/hooks/use-selected-organization';
import { handleApiError } from '@/lib/errors';
import { cn } from '@/lib/utils';

interface DashboardOrgSwitcherProps {
	collapsed: boolean;
}

export function DashboardOrgSwitcher({ collapsed }: DashboardOrgSwitcherProps) {
	const organizationsApi = apiClient.organizationsApi;
	const { organizations, refreshOrganizations } = useOrganizations();
	const { selectedOrganization, onSelectOrganization } =
		useSelectedOrganization();

	const [activeOrganization, setActiveOrganization] =
		useState(selectedOrganization);
	const [loading, setLoading] = useState(false);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		setActiveOrganization(selectedOrganization);
	}, [selectedOrganization]);

	const handleSelect = async (org: Organization) => {
		setActiveOrganization(org);
		setLoading(true);
		setMenuOpen(false);
		const success = await onSelectOrganization(org.id);
		if (!success) {
			setActiveOrganization(selectedOrganization);
		}
		setLoading(false);
	};

	const handleCreate = async (name: string) => {
		try {
			const org = (
				await organizationsApi.createOrganization({ name: name.trim() })
			).data;
			toast.success('Organization created');
			await refreshOrganizations();
			await onSelectOrganization(org.id);
			return org;
		} catch (error) {
			handleApiError(error, 'Failed to create organization');
			return null;
		}
	};

	const sortedOrgs = useMemo(
		() =>
			[...organizations].sort((a, b) => {
				if (a.personal && !b.personal) {
					return -1;
				}

				if (!a.personal && b.personal) {
					return 1;
				}

				return a.name.localeCompare(b.name);
			}),
		[organizations]
	);

	const getInitial = (org: Organization) => org.name.charAt(0).toUpperCase();

	if (!activeOrganization) {
		return null;
	}

	return (
		<>
			<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
				<DropdownMenuTrigger asChild={true}>
					<button
						type="button"
						aria-label="Switch organization"
						title={activeOrganization.name}
						className={cn(
							'group flex h-8 min-w-0 items-center rounded-lg border border-border bg-surface-2 pl-1.25 transition-colors hover:bg-surface-5',
							collapsed ? 'w-8' : 'w-full cursor-pointer gap-2 pr-2',
							loading && 'cursor-progress opacity-60'
						)}
					>
						{/* Org avatar */}
						<div
							className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-medium text-[12px] text-white leading-none"
							style={{ backgroundColor: 'var(--brand-tertiary-2)' }}
						>
							{getInitial(activeOrganization)}
						</div>

						{!collapsed && (
							<>
								<span className="min-w-0 flex-1 truncate text-left font-(--font-weight-base) font-season text-[14px] text-text-primary">
									{activeOrganization.name}
								</span>
								<ChevronDown className="sidebar-collapse-hide h-2 w-2.5 shrink-0 text-text-muted group-hover:text-text-secondary" />
							</>
						)}
					</button>
				</DropdownMenuTrigger>

				<DropdownMenuContent
					align="start"
					side={collapsed ? 'right' : 'bottom'}
					sideOffset={collapsed ? 16 : 8}
					className="flex max-h-none flex-col overflow-hidden"
					style={
						collapsed
							? { width: '248px', maxWidth: 'calc(100vw - 24px)' }
							: {
									width: 'var(--radix-dropdown-menu-trigger-width)',
									minWidth: 'var(--radix-dropdown-menu-trigger-width)',
									maxWidth: 'var(--radix-dropdown-menu-trigger-width)',
								}
					}
					onCloseAutoFocus={(e) => e.preventDefault()}
				>
					{/* Current org display */}
					<div className="flex items-center gap-2 px-0.5 py-0.5">
						<div
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-medium text-[12px] text-white"
							style={{ backgroundColor: 'var(--brand-tertiary-2)' }}
						>
							{getInitial(activeOrganization)}
						</div>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium text-[13px] text-text-primary">
								{activeOrganization.name}
							</span>
							<span className="text-[11px] text-text-tertiary">
								{activeOrganization.personal ? 'Personal' : 'Organization'}
							</span>
						</div>
					</div>

					{/* Org list */}
					<DropdownMenuGroup className="mt-1 min-h-0 flex-1">
						<div className="flex max-h-32.5 flex-col gap-0.5 overflow-y-auto">
							{sortedOrgs.map((org) => (
								<button
									key={org.id}
									type="button"
									className={cn(
										'group flex w-full cursor-pointer select-none items-center gap-2 rounded-[5px] px-2 py-1.25 font-medium text-[12px] text-text-body outline-none transition-colors hover:bg-surface-active',
										org.id === activeOrganization.id && 'bg-surface-active'
									)}
									onClick={() => handleSelect(org)}
								>
									<span className="min-w-0 flex-1 truncate">{org.name}</span>
								</button>
							))}
						</div>
					</DropdownMenuGroup>

					{/* Create new */}
					<div className="mt-1 flex flex-col gap-0.5">
						<button
							type="button"
							className="flex w-full cursor-pointer select-none items-center gap-2 rounded-[5px] px-2 py-1.25 font-medium text-[12px] text-text-body outline-none transition-colors hover:bg-surface-active"
							onClick={(e) => {
								e.stopPropagation();
								setMenuOpen(false);
								setShowCreateDialog(true);
							}}
						>
							<Plus className="h-3.5 w-3.5 shrink-0 text-text-icon" />
							Create new organization
						</button>
					</div>
				</DropdownMenuContent>
			</DropdownMenu>

			<CreateOrganizationModal
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				onCreateOrganization={handleCreate}
			/>
		</>
	);
}

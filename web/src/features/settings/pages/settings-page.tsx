/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OrganizationUserRoleEnum } from '@snapflow/api-client';
import { Copy, Settings } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiClient } from '@/api/api-client';
import { DeleteOrganizationModal } from '@/features/settings/components/delete-organization-modal';
import { LeaveOrganizationModal } from '@/features/settings/components/leave-organization-modal';
import { toast } from '@/components/ui';
import { Path } from '@/constants/paths';
import { useOrganizations } from '@/hooks/use-organizations';
import { useSelectedOrganization } from '@/hooks/use-selected-organization';
import { handleApiError } from '@/lib/errors';

export default function SettingsPage() {
	const navigate = useNavigate();
	const organizationsApi = apiClient.organizationsApi;

	const { refreshOrganizations } = useOrganizations();
	const { selectedOrganization, authenticatedUserOrganizationMember } =
		useSelectedOrganization();

	const [loadingDeleteOrganization, setLoadingDeleteOrganization] =
		useState(false);
	const [loadingLeaveOrganization, setLoadingLeaveOrganization] =
		useState(false);

	const handleCopyToClipboard = useCallback((text: string) => {
		navigator.clipboard.writeText(text);
		toast.success('Copied to clipboard');
	}, []);

	const handleDeleteOrganization = useCallback(async (): Promise<boolean> => {
		if (!selectedOrganization) {
			return false;
		}
		setLoadingDeleteOrganization(true);
		try {
			await organizationsApi.deleteOrganization(selectedOrganization.id);
			toast.success('Organization deleted successfully');
			await refreshOrganizations();
			navigate(Path.DASHBOARD);
			return true;
		} catch (error) {
			handleApiError(error, 'Failed to delete organization');
			return false;
		} finally {
			setLoadingDeleteOrganization(false);
		}
	}, [selectedOrganization, refreshOrganizations, navigate]);

	const handleLeaveOrganization = useCallback(async (): Promise<boolean> => {
		if (!selectedOrganization) {
			return false;
		}
		setLoadingLeaveOrganization(true);
		try {
			await organizationsApi.leaveOrganization(selectedOrganization.id);
			toast.success('Left organization successfully');
			await refreshOrganizations();
			navigate(Path.DASHBOARD);
			return true;
		} catch (error) {
			handleApiError(error, 'Failed to leave organization');
			return false;
		} finally {
			setLoadingLeaveOrganization(false);
		}
	}, [selectedOrganization, refreshOrganizations, navigate]);

	if (!selectedOrganization) {
		return null;
	}

	const isOwner =
		authenticatedUserOrganizationMember?.role ===
		OrganizationUserRoleEnum.OWNER;
	const showDangerZone =
		!selectedOrganization.personal && authenticatedUserOrganizationMember;

	return (
		<div className="flex h-full flex-1 flex-col overflow-hidden bg-bg">
			{/* Header */}
			<div className="shrink-0 border-border border-b px-6 py-2.5">
				<div className="flex items-center gap-3">
					<Settings className="h-3.5 w-3.5 text-text-icon" />
					<h1 className="font-medium text-[14px] text-text-body">Settings</h1>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-6">
				<div className="mx-auto max-w-2xl space-y-6">
					{/* General section */}
					<div className="rounded-lg border border-border">
						<div className="border-border border-b px-5 py-3">
							<h2 className="font-medium text-[14px] text-text-body">
								General
							</h2>
							<p className="mt-0.5 text-[12px] text-text-muted">
								Basic information about your organization.
							</p>
						</div>
						<div className="flex flex-col gap-4 p-5">
							<div className="flex flex-col gap-1">
								<label
									htmlFor="org-id"
									className="font-medium text-[13px] text-text-primary"
								>
									Organization ID
								</label>
								<div className="flex items-center rounded-[5px] border border-border-1 bg-surface-2">
									<input
										id="org-id"
										value={selectedOrganization.id}
										readOnly={true}
										className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[13px] text-text-primary outline-none"
									/>
									<button
										type="button"
										className="flex h-7 w-7 shrink-0 items-center justify-center text-text-icon transition-colors hover:text-text-primary"
										onClick={() =>
											handleCopyToClipboard(selectedOrganization?.id ?? '')
										}
									>
										<Copy className="h-3.5 w-3.5" />
									</button>
								</div>
							</div>

							<div className="border-border border-t" />

							<div className="flex flex-col gap-1">
								<label
									htmlFor="org-name"
									className="font-medium text-[13px] text-text-primary"
								>
									Organization Name
								</label>
								<input
									id="org-name"
									value={selectedOrganization.name}
									readOnly={true}
									className="rounded-[5px] border border-border-1 bg-surface-2 px-3 py-2 text-[13px] text-text-primary outline-none"
								/>
							</div>
						</div>
					</div>

					{/* Danger zone */}
					{showDangerZone && (
						<div className="rounded-lg border border-red-500/30">
							<div className="border-red-500/30 border-b px-5 py-3">
								<h2 className="font-medium text-[14px] text-red-400">
									Danger Zone
								</h2>
								<p className="mt-0.5 text-[12px] text-text-muted">
									Irreversible actions that affect your organization.
								</p>
							</div>
							<div className="p-5">
								{isOwner ? (
									<div className="flex items-start justify-between gap-6">
										<div className="flex flex-col gap-1">
											<span className="font-medium text-[13px] text-text-primary">
												Delete Organization
											</span>
											<p className="text-[11px] text-text-muted">
												Permanently delete this organization and all associated
												data including sandboxes, images, registries, and API
												keys. This action cannot be undone.
											</p>
										</div>
										<DeleteOrganizationModal
											organizationName={selectedOrganization.name}
											onDeleteOrganization={handleDeleteOrganization}
											loading={loadingDeleteOrganization}
										/>
									</div>
								) : (
									<div className="flex items-start justify-between gap-6">
										<div className="flex flex-col gap-1">
											<span className="font-medium text-[13px] text-text-primary">
												Leave Organization
											</span>
											<p className="text-[11px] text-text-muted">
												You will lose access to all resources in this
												organization. You can be re-invited by an owner at any
												time.
											</p>
										</div>
										<LeaveOrganizationModal
											organizationName={selectedOrganization.name}
											onLeaveOrganization={handleLeaveOrganization}
											loading={loadingLeaveOrganization}
										/>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

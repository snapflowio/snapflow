/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { OrganizationRole } from '@snapflow/api-client';
import { useCallback, useMemo, useState } from 'react';
import {
	Button,
	Checkbox,
	Label,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from '@/components/ui';
import { ViewerCheckbox } from '@/features/members/components/view-checkbox';

interface UpdateAssignedOrganizationRolesModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialData: OrganizationRole[];
	availableRoles: OrganizationRole[];
	loadingAvailableRoles: boolean;
	onUpdateAssignedRoles: (roleIds: string[]) => Promise<boolean>;
	loading: boolean;
}

export function UpdateAssignedOrganizationRolesModal({
	open,
	onOpenChange,
	initialData,
	availableRoles,
	loadingAvailableRoles,
	onUpdateAssignedRoles,
	loading,
}: UpdateAssignedOrganizationRolesModalProps) {
	const [roleIds, setRoleIds] = useState(initialData.map((role) => role.id));

	const hasAvailableRoles = useMemo(
		() => !loadingAvailableRoles && availableRoles.length > 0,
		[loadingAvailableRoles, availableRoles.length]
	);

	const handleUpdateAssignedRoles = useCallback(async () => {
		const success = await onUpdateAssignedRoles(roleIds);
		if (success) {
			onOpenChange(false);
			setRoleIds(initialData.map((role) => role.id));
		}
	}, [roleIds, onUpdateAssignedRoles, onOpenChange, initialData]);

	const handleRoleToggle = useCallback((roleId: string) => {
		setRoleIds((current) => {
			if (current.includes(roleId)) {
				return current.filter((p) => p !== roleId);
			}

			return [...current, roleId];
		});
	}, []);

	const handleOpenChange = useCallback(
		(isOpen: boolean) => {
			onOpenChange(isOpen);
			if (!isOpen) {
				setRoleIds(initialData.map((role) => role.id));
			}
		},
		[onOpenChange, initialData]
	);

	return (
		<Modal open={open} onOpenChange={handleOpenChange}>
			<ModalContent size="md">
				<ModalHeader>Assign Roles</ModalHeader>
				{hasAvailableRoles && (
					<ModalBody>
						<div className="flex flex-col gap-2">
							<Label>Roles</Label>
						</div>
						<div className="space-y-4">
							<ViewerCheckbox />
							{availableRoles.map((role) => (
								<div key={role.id} className="flex items-start space-x-3">
									<Checkbox
										id={role.id}
										checked={roleIds.includes(role.id)}
										onCheckedChange={() => handleRoleToggle(role.id)}
										className="mt-0.5"
									/>
									<div className="space-y-0.5">
										<Label htmlFor={role.id} className="font-medium text-sm">
											{role.name}
										</Label>
										{role.description && (
											<p className="text-text-muted text-xs">
												{role.description}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					</ModalBody>
				)}
				{!hasAvailableRoles && (
					<ModalBody>
						<p className="text-[13px] text-text-secondary">
							No roles are available for assignment.
						</p>
					</ModalBody>
				)}
				<ModalFooter>
					{hasAvailableRoles ? (
						<>
							<Button
								variant="default"
								onClick={() => onOpenChange(false)}
								disabled={loading}
							>
								Cancel
							</Button>
							<Button
								variant="primary"
								type="button"
								onClick={handleUpdateAssignedRoles}
								disabled={loading}
							>
								{loading ? 'Saving...' : 'Save'}
							</Button>
						</>
					) : (
						<Button variant="default" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
					)}
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { zodResolver } from '@hookform/resolvers/zod';
import {
	CreateInvitationRoleEnum,
	type OrganizationRole,
} from '@snapflow/api-client';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
	Button,
	ButtonGroup,
	ButtonGroupItem,
	Checkbox,
	Input,
	Label,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from '@/components/ui';
import { ViewerCheckbox } from '@/features/members/components/view-checkbox';

const schema = z.object({
	email: z.string().email('Please enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

interface CreateOrganizationInvitationModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	availableRoles: OrganizationRole[];
	loadingAvailableRoles: boolean;
	onCreateInvitation: (
		email: string,
		role: CreateInvitationRoleEnum,
		assignedRoleIds: string[]
	) => Promise<boolean>;
}

export function CreateOrganizationInvitationModal({
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	availableRoles,
	loadingAvailableRoles,
	onCreateInvitation,
}: CreateOrganizationInvitationModalProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = controlledOnOpenChange ?? setInternalOpen;

	const [role, setRole] = useState<CreateInvitationRoleEnum>(
		CreateInvitationRoleEnum.MEMBER
	);
	const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [developerRole, setDeveloperRole] = useState<OrganizationRole | null>(
		null
	);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { email: '' },
	});

	useEffect(() => {
		if (!loadingAvailableRoles) {
			const devRole = availableRoles.find((r) => r.name === 'Developer');
			if (devRole) {
				setDeveloperRole(devRole);
				setAssignedRoleIds([devRole.id]);
			}
		}
	}, [loadingAvailableRoles, availableRoles]);

	const handleRoleAssignmentToggle = useCallback((roleId: string) => {
		setAssignedRoleIds((current) => {
			if (current.includes(roleId)) {
				return current.filter((p) => p !== roleId);
			}

			return [...current, roleId];
		});
	}, []);

	const handleModalOpenChange = useCallback(
		(isOpen: boolean) => {
			setOpen(isOpen);
			if (!isOpen) {
				reset();
				setRole(CreateInvitationRoleEnum.MEMBER);
				setAssignedRoleIds(developerRole ? [developerRole.id] : []);
			}
		},
		[developerRole, setOpen, reset]
	);

	const onSubmit = async (values: FormValues) => {
		setLoading(true);
		const success = await onCreateInvitation(
			values.email,
			role,
			role === CreateInvitationRoleEnum.OWNER ? [] : assignedRoleIds
		);
		if (success) {
			setOpen(false);
		}
		setLoading(false);
	};

	return (
		<Modal open={open} onOpenChange={handleModalOpenChange}>
			<ModalContent size="md">
				<ModalHeader>Invite Member</ModalHeader>

				<ModalBody>
					<form
						id="invitation-form"
						className="flex flex-col gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="invite-email">Email</Label>
							<Input
								id="invite-email"
								type="email"
								placeholder="mail@example.com"
								{...register('email')}
							/>
							{errors.email && (
								<p className="text-[12px] text-text-error">
									{errors.email.message}
								</p>
							)}
						</div>

						<div className="border-border border-t" />

						<div className="flex flex-col gap-2">
							<Label>Role</Label>
							<ButtonGroup
								value={role}
								onValueChange={(v) => setRole(v as CreateInvitationRoleEnum)}
							>
								<ButtonGroupItem value={CreateInvitationRoleEnum.OWNER}>
									Owner
								</ButtonGroupItem>
								<ButtonGroupItem value={CreateInvitationRoleEnum.MEMBER}>
									Member
								</ButtonGroupItem>
							</ButtonGroup>
						</div>

						{role === CreateInvitationRoleEnum.MEMBER &&
							!loadingAvailableRoles && (
								<>
									<div className="border-border border-t" />
									<div className="flex flex-col gap-2">
										<Label>Assignments</Label>
									</div>
									<div className="space-y-4">
										<ViewerCheckbox />
										{availableRoles.map((availableRole) => (
											<div
												key={availableRole.id}
												className="flex items-start space-x-3"
											>
												<Checkbox
													id={`role-${availableRole.id}`}
													checked={assignedRoleIds.includes(availableRole.id)}
													onCheckedChange={() =>
														handleRoleAssignmentToggle(availableRole.id)
													}
													className="mt-0.5"
												/>
												<div className="space-y-0.5">
													<Label
														htmlFor={`role-${availableRole.id}`}
														className="font-medium text-sm"
													>
														{availableRole.name}
													</Label>
													{availableRole.description && (
														<p className="text-text-muted text-xs">
															{availableRole.description}
														</p>
													)}
												</div>
											</div>
										))}
									</div>
								</>
							)}
					</form>
				</ModalBody>
				<ModalFooter>
					<Button
						variant="default"
						onClick={() => setOpen(false)}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="invitation-form"
						disabled={loading}
					>
						{loading ? 'Inviting...' : 'Invite'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

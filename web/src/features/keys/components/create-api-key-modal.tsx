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
	type ApiKeyCreated,
	CreateApiKeyPermissionsEnum,
} from '@snapflow/api-client';
import { Check as CheckIcon, Copy, KeyRound } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as z from 'zod';
import {
	Badge,
	Button,
	DatePicker,
	Input,
	Label,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	Switch,
} from '@/components/ui';
import { CREATE_API_KEY_PERMISSIONS_GROUPS } from '@/constants/api-key-permissions';
import type { CreateApiKeyPermissionGroup } from '@/constants/api-key-permissions-group';
import { env } from '@/env';

const PERMISSION_LABELS: Record<string, string> = {
	[CreateApiKeyPermissionsEnum.WRITE_SANDBOXES]: 'Create & update',
	[CreateApiKeyPermissionsEnum.DELETE_SANDBOXES]: 'Delete',
	[CreateApiKeyPermissionsEnum.WRITE_IMAGES]: 'Create & update',
	[CreateApiKeyPermissionsEnum.DELETE_IMAGES]: 'Delete',
	[CreateApiKeyPermissionsEnum.WRITE_REGISTRIES]: 'Create & update',
	[CreateApiKeyPermissionsEnum.DELETE_REGISTRIES]: 'Delete',
	[CreateApiKeyPermissionsEnum.READ_BUCKETS]: 'Read',
	[CreateApiKeyPermissionsEnum.WRITE_BUCKETS]: 'Create & update',
	[CreateApiKeyPermissionsEnum.DELETE_BUCKETS]: 'Delete',
};

const schema = z.object({
	name: z.string().min(1, 'Key name is required'),
	expiresAt: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateApiKeyModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	availablePermissions: CreateApiKeyPermissionsEnum[];
	onCreateApiKey: (
		name: string,
		permissions: CreateApiKeyPermissionsEnum[],
		expiresAt: Date | null
	) => Promise<ApiKeyCreated | null>;
}

export function CreateApiKeyModal({
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	availablePermissions,
	onCreateApiKey,
}: CreateApiKeyModalProps) {
	const [internalCreateOpen, setInternalCreateOpen] = useState(false);
	const createOpen = controlledOpen ?? internalCreateOpen;
	const setCreateOpen = controlledOnOpenChange ?? setInternalCreateOpen;

	const [resultOpen, setResultOpen] = useState(false);
	const [checkedPermissions, setCheckedPermissions] =
		useState<CreateApiKeyPermissionsEnum[]>(availablePermissions);
	const [loading, setLoading] = useState(false);
	const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
	const [copied, setCopied] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		control,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { name: '', expiresAt: undefined },
	});

	const availableGroups = useMemo(() => {
		return CREATE_API_KEY_PERMISSIONS_GROUPS.map((group) => ({
			...group,
			permissions: group.permissions.filter((p) =>
				availablePermissions.includes(p)
			),
		})).filter((group) => group.permissions.length > 0);
	}, [availablePermissions]);

	const isGroupChecked = useCallback(
		(group: CreateApiKeyPermissionGroup) =>
			group.permissions.every((permission) =>
				checkedPermissions.includes(permission)
			),
		[checkedPermissions]
	);

	const isGroupPartial = useCallback(
		(group: CreateApiKeyPermissionGroup) =>
			group.permissions.some((permission) =>
				checkedPermissions.includes(permission)
			) &&
			!group.permissions.every((permission) =>
				checkedPermissions.includes(permission)
			),
		[checkedPermissions]
	);

	const handleGroupToggle = useCallback(
		(group: CreateApiKeyPermissionGroup) => {
			setCheckedPermissions((current) => {
				if (
					group.permissions.every((permission) => current.includes(permission))
				) {
					return current.filter((p) => !group.permissions.includes(p));
				}
				const newPermissions = [...current];
				group.permissions.forEach((key) => {
					if (!newPermissions.includes(key)) {
						newPermissions.push(key);
					}
				});
				return newPermissions;
			});
		},
		[]
	);

	const handlePermissionToggle = useCallback(
		(permission: CreateApiKeyPermissionsEnum) => {
			setCheckedPermissions((current) =>
				current.includes(permission)
					? current.filter((p) => p !== permission)
					: [...current, permission]
			);
		},
		[]
	);

	const copyToClipboard = useCallback(async (text: string, label: string) => {
		await navigator.clipboard.writeText(text);
		setCopied(label);
		setTimeout(() => setCopied(null), 2000);
	}, []);

	const resetCreateForm = useCallback(() => {
		reset();
		setCheckedPermissions(availablePermissions);
	}, [availablePermissions, reset]);

	const handleCreateOpenChange = useCallback(
		(isOpen: boolean) => {
			setCreateOpen(isOpen);
			if (!isOpen) {
				resetCreateForm();
			}
		},
		[resetCreateForm, setCreateOpen]
	);

	const handleResultOpenChange = useCallback((isOpen: boolean) => {
		setResultOpen(isOpen);
		if (!isOpen) {
			setCreatedKey(null);
			setCopied(null);
		}
	}, []);

	const onSubmit = async (values: FormValues) => {
		setLoading(true);
		try {
			const key = await onCreateApiKey(
				values.name,
				checkedPermissions,
				values.expiresAt ? new Date(values.expiresAt) : null
			);
			if (key) {
				setCreatedKey(key);
				setCreateOpen(false);
				setTimeout(() => setResultOpen(true), 200);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			{/* Step 1: Create form */}
			<Modal open={createOpen} onOpenChange={handleCreateOpenChange}>
				<ModalContent size="md">
					<ModalHeader>Create API Key</ModalHeader>

					<ModalBody>
						<form
							id="create-api-key-form"
							className="flex flex-col gap-3"
							onSubmit={handleSubmit(onSubmit)}
						>
							<div className="flex flex-col gap-2">
								<Label htmlFor="key-name">Key Name</Label>
								<Input
									id="key-name"
									type="text"
									placeholder="e.g. Production, CI/CD, Development"
									{...register('name')}
								/>
								{errors.name && (
									<p className="text-[12px] text-text-error">
										{errors.name.message}
									</p>
								)}
							</div>

							<div className="flex flex-col gap-2">
								<Label>Expiration</Label>
								<Controller
									name="expiresAt"
									control={control}
									render={({ field }) => (
										<DatePicker value={field.value} onChange={field.onChange} />
									)}
								/>
							</div>

							{availableGroups.length > 0 && (
								<>
									<div className="border-border border-t" />

									<div className="flex flex-col gap-2">
										<Label>Permissions</Label>
									</div>

									<div className="space-y-4">
										{availableGroups.map((group) => {
											const groupChecked = isGroupChecked(group);
											const groupPartial = isGroupPartial(group);
											const activeCount = group.permissions.filter((p) =>
												checkedPermissions.includes(p)
											).length;

											return (
												<div
													key={group.name}
													className="rounded-lg border bg-surface-2"
												>
													<div className="flex flex-row items-center justify-between gap-3 px-4 py-3">
														<div className="flex items-center gap-3">
															<Label>{group.name}</Label>
															<Badge
																variant={
																	groupChecked
																		? 'green'
																		: groupPartial
																			? 'amber'
																			: 'gray-secondary'
																}
																size="sm"
															>
																{activeCount}/{group.permissions.length}
															</Badge>
														</div>
														<Switch
															checked={groupChecked}
															onCheckedChange={() => handleGroupToggle(group)}
														/>
													</div>

													{!groupChecked && (
														<div className="space-y-1 border-t px-4 py-2">
															{group.permissions.map((permission) => (
																<div
																	key={permission}
																	className="flex flex-row items-center justify-between gap-3 py-1"
																>
																	<Label
																		htmlFor={permission}
																		className="text-text-muted"
																	>
																		{PERMISSION_LABELS[permission] ||
																			permission}
																	</Label>
																	<Switch
																		id={permission}
																		checked={checkedPermissions.includes(
																			permission
																		)}
																		onCheckedChange={() =>
																			handlePermissionToggle(permission)
																		}
																	/>
																</div>
															))}
														</div>
													)}
												</div>
											);
										})}
									</div>
								</>
							)}
						</form>
					</ModalBody>
					<ModalFooter>
						<Button
							variant="default"
							onClick={() => setCreateOpen(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							type="submit"
							form="create-api-key-form"
							disabled={loading || !checkedPermissions.length}
						>
							{loading ? 'Creating...' : 'Create'}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			{/* Step 2: Result dialog */}
			{createdKey && (
				<Modal open={resultOpen} onOpenChange={handleResultOpenChange}>
					<ModalContent size="md">
						<ModalHeader>API Key Created</ModalHeader>

						<ModalBody>
							<div className="flex flex-col gap-3">
								<div className="flex items-center gap-3 rounded-lg border border-border bg-brand-tertiary/5 p-3">
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-tertiary/10">
										<KeyRound className="h-4 w-4 text-brand-tertiary" />
									</div>
									<p className="text-[13px] text-brand-tertiary">
										Store this key securely. It will only be shown once.
									</p>
								</div>

								<div className="flex flex-col gap-2">
									<Label>API Key</Label>
									<div className="flex items-center gap-2">
										<Input
											value={createdKey.value}
											readOnly={true}
											className="flex-1"
										/>
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												copyToClipboard(createdKey.value, 'API Key')
											}
										>
											{copied === 'API Key' ? (
												<CheckIcon className="h-3.5 w-3.5 text-brand-tertiary" />
											) : (
												<Copy className="h-3.5 w-3.5" />
											)}
										</Button>
									</div>
								</div>

								<div className="flex flex-col gap-2">
									<Label>API URL</Label>
									<div className="flex items-center gap-2">
										<Input
											value={env.VITE_API_URL || ''}
											readOnly={true}
											className="flex-1"
										/>
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												copyToClipboard(env.VITE_API_URL || '', 'API URL')
											}
										>
											{copied === 'API URL' ? (
												<CheckIcon className="h-3.5 w-3.5 text-brand-tertiary" />
											) : (
												<Copy className="h-3.5 w-3.5" />
											)}
										</Button>
									</div>
								</div>
							</div>
						</ModalBody>

						<ModalFooter>
							<Button
								variant="primary"
								onClick={() => handleResultOpenChange(false)}
							>
								Done
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>
			)}
		</>
	);
}

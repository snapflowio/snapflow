/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as z from 'zod';
import {
	Button,
	Input,
	Label,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	Switch,
} from '@/components/ui';

const REGISTRY_URL_REGEX = /^[a-zA-Z0-9.-]+(:[0-9]+)?(\/[a-zA-Z0-9._/-]*)?$/;

const schema = z.object({
	name: z.string().min(1, 'Registry name is required'),
	url: z
		.string()
		.min(1, 'Registry URL is required')
		.regex(
			REGISTRY_URL_REGEX,
			'Invalid URL format (e.g., docker.io or gcr.io)'
		),
	username: z.string().min(1, 'Username is required'),
	password: z.string().min(1, 'Password is required'),
	project: z.string().optional(),
	isDefault: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface CreateRegistryModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onCreateRegistry: (data: {
		name: string;
		url: string;
		username: string;
		password: string;
		project?: string;
		isDefault?: boolean;
	}) => Promise<void>;
	loading?: boolean;
}

export function CreateRegistryModal({
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	onCreateRegistry,
	loading = false,
}: CreateRegistryModalProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = controlledOnOpenChange ?? setInternalOpen;

	const {
		register,
		handleSubmit,
		reset,
		control,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: '',
			url: '',
			username: '',
			password: '',
			project: '',
			isDefault: false,
		},
	});

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			reset();
		}
	};

	const onSubmit = async (values: FormValues) => {
		await onCreateRegistry({
			name: values.name.trim(),
			url: values.url.trim(),
			username: values.username.trim(),
			password: values.password.trim(),
			project: values.project?.trim() || undefined,
			isDefault: values.isDefault,
		});
		setOpen(false);
		reset();
	};

	return (
		<Modal open={open} onOpenChange={handleOpenChange}>
			<ModalContent size="md">
				<ModalHeader>Create New Registry</ModalHeader>
				<ModalBody>
					<form
						id="registry-form"
						className="flex flex-col gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="reg-name">Registry Name</Label>
							<Input
								id="reg-name"
								placeholder="my-docker-hub"
								{...register('name')}
							/>
							{errors.name && (
								<p className="text-[12px] text-text-error">
									{errors.name.message}
								</p>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="reg-url">Registry URL</Label>
							<Input
								id="reg-url"
								placeholder="docker.io"
								{...register('url')}
							/>
							{errors.url && (
								<p className="text-[12px] text-text-error">
									{errors.url.message}
								</p>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="reg-username">Username</Label>
							<Input
								id="reg-username"
								placeholder="myusername"
								{...register('username')}
							/>
							{errors.username && (
								<p className="text-[12px] text-text-error">
									{errors.username.message}
								</p>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="reg-password">Password</Label>
							<Input
								id="reg-password"
								type="password"
								{...register('password')}
							/>
							{errors.password && (
								<p className="text-[12px] text-text-error">
									{errors.password.message}
								</p>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="reg-project">
								Project{' '}
								<span className="font-normal text-text-secondary">
									(optional)
								</span>
							</Label>
							<Input
								id="reg-project"
								placeholder="my-project"
								{...register('project')}
							/>
						</div>

						<div className="border-border border-t" />

						<div className="flex flex-row items-center justify-between gap-3">
							<Label htmlFor="reg-is-default">Default Registry</Label>
							<Controller
								name="isDefault"
								control={control}
								render={({ field }) => (
									<Switch
										id="reg-is-default"
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								)}
							/>
						</div>
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
						form="registry-form"
						disabled={loading}
					>
						{loading ? 'Creating...' : 'Create Registry'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

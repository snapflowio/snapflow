/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { zodResolver } from '@hookform/resolvers/zod';
import type { Registry } from '@snapflow/api-client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
	password: z.string().optional(),
	project: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditRegistryModalProps {
	registry: Registry | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onEditRegistry: (data: {
		name: string;
		url: string;
		username: string;
		password?: string;
		project?: string;
	}) => Promise<void>;
	loading?: boolean;
}

export function EditRegistryModal({
	registry,
	open,
	onOpenChange,
	onEditRegistry,
	loading = false,
}: EditRegistryModalProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: '',
			url: '',
			username: '',
			password: '',
			project: '',
		},
	});

	useEffect(() => {
		if (registry) {
			reset({
				name: registry.name,
				url: registry.url,
				username: registry.username,
				password: '',
				project: registry.project || '',
			});
		}
	}, [registry, reset]);

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
		if (!isOpen) {
			reset();
		}
	};

	const onSubmit = async (values: FormValues) => {
		await onEditRegistry({
			name: values.name.trim(),
			url: values.url.trim(),
			username: values.username.trim(),
			password: values.password?.trim() || undefined,
			project: values.project?.trim() || undefined,
		});
	};

	return (
		<Modal open={open} onOpenChange={handleOpenChange}>
			<ModalContent size="md">
				<ModalHeader>Edit Registry</ModalHeader>
				<ModalBody>
					<form
						id="edit-registry-form"
						className="flex flex-col gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="edit-name">Registry Name</Label>
							<Input
								id="edit-name"
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
							<Label htmlFor="edit-url">Registry URL</Label>
							<Input
								id="edit-url"
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
							<Label htmlFor="edit-username">Username</Label>
							<Input
								id="edit-username"
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
							<Label htmlFor="edit-password">
								Password{' '}
								<span className="font-normal text-text-secondary">
									(leave blank to keep current)
								</span>
							</Label>
							<Input
								id="edit-password"
								type="password"
								placeholder="••••••••"
								{...register('password')}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="edit-project">
								Project{' '}
								<span className="font-normal text-text-secondary">
									(optional)
								</span>
							</Label>
							<Input
								id="edit-project"
								placeholder="my-project"
								{...register('project')}
							/>
						</div>
					</form>
				</ModalBody>
				<ModalFooter>
					<Button
						variant="default"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="edit-registry-form"
						disabled={loading}
					>
						{loading ? 'Updating...' : 'Update Registry'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

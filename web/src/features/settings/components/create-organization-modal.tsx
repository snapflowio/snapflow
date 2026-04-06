/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { zodResolver } from '@hookform/resolvers/zod';
import type { Organization } from '@snapflow/api-client';
import { useState } from 'react';
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
	toast,
} from '@/components/ui';

const schema = z.object({
	name: z
		.string()
		.min(1, 'Organization name is required')
		.max(100, 'Name must be 100 characters or fewer'),
});

type FormValues = z.infer<typeof schema>;

interface CreateOrganizationModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreateOrganization: (name: string) => Promise<Organization | null>;
}

export function CreateOrganizationModal({
	open,
	onOpenChange,
	onCreateOrganization,
}: CreateOrganizationModalProps) {
	const [loading, setLoading] = useState(false);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { name: '' },
	});

	const handleOpenChange = (isOpen: boolean) => {
		onOpenChange(isOpen);
		if (!isOpen) {
			reset();
		}
	};

	const onSubmit = async (values: FormValues) => {
		setLoading(true);
		try {
			const org = await onCreateOrganization(values.name);
			if (org) {
				toast.success('Organization created successfully');
				reset();
				onOpenChange(false);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal open={open} onOpenChange={handleOpenChange}>
			<ModalContent size="md">
				<ModalHeader>Create New Organization</ModalHeader>
				<ModalBody>
					<form
						id="create-organization-form"
						className="flex flex-col gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="organization-name">Organization Name</Label>
							<Input
								id="organization-name"
								placeholder="Name"
								{...register('name')}
							/>
							{errors.name && (
								<p className="text-[12px] text-text-error">
									{errors.name.message}
								</p>
							)}
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
						form="create-organization-form"
						disabled={loading}
					>
						{loading ? 'Creating...' : 'Create'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

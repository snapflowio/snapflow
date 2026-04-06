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

const schema = z.object({
	name: z
		.string()
		.min(1, 'Bucket name is required')
		.max(63, 'Name must be 63 characters or fewer')
		.regex(
			/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
			'Use lowercase letters, numbers, and hyphens only'
		),
});

type FormValues = z.infer<typeof schema>;

interface CreateBucketModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onCreateBucket: (name: string) => Promise<void>;
	loading?: boolean;
	disabled?: boolean;
}

export function CreateBucketModal({
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	onCreateBucket,
	loading = false,
	disabled = false,
}: CreateBucketModalProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = controlledOnOpenChange ?? setInternalOpen;

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
		setOpen(isOpen);
		if (!isOpen) {
			reset();
		}
	};

	const onSubmit = async (values: FormValues) => {
		await onCreateBucket(values.name);
		setOpen(false);
		reset();
	};

	return (
		<Modal open={open} onOpenChange={handleOpenChange}>
			<ModalContent size="md">
				<ModalHeader>Create New Bucket</ModalHeader>
				<ModalBody>
					<form
						id="create-bucket-form"
						className="flex flex-col gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="bucket-name">Bucket Name</Label>
							<Input
								id="bucket-name"
								placeholder="my-bucket"
								disabled={disabled}
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
						onClick={() => setOpen(false)}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="create-bucket-form"
						disabled={loading || disabled}
					>
						{loading ? 'Creating...' : 'Create'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

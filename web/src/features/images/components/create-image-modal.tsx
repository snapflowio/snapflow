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
	Slider,
} from '@/components/ui';
import {
	IMAGE_NAME_REGEX,
	validateImageName,
} from '@/constants/image-validation';

const schema = z.object({
	name: z
		.string()
		.min(1, 'Image name is required')
		.refine((v) => !v.includes(' '), 'Spaces are not allowed in image names')
		.refine(
			(v) => IMAGE_NAME_REGEX.test(v),
			'Invalid image name format. May contain letters, digits, dots, colons, slashes and dashes'
		),
	imageName: z
		.string()
		.min(1, 'Registry image is required')
		.superRefine((v, ctx) => {
			const result = validateImageName(v);
			if (!result.isValid) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: result.error ?? 'Invalid image name',
				});
			}
		}),
	entrypoint: z.string().optional(),
	cpu: z.number().min(1).max(16),
	memory: z.number().min(256).max(32768),
	disk: z.number().min(1).max(100),
});

type FormValues = z.infer<typeof schema>;

interface CreateImageModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onCreateImage: (data: {
		name: string;
		imageName: string;
		entrypoint?: string[];
		cpu?: number;
		memory?: number;
		disk?: number;
	}) => Promise<void>;
	loading?: boolean;
	disabled?: boolean;
}

export function CreateImageModal({
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	onCreateImage,
	loading = false,
	disabled = false,
}: CreateImageModalProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = controlledOnOpenChange ?? setInternalOpen;

	const {
		register,
		handleSubmit,
		reset,
		control,
		watch,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: '',
			imageName: '',
			entrypoint: '',
			cpu: 2,
			memory: 512,
			disk: 2,
		},
	});

	const cpu = watch('cpu');
	const memory = watch('memory');
	const disk = watch('disk');

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			reset();
		}
	};

	const onSubmit = async (values: FormValues) => {
		await onCreateImage({
			name: values.name,
			imageName: values.imageName,
			entrypoint: values.entrypoint?.trim()
				? values.entrypoint.trim().split(' ')
				: undefined,
			cpu: values.cpu,
			memory: values.memory,
			disk: values.disk,
		});
		setOpen(false);
		reset();
	};

	return (
		<Modal open={open} onOpenChange={handleOpenChange}>
			<ModalContent size="md">
				<ModalHeader>Create New Image</ModalHeader>
				<ModalBody>
					<form
						id="create-image-form"
						className="flex flex-col gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="img-name">Image Name</Label>
							<Input
								id="img-name"
								placeholder="ubuntu-4vcpu-8ram-100gb"
								disabled={disabled}
								{...register('name')}
							/>
							{errors.name && (
								<p className="text-[12px] text-text-error">
									{errors.name.message}
								</p>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="img-registry">Registry Image</Label>
							<Input
								id="img-registry"
								placeholder="ubuntu:22.04"
								disabled={disabled}
								{...register('imageName')}
							/>
							{errors.imageName && (
								<p className="text-[12px] text-text-error">
									{errors.imageName.message}
								</p>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="img-entrypoint">
								Entrypoint{' '}
								<span className="font-normal text-text-secondary">
									(optional)
								</span>
							</Label>
							<Input
								id="img-entrypoint"
								placeholder="sleep infinity"
								disabled={disabled}
								{...register('entrypoint')}
							/>
						</div>

						<div className="rounded-lg border bg-surface-2">
							<div className="border-b px-4 py-3">
								<Label>Resource Allocation</Label>
							</div>

							<div className="space-y-4 px-4 py-4">
								<div className="flex flex-col gap-2">
									<div className="flex w-full items-center justify-between">
										<Label>Compute</Label>
										<span className="text-sm text-text-secondary">
											{cpu} vCPU
										</span>
									</div>
									<Controller
										name="cpu"
										control={control}
										render={({ field }) => (
											<Slider
												value={[field.value]}
												onValueChange={(val) => field.onChange(val[0])}
												min={1}
												max={16}
												step={1}
											/>
										)}
									/>
								</div>

								<div className="border-border border-t" />

								<div className="flex flex-col gap-2">
									<div className="flex w-full items-center justify-between">
										<Label>Memory</Label>
										<span className="text-sm text-text-secondary">
											{memory >= 1024 ? `${memory / 1024} GB` : `${memory} MB`}
										</span>
									</div>
									<Controller
										name="memory"
										control={control}
										render={({ field }) => (
											<Slider
												value={[field.value]}
												onValueChange={(val) => field.onChange(val[0])}
												min={256}
												max={32768}
												step={256}
											/>
										)}
									/>
								</div>

								<div className="border-border border-t" />

								<div className="flex flex-col gap-2">
									<div className="flex w-full items-center justify-between">
										<Label>Storage</Label>
										<span className="text-sm text-text-secondary">
											{disk} GB
										</span>
									</div>
									<Controller
										name="disk"
										control={control}
										render={({ field }) => (
											<Slider
												value={[field.value]}
												onValueChange={(val) => field.onChange(val[0])}
												min={1}
												max={100}
												step={1}
											/>
										)}
									/>
								</div>
							</div>
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
						form="create-image-form"
						disabled={loading || disabled}
					>
						{loading ? 'Creating...' : 'Create Image'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

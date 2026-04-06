/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
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
	ModalTrigger,
} from '@/components/ui';

type FormValues = { confirmName: string };

interface DeleteOrganizationModalProps {
	organizationName: string;
	onDeleteOrganization: () => Promise<boolean>;
	loading: boolean;
}

export function DeleteOrganizationModal({
	organizationName,
	onDeleteOrganization,
	loading,
}: DeleteOrganizationModalProps) {
	const [open, setOpen] = useState(false);

	const schema = useMemo(
		() =>
			z.object({
				confirmName: z
					.string()
					.refine(
						(v) => v === organizationName,
						`Type "${organizationName}" exactly to confirm`
					),
			}),
		[organizationName]
	);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isValid },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { confirmName: '' },
		mode: 'onChange',
	});

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			reset();
		}
	};

	const onSubmit = async () => {
		const success = await onDeleteOrganization();
		if (success) {
			setOpen(false);
			reset();
		}
	};

	return (
		<Modal open={open} onOpenChange={handleOpenChange}>
			<ModalTrigger>
				<Button variant="destructive">Delete Organization</Button>
			</ModalTrigger>
			<ModalContent size="sm">
				<ModalHeader>Delete Organization</ModalHeader>
				<ModalBody>
					<p className="text-[13px] text-text-secondary">
						This will permanently delete all associated data. This action cannot
						be undone.
					</p>
					<form
						id="delete-organization-form"
						className="mt-3 flex flex-col gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="confirm-action">
								Please type{' '}
								<span className="cursor-text select-all font-bold font-mono">
									{organizationName}
								</span>{' '}
								to confirm
							</Label>
							<Input
								id="confirm-action"
								placeholder={organizationName}
								autoComplete="off"
								{...register('confirmName')}
							/>
							{errors.confirmName && (
								<p className="text-[12px] text-text-error">
									{errors.confirmName.message}
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
						type="submit"
						form="delete-organization-form"
						variant="destructive"
						disabled={loading || !isValid}
					>
						{loading ? 'Deleting...' : 'Delete'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

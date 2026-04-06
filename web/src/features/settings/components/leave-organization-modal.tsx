/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useState } from 'react';
import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalTrigger,
} from '@/components/ui';

interface LeaveOrganizationModalProps {
	organizationName: string;
	onLeaveOrganization: () => Promise<boolean>;
	loading: boolean;
}

export function LeaveOrganizationModal({
	organizationName,
	onLeaveOrganization,
	loading,
}: LeaveOrganizationModalProps) {
	const [open, setOpen] = useState(false);

	const handleLeaveOrganization = useCallback(async () => {
		const success = await onLeaveOrganization();
		if (success) {
			setOpen(false);
		}
	}, [onLeaveOrganization]);

	return (
		<Modal open={open} onOpenChange={setOpen}>
			<ModalTrigger>
				<Button variant="destructive">Leave Organization</Button>
			</ModalTrigger>
			<ModalContent size="sm">
				<ModalHeader>Leave Organization</ModalHeader>
				<ModalBody>
					<p className="text-[13px] text-text-secondary">
						Are you sure you want to leave{' '}
						<span className="font-medium text-text-primary">
							{organizationName}
						</span>
						? You will lose access to all resources in this organization.
					</p>
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
						type="button"
						variant="destructive"
						onClick={handleLeaveOrganization}
						disabled={loading}
					>
						{loading ? 'Leaving...' : 'Leave'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

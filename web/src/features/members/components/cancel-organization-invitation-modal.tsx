/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback } from 'react';
import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from '@/components/ui';

interface CancelOrganizationInvitationModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCancelInvitation: () => Promise<boolean>;
	loading: boolean;
}

export function CancelOrganizationInvitationModal({
	open,
	onOpenChange,
	onCancelInvitation,
	loading,
}: CancelOrganizationInvitationModalProps) {
	const handleCancelInvitation = useCallback(async () => {
		const success = await onCancelInvitation();

		if (success) {
			onOpenChange(false);
		}
	}, [onCancelInvitation, onOpenChange]);

	return (
		<Modal open={open} onOpenChange={onOpenChange}>
			<ModalContent size="sm">
				<ModalHeader>Cancel Invitation</ModalHeader>
				<ModalBody>
					<p className="text-[13px] text-text-secondary">
						Are you sure you want to cancel this invitation to join the
						organization? This action cannot be undone.
					</p>
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
						variant="destructive"
						onClick={handleCancelInvitation}
						disabled={loading}
					>
						{loading ? 'Confirming...' : 'Confirm'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

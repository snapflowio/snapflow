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

interface RemoveOrganizationMemberModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRemoveMember: () => Promise<boolean>;
	loading: boolean;
}

export function RemoveOrganizationMemberModal({
	open,
	onOpenChange,
	onRemoveMember,
	loading,
}: RemoveOrganizationMemberModalProps) {
	const handleRemoveMember = useCallback(async () => {
		const success = await onRemoveMember();
		if (success) {
			onOpenChange(false);
		}
	}, [onRemoveMember, onOpenChange]);

	return (
		<Modal open={open} onOpenChange={onOpenChange}>
			<ModalContent size="sm">
				<ModalHeader>Remove Member</ModalHeader>
				<ModalBody>
					<p className="text-[13px] text-text-secondary">
						Are you sure you want to remove this member from the organization?
						This action cannot be undone.
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
						onClick={handleRemoveMember}
						disabled={loading}
					>
						{loading ? 'Removing...' : 'Remove'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

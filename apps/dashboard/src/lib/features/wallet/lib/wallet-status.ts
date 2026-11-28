/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	RecoveryOwnerKind,
	RecoveryStatus,
	WalletTransactionStatus,
} from '@snapflow/api-client';
import type { StatusBadge } from '#lib/components/ui/status-badge.ts';

interface RecoveryKindCopy {
	label: string;
	description: string;
}

export const RECOVERY_STATUS_BADGES = {
	[RecoveryStatus.None]: { label: 'No recovery', variant: 'warning' },
	[RecoveryStatus.Pending]: { label: 'Recovery pending', variant: 'neutral' },
	[RecoveryStatus.Active]: { label: 'Recoverable', variant: 'success' },
} as const satisfies Record<RecoveryStatus, StatusBadge>;

export const WALLET_TRANSACTION_BADGES = {
	[WalletTransactionStatus.Queued]: { label: 'Queued', variant: 'neutral' },
	[WalletTransactionStatus.Sent]: { label: 'Sent', variant: 'neutral' },
	[WalletTransactionStatus.Succeeded]: {
		label: 'Confirmed',
		variant: 'success',
	},
	[WalletTransactionStatus.Failed]: { label: 'Failed', variant: 'error' },
} as const satisfies Record<WalletTransactionStatus, StatusBadge>;

export const RECOVERY_KINDS = {
	[RecoveryOwnerKind.Phrase]: {
		label: 'Recovery phrase',
		description:
			'12 words you write down and keep offline. They are created in this browser and never sent to Snapflow.',
	},
	[RecoveryOwnerKind.Passkey]: {
		label: 'Another passkey',
		description:
			'A passkey on another device, such as your phone or a security key.',
	},
	[RecoveryOwnerKind.Wallet]: {
		label: 'Existing wallet',
		description:
			'A wallet you already control, such as a hardware wallet. Connect it and sign a message to prove it is yours.',
	},
} as const satisfies Record<RecoveryOwnerKind, RecoveryKindCopy>;

export const RECOVERY_KIND_OPTIONS = Object.values(RecoveryOwnerKind).map(
	(value) => ({ value, label: RECOVERY_KINDS[value].label })
);

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowAccount } from '../../entities/escrow-account.entity';
import {
	ACCOUNT_BLOCK_REASONS,
	type AccountBlockReason,
} from '../../enums/account-block-reason.enum';

type AccountBlock = Pick<EscrowAccount, 'blockedAt' | 'blockedUntil'>;

export function accountBlocked(
	account: AccountBlock | null | undefined,
	at: Date
): boolean {
	return (
		account?.blockedUntil !== null &&
		account?.blockedUntil !== undefined &&
		at < account.blockedUntil
	);
}

export function activeBlockedAt(
	account: AccountBlock | null | undefined,
	at: Date
): Date | null {
	return accountBlocked(account, at) ? (account?.blockedAt ?? null) : null;
}

export function blockReasonOf(index: number): AccountBlockReason {
	const reason = ACCOUNT_BLOCK_REASONS[index];
	if (reason === undefined) {
		throw new Error(`AccountBlocked carries an unknown reason ${index}`);
	}
	return reason;
}

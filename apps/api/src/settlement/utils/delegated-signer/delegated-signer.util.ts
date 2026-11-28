/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowSigner } from '../../entities/escrow-signer.entity';
import { EscrowSignerStatus } from '../../enums/escrow-signer-status.enum';

export function escrowSignerStatus(
	grant: Pick<EscrowSigner, 'revokedAt' | 'thawEndsAt' | 'expiresAt'>,
	unfrozenNow: Date,
	chainNow: Date
): EscrowSignerStatus {
	if (grant.revokedAt !== null) return EscrowSignerStatus.REVOKED;
	if (grant.thawEndsAt !== null) {
		return grant.thawEndsAt > unfrozenNow
			? EscrowSignerStatus.THAWING
			: EscrowSignerStatus.REVOCABLE;
	}
	return grant.expiresAt > chainNow
		? EscrowSignerStatus.ACTIVE
		: EscrowSignerStatus.EXPIRED;
}

const SPENT_SIGNER_STATUSES: ReadonlySet<EscrowSignerStatus> = new Set([
	EscrowSignerStatus.REVOCABLE,
	EscrowSignerStatus.REVOKED,
	EscrowSignerStatus.EXPIRED,
]);

export function delegatedSignerSpent(
	grant: Pick<EscrowSigner, 'revokedAt' | 'thawEndsAt' | 'expiresAt'> | null,
	unfrozenNow: Date,
	chainNow: Date
): boolean {
	return (
		grant !== null &&
		SPENT_SIGNER_STATUSES.has(escrowSignerStatus(grant, unfrozenNow, chainNow))
	);
}

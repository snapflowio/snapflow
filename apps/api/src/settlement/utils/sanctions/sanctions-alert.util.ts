/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MAX_BLOCK_DURATION } from '@snapflow/contracts';
import { errorMessage } from '../../../common/utils/error/error.util';
import { SanctionsPendingAlertKind } from '../../constants/sanctions.constants';
import type { SanctionsListSync } from '../../entities/sanctions-list-sync.entity';
import type { SanctionedWallet } from '../../types/sanctions.types';

const describeWallet = (wallet: SanctionedWallet) =>
	`${wallet.purpose} wallet ${wallet.address} of organization ${wallet.organizationId}`;

function sanctionsMatchMessage(wallets: readonly SanctionedWallet[]): string {
	return [
		`Sanctions re-screening matched ${wallets.length} linked wallets. Their payouts and new sandbox billing are now blocked off-chain. Have the compliance Safe call blockAccount(account, Sanctions, ${MAX_BLOCK_DURATION}) on the escrow for each:`,
		...wallets.map(describeWallet),
	].join('\n');
}

function sanctionsDelistedMessage(
	wallets: readonly SanctionedWallet[]
): string {
	return [
		`${wallets.length} blocked wallets are no longer on the OFAC SDN list. They stay blocked until reviewed; once the delisting is confirmed, set their sanctions status to clear and have the compliance Safe call unblockAccount(account) and releaseFrozen(account) on the escrow for each:`,
		...wallets.map(describeWallet),
	].join('\n');
}

export const SANCTIONS_PENDING_ALERT_MESSAGE: Readonly<
	Record<
		SanctionsPendingAlertKind,
		(wallets: readonly SanctionedWallet[]) => string
	>
> = {
	[SanctionsPendingAlertKind.MATCH]: sanctionsMatchMessage,
	[SanctionsPendingAlertKind.DELISTED]: sanctionsDelistedMessage,
};

export function sanctionsListStaleMessage(
	sync: SanctionsListSync | null,
	error: unknown
): string {
	const age = sync
		? `was last synced at ${sync.syncedAt.toISOString()}`
		: 'has never been synced, so wallet linking and relayed transactions are refused';
	return `The OFAC SDN sanctions list ${age}. The latest sync failed: ${errorMessage(error)}`;
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingLedgerPosting } from '../../billing/services/billing-ledger.service';
import {
	type EscrowPostingSource,
	escrowClaimPosting,
	escrowDepositPosting,
	escrowWithdrawalPosting,
} from '../../billing/utils/ledger/billing-escrow-posting.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import type { EscrowEvent } from '../entities/escrow-event.entity';
import type {
	EscrowEventKind,
	EscrowLogOf,
	StoredEscrowArgs,
} from '../types/escrow.types';
import { escrowSourceReference } from './escrow-event-record.util';

export type PostableEscrowEvent = Pick<
	EscrowEvent,
	| 'chainId'
	| 'transactionHash'
	| 'logIndex'
	| 'blockNumber'
	| 'blockTimestamp'
	| 'kind'
	| 'args'
	| 'customerOrganizationId'
	| 'hostOrganizationId'
>;

const LEDGER_EVENT_KINDS: ReadonlySet<EscrowEventKind> = new Set([
	'Deposited',
	'Withdrawn',
	'Claimed',
]);

export function movesLedgerFunds(kind: EscrowEventKind): boolean {
	return LEDGER_EVENT_KINDS.has(kind);
}

// A claim waits for both parties even though it only touches the host's
// accounts: posting it before the customer's deposits would take from
// escrow_custody funds that were never put there. A claim paying no host,
// from a platform service channel whose host is Snapflow's fee recipient,
// waits for the customer alone.
export function escrowEventPostable(event: PostableEscrowEvent): boolean {
	if (event.customerOrganizationId === null) return false;
	return (
		event.kind !== 'Claimed' ||
		event.hostOrganizationId !== null ||
		storedAmount<'Claimed'>(event.args, 'hostPaid').isZero()
	);
}

function storedAmount<Kind extends EscrowEventKind>(
	args: StoredEscrowArgs,
	field: keyof EscrowLogOf<Kind>['args'] & string
): MicroUsd {
	const value = args[field];
	if (value === undefined) {
		throw new Error(`Escrow event is missing its ${field} argument`);
	}
	return MicroUsd.parse(value);
}

function requireOrganization(
	organizationId: string | null,
	event: PostableEscrowEvent
): string {
	if (organizationId === null) {
		throw new Error(
			`Escrow event ${escrowSourceReference(event)} is not attributed`
		);
	}
	return organizationId;
}

// The ledger posting of an attributed event that moves funds, or null when
// it moves none (a withdrawal of an emptied balance pays out zero).
export function escrowEventPosting(
	event: PostableEscrowEvent
): BillingLedgerPosting | null {
	const source: EscrowPostingSource = {
		sourceReference: escrowSourceReference(event),
		effectiveAt: event.blockTimestamp,
		metadata: {
			kind: event.kind,
			chainId: event.chainId,
			transactionHash: event.transactionHash,
			logIndex: event.logIndex,
			blockNumber: event.blockNumber,
		},
	};
	switch (event.kind) {
		case 'Deposited':
			return escrowDepositPosting({
				...source,
				organizationId: requireOrganization(
					event.customerOrganizationId,
					event
				),
				amountMicroUsd: storedAmount<'Deposited'>(event.args, 'amount'),
			});
		case 'Withdrawn': {
			const amountMicroUsd = storedAmount<'Withdrawn'>(event.args, 'amount');
			return amountMicroUsd.isZero()
				? null
				: escrowWithdrawalPosting({
						...source,
						organizationId: requireOrganization(
							event.customerOrganizationId,
							event
						),
						amountMicroUsd,
					});
		}
		case 'Claimed':
			return escrowClaimPosting({
				...source,
				customerOrganizationId: requireOrganization(
					event.customerOrganizationId,
					event
				),
				hostOrganizationId: event.hostOrganizationId,
				hostMicroUsd: storedAmount<'Claimed'>(event.args, 'hostPaid'),
				platformMicroUsd: storedAmount<'Claimed'>(event.args, 'feePaid').add(
					storedAmount<'Claimed'>(event.args, 'servicePaid')
				),
			});
		default:
			return null;
	}
}

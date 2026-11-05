/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BILLING_LEDGER_PLATFORM_OWNER,
	BillingLedgerAccountCode,
	BillingLedgerOwnerKind,
} from '../../constants/billing.constants';
import type { BillingLedgerAccountReference } from '../../services/billing-ledger.service';

type OrganizationAccountCode =
	| typeof BillingLedgerAccountCode.CUSTOMER_CREDIT
	| typeof BillingLedgerAccountCode.HOST_EARNINGS_PAYABLE
	| typeof BillingLedgerAccountCode.HOST_EARNINGS_PENDING
	| typeof BillingLedgerAccountCode.HOST_TRANSFERS_PENDING;

type PlatformAccountCode = Exclude<
	BillingLedgerAccountCode,
	OrganizationAccountCode
>;

function organizationAccount(
	organizationId: string,
	accountCode: OrganizationAccountCode
): BillingLedgerAccountReference {
	return {
		ownerKind: BillingLedgerOwnerKind.ORGANIZATION,
		ownerReference: organizationId,
		accountCode,
	};
}

export function customerCreditAccount(
	organizationId: string
): BillingLedgerAccountReference {
	return organizationAccount(
		organizationId,
		BillingLedgerAccountCode.CUSTOMER_CREDIT
	);
}

export function providerEarningsAccount(
	organizationId: string
): BillingLedgerAccountReference {
	return organizationAccount(
		organizationId,
		BillingLedgerAccountCode.HOST_EARNINGS_PAYABLE
	);
}

export function hostPendingEarningsAccount(
	organizationId: string
): BillingLedgerAccountReference {
	return organizationAccount(
		organizationId,
		BillingLedgerAccountCode.HOST_EARNINGS_PENDING
	);
}

export function hostTransfersPendingAccount(
	organizationId: string
): BillingLedgerAccountReference {
	return organizationAccount(
		organizationId,
		BillingLedgerAccountCode.HOST_TRANSFERS_PENDING
	);
}

export function platformAccount(
	accountCode: PlatformAccountCode
): BillingLedgerAccountReference {
	return {
		ownerKind: BillingLedgerOwnerKind.PLATFORM,
		ownerReference: BILLING_LEDGER_PLATFORM_OWNER,
		accountCode,
	};
}

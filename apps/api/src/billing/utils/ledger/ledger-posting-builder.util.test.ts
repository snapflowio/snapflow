/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BILLING_LEDGER_SOURCE_VERSION,
	BillingLedgerAccountCode,
	BillingLedgerSide,
} from '../../constants/billing.constants';
import {
	customerCreditAccount,
	platformAccount,
} from './billing-ledger-accounts.util';
import { LedgerPostingBuilder } from './ledger-posting-builder.util';

const AT = new Date('2026-10-14T12:00:00.000Z');
const SOURCE = {
	sourceType: 'source',
	descriptionCode: 'description',
	sourceReference: 'reference',
	effectiveAt: AT,
	metadata: { reason: 'test' },
};

describe('LedgerPostingBuilder', () => {
	it('records entries in order and skips non-positive optional amounts', () => {
		const customer = customerCreditAccount('organization');
		const grants = platformAccount(
			BillingLedgerAccountCode.ADMIN_CREDIT_GRANTS
		);
		const posting = LedgerPostingBuilder.for(SOURCE)
			.debit(grants, MicroUsd.of(10n))
			.creditIfPositive(customer, MicroUsd.ZERO)
			.debitIfPositive(grants, MicroUsd.ZERO)
			.credit(customer, MicroUsd.of(10n))
			.build();

		assert.deepEqual(posting, {
			sourceType: 'source',
			sourceReference: 'reference',
			sourceVersion: BILLING_LEDGER_SOURCE_VERSION,
			descriptionCode: 'description',
			effectiveAt: AT,
			metadata: { reason: 'test' },
			entries: [
				{ account: grants, side: BillingLedgerSide.DEBIT, amount: '10' },
				{ account: customer, side: BillingLedgerSide.CREDIT, amount: '10' },
			],
		});
	});

	it('keeps an explicit source version', () => {
		const posting = LedgerPostingBuilder.for({
			...SOURCE,
			sourceVersion: 3,
		}).build();
		assert.equal(posting.sourceVersion, 3);
	});
});

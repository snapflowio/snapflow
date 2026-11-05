/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { NotFoundException } from '@nestjs/common';
import { fakeInstance } from '../../common/testing/instance.fake';
import { Organization } from '../../organization/entities/organization.entity';
import {
	BillingLedgerAccountCode,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../constants/billing.constants';
import { RecordingLedger } from '../testing/recording-ledger.fake';
import { BillingCreditGrantService } from './billing-credit-grant.service';

const ORGANIZATION_ID = 'organization-id';
const NOW = new Date('2026-10-04T12:00:00.000Z');
const GRANT = {
	organizationId: ORGANIZATION_ID,
	amountMicroUsd: 5_000_000,
	reason: '  Launch credit  ',
	actorUserId: 'admin-id',
};

function harness(organization: Organization | null) {
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'findOne', async () => organization);
	mock.method(manager, 'flush', async () => undefined);
	mock.method(manager, 'execute', async (sql: string) =>
		sql.includes('balance') ? [{ balance: '5000000' }] : [{ now: NOW }]
	);
	const ledger = new RecordingLedger();
	return { manager, ledger, service: new BillingCreditGrantService(ledger) };
}

describe('BillingCreditGrantService', () => {
	it('debits admin grants and credits the customer with the reason and actor', async () => {
		const { manager, ledger, service } = harness(
			Object.assign(new Organization(), { id: ORGANIZATION_ID })
		);

		const grant = await service.grant(manager, GRANT);

		const [posting] = ledger.postings;
		assert.equal(
			posting?.sourceType,
			BillingLedgerSourceType.ADMIN_CREDIT_GRANT
		);
		assert.equal(posting?.sourceReference, grant.grantId);
		assert.deepEqual(posting?.metadata, {
			reason: 'Launch credit',
			actorUserId: 'admin-id',
		});
		assert.deepEqual(
			posting?.entries.map(({ account, side, amount }) => [
				account.accountCode,
				account.ownerReference === ORGANIZATION_ID,
				side,
				amount,
			]),
			[
				[
					BillingLedgerAccountCode.ADMIN_CREDIT_GRANTS,
					false,
					BillingLedgerSide.DEBIT,
					'5000000',
				],
				[
					BillingLedgerAccountCode.CUSTOMER_CREDIT,
					true,
					BillingLedgerSide.CREDIT,
					'5000000',
				],
			]
		);
		assert.equal(grant.creditBalanceMicroUsd, '5000000');
		assert.equal(grant.reason, 'Launch credit');
	});

	it('refuses an unknown organization', async () => {
		const { manager, ledger, service } = harness(null);

		await assert.rejects(service.grant(manager, GRANT), NotFoundException);
		assert.deepEqual(ledger.postings, []);
	});
});

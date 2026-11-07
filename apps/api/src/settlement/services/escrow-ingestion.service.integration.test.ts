/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { MikroORM } from '@mikro-orm/postgresql';
import type { Address } from 'viem';
import { BillingLedgerAccountCode } from '../../billing/constants/billing.constants';
import { BillingLedgerAccount } from '../../billing/entities/billing-ledger-account.entity';
import { BillingLedgerEntry } from '../../billing/entities/billing-ledger-entry.entity';
import { BillingLedgerTransaction } from '../../billing/entities/billing-ledger-transaction.entity';
import { ledgerBalance } from '../../billing/queries/ledger-balance.query';
import { BillingLedgerService } from '../../billing/services/billing-ledger.service';
import {
	customerCreditAccount,
	hostPendingEarningsAccount,
	platformAccount,
} from '../../billing/utils/ledger/billing-ledger-accounts.util';
import { fakeInstance } from '../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { Organization } from '../../organization/entities/organization.entity';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { EscrowSessionKey } from '../entities/escrow-session-key.entity';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { SettlementChainCursor } from '../entities/settlement-chain-cursor.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { SanctionsStatus } from '../enums/sanctions-status.enum';
import {
	CHANNEL_ID,
	CUSTOMER_ADDRESS,
	ESCROW_ADDRESS,
	escrowLog,
	HOST_ADDRESS,
	KEY_ADDRESS,
} from '../testing/escrow-log.fixtures';
import type { EscrowIdentity, EscrowLog } from '../types/escrow.types';
import type { BlockRange } from '../utils/block-range.util';
import { EscrowAttributionService } from './escrow-attribution.service';
import { EscrowIngestionService } from './escrow-ingestion.service';
import { EscrowLedgerService } from './escrow-ledger.service';
import { EscrowProjectionService } from './escrow-projection.service';

const DATABASE_URL = integrationDatabaseUrl();
const ESCROW: EscrowIdentity = {
	chainId: 31_337,
	contractAddress: ESCROW_ADDRESS,
};
const DEPLOYMENT_BLOCK = 10;
const FIRST_RANGE: BlockRange = { fromBlock: 10n, toBlock: 19n };
const SECOND_RANGE: BlockRange = { fromBlock: 20n, toBlock: 29n };
const BLOCK_TIME = new Date('2026-11-05T12:00:00.000Z');
const DEPOSIT = 1_000n;
const HOST_PAID = 70n;
const FEE_PAID = 20n;
const SERVICE_PAID = 10n;
const CONFIG: Readonly<Record<string, unknown>> = {
	'settlement.chainId': ESCROW.chainId,
	'settlement.escrowAddress': ESCROW.contractAddress,
	'settlement.escrowDeploymentBlock': DEPLOYMENT_BLOCK,
};

describe('escrow ingestion and attribution', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	const schema = `escrow_ingestion_${randomUUID().replaceAll('-', '')}`;
	const customerOrganizationId = randomUUID();
	const hostOrganizationId = randomUUID();
	let orm: MikroORM;
	let ingestion: EscrowIngestionService;
	let attribution: EscrowAttributionService;

	const firstRangeLogs: EscrowLog[] = [
		escrowLog(
			'Deposited',
			{ customer: CUSTOMER_ADDRESS, payer: CUSTOMER_ADDRESS, amount: DEPOSIT },
			{ blockNumber: 11n, logIndex: 0 }
		),
		escrowLog(
			'SessionKeySet',
			{
				customer: CUSTOMER_ADDRESS,
				key: KEY_ADDRESS,
				spendCap: DEPOSIT,
				hourlyCap: DEPOSIT,
				expiry: 2_000_000_000n,
			},
			{ blockNumber: 11n, logIndex: 1 }
		),
		escrowLog(
			'Claimed',
			{
				channelId: CHANNEL_ID,
				customer: CUSTOMER_ADDRESS,
				host: HOST_ADDRESS,
				hostPaid: HOST_PAID,
				feePaid: FEE_PAID,
				servicePaid: SERVICE_PAID,
				sequence: 1n,
			},
			{ blockNumber: 12n, logIndex: 0 }
		),
	];

	function timestamps(logs: readonly EscrowLog[]): Map<bigint, Date> {
		return new Map(logs.map((log) => [log.blockNumber, BLOCK_TIME]));
	}

	async function ingest(
		range: BlockRange,
		logs: readonly EscrowLog[]
	): Promise<void> {
		await orm.em
			.fork()
			.transactional((manager) =>
				ingestion.ingest(manager, ESCROW, range, logs, timestamps(logs))
			);
	}

	async function link(
		organizationId: string,
		purpose: PaymentWalletPurpose,
		address: Address
	): Promise<void> {
		await orm.em.fork().transactional(async (manager) => {
			manager.create(PaymentWallet, {
				organizationId,
				purpose,
				address,
				verifiedAt: BLOCK_TIME,
				sanctionsStatus: SanctionsStatus.UNCHECKED,
				sanctionsCheckedAt: null,
			});
			await attribution.attributeWallet(
				manager,
				organizationId,
				purpose,
				address
			);
		});
	}

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				Organization,
				PaymentWallet,
				EscrowAccount,
				EscrowEvent,
				EscrowSessionKey,
				SettlementChainCursor,
				BillingLedgerAccount,
				BillingLedgerEntry,
				BillingLedgerTransaction,
			],
			driverOptions: { options: `-c search_path=${schema}` },
		});
		await orm.em.getConnection().execute(`CREATE SCHEMA ${schema}`);
		await orm.schema.create();
		const manager = orm.em.fork();
		for (const id of [customerOrganizationId, hostOrganizationId]) {
			manager.create(
				Organization,
				{ id, name: id, slug: id },
				{ partial: true }
			);
		}
		await manager.flush();
		const config = fakeInstance(TypedConfigService, {
			get: (key: string) => CONFIG[key],
		});
		const ledger = new EscrowLedgerService(new BillingLedgerService());
		ingestion = new EscrowIngestionService(
			config,
			new EscrowProjectionService(),
			ledger
		);
		attribution = new EscrowAttributionService(config, ledger);
	});

	after(async () => {
		if (!orm) return;
		await orm.em.getConnection().execute(`DROP SCHEMA ${schema} CASCADE`);
		await orm.close(true);
	});

	it('stores a range, projects it and posts what is attributed', async () => {
		await link(
			customerOrganizationId,
			PaymentWalletPurpose.FUNDING,
			CUSTOMER_ADDRESS
		);
		await ingest(FIRST_RANGE, firstRangeLogs);

		const manager = orm.em.fork();
		const events = await manager.find(
			EscrowEvent,
			{},
			{ orderBy: { blockNumber: 'ASC', logIndex: 'ASC' } }
		);
		assert.deepEqual(
			events.map(({ kind, customerOrganizationId, processedAt }) => [
				kind,
				customerOrganizationId,
				processedAt !== null,
			]),
			[
				['Deposited', customerOrganizationId, true],
				['SessionKeySet', customerOrganizationId, true],
				['Claimed', customerOrganizationId, false],
			]
		);
		const account = await manager.findOneOrFail(EscrowAccount, {
			...ESCROW,
			address: CUSTOMER_ADDRESS,
		});
		assert.equal(
			account.balanceMicroUsd,
			(DEPOSIT - HOST_PAID - FEE_PAID - SERVICE_PAID).toString()
		);
		const key = await manager.findOneOrFail(EscrowSessionKey, {
			...ESCROW,
			customerAddress: CUSTOMER_ADDRESS,
			keyAddress: KEY_ADDRESS,
		});
		assert.equal(key.revokedAt, null);
		const cursor = await manager.findOneOrFail(SettlementChainCursor, ESCROW);
		assert.equal(cursor.lastIndexedBlock, Number(FIRST_RANGE.toBlock));
		assert.deepEqual(
			await ledgerBalance(
				manager,
				customerCreditAccount(customerOrganizationId)
			),
			MicroUsd.of(DEPOSIT)
		);
	});

	it('refuses to index a range twice', async () => {
		await assert.rejects(
			ingest(FIRST_RANGE, firstRangeLogs),
			/Escrow cursor expects block 20/
		);
	});

	it('posts a claim once its host links the payout wallet', async () => {
		await link(hostOrganizationId, PaymentWalletPurpose.PAYOUT, HOST_ADDRESS);

		const manager = orm.em.fork();
		const claim = await manager.findOneOrFail(EscrowEvent, { kind: 'Claimed' });
		assert.equal(claim.hostOrganizationId, hostOrganizationId);
		assert.notEqual(claim.processedAt, null);
		assert.deepEqual(
			await ledgerBalance(
				manager,
				hostPendingEarningsAccount(hostOrganizationId)
			),
			MicroUsd.of(-HOST_PAID)
		);
		assert.deepEqual(
			await ledgerBalance(
				manager,
				platformAccount(BillingLedgerAccountCode.PLATFORM_WALLET)
			),
			MicroUsd.of(FEE_PAID + SERVICE_PAID)
		);
		assert.deepEqual(
			await ledgerBalance(
				manager,
				platformAccount(BillingLedgerAccountCode.ESCROW_CUSTODY)
			),
			MicroUsd.of(DEPOSIT - HOST_PAID - FEE_PAID - SERVICE_PAID)
		);
	});

	it('keeps posted events with their organization when a wallet moves on', async () => {
		const manager = orm.em.fork();
		await manager.nativeDelete(PaymentWallet, {
			organizationId: customerOrganizationId,
		});
		await ingest(SECOND_RANGE, [
			escrowLog(
				'Withdrawn',
				{ customer: CUSTOMER_ADDRESS, amount: DEPOSIT },
				{ blockNumber: 21n, logIndex: 0 }
			),
		]);
		const withdrawal = await orm.em
			.fork()
			.findOneOrFail(EscrowEvent, { kind: 'Withdrawn' });
		assert.equal(withdrawal.customerOrganizationId, null);
		assert.equal(withdrawal.processedAt, null);

		await link(
			customerOrganizationId,
			PaymentWalletPurpose.FUNDING,
			CUSTOMER_ADDRESS
		);
		const reader = orm.em.fork();
		assert.equal(await reader.count(EscrowEvent, { processedAt: null }), 0);
		assert.deepEqual(
			await ledgerBalance(
				reader,
				customerCreditAccount(customerOrganizationId)
			),
			MicroUsd.ZERO
		);
	});
});

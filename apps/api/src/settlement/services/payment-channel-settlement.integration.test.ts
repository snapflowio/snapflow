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
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import {
	ConflictException,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import {
	recoverVoucherSigner,
	snapflowEscrowAbi,
	voucherTypedData,
} from '@snapflow/contracts';
import {
	type Address,
	createPublicClient,
	createWalletClient,
	erc20Abi,
	type Hash,
	type Hex,
	http,
	type PublicClient,
	parseEther,
	type WalletClient,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import {
	BILLING_LINE_SCHEMA_VERSION,
	BillingBeneficiaryKind,
	BillingChargeClass,
	BillingEvidenceStatus,
	BillingLedgerAccountCode,
} from '../../billing/constants/billing.constants';
import { BillingLedgerAccount } from '../../billing/entities/billing-ledger-account.entity';
import { BillingLedgerEntry } from '../../billing/entities/billing-ledger-entry.entity';
import { BillingLedgerTransaction } from '../../billing/entities/billing-ledger-transaction.entity';
import { BillingLineItem } from '../../billing/entities/billing-line-item.entity';
import { PrivatePoolCharge } from '../../billing/entities/private-pool-charge.entity';
import { ledgerBalance } from '../../billing/queries/ledger-balance.query';
import { BillingLedgerService } from '../../billing/services/billing-ledger.service';
import { PrivatePoolBillingService } from '../../billing/services/private-pool-billing.service';
import { utcBillingMonth } from '../../billing/utils/billing-period.util';
import {
	customerCreditAccount,
	hostPendingEarningsAccount,
	platformAccount,
} from '../../billing/utils/ledger/billing-ledger-accounts.util';
import { privatePoolDayFee } from '../../billing/utils/private-pool-fee.util';
import {
	HOURS_PER_DAY,
	MILLISECONDS_PER_DAY,
	MILLISECONDS_PER_HOUR,
	SECONDS_PER_HOUR,
} from '../../common/constants/time.constants';
import { fakeInstance } from '../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { MachinePriceCard } from '../../marketplace/entities/machine-price-card.entity';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { ListingState } from '../../marketplace/enums/listing-state.enum';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { Organization } from '../../organization/entities/organization.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { SandboxMode } from '../../sandbox/enums/sandbox-mode.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import type { SettingsService } from '../../settings/services/settings.service';
import { fakeSettings } from '../../settings/testing/settings.fake';
import { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import { PaymentChannelErrorCode } from '../constants/payment-channel.constants';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { EscrowSessionKey } from '../entities/escrow-session-key.entity';
import { PaymentChannel } from '../entities/payment-channel.entity';
import { PaymentVoucher } from '../entities/payment-voucher.entity';
import { PaymentWallet } from '../entities/payment-wallet.entity';
import { SettlementChainCursor } from '../entities/settlement-chain-cursor.entity';
import { PaymentChannelKind } from '../enums/payment-channel-kind.enum';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { SanctionsStatus } from '../enums/sanctions-status.enum';
import { VoucherRejection } from '../enums/voucher-rejection.enum';
import { VoucherSigningMode } from '../enums/voucher-signing-mode.enum';
import { unbilledServicePeriods } from '../queries/unbilled-service-periods.query';
import { ClaimRelayerService } from '../scheduler/services/claim-relayer.service';
import { EscrowIndexerService } from '../scheduler/services/escrow-indexer.service';
import {
	type IntegrationChain,
	integrationChain,
} from '../testing/integration-chain.util';
import { channelDomain, voucherMessage } from '../utils/voucher-message.util';
import { EscrowFeePolicyService } from './escrow-fee-policy.service';
import { EscrowIngestionService } from './escrow-ingestion.service';
import { EscrowLedgerService } from './escrow-ledger.service';
import { EscrowProjectionService } from './escrow-projection.service';
import { MachineVoucherRelayService } from './machine-voucher-relay.service';
import { PaymentChannelService } from './payment-channel.service';
import { VoucherIssuanceService } from './voucher-issuance.service';
import { VoucherSigningService } from './voucher-signing.service';
import { VoucherSubmissionService } from './voucher-submission.service';

const CHAIN = integrationChain();
const DATABASE_URL = integrationDatabaseUrl();
// Anvil accounts the other chain tests leave alone; DeployLocal must fund
// the customer with test USDC.
const CUSTOMER_ACCOUNT_INDEX = 5;
const HOST_ACCOUNT_INDEX = 6;
const GAS_FUNDER_ACCOUNT_INDEX = 0;
const RELAYER_GAS = parseEther('1');
const DEPOSIT_MICRO_USD = 10_000_000n;
const SPEND_CAP_MICRO_USD = 50_000_000n;
const HOURLY_CAP_MICRO_USD = 10_000_000n;
const SESSION_KEY_LIFETIME_SECONDS = BigInt(
	2 * HOURS_PER_DAY * SECONDS_PER_HOUR
);
const MARKUP_BASIS_POINTS = 2_500;
const LEASE_AGE_MILLISECONDS = 2 * MILLISECONDS_PER_HOUR;
const RATE_MICRO_USD = '100000';
const SANDBOX_SHAPE = { cpu: 1, memoryGib: 1, diskGib: 1, gpu: 0 };
// Fees and service the first claims of the two lease channels pay Snapflow.
const LEASE_PLATFORM_PAID = 333_333n + 10_001n + 125_000n;

interface SeededLease {
	sandbox: Sandbox;
	lease: SandboxLease;
}

interface LineAmounts {
	host: bigint;
	markup: bigint;
	gross: bigint;
	beneficiary: BillingBeneficiaryKind;
}

describe('escrow payment channels end to end', {
	skip:
		CHAIN && DATABASE_URL
			? false
			: 'SETTLEMENT_INTEGRATION_RPC_URL and DATABASE_URL are required',
}, () => {
	const schema = `payment_channels_${randomUUID().replaceAll('-', '')}`;
	const customerOrganizationId = randomUUID();
	const hostOrganizationId = randomUUID();
	const signer = privateKeyToAccount(generatePrivateKey());
	const relayerAccount = privateKeyToAccount(generatePrivateKey());
	let orm: MikroORM;
	let publicClient: PublicClient;
	let walletClient: WalletClient;
	let customer: Address;
	let host: Address;
	let machine: Machine;
	let priceCard: MachinePriceCard;
	let delegated: SeededLease;
	let client: SeededLease;
	let indexer: EscrowIndexerService;
	let channels: PaymentChannelService;
	let issuance: VoucherIssuanceService;
	let submissions: VoucherSubmissionService;
	let relayer: ClaimRelayerService;
	let relay: MachineVoucherRelayService;
	let hostOpeningUsdc: bigint;
	let config: TypedConfigService;
	let chain: IntegrationChain;
	const settings: SettingsService = fakeSettings({
		settlementConfirmations: 0,
	});

	async function send(hash: Promise<Hash>): Promise<void> {
		const receipt = await publicClient.waitForTransactionReceipt({
			hash: await hash,
		});
		assert.equal(receipt.status, 'success');
	}

	async function indexChain(): Promise<void> {
		const head = await publicClient.getBlockNumber({ cacheTime: 0 });
		await indexer.indexConfirmedEvents();
		const cursor = await orm.em.fork().findOneOrFail(SettlementChainCursor, {
			chainId: foundry.id,
			contractAddress: chain.escrowAddress,
		});
		assert.equal(BigInt(cursor.lastIndexedBlock) >= head, true);
	}

	async function seedLease(
		manager: EntityManager,
		signingMode: VoucherSigningMode
	): Promise<SeededLease> {
		const startedAt = new Date(Date.now() - LEASE_AGE_MILLISECONDS);
		const sandbox = Object.assign(new Sandbox({}), {
			organizationId: customerOrganizationId,
			mode: SandboxMode.STANDARD,
			osUser: 'snapflow',
			state: SandboxState.STARTED,
			machineId: machine.id,
			voucherSigning: signingMode,
		});
		manager.persist(sandbox);
		await manager.flush();
		const placement = manager.create(SandboxPlacement, {
			id: randomUUID(),
			sandboxId: sandbox.id,
			machineId: machine.id,
			assignmentGeneration: 1,
			fencingToken: randomUUID(),
			placementKind: PlacementKind.FLEXIBLE,
			placedAt: startedAt,
			releasedAt: null,
			releaseReason: null,
		});
		const lease = Object.assign(new SandboxLease(), {
			id: randomUUID(),
			sandboxId: sandbox.id,
			placementId: placement.id,
			customerOrganizationId,
			hostOrganizationId,
			machineId: machine.id,
			priceCardId: priceCard.id,
			markupBasisPoints: MARKUP_BASIS_POINTS,
			placementKind: PlacementKind.FLEXIBLE,
			memoryGib: SANDBOX_SHAPE.memoryGib,
			diskGib: SANDBOX_SHAPE.diskGib,
			cpu: SANDBOX_SHAPE.cpu,
			gpu: SANDBOX_SHAPE.gpu,
			startedAt,
			priceLockedUntil: new Date(startedAt.getTime() + MILLISECONDS_PER_DAY),
		});
		manager.persist(lease);
		await manager.flush();
		await channels.open(manager, lease);
		return { sandbox, lease };
	}

	async function charge(seeded: SeededLease, line: LineAmounts): Promise<void> {
		const manager = orm.em.fork();
		const now = new Date();
		const network = line.beneficiary === BillingBeneficiaryKind.PLATFORM;
		manager.create(BillingLineItem, {
			id: randomUUID(),
			schemaVersion: BILLING_LINE_SCHEMA_VERSION,
			sourceType: 'integration_test',
			sourceId: randomUUID(),
			sourceVersion: 1,
			chargeClass: network
				? BillingChargeClass.NETWORK
				: BillingChargeClass.COMPUTE,
			customerOrganizationId,
			beneficiaryKind: line.beneficiary,
			beneficiaryReference: network ? 'snapflow' : hostOrganizationId,
			hostOrganizationId,
			sandboxId: seeded.sandbox.id,
			placementId: seeded.lease.placementId,
			machineId: machine.id,
			assignmentGeneration: 1,
			resourceSku: 'integration',
			periodStart: seeded.lease.startedAt,
			periodEnd: now,
			serviceThrough: now,
			consumedQuantities: {
				durationMillis: '0',
				cpu: '1',
				memoryGiB: '1',
				diskGiB: '1',
				gpu: '0',
			},
			leaseId: seeded.lease.id,
			quantities: network
				? null
				: {
						vcpuMillis: '0',
						memoryGibMillis: '0',
						gpuMillis: '0',
						runningDiskGibMillis: '0',
						stoppedDiskGibMillis: '0',
					},
			grossMicroUsd: line.gross.toString(),
			hostMicroUsd: line.host.toString(),
			markupMicroUsd: line.markup.toString(),
			evidenceStatus: BillingEvidenceStatus.PENDING,
			contentDigest: randomUUID(),
			reconciliationReason: null,
			reconciledAt: null,
			earningsReleasedAt: null,
			createdAt: now,
		});
		await manager.flush();
	}

	async function issue(seeded: SeededLease): Promise<void> {
		const manager = orm.em.fork();
		const channel = await manager.findOneOrFail(PaymentChannel, {
			leaseId: seeded.lease.id,
		});
		const voucherSettings = await settings.get();
		await manager.transactional((transaction) =>
			issuance.evaluate(transaction, channel.id, voucherSettings)
		);
	}

	async function channelOf(seeded: SeededLease): Promise<PaymentChannel> {
		return orm.em
			.fork()
			.findOneOrFail(PaymentChannel, { leaseId: seeded.lease.id });
	}

	async function vouchersOf(seeded: SeededLease): Promise<PaymentVoucher[]> {
		const channel = await channelOf(seeded);
		return orm.em
			.fork()
			.find(
				PaymentVoucher,
				{ paymentChannelId: channel.id },
				{ orderBy: { sequence: 'ASC' } }
			);
	}

	function customerSignature(
		channel: PaymentChannel,
		voucher: PaymentVoucher
	): Promise<Hex> {
		return walletClient.signTypedData({
			account: customer,
			...voucherTypedData(
				channelDomain(channel),
				voucherMessage(channel, voucher)
			),
		});
	}

	before(async () => {
		if (!CHAIN || !DATABASE_URL) return;
		chain = CHAIN;
		const transport = http(chain.rpcUrl);
		publicClient = createPublicClient({ chain: foundry, transport });
		walletClient = createWalletClient({ chain: foundry, transport });
		const accounts = await walletClient.getAddresses();
		const customerAccount = accounts[CUSTOMER_ACCOUNT_INDEX];
		const hostAccount = accounts[HOST_ACCOUNT_INDEX];
		const funder = accounts[GAS_FUNDER_ACCOUNT_INDEX];
		if (!customerAccount || !hostAccount || !funder) {
			throw new Error('The chain has too few unlocked accounts');
		}
		customer = customerAccount;
		host = hostAccount;
		const firstBlock =
			(await publicClient.getBlockNumber({ cacheTime: 0 })) + 1n;
		const values: Readonly<Record<string, unknown>> = {
			'settlement.chainId': foundry.id,
			'settlement.escrowAddress': chain.escrowAddress,
			'settlement.escrowDeploymentBlock': Number(firstBlock),
		};
		config = fakeInstance(TypedConfigService, {
			get: (key: string) => values[key],
		});

		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				Organization,
				Machine,
				MachinePriceCard,
				Sandbox,
				SandboxPlacement,
				SandboxLease,
				SandboxUsagePeriod,
				BillingLineItem,
				BillingLedgerAccount,
				BillingLedgerEntry,
				BillingLedgerTransaction,
				MachineListing,
				PrivatePoolCharge,
				PaymentWallet,
				EscrowAccount,
				EscrowEvent,
				EscrowSessionKey,
				SettlementChainCursor,
				PaymentChannel,
				PaymentVoucher,
			],
			driverOptions: { options: `-c search_path=${schema}` },
		});
		await orm.em.getConnection().execute(`CREATE SCHEMA ${schema}`);
		await orm.schema.create();

		const locks = fakeInstance(RedisLockProvider, {
			runExclusive: <Result>(
				_key: string,
				_ttlSeconds: number,
				task: () => Promise<Result>
			) => task(),
		});
		const signing = new VoucherSigningService(
			signer,
			fakeInstance(ControlWakeService, { notifyAfterCommit: () => undefined })
		);
		indexer = new EscrowIndexerService(
			orm.em,
			publicClient,
			config,
			settings,
			locks,
			new EscrowIngestionService(
				config,
				new EscrowProjectionService(),
				new EscrowLedgerService(new BillingLedgerService())
			)
		);
		channels = new PaymentChannelService(
			config,
			fakeInstance(ControlWakeService, { notifyAfterCommit: () => undefined }),
			new EscrowFeePolicyService(publicClient, config)
		);
		issuance = new VoucherIssuanceService(signing);
		submissions = new VoucherSubmissionService(orm.em, config, signing);
		relayer = new ClaimRelayerService(
			orm.em,
			publicClient,
			createWalletClient({
				account: relayerAccount,
				chain: foundry,
				transport,
			}),
			config,
			settings,
			locks
		);
		relay = new MachineVoucherRelayService(orm.em, config, settings);

		const manager = orm.em.fork();
		for (const id of [customerOrganizationId, hostOrganizationId]) {
			manager.create(
				Organization,
				{ id, name: id, slug: id },
				{ partial: true }
			);
		}
		await manager.flush();
		for (const [organizationId, purpose, address] of [
			[customerOrganizationId, PaymentWalletPurpose.FUNDING, customer],
			[hostOrganizationId, PaymentWalletPurpose.PAYOUT, host],
		] as const) {
			manager.create(PaymentWallet, {
				organizationId,
				purpose,
				address,
				verifiedAt: new Date(),
				sanctionsStatus: SanctionsStatus.UNCHECKED,
				sanctionsCheckedAt: null,
			});
		}
		machine = new Machine({
			name: `payment-channels-${randomUUID()}`,
			apiVersion: '1',
			organizationId: hostOrganizationId,
		});
		manager.persist(machine);
		await manager.flush();
		priceCard = manager.create(MachinePriceCard, {
			id: randomUUID(),
			machineId: machine.id,
			organizationId: hostOrganizationId,
			version: 1,
			vcpuHourMicroUsd: RATE_MICRO_USD,
			memoryGibHourMicroUsd: RATE_MICRO_USD,
			gpuHourMicroUsd: RATE_MICRO_USD,
			diskGibMonthMicroUsd: RATE_MICRO_USD,
			stoppedDiskGibMonthMicroUsd: RATE_MICRO_USD,
			egressMicroUsdPerGiB: RATE_MICRO_USD,
			referencePriceMicroUsd: RATE_MICRO_USD,
			floorMicroUsd: RATE_MICRO_USD,
			egressCeilingMicroUsdPerGiB: RATE_MICRO_USD,
			createdAt: new Date(),
		});
		await manager.flush();
		delegated = await seedLease(manager, VoucherSigningMode.DELEGATED);
		client = await seedLease(manager, VoucherSigningMode.CLIENT);

		hostOpeningUsdc = await publicClient.readContract({
			address: chain.usdcAddress,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [host],
		});
		const latest = await publicClient.getBlock();
		const asCustomer = { account: customer, chain: foundry } as const;
		const escrow = { address: chain.escrowAddress, abi: snapflowEscrowAbi };
		await send(
			walletClient.sendTransaction({
				account: funder,
				chain: foundry,
				to: relayerAccount.address,
				value: RELAYER_GAS,
			})
		);
		await send(
			walletClient.writeContract({
				...asCustomer,
				address: chain.usdcAddress,
				abi: erc20Abi,
				functionName: 'approve',
				args: [chain.escrowAddress, DEPOSIT_MICRO_USD],
			})
		);
		await send(
			walletClient.writeContract({
				...asCustomer,
				...escrow,
				functionName: 'deposit',
				args: [DEPOSIT_MICRO_USD],
			})
		);
		await send(
			walletClient.writeContract({
				...asCustomer,
				...escrow,
				functionName: 'setSessionKey',
				args: [
					signer.address,
					SPEND_CAP_MICRO_USD,
					HOURLY_CAP_MICRO_USD,
					latest.timestamp + SESSION_KEY_LIFETIME_SECONDS,
				],
			})
		);
		await indexChain();
	});

	after(async () => {
		if (!orm) return;
		await orm.em.getConnection().execute(`DROP SCHEMA ${schema} CASCADE`);
		await orm.close(true);
	});

	it('opens a channel per lease between the linked wallets', async () => {
		const channel = await channelOf(delegated);
		assert.equal(channel.customerAddress, customer);
		assert.equal(channel.hostAddress, host);
		assert.equal(channel.signingMode, VoucherSigningMode.DELEGATED);
		assert.equal(
			(await channelOf(client)).signingMode,
			VoucherSigningMode.CLIENT
		);
	});

	it('refuses a lease whose markup is above the on-chain fee cap', async () => {
		const feeCapBasisPoints = await publicClient.readContract({
			address: chain.escrowAddress,
			abi: snapflowEscrowAbi,
			functionName: 'feeCapBps',
		});
		await assert.rejects(
			channels.open(
				orm.em.fork(),
				Object.assign(new SandboxLease(), {
					...delegated.lease,
					id: randomUUID(),
					markupBasisPoints: feeCapBasisPoints + 1,
				})
			),
			(error: unknown) =>
				error instanceof ConflictException &&
				JSON.stringify(error.getResponse()).includes(
					PaymentChannelErrorCode.MARKUP_ABOVE_FEE_CAP
				)
		);
	});

	it('signs cumulative vouchers in delegated mode', async () => {
		await charge(delegated, {
			host: 1_000_000n,
			markup: 250_000n,
			gross: 1_250_000n,
			beneficiary: BillingBeneficiaryKind.HOST_ORGANIZATION,
		});
		await charge(delegated, {
			host: 0n,
			markup: 0n,
			gross: 10_000n,
			beneficiary: BillingBeneficiaryKind.PLATFORM,
		});
		await issue(delegated);
		await issue(delegated);
		await charge(delegated, {
			host: 333_333n,
			markup: 83_334n,
			gross: 416_667n,
			beneficiary: BillingBeneficiaryKind.HOST_ORGANIZATION,
		});
		await issue(delegated);

		const vouchers = await vouchersOf(delegated);
		assert.deepEqual(
			vouchers.map((voucher) => [
				voucher.sequence,
				voucher.hostAmountMicroUsd,
				voucher.feeAmountMicroUsd,
				voucher.serviceAmountMicroUsd,
			]),
			[
				[1, '1000000', '250000', '10000'],
				[2, '1333333', '333333', '10001'],
			]
		);
		const channel = await channelOf(delegated);
		for (const voucher of vouchers) {
			assert.ok(voucher.signature);
			assert.equal(
				await recoverVoucherSigner(
					channelDomain(channel),
					voucherMessage(channel, voucher),
					voucher.signature
				),
				signer.address
			);
		}
		assert.equal(channel.voucherError, null);
		assert.ok(channel.coveredAt > channel.openedAt);
	});

	it('takes client-mode signatures only from authorized signers', async () => {
		await charge(client, {
			host: 500_000n,
			markup: 125_000n,
			gross: 625_000n,
			beneficiary: BillingBeneficiaryKind.HOST_ORGANIZATION,
		});
		await issue(client);
		const [pending] = await vouchersOf(client);
		assert.ok(pending);
		assert.equal(pending.signature, null);
		const channel = await channelOf(client);
		const signature = await customerSignature(channel, pending);
		const submission = {
			channelId: channel.channelId,
			sequence: pending.sequence,
			signature,
		};

		await assert.rejects(
			submissions.submit(customerOrganizationId, {
				...submission,
				signer: host,
			}),
			(error: unknown) =>
				error instanceof UnprocessableEntityException &&
				JSON.stringify(error.getResponse()).includes(
					VoucherRejection.SIGNATURE_INVALID
				)
		);
		const accepted = await submissions.submit(customerOrganizationId, {
			...submission,
			signer: customer,
		});
		assert.equal(accepted.signerAddress, customer);
		assert.deepEqual(
			await submissions.submit(customerOrganizationId, {
				...submission,
				signer: customer,
			}),
			accepted
		);
		await assert.rejects(
			submissions.submit(hostOrganizationId, {
				...submission,
				signer: customer,
			}),
			NotFoundException
		);
	});

	it('relays the machine the latest signed vouchers', async () => {
		const document = await relay.build(machine.id);
		const relayed = new Map(
			document.channels.map((channel) => [channel.leaseId, channel.voucher])
		);
		assert.equal(relayed.get(delegated.lease.id)?.sequence, '2');
		assert.equal(relayed.get(client.lease.id)?.signer, customer);
		assert.equal((await relay.build(machine.id)).digest, document.digest);
	});

	it('claims both channels in one batch and the ledger follows', async () => {
		await relayer.relayClaims();
		const delegatedChannel = await channelOf(delegated);
		const clientChannel = await channelOf(client);
		assert.equal(delegatedChannel.claimError, null);
		assert.equal(delegatedChannel.claimedSequence, 2);
		assert.equal(clientChannel.claimedSequence, 1);
		assert.equal(delegatedChannel.claimTransactionHash, null);

		const onChain = await publicClient.readContract({
			address: chain.escrowAddress,
			abi: snapflowEscrowAbi,
			functionName: 'channelOf',
			args: [delegatedChannel.channelId],
		});
		assert.deepEqual(
			[
				onChain.sequence,
				onChain.hostClaimed,
				onChain.feeClaimed,
				onChain.serviceClaimed,
			],
			[2n, 1_333_333n, 333_333n, 10_001n]
		);
		const hostUsdc = await publicClient.readContract({
			address: chain.usdcAddress,
			abi: erc20Abi,
			functionName: 'balanceOf',
			args: [host],
		});
		const hostPaid = 1_333_333n + 500_000n;
		const platformPaid = LEASE_PLATFORM_PAID;
		assert.equal(hostUsdc - hostOpeningUsdc, hostPaid);

		await indexChain();
		const manager = orm.em.fork();
		assert.deepEqual(
			await ledgerBalance(
				manager,
				customerCreditAccount(customerOrganizationId)
			),
			MicroUsd.of(DEPOSIT_MICRO_USD)
		);
		assert.deepEqual(
			await ledgerBalance(
				manager,
				hostPendingEarningsAccount(hostOrganizationId)
			),
			MicroUsd.of(-hostPaid)
		);
		assert.deepEqual(
			await ledgerBalance(
				manager,
				platformAccount(BillingLedgerAccountCode.PLATFORM_WALLET)
			),
			MicroUsd.of(platformPaid)
		);
		assert.deepEqual(
			await ledgerBalance(
				manager,
				platformAccount(BillingLedgerAccountCode.ESCROW_CUSTODY)
			),
			MicroUsd.of(DEPOSIT_MICRO_USD - hostPaid - platformPaid)
		);
		const account = await manager.findOneOrFail(EscrowAccount, {
			address: customer,
		});
		assert.equal(
			account.balanceMicroUsd,
			(DEPOSIT_MICRO_USD - hostPaid - platformPaid).toString()
		);
	});

	it('claims nothing again once the vouchers are paid', async () => {
		await relayer.relayClaims();
		assert.equal((await channelOf(delegated)).claimError, null);
		assert.equal((await channelOf(delegated)).claimedSequence, 2);
	});

	it('bills a private pool month through a platform service channel', async () => {
		const manager = orm.em.fork();
		const poolMachine = new Machine({
			name: `private-pool-${randomUUID()}`,
			apiVersion: '1',
			organizationId: customerOrganizationId,
		});
		manager.persist(poolMachine);
		await manager.flush();
		manager.persist(
			Object.assign(new MachineListing(), {
				machineId: poolMachine.id,
				state: ListingState.LISTED,
				visibility: ListingVisibility.PRIVATE,
			})
		);
		await manager.flush();

		const pools = new PrivatePoolBillingService(
			settings,
			new BillingLedgerService()
		);
		for (let run = 0; run < 2; run += 1) {
			await orm.em
				.fork()
				.transactional((transaction) => pools.chargeCurrentDay(transaction));
		}
		const charges = await orm.em
			.fork()
			.find(PrivatePoolCharge, { organizationId: customerOrganizationId });
		assert.equal(charges.length, 1);
		const [dayCharge] = charges;
		assert.ok(dayCharge);
		const { privatePoolMachineMonthlyMicroUsd } = await settings.get();
		const fee = privatePoolDayFee(
			MicroUsd.of(BigInt(privatePoolMachineMonthlyMicroUsd)),
			dayCharge.serviceDay
		);
		assert.equal(dayCharge.amountMicroUsd, fee.toString());
		assert.deepEqual(
			await ledgerBalance(
				orm.em.fork(),
				customerCreditAccount(customerOrganizationId)
			),
			MicroUsd.of(DEPOSIT_MICRO_USD).subtract(fee)
		);

		const escrowIdentity = {
			chainId: foundry.id,
			contractAddress: chain.escrowAddress,
		};
		const [unbilled, ...others] = await unbilledServicePeriods(
			orm.em.fork(),
			escrowIdentity
		);
		assert.ok(unbilled);
		assert.deepEqual(others, []);
		assert.equal(unbilled.organizationId, customerOrganizationId);
		await orm.em
			.fork()
			.transactional((transaction) =>
				channels.openPlatformService(
					transaction,
					unbilled.organizationId,
					utcBillingMonth(unbilled.periodStart)
				)
			);
		assert.deepEqual(
			await unbilledServicePeriods(orm.em.fork(), escrowIdentity),
			[]
		);

		const feeRecipient = await publicClient.readContract({
			address: chain.escrowAddress,
			abi: snapflowEscrowAbi,
			functionName: 'feeRecipient',
		});
		const serviceChannel = await orm.em.fork().findOneOrFail(PaymentChannel, {
			customerOrganizationId,
			kind: PaymentChannelKind.PLATFORM_SERVICE,
		});
		assert.equal(serviceChannel.hostAddress, feeRecipient);
		assert.equal(serviceChannel.leaseId, null);
		const voucherSettings = await settings.get();
		await orm.em
			.fork()
			.transactional((transaction) =>
				issuance.evaluate(transaction, serviceChannel.id, voucherSettings)
			);
		const [voucher] = await orm.em
			.fork()
			.find(PaymentVoucher, { paymentChannelId: serviceChannel.id });
		assert.ok(voucher?.signature);
		assert.deepEqual(
			[
				voucher.hostAmountMicroUsd,
				voucher.feeAmountMicroUsd,
				voucher.serviceAmountMicroUsd,
			],
			['0', '0', fee.toString()]
		);

		const recipientUsdc = () =>
			publicClient.readContract({
				address: chain.usdcAddress,
				abi: erc20Abi,
				functionName: 'balanceOf',
				args: [feeRecipient],
			});
		const recipientOpening = await recipientUsdc();
		// A channel is first claimed a claim interval after it opened.
		await orm.em
			.fork()
			.nativeUpdate(
				PaymentChannel,
				{ id: serviceChannel.id },
				{ openedAt: new Date(Date.now() - LEASE_AGE_MILLISECONDS) }
			);
		await relayer.relayClaims();
		const claimed = await orm.em
			.fork()
			.findOneOrFail(PaymentChannel, { id: serviceChannel.id });
		assert.equal(claimed.claimError, null);
		assert.equal(claimed.claimedSequence, 1);
		assert.equal((await recipientUsdc()) - recipientOpening, fee.toBigInt());

		await indexChain();
		assert.deepEqual(
			await ledgerBalance(
				orm.em.fork(),
				platformAccount(BillingLedgerAccountCode.PLATFORM_WALLET)
			),
			MicroUsd.of(LEASE_PLATFORM_PAID).add(fee)
		);
		assert.deepEqual(
			await ledgerBalance(
				orm.em.fork(),
				platformAccount(BillingLedgerAccountCode.PLATFORM_SERVICE_REVENUE)
			),
			fee
		);
	});

	it('still claims the others when the escrow refuses one voucher', async () => {
		for (const seeded of [delegated, client]) {
			await charge(seeded, {
				host: 100_000n,
				markup: 25_000n,
				gross: 125_000n,
				beneficiary: BillingBeneficiaryKind.HOST_ORGANIZATION,
			});
			await issue(seeded);
		}
		const channel = await channelOf(client);
		const pending = (await vouchersOf(client)).at(-1);
		assert.ok(pending);
		await submissions.submit(customerOrganizationId, {
			channelId: channel.channelId,
			sequence: pending.sequence,
			signer: customer,
			signature: await customerSignature(channel, pending),
		});
		await send(
			walletClient.writeContract({
				account: customer,
				chain: foundry,
				address: chain.escrowAddress,
				abi: snapflowEscrowAbi,
				functionName: 'revokeSessionKey',
				args: [signer.address],
			})
		);
		await orm.em
			.fork()
			.nativeUpdate(
				PaymentChannel,
				{ leaseId: { $in: [delegated.lease.id, client.lease.id] } },
				{ claimAttemptedAt: null }
			);

		await relayer.relayClaims();
		const refused = await channelOf(delegated);
		assert.equal(refused.claimError, 'SessionKeyInactive');
		assert.equal(refused.claimedSequence, 2);
		assert.equal((await channelOf(client)).claimedSequence, 2);
	});
});

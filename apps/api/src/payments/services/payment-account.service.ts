/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import {
	isStripeObjectMissing,
	stripeErrorDetails,
} from '../../common/utils/error/stripe-error.util';
import { Organization } from '../../organization/entities/organization.entity';
import { SettingsService } from '../../settings/services/settings.service';
import {
	PaymentsErrorCode,
	PayoutsBlockedReason,
} from '../constants/payments.constants';
import {
	HOST_BUSINESS_PROFILE,
	STRIPE_ACCOUNT_INCLUDE,
	STRIPE_CLIENT,
	STRIPE_CURRENCY,
	STRIPE_DASHBOARD,
	STRIPE_PAYOUT_INTERVAL,
	STRIPE_RESPONSIBLE_PARTY,
	STRIPE_WEEKLY_PAYOUT_DAY,
	StripeAccountConfiguration,
	StripeIdempotencyPrefix,
	StripeMetadataKey,
	StripeRequestParam,
} from '../constants/stripe.constants';
import { PaymentAccount } from '../entities/payment-account.entity';
import { PayoutAccountType } from '../enums/payout-account-type.enum';
import {
	balanceSettingsMatch,
	paymentAccountState,
} from '../utils/payment-account.util';
import { payoutAccountEligible } from '../utils/payout.util';
import {
	idempotencyKey,
	requestFingerprint,
} from '../utils/stripe-amount.util';
import { PaymentMethodService } from './payment-method.service';

export interface PaymentAccountOwner {
	organizationId: string;
	contactEmail: string;
}

export interface PayoutAccountProfile {
	country: string;
	type: PayoutAccountType;
}

export type AccountFields = Pick<
	Stripe.V2.Core.AccountCreateParams,
	'configuration' | 'dashboard' | 'defaults' | 'identity'
>;

const CUSTOMER_FIELDS: AccountFields = { configuration: { customer: {} } };

function recipientIdentity(
	owner: PaymentAccountOwner,
	profile: PayoutAccountProfile
): Stripe.V2.Core.AccountCreateParams.Identity {
	return {
		country: profile.country,
		entity_type: profile.type,
		...(profile.type === PayoutAccountType.INDIVIDUAL
			? { individual: { email: owner.contactEmail } }
			: {}),
	};
}

function recipientFields(
	identity: Stripe.V2.Core.AccountCreateParams.Identity | null
): AccountFields {
	return {
		configuration: {
			recipient: {
				capabilities: {
					stripe_balance: { stripe_transfers: { requested: true } },
				},
			},
		},
		dashboard: STRIPE_DASHBOARD,
		...(identity ? { identity } : {}),
		defaults: {
			currency: STRIPE_CURRENCY,
			responsibilities: {
				fees_collector: STRIPE_RESPONSIBLE_PARTY,
				losses_collector: STRIPE_RESPONSIBLE_PARTY,
			},
		},
	};
}

@Injectable()
export class PaymentAccountService {
	private readonly logger = new Logger(PaymentAccountService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly settings: SettingsService,
		private readonly paymentMethods: PaymentMethodService
	) {}

	find(organizationId: string): Promise<PaymentAccount | null> {
		return this.entityManager
			.fork()
			.findOne(PaymentAccount, { organizationId });
	}

	async findOrFail(organizationId: string): Promise<PaymentAccount> {
		const account = await this.find(organizationId);
		if (!account) {
			throw new NotFoundException({
				code: PaymentsErrorCode.PAYOUT_ACCOUNT_MISSING,
				message: 'The organization has no payment account',
			});
		}
		return account;
	}

	async currentPayoutAccount(organizationId: string): Promise<PaymentAccount> {
		const account = await this.findPayoutAccountOrFail(organizationId);
		if (payoutAccountEligible(account)) return account;
		await this.synchronize(account.stripeAccountId);
		return this.findPayoutAccountOrFail(organizationId);
	}

	async findPayoutAccountOrFail(
		organizationId: string
	): Promise<PaymentAccount> {
		const account = await this.find(organizationId);
		if (!account?.recipientRequested) {
			throw new NotFoundException({
				code: PaymentsErrorCode.PAYOUT_ACCOUNT_MISSING,
				message: 'The organization has no payout account',
			});
		}
		return account;
	}

	async ensureCustomer(owner: PaymentAccountOwner): Promise<PaymentAccount> {
		const existing = await this.find(owner.organizationId);
		if (existing?.customerConfigured) return existing;
		const account =
			existing ??
			(await this.create(
				owner,
				StripeAccountConfiguration.CUSTOMER,
				CUSTOMER_FIELDS
			));
		if (account.customerConfigured) return account;
		try {
			return await this.addConfiguration(
				account,
				StripeAccountConfiguration.CUSTOMER,
				CUSTOMER_FIELDS
			);
		} catch (error) {
			if (!isStripeObjectMissing(error)) throw error;
			return this.replaceMissingCustomer(owner, account, error);
		}
	}

	// Runs a Stripe request on the customer account of the owner. When Stripe no
	// longer has that account, it is replaced and the request retried once.
	async withCustomer<Result>(
		owner: PaymentAccountOwner,
		request: (account: PaymentAccount) => Promise<Result>
	): Promise<Result> {
		const account = await this.ensureCustomer(owner);
		try {
			return await request(account);
		} catch (error) {
			if (!isStripeObjectMissing(error, StripeRequestParam.CUSTOMER_ACCOUNT)) {
				throw error;
			}
			return request(await this.replaceMissingCustomer(owner, account, error));
		}
	}

	async ensureRecipient(
		owner: PaymentAccountOwner,
		profile: PayoutAccountProfile
	): Promise<PaymentAccount> {
		const { payoutCountries, payoutWeekday } = await this.settings.get();
		if (!payoutCountries.includes(profile.country)) {
			throw new BadRequestException({
				code: PaymentsErrorCode.PAYOUT_COUNTRY_UNSUPPORTED,
				message: `Payouts are not available in ${profile.country}`,
			});
		}
		const existing = await this.find(owner.organizationId);
		const account = existing?.recipientRequested
			? existing
			: await this.requestRecipient(owner, profile, existing);
		await this.reconcileBusinessProfile(account.stripeAccountId);
		await this.reconcilePayoutSchedule(account, payoutWeekday);
		return account;
	}

	// Requests the recipient configuration with fields the caller already holds, so
	// the account needs no hosted onboarding (the development host seed uses this).
	async ensurePrefilledRecipient(
		owner: PaymentAccountOwner,
		fields: AccountFields
	): Promise<PaymentAccount> {
		const existing = await this.find(owner.organizationId);
		if (existing?.recipientRequested) return existing;
		if (!existing) {
			return this.create(owner, StripeAccountConfiguration.RECIPIENT, fields);
		}
		return this.addConfiguration(
			existing,
			StripeAccountConfiguration.RECIPIENT,
			fields
		);
	}

	async createSession(organizationId: string): Promise<string> {
		const account = await this.findPayoutAccountOrFail(organizationId);
		const session = await this.stripe.accountSessions.create({
			account: account.stripeAccountId,
			components: {
				account_onboarding: { enabled: true },
				notification_banner: { enabled: true },
				account_management: { enabled: true },
			},
		});
		return session.client_secret;
	}

	async synchronize(stripeAccountId: string): Promise<void> {
		const remote = await this.stripe.v2.core.accounts.retrieve(
			stripeAccountId,
			{ include: [...STRIPE_ACCOUNT_INCLUDE] }
		);
		await this.entityManager.transactional(async (manager) => {
			const account = await manager.findOne(PaymentAccount, {
				stripeAccountId,
			});
			if (!account) return;
			this.apply(account, remote);
		});
	}

	async setPayoutsBlocked(
		stripeAccountId: string,
		reason: string | null
	): Promise<void> {
		await this.entityManager.transactional(async (manager) => {
			const account = await manager.findOne(PaymentAccount, {
				stripeAccountId,
			});
			if (!account) return;
			if (
				reason === null &&
				account.payoutsBlockedReason !== PayoutsBlockedReason.PAYOUT_FAILED
			) {
				return;
			}
			account.payoutsBlockedReason = reason;
		});
	}

	private async requestRecipient(
		owner: PaymentAccountOwner,
		profile: PayoutAccountProfile,
		existing: PaymentAccount | null
	): Promise<PaymentAccount> {
		const identity = recipientIdentity(owner, profile);
		const stored =
			existing ??
			(await this.create(
				owner,
				StripeAccountConfiguration.RECIPIENT,
				recipientFields(identity)
			));
		if (stored.recipientRequested) return stored;
		return this.addConfiguration(
			stored,
			StripeAccountConfiguration.RECIPIENT,
			recipientFields(stored.country ? null : identity)
		);
	}

	private async reconcileBusinessProfile(
		stripeAccountId: string
	): Promise<void> {
		const remote = await this.stripe.accounts.retrieve(stripeAccountId);
		if (
			remote.business_profile?.mcc === HOST_BUSINESS_PROFILE.mcc &&
			remote.business_profile.product_description ===
				HOST_BUSINESS_PROFILE.product_description
		) {
			return;
		}
		const params: Stripe.AccountUpdateParams = {
			business_profile: HOST_BUSINESS_PROFILE,
		};
		await this.stripe.accounts.update(stripeAccountId, params, {
			idempotencyKey: idempotencyKey(
				StripeIdempotencyPrefix.BUSINESS_PROFILE,
				`${stripeAccountId}:${requestFingerprint(params)}`
			),
		});
	}

	private async reconcilePayoutSchedule(
		account: PaymentAccount,
		payoutWeekday: number
	): Promise<void> {
		const options = { stripeAccount: account.stripeAccountId };
		const params: Stripe.BalanceSettingsUpdateParams = {
			payments: {
				payouts: {
					schedule: {
						interval: STRIPE_PAYOUT_INTERVAL,
						weekly_payout_days: [STRIPE_WEEKLY_PAYOUT_DAY[payoutWeekday]],
					},
				},
				debit_negative_balances: true,
			},
		};
		const current = await this.stripe.balanceSettings.retrieve({}, options);
		if (balanceSettingsMatch(current, params)) return;
		await this.stripe.balanceSettings.update(params, {
			...options,
			idempotencyKey: idempotencyKey(
				StripeIdempotencyPrefix.BALANCE_SETTINGS,
				`${account.organizationId}:${requestFingerprint(params)}`
			),
		});
	}

	// A customer-only account is recreated; a recipient account holds the
	// identity and payout history of a host, so its payouts stop instead.
	private async replaceMissingCustomer(
		owner: PaymentAccountOwner,
		missing: PaymentAccount,
		cause: unknown
	): Promise<PaymentAccount> {
		this.logger.warn(
			`Stripe account ${missing.stripeAccountId} of organization ${missing.organizationId} is missing: ${stripeErrorDetails(cause)}`
		);
		if (missing.recipientRequested) {
			await this.setPayoutsBlocked(
				missing.stripeAccountId,
				PayoutsBlockedReason.ACCOUNT_CLOSED
			);
			throw new ConflictException({
				code: PaymentsErrorCode.PAYMENT_ACCOUNT_UNAVAILABLE,
				message:
					'The Stripe account of this organization is unavailable. Contact support.',
			});
		}
		const remote = await this.createRemote(
			owner,
			StripeAccountConfiguration.CUSTOMER,
			CUSTOMER_FIELDS,
			missing.stripeAccountId
		);
		const account = await this.entityManager.transactional(async (manager) => {
			const stored = await manager.findOneOrFail(
				PaymentAccount,
				{ organizationId: missing.organizationId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (stored.stripeAccountId !== missing.stripeAccountId) return stored;
			stored.stripeAccountId = remote.id;
			this.apply(stored, remote);
			await this.paymentMethods.markAllDetached(
				manager,
				missing.organizationId
			);
			return stored;
		});
		await this.closeUnlessStored(
			account,
			remote,
			StripeAccountConfiguration.CUSTOMER
		);
		return account;
	}

	// The idempotency scope is the organization for its first account and the
	// missing account for a replacement, so a retry never returns the old one.
	private async createRemote(
		owner: PaymentAccountOwner,
		configuration: StripeAccountConfiguration,
		fields: AccountFields,
		scope: string
	): Promise<Stripe.V2.Core.Account> {
		const organization = await this.entityManager
			.fork()
			.findOne(Organization, { id: owner.organizationId });
		if (!organization) {
			throw new NotFoundException(
				`Organization ${owner.organizationId} not found`
			);
		}
		const params: Stripe.V2.Core.AccountCreateParams = {
			display_name: organization.name,
			contact_email: owner.contactEmail,
			...fields,
			metadata: {
				[StripeMetadataKey.ORGANIZATION_ID]: owner.organizationId,
			},
			include: [...STRIPE_ACCOUNT_INCLUDE],
		};
		return this.stripe.v2.core.accounts.create(params, {
			idempotencyKey: idempotencyKey(
				StripeIdempotencyPrefix.ACCOUNT,
				`${scope}:${configuration}:${requestFingerprint(params)}`
			),
		});
	}

	private async closeUnlessStored(
		account: PaymentAccount,
		remote: Stripe.V2.Core.Account,
		configuration: StripeAccountConfiguration
	): Promise<void> {
		if (account.stripeAccountId === remote.id) return;
		await this.stripe.v2.core.accounts.close(remote.id, {
			applied_configurations: [configuration],
		});
	}

	private async create(
		owner: PaymentAccountOwner,
		configuration: StripeAccountConfiguration,
		fields: AccountFields
	): Promise<PaymentAccount> {
		const remote = await this.createRemote(
			owner,
			configuration,
			fields,
			owner.organizationId
		);
		const account = await this.entityManager.transactional(async (manager) => {
			await manager.upsert(
				PaymentAccount,
				{
					organizationId: owner.organizationId,
					stripeAccountId: remote.id,
				},
				{ onConflictFields: ['organizationId'], onConflictAction: 'ignore' }
			);
			const stored = await manager.findOneOrFail(
				PaymentAccount,
				{ organizationId: owner.organizationId },
				{ refresh: true }
			);
			if (stored.stripeAccountId === remote.id) this.apply(stored, remote);
			return stored;
		});
		await this.closeUnlessStored(account, remote, configuration);
		return account;
	}

	private async addConfiguration(
		account: PaymentAccount,
		configuration: StripeAccountConfiguration,
		changes: Stripe.V2.Core.AccountUpdateParams
	): Promise<PaymentAccount> {
		const params: Stripe.V2.Core.AccountUpdateParams = {
			...changes,
			include: [...STRIPE_ACCOUNT_INCLUDE],
		};
		const remote = await this.stripe.v2.core.accounts.update(
			account.stripeAccountId,
			params,
			{
				idempotencyKey: idempotencyKey(
					StripeIdempotencyPrefix.ACCOUNT_CONFIGURATION,
					`${account.stripeAccountId}:${configuration}:${requestFingerprint(params)}`
				),
			}
		);
		return this.entityManager.transactional(async (manager) => {
			const current = await manager.findOneOrFail(PaymentAccount, {
				organizationId: account.organizationId,
			});
			this.apply(current, remote);
			return current;
		});
	}

	private apply(account: PaymentAccount, remote: Stripe.V2.Core.Account): void {
		const state = paymentAccountState(remote);
		account.country = state.country ?? account.country;
		account.customerConfigured = state.customerConfigured;
		account.recipientRequested = state.recipientRequested;
		account.transfersStatus = state.transfersStatus;
		account.requirementsStatus = state.requirementsStatus;
		account.taxInformationStatus = state.taxInformationStatus;
		if (state.closed) {
			account.payoutsBlockedReason = PayoutsBlockedReason.ACCOUNT_CLOSED;
		}
	}
}

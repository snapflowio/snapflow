/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import type { CursorPageQueryDto } from '../../../common/dto/cursor-page.dto';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { SettingsService } from '../../../settings/platform/services/settings.service';
import {
	PaymentsErrorCode,
	TOP_UP_RETURN_PATH,
	TOP_UP_RETURN_QUERY_KEY,
	TopUpFailureCode,
} from '../constants/payments.constants';
import {
	CREDIT_PRODUCT_NAME,
	CREDIT_PRODUCT_QUANTITY,
	CREDIT_PRODUCT_TAX_CODE,
	STRIPE_CLIENT,
	STRIPE_CURRENCY,
	StripeIdempotencyPrefix,
	StripeMetadataKey,
} from '../constants/stripe.constants';
import {
	type CreateTopUpDto,
	TopUpDto,
	type TopUpPageDto,
	type TopUpSessionDto,
	type UpdateTopUpAmountDto,
} from '../dto/top-up.dto';
import { TopUp } from '../entities/top-up.entity';
import { TopUpKind } from '../enums/top-up-kind.enum';
import { TopUpState } from '../enums/top-up-state.enum';
import { idempotencyKey } from '../utils/stripe-amount.util';
import {
	type PaymentAccountOwner,
	PaymentAccountService,
} from './payment-account.service';
import { PaymentVelocityService } from './payment-velocity.service';
import { TopUpSettlementService } from './top-up-settlement.service';

const CHECKOUT_MODE = 'payment';
const CHECKOUT_UI_MODE = 'elements';
const CARD_PAYMENT_METHOD_TYPE = 'card';
const LINK_WALLET_DISPLAY = 'never';
const PAYMENT_METHOD_SAVE = 'enabled';
const OPEN_CHECKOUT_STATUS = 'open' satisfies Stripe.Checkout.Session.Status;

function creditLineItem(
	amountCents: number
): Stripe.Checkout.SessionCreateParams.LineItem &
	Stripe.Checkout.SessionUpdateParams.LineItem {
	return {
		price_data: {
			currency: STRIPE_CURRENCY,
			unit_amount: amountCents,
			product_data: {
				name: CREDIT_PRODUCT_NAME,
				tax_code: CREDIT_PRODUCT_TAX_CODE,
			},
		},
		quantity: CREDIT_PRODUCT_QUANTITY,
	};
}

@Injectable()
export class TopUpService {
	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly settings: SettingsService,
		private readonly config: TypedConfigService,
		private readonly accounts: PaymentAccountService,
		private readonly velocity: PaymentVelocityService,
		private readonly settlement: TopUpSettlementService
	) {}

	async create(
		owner: PaymentAccountOwner,
		input: CreateTopUpDto
	): Promise<TopUpSessionDto> {
		const settings = await this.assertAmountInRange(input.amountCents);
		const resumed = await this.resumeOpenSession(
			owner.organizationId,
			input.amountCents
		);
		if (resumed) return resumed;
		const topUp = await this.recordAttempt(owner.organizationId, input);
		try {
			const session = await this.accounts.withCustomer(owner, (account) =>
				this.openSession(
					topUp,
					account.stripeAccountId,
					settings.stripeTaxEnabled
				)
			);
			if (!session.client_secret) {
				throw new Error(`Checkout session ${session.id} has no client secret`);
			}
			await this.entityManager
				.fork()
				.nativeUpdate(
					TopUp,
					{ id: topUp.id },
					{ stripeCheckoutSessionId: session.id }
				);
			return { topUpId: topUp.id, checkoutClientSecret: session.client_secret };
		} catch (error) {
			await this.entityManager.fork().nativeUpdate(
				TopUp,
				{ id: topUp.id, state: TopUpState.CREATED },
				{
					state: TopUpState.FAILED,
					failureCode: TopUpFailureCode.PAYMENT_ERROR,
				}
			);
			throw error;
		}
	}

	// The idempotency key stays valid across a replaced customer account:
	// Stripe stores no result for a request naming a missing object.
	private openSession(
		topUp: TopUp,
		customerAccountId: string,
		taxEnabled: boolean
	): Promise<Stripe.Checkout.Session> {
		return this.stripe.checkout.sessions.create(
			{
				mode: CHECKOUT_MODE,
				ui_mode: CHECKOUT_UI_MODE,
				customer_account: customerAccountId,
				line_items: [creditLineItem(topUp.amountCents)],
				allowed_payment_method_types: [CARD_PAYMENT_METHOD_TYPE],
				wallet_options: { link: { display: LINK_WALLET_DISPLAY } },
				payment_intent_data: {
					metadata: {
						[StripeMetadataKey.TOP_UP_ID]: topUp.id,
						[StripeMetadataKey.ORGANIZATION_ID]: topUp.organizationId,
						[StripeMetadataKey.TOP_UP_KIND]: TopUpKind.MANUAL,
					},
				},
				saved_payment_method_options: {
					payment_method_save: PAYMENT_METHOD_SAVE,
				},
				automatic_tax: { enabled: taxEnabled },
				return_url: this.returnUrl(topUp.id),
			},
			{
				idempotencyKey: idempotencyKey(
					StripeIdempotencyPrefix.TOP_UP,
					topUp.id
				),
			}
		);
	}

	async updateAmount(
		organizationId: string,
		topUpId: string,
		input: UpdateTopUpAmountDto
	): Promise<TopUpDto> {
		await this.assertAmountInRange(input.amountCents);
		const resized = await this.resizeOpenSession(
			organizationId,
			topUpId,
			input.amountCents
		);
		if (!resized) {
			throw new ConflictException({
				code: PaymentsErrorCode.TOP_UP_NOT_OPEN,
				message: `Top-up ${topUpId} is no longer open for payment`,
			});
		}
		return TopUpDto.from(resized.topUp);
	}

	async list(
		organizationId: string,
		query: CursorPageQueryDto
	): Promise<TopUpPageDto> {
		const page = await findCursorPage(this.entityManager.fork(), TopUp, {
			where: { organizationId },
			orderBy: { createdAt: 'DESC', id: 'DESC' },
			limit: query.limit,
			cursor: query.cursor,
		});
		return {
			items: page.items.map((topUp) => TopUpDto.from(topUp)),
			nextCursor: page.nextCursor,
		};
	}

	async get(organizationId: string, topUpId: string): Promise<TopUpDto> {
		const found = await this.entityManager
			.fork()
			.findOne(TopUp, { id: topUpId, organizationId });
		if (!found) throw new NotFoundException(`Top-up ${topUpId} not found`);
		const topUp = await this.settlement.settle(found);
		if (
			topUp.state !== TopUpState.REQUIRES_ACTION ||
			!topUp.stripePaymentIntentId
		) {
			return TopUpDto.from(topUp);
		}
		const intent = await this.stripe.paymentIntents.retrieve(
			topUp.stripePaymentIntentId
		);
		return TopUpDto.from(topUp, intent.client_secret ?? undefined);
	}

	private async assertAmountInRange(amountCents: number) {
		const settings = await this.settings.get();
		if (
			amountCents < settings.topUpMinimumCents ||
			amountCents > settings.topUpMaximumCents
		) {
			throw new BadRequestException({
				code: PaymentsErrorCode.TOP_UP_AMOUNT_OUT_OF_RANGE,
				message: `Top-ups must be between ${settings.topUpMinimumCents} and ${settings.topUpMaximumCents} cents`,
			});
		}
		return settings;
	}

	private async resumeOpenSession(
		organizationId: string,
		amountCents: number
	): Promise<TopUpSessionDto | null> {
		const pending = await this.entityManager.fork().findOne(
			TopUp,
			{
				organizationId,
				kind: TopUpKind.MANUAL,
				state: TopUpState.CREATED,
				stripeCheckoutSessionId: { $ne: null },
			},
			{ orderBy: { createdAt: 'DESC', id: 'DESC' } }
		);
		if (!pending) return null;
		const resized = await this.resizeOpenSession(
			organizationId,
			pending.id,
			amountCents
		);
		if (!resized?.clientSecret) return null;
		return {
			topUpId: resized.topUp.id,
			checkoutClientSecret: resized.clientSecret,
		};
	}

	// The session is fetched before the top-up is locked, so no row lock is held
	// across a read from Stripe.
	private async resizeOpenSession(
		organizationId: string,
		topUpId: string,
		amountCents: number
	): Promise<{ topUp: TopUp; clientSecret: string | null } | null> {
		const found = await this.entityManager
			.fork()
			.findOne(TopUp, { id: topUpId, organizationId, kind: TopUpKind.MANUAL });
		if (!found) throw new NotFoundException(`Top-up ${topUpId} not found`);
		if (found.state !== TopUpState.CREATED || !found.stripeCheckoutSessionId) {
			return null;
		}
		const session = await this.settlement.retrieveSession(
			found,
			found.stripeCheckoutSessionId
		);
		if (session?.status !== OPEN_CHECKOUT_STATUS) return null;
		return this.entityManager.fork().transactional(async (manager) => {
			await this.assertActiveOrganization(manager, organizationId);
			const topUp = await manager.findOne(
				TopUp,
				{
					id: topUpId,
					state: TopUpState.CREATED,
					stripeCheckoutSessionId: session.id,
				},
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!topUp) return null;
			if (topUp.amountCents !== amountCents) {
				await this.stripe.checkout.sessions.update(session.id, {
					line_items: [creditLineItem(amountCents)],
				});
				topUp.amountCents = amountCents;
			}
			return { topUp, clientSecret: session.client_secret };
		});
	}

	private recordAttempt(
		organizationId: string,
		input: CreateTopUpDto
	): Promise<TopUp> {
		return this.entityManager.fork().transactional(async (manager) => {
			await this.lockActiveOrganization(manager, organizationId);
			await this.velocity.assertTopUpAllowed(manager, organizationId);
			const created = Object.assign(new TopUp(), {
				id: randomUUID(),
				organizationId,
				kind: TopUpKind.MANUAL,
				amountCents: input.amountCents,
				createdAt: await databaseNow(manager),
			});
			manager.persist(created);
			return created;
		});
	}

	private lockActiveOrganization(
		manager: EntityManager,
		organizationId: string
	): Promise<void> {
		return this.assertActiveOrganization(
			manager,
			organizationId,
			LockMode.PESSIMISTIC_WRITE
		);
	}

	private async assertActiveOrganization(
		manager: EntityManager,
		organizationId: string,
		lockMode?: LockMode
	): Promise<void> {
		const organization = await manager.findOne(
			Organization,
			{ id: organizationId },
			lockMode ? { lockMode } : {}
		);
		if (!organization) {
			throw new NotFoundException(`Organization ${organizationId} not found`);
		}
		const now = await databaseNow(manager);
		if (
			organization.suspended &&
			(!organization.suspendedUntil || organization.suspendedUntil > now)
		) {
			throw new ForbiddenException({
				code: PaymentsErrorCode.ORGANIZATION_SUSPENDED,
				message: 'A suspended organization cannot buy credit',
			});
		}
	}

	private returnUrl(topUpId: string): string {
		const url = new URL(
			`${this.config.getOrThrow('dashboardUrl')}${TOP_UP_RETURN_PATH}`
		);
		url.searchParams.set(TOP_UP_RETURN_QUERY_KEY, topUpId);
		return url.toString();
	}
}

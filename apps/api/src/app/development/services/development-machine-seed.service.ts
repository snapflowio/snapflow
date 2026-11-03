/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { DeploymentEnvironment } from '../../../config/enums/deployment-environment.enum';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { MachineListing } from '../../../marketplace/machine/entities/machine-listing.entity';
import { ListingState } from '../../../marketplace/machine/enums/listing-state.enum';
import { ListingVisibility } from '../../../marketplace/machine/enums/listing-visibility.enum';
import { MachineListingService } from '../../../marketplace/machine/services/machine-listing.service';
import { PriceCardService } from '../../../marketplace/machine/services/price-card.service';
import { PriceFloorService } from '../../../marketplace/machine/services/price-floor.service';
import { requirePriceClass } from '../../../marketplace/machine/utils/price-class.util';
import { STRIPE_CLIENT } from '../../../payments/funds/constants/stripe.constants';
import { PaymentAccountService } from '../../../payments/funds/services/payment-account.service';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { UserService } from '../../../user/services/user.service';
import { VerificationEvents } from '../../../verification/qualification/constants/verification-events.constants';
import { BenchmarkPassedEvent } from '../../../verification/qualification/events/benchmark-passed.event';
import { MachineTierService } from '../../../verification/qualification/services/machine-tier.service';
import {
	DEVELOPMENT_HOST_ACCOUNT,
	DEVELOPMENT_MARKET_REFERENCE_PRICE,
	DEVELOPMENT_PRICE_CARD,
	DEVELOPMENT_TIER_REASON,
} from '../constants/development-machine-seed.constants';
import { developmentHostAccountFields } from '../utils/development-host-account.util';

const SINGLE_RESULT = 1;

@Injectable()
export class DevelopmentMachineSeedService {
	private readonly logger = new Logger(DevelopmentMachineSeedService.name);

	constructor(
		private readonly entityManager: EntityManager,
		@Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
		private readonly accounts: PaymentAccountService,
		private readonly config: TypedConfigService,
		private readonly users: UserService,
		private readonly floors: PriceFloorService,
		private readonly priceCards: PriceCardService,
		private readonly listings: MachineListingService,
		private readonly tiers: MachineTierService
	) {}

	@OnEvent(VerificationEvents.BENCHMARK_PASSED)
	async onBenchmarkPassed({ machineId }: BenchmarkPassedEvent): Promise<void> {
		if (
			this.config.get('deployment').name !== DeploymentEnvironment.DEVELOPMENT
		) {
			return;
		}
		try {
			await RequestContext.create(this.entityManager, () =>
				this.seed(machineId)
			);
			this.logger.log(
				`Development machine ${machineId} is listed and placeable`
			);
		} catch (error) {
			this.logger.error(
				`Could not list development machine ${machineId}`,
				error
			);
		}
	}

	private async seed(machineId: string): Promise<void> {
		const administrator = await this.users.findOldestAdministrator();
		if (!administrator) {
			throw new Error('No administrator exists to own the development listing');
		}
		const machine = await this.entityManager.findOneOrFail(Machine, {
			id: machineId,
		});
		const { priceClass } = requirePriceClass(machine);
		await this.floors.updateBootstrapMedian(
			priceClass,
			DEVELOPMENT_MARKET_REFERENCE_PRICE,
			administrator.id
		);
		await this.ensureHostAccount(machine.organizationId, administrator.email);
		await this.ensurePriceCard(machine, administrator.id);
		await this.ensurePublicListing(machine);
		await this.tiers.updateAdminTier(machine.id, {
			tierCap: null,
			reason: DEVELOPMENT_TIER_REASON,
		});
	}

	private async ensureHostAccount(
		organizationId: string,
		contactEmail: string
	): Promise<void> {
		const account = await this.accounts.ensurePrefilledRecipient(
			{ organizationId, contactEmail },
			developmentHostAccountFields(contactEmail, new Date())
		);
		const banks = await this.stripe.accounts.listExternalAccounts(
			account.stripeAccountId,
			{ limit: SINGLE_RESULT }
		);
		if (banks.data.length === 0) {
			await this.stripe.accounts.createExternalAccount(
				account.stripeAccountId,
				{
					external_account: DEVELOPMENT_HOST_ACCOUNT.verifiedBankToken,
				}
			);
		}
		await this.accounts.synchronize(account.stripeAccountId);
	}

	private async ensurePriceCard(
		machine: Machine,
		administratorId: string
	): Promise<void> {
		const listing = await this.listing(machine.id);
		if (listing.currentPriceCardId !== null) return;
		await this.entityManager.transactional((manager) =>
			this.priceCards.create(
				manager,
				machine.organizationId,
				machine.id,
				DEVELOPMENT_PRICE_CARD,
				administratorId
			)
		);
	}

	private async ensurePublicListing(machine: Machine): Promise<void> {
		const listing = await this.listing(machine.id);
		if (
			listing.state === ListingState.LISTED &&
			listing.visibility === ListingVisibility.PUBLIC
		) {
			return;
		}
		await this.listings.update(
			machine.organizationId,
			machine.id,
			listing.version,
			{
				state: ListingState.LISTED,
				visibility: ListingVisibility.PUBLIC,
			}
		);
	}

	private listing(machineId: string): Promise<MachineListing> {
		return this.entityManager.findOneOrFail(
			MachineListing,
			{ machineId },
			{ refresh: true }
		);
	}
}

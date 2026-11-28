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
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DeploymentEnvironment } from '../../config/enums/deployment-environment.enum';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/constants/legal-documents.constants';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineListing } from '../../marketplace/entities/machine-listing.entity';
import { ListingState } from '../../marketplace/enums/listing-state.enum';
import { ListingVisibility } from '../../marketplace/enums/listing-visibility.enum';
import { recordHostTermsAcceptance } from '../../marketplace/queries/host-terms.query';
import { MachineListingService } from '../../marketplace/services/machine-listing.service';
import { PriceCardService } from '../../marketplace/services/price-card.service';
import { PaymentWalletPurpose } from '../../settlement/enums/payment-wallet-purpose.enum';
import { PayoutReadiness } from '../../settlement/enums/payout-readiness.enum';
import { PayoutReadinessService } from '../../settlement/services/payouts/payout-readiness.service';
import { PaymentWalletService } from '../../settlement/services/wallets/payment-wallet.service';
import { UserService } from '../../user/services/user.service';
import { VerificationEvents } from '../../verification/constants/verification-events.constants';
import { BenchmarkPassedEvent } from '../../verification/events/benchmark-passed.event';
import { MachineTierService } from '../../verification/services/machine-tier.service';
import {
	DEVELOPMENT_HOST_RATES,
	DEVELOPMENT_PAYOUT_WALLET_ADDRESS,
	DEVELOPMENT_TIER_REASON,
} from '../constants/development-machine-seed.constants';

@Injectable()
export class DevelopmentMachineSeedService {
	private readonly logger = new Logger(DevelopmentMachineSeedService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly wallets: PaymentWalletService,
		private readonly payoutReadiness: PayoutReadinessService,
		private readonly config: TypedConfigService,
		private readonly users: UserService,
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
		await this.ensurePayoutWallet(machine.organizationId);
		await this.ensurePriceCard(machine, administrator.id);
		await recordHostTermsAcceptance(
			this.entityManager,
			machine.organizationId,
			administrator.id,
			LEGAL_DOCUMENT_VERSION.HOST_TERMS
		);
		await this.ensurePublicListing(machine);
		await this.tiers.updateAdminTier(machine.id, {
			tierCap: null,
			reason: DEVELOPMENT_TIER_REASON,
		});
	}

	private async ensurePayoutWallet(organizationId: string): Promise<void> {
		if (
			(await this.payoutReadiness.forOrganization(organizationId)) !==
			PayoutReadiness.NOT_SET_UP
		) {
			return;
		}
		await this.wallets.recordUnscreened(
			organizationId,
			PaymentWalletPurpose.PAYOUT,
			DEVELOPMENT_PAYOUT_WALLET_ADDRESS
		);
	}

	private async ensurePriceCard(
		machine: Machine,
		administratorId: string
	): Promise<void> {
		const listing = await this.listing(machine.id);
		if (listing.currentPriceCardId !== null) return;
		await this.entityManager.transactional(async (manager) => {
			await this.priceCards.create(
				manager,
				machine.organizationId,
				machine.id,
				{
					vcpuHourMicroUsd: DEVELOPMENT_HOST_RATES.vcpuHourMicroUsd,
					memoryGibHourMicroUsd: DEVELOPMENT_HOST_RATES.memoryGibHourMicroUsd,
					gpuHourMicroUsd:
						machine.gpuCount > 0
							? DEVELOPMENT_HOST_RATES.gpuHourMicroUsd
							: undefined,
					diskGibMonthMicroUsd: DEVELOPMENT_HOST_RATES.diskGibMonthMicroUsd,
				},
				administratorId
			);
		});
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

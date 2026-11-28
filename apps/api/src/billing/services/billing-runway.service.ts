/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { SettingsService } from '../../settings/services/settings.service';
import {
	type EscrowFunding,
	escrowFunding,
} from '../../settlement/queries/escrow-funding.query';
import { ChainClockService } from '../../settlement/services/escrow/chain-clock.service';
import { configuredEscrow } from '../../settlement/utils/escrow/escrow-identity.util';
import { FUNDING_POLICY } from '../constants/funding.constants';
import { OrganizationFunding } from '../entities/organization-funding.entity';
import { BillingRestriction } from '../enums/billing-restriction.enum';
import { BillingRestrictedException } from '../exceptions/billing-restricted.exception';
import {
	hourlyBurn,
	type SandboxBurn,
	sandboxBurn,
} from '../queries/price-burn.query';
import { storedBytes } from '../queries/stored-bytes.query';
import { coverageMicroUsd, runwaySeconds } from '../utils/funding/runway.util';
import { startFunded } from '../utils/placement/billing-capacity.util';
import { storageHourFee } from '../utils/storage-fee.util';

export interface OrganizationRunway {
	funding: EscrowFunding;
	placementPrices: SandboxBurn[];
	computeMicroUsdPerHour: MicroUsd;
	storageMicroUsdPerHour: MicroUsd;
	burnMicroUsdPerHour: MicroUsd;
	runwaySeconds: bigint | null;
}

@Injectable()
export class BillingRunwayService {
	constructor(
		private readonly settings: SettingsService,
		private readonly config: TypedConfigService,
		private readonly chainClock: ChainClockService
	) {}

	async runway(
		manager: EntityManager,
		organizationId: string
	): Promise<OrganizationRunway> {
		const funding = await escrowFunding(
			manager,
			configuredEscrow(this.config),
			organizationId,
			await this.chainClock.now()
		);
		const placementPrices = await sandboxBurn(manager, {
			customerOrganizationId: organizationId,
		});
		const computeMicroUsdPerHour = hourlyBurn(placementPrices);
		const storageMicroUsdPerHour = await this.storageBurn(
			manager,
			organizationId
		);
		const burnMicroUsdPerHour = computeMicroUsdPerHour.add(
			storageMicroUsdPerHour
		);
		return {
			funding,
			placementPrices,
			computeMicroUsdPerHour,
			storageMicroUsdPerHour,
			burnMicroUsdPerHour,
			runwaySeconds: runwaySeconds(
				funding.spendableMicroUsd,
				burnMicroUsdPerHour
			),
		};
	}

	async assertStartCovered(
		manager: EntityManager,
		organizationId: string,
		startingHourly: MicroUsd | null
	): Promise<void> {
		const restriction = await this.startRestriction(
			manager,
			organizationId,
			startingHourly
		);
		if (restriction) throw restriction;
	}

	async startRestriction(
		manager: EntityManager,
		organizationId: string,
		startingHourly: MicroUsd | null
	): Promise<BillingRestrictedException | null> {
		const runway = await this.runway(manager, organizationId);
		const required = this.startRequirement(
			runway,
			startingHourly ?? MicroUsd.ZERO
		);
		const available = runway.funding.spendableMicroUsd;
		if (
			startFunded({
				spendableMicroUsd: available,
				fundingWalletReady: runway.funding.walletReady,
				requiredMicroUsd: required,
				startingHourlyMicroUsd: startingHourly,
			})
		) {
			return null;
		}
		return new BillingRestrictedException(
			BillingRestriction.INSUFFICIENT_CREDIT,
			{ requiredMicroUsd: required, availableMicroUsd: available }
		);
	}

	startRequirement(
		runway: Pick<OrganizationRunway, 'burnMicroUsdPerHour'>,
		startingHourly: MicroUsd
	): MicroUsd {
		return coverageMicroUsd(
			runway.burnMicroUsdPerHour.add(startingHourly),
			FUNDING_POLICY.startCoverageSeconds
		);
	}

	private async storageBurn(
		manager: EntityManager,
		organizationId: string
	): Promise<MicroUsd> {
		const state = await manager.findOne(
			OrganizationFunding,
			{ organizationId },
			{ fields: ['computeStoppedAt'] }
		);
		if (state?.computeStoppedAt) return MicroUsd.ZERO;
		const [stored] = await storedBytes(manager, organizationId);
		if (!stored) return MicroUsd.ZERO;
		const { storageMicroUsdPerGibMonth } = await this.settings.get();
		return storageHourFee(
			stored.storedBytes,
			BigInt(storageMicroUsdPerGibMonth)
		);
	}
}

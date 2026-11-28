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
import { ConflictException, Injectable } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/constants/legal-documents.constants';
import { PayoutReadiness } from '../../settlement/enums/payout-readiness.enum';
import { PayoutReadinessService } from '../../settlement/services/payouts/payout-readiness.service';
import type { UpdateMachineListingDto } from '../dto/host-machine.dto';
import { MachineListing } from '../entities/machine-listing.entity';
import { MarketplaceErrorCode } from '../enums/marketplace-error-code.enum';
import { acceptedHostTermsVersion } from '../queries/host-terms.query';
import {
	listingTransitionError,
	nextListedSince,
} from '../utils/listings/listing-transition.util';
import { MachineMarketplaceService } from './machine-marketplace.service';

const LISTING_TRANSITION_MESSAGES: Partial<
	Record<MarketplaceErrorCode, string>
> = {
	[MarketplaceErrorCode.PRICE_CARD_REQUIRED]:
		'Set a machine price before listing the machine publicly',
	[MarketplaceErrorCode.PAYOUT_WALLET_REQUIRED]:
		'Link a payout wallet that passes sanctions screening before listing the machine publicly',
	[MarketplaceErrorCode.HOST_TERMS_REQUIRED]:
		'Accept the current host terms before listing the machine publicly',
	[MarketplaceErrorCode.MACHINE_RESTRICTED]:
		'A restricted machine cannot be listed publicly',
};

@Injectable()
export class MachineListingService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machines: MachineMarketplaceService,
		private readonly payoutReadiness: PayoutReadinessService
	) {}

	async update(
		organizationId: string,
		machineId: string,
		expectedVersion: number,
		input: UpdateMachineListingDto
	): Promise<MachineListing> {
		return this.entityManager.transactional(async (manager) => {
			const machine = await this.machines.findOwned(
				manager,
				organizationId,
				machineId,
				LockMode.PESSIMISTIC_WRITE
			);
			const locked = await manager.findOneOrFail(
				MachineListing,
				{ machineId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (locked.version !== expectedVersion) {
				throw new ConflictException({
					code: MarketplaceErrorCode.VERSION_CONFLICT,
					message: 'The listing was changed by another request',
					currentVersion: locked.version,
				});
			}
			const payouts = await this.payoutReadiness.forOrganization(
				organizationId,
				manager
			);
			const error = listingTransitionError(input, {
				currentState: locked.state,
				hasPriceCard: locked.currentPriceCardId !== null,
				payoutReady: payouts === PayoutReadiness.READY,
				hostTermsAccepted:
					(await acceptedHostTermsVersion(manager, organizationId)) ===
					LEGAL_DOCUMENT_VERSION.HOST_TERMS,
				restricted: machine.restrictedAt !== null,
			});
			if (error !== null) {
				throw new ConflictException({
					code: error,
					message:
						LISTING_TRANSITION_MESSAGES[error] ??
						'The listing cannot move to the requested state',
				});
			}
			machine.listedSince = nextListedSince(
				input,
				machine.listedSince,
				await databaseNow(manager)
			);
			locked.state = input.state;
			locked.visibility = input.visibility;
			if (input.gpuOnly !== undefined) locked.gpuOnly = input.gpuOnly;
			if (input.interruptibleEnabled !== undefined) {
				locked.interruptibleEnabled = input.interruptibleEnabled;
			}
			if (input.monthlyTrafficCapGb !== undefined) {
				locked.monthlyTrafficCapGb = input.monthlyTrafficCapGb;
			}
			return locked;
		});
	}
}

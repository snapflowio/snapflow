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
import type { Address } from 'viem';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import { configuredEscrow } from '../utils/escrow-identity.util';
import { lockEscrow } from '../utils/escrow-lock.util';
import { EscrowLedgerService } from './escrow-ledger.service';

@Injectable()
export class EscrowAttributionService {
	constructor(
		private readonly config: TypedConfigService,
		private readonly ledger: EscrowLedgerService
	) {}

	// Gives an organization the escrow events its newly linked wallet took part
	// in before anyone linked it, and posts those that can now be posted. Events
	// already attributed keep their organization, so relinking or unlinking a
	// wallet never moves or repeats a posting.
	async attributeWallet(
		manager: EntityManager,
		organizationId: string,
		purpose: PaymentWalletPurpose,
		address: Address
	): Promise<void> {
		const escrow = configuredEscrow(this.config);
		await lockEscrow(manager, escrow);
		if (purpose === PaymentWalletPurpose.FUNDING) {
			const events = await manager.find(EscrowEvent, {
				...escrow,
				customerAddress: address,
				customerOrganizationId: null,
			});
			for (const event of events) event.customerOrganizationId = organizationId;
			await this.ledger.postAttributed(manager, events);
			return;
		}
		const events = await manager.find(EscrowEvent, {
			...escrow,
			hostAddress: address,
			hostOrganizationId: null,
		});
		for (const event of events) event.hostOrganizationId = organizationId;
		await this.ledger.postAttributed(manager, events);
	}
}

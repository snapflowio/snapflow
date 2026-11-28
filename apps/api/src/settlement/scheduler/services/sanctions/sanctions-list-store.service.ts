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
import { Injectable } from '@nestjs/common';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import {
	SANCTIONS_LIST_SYNC_ID,
	SanctionsPendingAlertKind,
} from '../../../constants/sanctions.constants';
import { SanctionedAddress } from '../../../entities/sanctioned-address.entity';
import { SanctionsListSync } from '../../../entities/sanctions-list-sync.entity';
import { SanctionsPendingAlert } from '../../../entities/sanctions-pending-alert.entity';
import { PaymentWalletPurpose } from '../../../enums/payment-wallet-purpose.enum';
import {
	blockedPaymentWallets,
	rescreenPaymentWallets,
} from '../../../queries/sanctions-screening.query';
import { SettlementWakeService } from '../../../services/settlement-wake.service';
import type {
	SanctionsListChanges,
	ScreenedPaymentWallet,
	SdnPublication,
} from '../../../types/sanctions.types';
import { diffSanctionedAddresses } from '../../../utils/sanctions/sanctioned-address-diff.util';
import { assertPublicationSupersedes } from '../../../utils/sanctions/sdn-publication.util';

function queuePendingAlerts(
	manager: EntityManager,
	kind: SanctionsPendingAlertKind,
	wallets: readonly ScreenedPaymentWallet[]
): void {
	for (const { id, organizationId, purpose, address } of wallets) {
		manager.create(SanctionsPendingAlert, {
			kind,
			paymentWalletId: id,
			organizationId,
			purpose,
			address,
		});
	}
}

@Injectable()
export class SanctionsListStoreService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly wakes: SettlementWakeService
	) {}

	store(publication: SdnPublication): Promise<SanctionsListChanges> {
		return this.entityManager.fork().transactional(async (manager) => {
			const now = await databaseNow(manager);
			const sync = await manager.findOne(
				SanctionsListSync,
				{ id: SANCTIONS_LIST_SYNC_ID },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			assertPublicationSupersedes(publication, sync);
			const { added, removed } = await this.replaceAddresses(
				manager,
				publication,
				now
			);
			const state = {
				publishedAt: publication.publishedAt,
				recordCount: publication.recordCount,
				addressCount: publication.addresses.length,
				syncedAt: now,
			};
			if (sync) manager.assign(sync, state);
			else manager.create(SanctionsListSync, state);
			await manager.flush();
			const blocked = await rescreenPaymentWallets(manager);
			await this.wakePayoutOrganizations(manager, blocked);
			const delisted = await blockedPaymentWallets(manager, removed);
			queuePendingAlerts(manager, SanctionsPendingAlertKind.MATCH, blocked);
			queuePendingAlerts(manager, SanctionsPendingAlertKind.DELISTED, delisted);
			return { added, removed, blocked, delisted };
		});
	}

	private async replaceAddresses(
		manager: EntityManager,
		publication: SdnPublication,
		listedAt: Date
	): Promise<Pick<SanctionsListChanges, 'added' | 'removed'>> {
		const stored = await manager.find(SanctionedAddress, {});
		const diff = diffSanctionedAddresses(stored, publication.addresses);
		for (const listed of diff.added) {
			manager.create(SanctionedAddress, { ...listed, listedAt });
		}
		for (const [entry, listed] of diff.changed) {
			manager.assign(entry, {
				sdnEntryUid: listed.sdnEntryUid,
				entityName: listed.entityName,
				currency: listed.currency,
			});
		}
		for (const entry of diff.removed) manager.remove(entry);
		return {
			added: diff.added.length,
			removed: diff.removed.map(({ address }) => address),
		};
	}

	private async wakePayoutOrganizations(
		manager: EntityManager,
		wallets: readonly ScreenedPaymentWallet[]
	): Promise<void> {
		const organizationIds = new Set(
			wallets
				.filter(({ purpose }) => purpose === PaymentWalletPurpose.PAYOUT)
				.map(({ organizationId }) => organizationId)
		);
		for (const organizationId of organizationIds) {
			await this.wakes.wakeOrganizationMachines(manager, organizationId);
		}
	}
}

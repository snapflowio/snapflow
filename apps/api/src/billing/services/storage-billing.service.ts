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
import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SettingsService } from '../../settings/services/settings.service';
import { STORAGE_BACKFILL_HOURS } from '../constants/billing.constants';
import { OrganizationFunding } from '../entities/organization-funding.entity';
import { StorageCharge } from '../entities/storage-charge.entity';
import { lastStorageChargeHours } from '../queries/storage-charge.query';
import { storedBytes } from '../queries/stored-bytes.query';
import { storagePosting } from '../utils/ledger/billing-storage-posting.util';
import { storageHourFee, utcHourStart } from '../utils/storage-fee.util';
import { BillingLedgerService } from './ledger/billing-ledger.service';

function dueHours(lastCharged: Date | undefined, currentHour: Date): Date[] {
	const earliest =
		currentHour.getTime() - STORAGE_BACKFILL_HOURS * MILLISECONDS_PER_HOUR;
	const first = lastCharged
		? Math.max(lastCharged.getTime() + MILLISECONDS_PER_HOUR, earliest)
		: currentHour.getTime();
	const hours: Date[] = [];
	for (
		let hour = first;
		hour <= currentHour.getTime();
		hour += MILLISECONDS_PER_HOUR
	) {
		hours.push(new Date(hour));
	}
	return hours;
}

@Injectable()
export class StorageBillingService {
	constructor(
		private readonly settings: SettingsService,
		private readonly ledger: BillingLedgerService
	) {}

	async chargeDueHours(manager: EntityManager): Promise<void> {
		const currentHour = utcHourStart(await databaseNow(manager));
		const stopped = new Set(
			(
				await manager.find(
					OrganizationFunding,
					{ computeStoppedAt: { $ne: null } },
					{ fields: ['organizationId'] }
				)
			).map(({ organizationId }) => organizationId)
		);
		const stored = (await storedBytes(manager)).filter(
			({ organizationId }) => !stopped.has(organizationId)
		);
		if (stored.length === 0) return;
		const lastCharged = await lastStorageChargeHours(
			manager,
			stored.map(({ organizationId }) => organizationId)
		);
		const rate = BigInt((await this.settings.get()).storageMicroUsdPerGibMonth);
		const charges = stored.flatMap((organization) => {
			const amountMicroUsd = storageHourFee(
				organization.storedBytes,
				rate
			).toString();
			return dueHours(
				lastCharged.get(organization.organizationId),
				currentHour
			).map((serviceHour) =>
				manager.create(StorageCharge, {
					organizationId: organization.organizationId,
					serviceHour,
					storedBytes: organization.storedBytes.toString(),
					amountMicroUsd,
				})
			);
		});
		if (charges.length === 0) return;
		await manager.flush();
		for (const charge of charges) {
			if (BigInt(charge.amountMicroUsd) === 0n) continue;
			await this.ledger.post(manager, storagePosting(charge));
		}
	}
}

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
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { Machine } from '../../machine/entities/machine.entity';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { Organization } from '../../organization/entities/organization.entity';
import { MachineListing } from '../entities/machine-listing.entity';
import { MachinePriceCard } from '../entities/machine-price-card.entity';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MachineCategory } from '../enums/machine-category.enum';
import { MachineTier } from '../enums/machine-tier.enum';
import { similarListingPrices } from './price-hint.query';

const DATABASE_URL = integrationDatabaseUrl();
const SIMILAR_LISTINGS = 10;
const VCPU_RATE_STEP = 1_000;
const FLAT_RATE = '2000';

interface ListedMachine {
	category: MachineCategory;
	gpuType: GpuType | null;
	tier: MachineTier;
	visibility: ListingVisibility;
	vcpuHourMicroUsd: number;
}

const GENERAL_PUBLIC: Omit<ListedMachine, 'vcpuHourMicroUsd'> = {
	category: MachineCategory.GENERAL,
	gpuType: null,
	tier: MachineTier.COMMUNITY,
	visibility: ListingVisibility.PUBLIC,
};

describe('similar listing prices', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	const schema = `price_hint_${randomUUID().replaceAll('-', '')}`;
	const organizationId = randomUUID();
	let orm: MikroORM;
	let own: Machine;

	async function list(
		manager: EntityManager,
		listed: ListedMachine
	): Promise<Machine> {
		const machine = Object.assign(
			new Machine({
				name: `price-hint-${randomUUID()}`,
				apiVersion: '1',
				organizationId,
			}),
			{
				category: listed.category,
				gpuType: listed.gpuType,
				gpuCount: listed.gpuType ? 1 : 0,
				tier: listed.tier,
			}
		);
		manager.persist(machine);
		await manager.flush();
		const card = manager.create(MachinePriceCard, {
			id: randomUUID(),
			machineId: machine.id,
			organizationId,
			version: 1,
			vcpuHourMicroUsd: String(listed.vcpuHourMicroUsd),
			memoryGibHourMicroUsd: FLAT_RATE,
			gpuHourMicroUsd: FLAT_RATE,
			diskGibMonthMicroUsd: FLAT_RATE,
			stoppedDiskGibMonthMicroUsd: FLAT_RATE,
			egressMicroUsdPerGiB: FLAT_RATE,
			referencePriceMicroUsd: FLAT_RATE,
			floorMicroUsd: FLAT_RATE,
			egressCeilingMicroUsdPerGiB: FLAT_RATE,
			createdAt: new Date(),
		});
		await manager.flush();
		manager.persist(
			Object.assign(new MachineListing(), {
				machineId: machine.id,
				state: ListingState.LISTED,
				visibility: listed.visibility,
				currentPriceCardId: card.id,
			})
		);
		await manager.flush();
		return machine;
	}

	before(async () => {
		if (!DATABASE_URL) return;
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [Organization, Machine, MachinePriceCard, MachineListing],
			driverOptions: { options: `-c search_path=${schema}` },
		});
		await orm.em.getConnection().execute(`CREATE SCHEMA ${schema}`);
		await orm.schema.create();
		const manager = orm.em.fork();
		manager.create(
			Organization,
			{ id: organizationId, name: organizationId, slug: organizationId },
			{ partial: true }
		);
		await manager.flush();
		for (let index = 1; index <= SIMILAR_LISTINGS; index += 1) {
			await list(manager, {
				...GENERAL_PUBLIC,
				vcpuHourMicroUsd: index * VCPU_RATE_STEP,
			});
		}
		own = await list(manager, { ...GENERAL_PUBLIC, vcpuHourMicroUsd: 1 });
		await list(manager, {
			...GENERAL_PUBLIC,
			visibility: ListingVisibility.PRIVATE,
			vcpuHourMicroUsd: 1,
		});
		await list(manager, {
			...GENERAL_PUBLIC,
			tier: MachineTier.PRIVATE,
			vcpuHourMicroUsd: 1,
		});
		await list(manager, {
			...GENERAL_PUBLIC,
			category: MachineCategory.HIGH_MEMORY,
			vcpuHourMicroUsd: 1,
		});
		await list(manager, {
			...GENERAL_PUBLIC,
			category: MachineCategory.GPU,
			gpuType: GpuType.H100,
			vcpuHourMicroUsd: 1,
		});
	});

	after(async () => {
		if (!orm) return;
		await orm.em.getConnection().execute(`DROP SCHEMA ${schema} CASCADE`);
		await orm.close(true);
	});

	it('spans the 10th to 90th percentile of rentable listings of the class', async () => {
		const prices = await similarListingPrices(orm.em.fork(), {
			id: own.id,
			category: MachineCategory.GENERAL,
			gpuType: null,
		});
		assert.equal(prices.listings, SIMILAR_LISTINGS);
		assert.equal(prices.vcpu_hour_low, String(VCPU_RATE_STEP));
		assert.equal(prices.vcpu_hour_high, String(9 * VCPU_RATE_STEP));
		assert.equal(prices.egress_gib_low, FLAT_RATE);
	});

	it('keeps GPU models apart and reports no range without listings', async () => {
		const prices = await similarListingPrices(orm.em.fork(), {
			id: randomUUID(),
			category: MachineCategory.GPU,
			gpuType: GpuType.RTX_PRO_6000,
		});
		assert.equal(prices.listings, 0);
		assert.equal(prices.vcpu_hour_low, null);
	});
});

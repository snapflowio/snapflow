/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { SandboxPlacement } from '../../../../sandbox/instance/entities/sandbox-placement.entity';
import {
	SYSTEM_EXPOSURE_SERVICE,
	type SystemExposureService,
} from '../../constants/exposure.constants';
import {
	findServingPlacement,
	systemExposureNeedsRuntime,
} from './exposure-serving-placement.util';

const SANDBOX_ID = 'sandbox-1';
const ACTIVE_PLACEMENT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';
const BUILD_PLACEMENT_ID = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e';
const BUILD_MACHINE_ID = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f';

function placement(id: string, releasedAt: Date | null): SandboxPlacement {
	return Object.assign(new SandboxPlacement(), {
		id,
		sandboxId: SANDBOX_ID,
		machineId: BUILD_MACHINE_ID,
		releasedAt,
	});
}

class PlacementLookup {
	readonly filters: Record<string, unknown>[] = [];

	constructor(
		private readonly active: SandboxPlacement | null,
		private readonly latest: SandboxPlacement | null
	) {}

	async findOne(
		entity: unknown,
		filter: Record<string, unknown>
	): Promise<SandboxPlacement | null> {
		assert.equal(entity, SandboxPlacement);
		this.filters.push(filter);
		return 'releasedAt' in filter ? this.active : this.latest;
	}

	private readonly entityManager = fakeInstance(EntityManager, {
		findOne: this.findOne.bind(this),
	});

	asEntityManager(): EntityManager {
		return this.entityManager;
	}
}

function exposureFor(systemService: SystemExposureService | null) {
	return { sandboxId: SANDBOX_ID, systemService };
}

describe('findServingPlacement', () => {
	it('routes through the active placement whenever one exists', async () => {
		const lookup = new PlacementLookup(
			placement(ACTIVE_PLACEMENT_ID, null),
			placement(BUILD_PLACEMENT_ID, new Date())
		);

		const selected = await findServingPlacement(
			lookup.asEntityManager(),
			exposureFor(SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS)
		);

		assert.equal(selected?.id, ACTIVE_PLACEMENT_ID);
		assert.equal(lookup.filters.length, 1);
	});

	it('routes failed-build logs to the Machine of the released build placement', async () => {
		const lookup = new PlacementLookup(
			null,
			placement(BUILD_PLACEMENT_ID, new Date())
		);

		const selected = await findServingPlacement(
			lookup.asEntityManager(),
			exposureFor(SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS)
		);

		assert.equal(selected?.id, BUILD_PLACEMENT_ID);
		assert.equal(selected?.machineId, BUILD_MACHINE_ID);
	});

	it('never routes runtime services through a released placement', async () => {
		for (const service of [
			SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
			SYSTEM_EXPOSURE_SERVICE.TERMINAL,
			SYSTEM_EXPOSURE_SERVICE.SSH,
			null,
		]) {
			const lookup = new PlacementLookup(
				null,
				placement(BUILD_PLACEMENT_ID, new Date())
			);

			const selected = await findServingPlacement(
				lookup.asEntityManager(),
				exposureFor(service)
			);

			assert.equal(selected, null, `service ${service}`);
			assert.equal(systemExposureNeedsRuntime(service), true);
		}
	});
});

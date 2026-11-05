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
import { MikroORM } from '@mikro-orm/postgresql';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import { Organization } from '../../../organization/entities/organization.entity';
import { User } from '../../../user/entities/user.entity';
import { MachineBenchmark } from '../../../verification/entities/machine-benchmark.entity';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxLastActivity } from '../../entities/sandbox-last-activity.entity';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { Machine } from '../../machine/entities/machine.entity';
import { applyPlacement } from '../../placement/utils/sandbox-placement.util';
import { BuildInfo } from '../../snapshot/entities/build-info.entity';
import { SandboxService } from './sandbox.service';

const DATABASE_URL = integrationDatabaseUrl();
const OS_USER = 'snapflow';

interface PinColumns {
	placementKind: string;
	pinnedMachineId: string | null;
}

describe('sandbox lookups on a pinned sandbox', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	const organizationId = randomUUID();
	const machine = new Machine({
		name: `pinned-${randomUUID()}`,
		apiVersion: '1',
		organizationId,
	});
	const sandbox = Object.assign(new Sandbox({}), {
		organizationId,
		mode: SandboxMode.STANDARD,
		osUser: OS_USER,
		state: SandboxState.STOPPED,
		machineId: machine.id,
	});
	applyPlacement(sandbox, {
		request: { kind: PlacementKind.PINNED, machineId: machine.id },
	});

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				Organization,
				User,
				Machine,
				MachineBenchmark,
				Sandbox,
				SandboxLastActivity,
				BuildInfo,
			],
		});
		const manager = orm.em.fork();
		await manager.execute(
			'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
			[organizationId, organizationId, organizationId]
		);
		manager.persist(machine);
		await manager.flush();
		manager.persist(sandbox);
		await manager.flush();
	});

	after(async () => {
		if (!orm) return;
		const manager = orm.em.fork();
		await manager.nativeDelete(Sandbox, { id: sandbox.id });
		await manager.nativeDelete(Machine, { id: machine.id });
		await manager.execute('DELETE FROM organization WHERE id = ?', [
			organizationId,
		]);
		await orm.close(true);
	});

	async function pinColumns(): Promise<PinColumns[]> {
		return orm.em
			.fork()
			.execute<PinColumns[]>(
				'SELECT "placementKind", "pinnedMachineId" FROM sandbox WHERE id = ?',
				[sandbox.id]
			);
	}

	it('resolves the organization without managing a partially loaded sandbox', async () => {
		const manager = orm.em.fork();
		const service = new SandboxService(manager);

		assert.equal(
			await service.getOrganizationId(sandbox.id, organizationId),
			organizationId
		);
		assert.equal(
			manager.getUnitOfWork().getById(Sandbox, sandbox.id),
			undefined
		);
	});

	it('keeps the pinned machine of a loaded sandbox around organization lookups', async () => {
		const manager = orm.em.fork();
		const service = new SandboxService(manager);

		await service.getOrganizationId(sandbox.id, organizationId);
		const loaded = await service.findOneByIdOrName(sandbox.id, organizationId);
		await service.getOrganizationId(sandbox.id, organizationId);
		loaded.state = SandboxState.SNAPSHOTTING;
		await manager.flush();

		assert.deepEqual(await pinColumns(), [
			{ placementKind: PlacementKind.PINNED, pinnedMachineId: machine.id },
		]);
	});
});

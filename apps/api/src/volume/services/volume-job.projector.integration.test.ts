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
import {
	MikroORM,
	UniqueConstraintViolationException,
} from '@mikro-orm/postgresql';
import { fakeInstance } from '../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { Job } from '../../machine-job/entities/job.entity';
import { JobStatus } from '../../machine-job/enums/job-status.enum';
import { JobType } from '../../machine-job/enums/job-type.enum';
import { JobService } from '../../machine-job/services/job.service';
import { Organization } from '../../organization/entities/organization.entity';
import { Volume } from '../entities/volume.entity';
import { VolumeState } from '../enums/volume-state.enum';
import { VolumeManager } from '../managers/volume.manager';
import { VolumeBackupService } from './volume-backup.service';
import { VolumeJobProjector } from './volume-job.projector';

const DATABASE_URL = integrationDatabaseUrl();
const VOLUME_NAME = 'data';
const SUFFIXED_NAME = 'data-deleted';

describe('volume deletion', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	const schema = `volume_deletion_${randomUUID().replaceAll('-', '')}`;
	const organizationId = randomUUID();
	let orm: MikroORM;

	async function persistVolume(
		name: string,
		state: VolumeState,
		homeMachineId: string | null = randomUUID()
	): Promise<Volume> {
		const manager = orm.em.fork();
		const volume = manager.create(
			Volume,
			{
				id: randomUUID(),
				organizationId,
				name,
				state,
				homeMachineId,
			},
			{ partial: true }
		);
		await manager.persist(volume).flush();
		return volume;
	}

	async function completeDeletion(volume: Volume): Promise<Volume> {
		const manager = orm.em.fork();
		const job = Object.assign(new Job(), {
			id: randomUUID(),
			type: JobType.DELETE_VOLUME,
			status: JobStatus.COMPLETED,
			resourceId: volume.id,
		});
		await new VolumeJobProjector(
			manager,
			fakeInstance(VolumeBackupService)
		).projectDelete(job);
		return orm.em.fork().findOneOrFail(Volume, { id: volume.id });
	}

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [Organization, Volume],
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
	});

	after(async () => {
		if (!orm) return;
		await orm.em.getConnection().execute(`DROP SCHEMA ${schema} CASCADE`);
		await orm.close(true);
	});

	it('deletes a volume while a live volume holds the old suffixed name', async () => {
		const suffixed = await persistVolume(SUFFIXED_NAME, VolumeState.READY);
		const deleting = await persistVolume(VOLUME_NAME, VolumeState.DELETING);

		const deleted = await completeDeletion(deleting);

		assert.equal(deleted.state, VolumeState.DELETED);
		assert.equal(deleted.name, VOLUME_NAME);
		const untouched = await orm.em
			.fork()
			.findOneOrFail(Volume, { id: suffixed.id });
		assert.equal(untouched.state, VolumeState.READY);
	});

	it('keeps every deleted generation of a reused name', async () => {
		const recreated = await persistVolume(VOLUME_NAME, VolumeState.DELETING);
		await completeDeletion(recreated);

		const deletedRows = await orm.em.fork().count(Volume, {
			organizationId,
			name: VOLUME_NAME,
			state: VolumeState.DELETED,
		});
		assert.equal(deletedRows, 2);
	});

	it('marks a volume without a home machine deleted without a job', async () => {
		const pending = await persistVolume(
			VOLUME_NAME,
			VolumeState.PENDING_DELETE,
			null
		);
		const manager = new VolumeManager(
			orm.em.fork(),
			fakeInstance(JobService),
			fakeInstance(RedisLockProvider)
		);

		await manager.scheduleDeletion(pending.id);

		const deleted = await orm.em
			.fork()
			.findOneOrFail(Volume, { id: pending.id });
		assert.equal(deleted.state, VolumeState.DELETED);
		assert.equal(deleted.name, VOLUME_NAME);
	});

	it('still rejects two live volumes with the same name', async () => {
		await persistVolume(VOLUME_NAME, VolumeState.READY);
		await assert.rejects(
			persistVolume(VOLUME_NAME, VolumeState.READY),
			UniqueConstraintViolationException
		);
	});
});

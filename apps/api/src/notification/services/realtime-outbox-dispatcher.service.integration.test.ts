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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { integrationDatabaseUrl } from '../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../infra/database/config/entity-mapping.config';
import { Machine } from '../../machine/entities/machine.entity';
import { RealtimeOutboxSubscriber } from '../../sandbox/subscribers/realtime-outbox.subscriber';
import { VolumeEvents } from '../../volume/constants/volume-events.constants';
import { Volume } from '../../volume/entities/volume.entity';
import { VolumeBackupState } from '../../volume/enums/volume-backup-state.enum';
import { VolumeState } from '../../volume/enums/volume-state.enum';
import type { VolumeCreatedEvent } from '../../volume/events/volume-created.event';
import {
	REALTIME_OUTBOX,
	RealtimeOutboxStatus,
} from '../constants/realtime-outbox.constants';
import { RealtimeOutboxEvent } from '../entities/realtime-outbox-event.entity';
import { RealtimeOutboxDispatcherService } from './realtime-outbox-dispatcher.service';

const DATABASE_URL = integrationDatabaseUrl();
const ENTITIES = [RealtimeOutboxEvent, Machine, Volume];

describe('transactional realtime outbox', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	const schema = `realtime_outbox_${randomUUID().replaceAll('-', '')}`;
	let orm: MikroORM;
	let committedAggregateId: string;

	async function persistOutboxEvent(
		payload: Record<string, unknown> & { topic: string },
		options: { attempts?: number; status?: RealtimeOutboxStatus } = {}
	): Promise<RealtimeOutboxEvent> {
		const aggregateId = randomUUID();
		const event = new RealtimeOutboxEvent(payload, aggregateId);
		event.attempts = options.attempts ?? event.attempts;
		event.status = options.status ?? event.status;
		const manager = orm.em.fork();
		manager.persist(event);
		await manager.flush();
		return event;
	}

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: ENTITIES,
			driverOptions: { options: `-c search_path=${schema}` },
		});
		await orm.em.getConnection().execute(`CREATE SCHEMA ${schema}`);
		await orm.schema.create();
		const [resolved] = await orm.em
			.getConnection()
			.execute<{ schema: string }[]>(
				`SELECT n.nspname AS schema FROM pg_class c
				 JOIN pg_namespace n ON n.oid = c.relnamespace
				 WHERE c.oid = 'realtime_outbox_event'::regclass`
			);
		assert.equal(resolved?.schema, schema, 'tables resolve to the test schema');
		new RealtimeOutboxSubscriber(orm.em);
	});

	after(async () => {
		if (!orm) return;
		await orm.em.getConnection().execute(`DROP SCHEMA ${schema} CASCADE`);
		await orm.close(true);
	});

	it('persists a sanitized volume event in the same unit of work', async () => {
		const id = randomUUID();
		committedAggregateId = id;
		const manager = orm.em.fork();

		await manager.transactional(async (transaction) => {
			const now = new Date();
			transaction.persist(
				transaction.create(Volume, {
					id,
					userId: null,
					name: `outbox-${id}`,
					sizeGiB: 10,
					filesystem: 'ext4',
					generation: 1,
					attachmentGeneration: 0,
					backupState: VolumeBackupState.NONE,
					state: VolumeState.READY,
					createdAt: now,
					updatedAt: now,
				})
			);
		});

		const event = await manager.findOne(RealtimeOutboxEvent, {
			aggregateId: id,
		});
		assert.ok(event);
		assert.equal(event.status, RealtimeOutboxStatus.PENDING);
		assert.equal(event.attempts, 0);
		assert.ok('topic' in event.payload);
		assert.equal(event.payload.topic, VolumeEvents.CREATED);
		assert.ok('volume' in event.payload);
		assert.ok(
			typeof event.payload.volume === 'object' && event.payload.volume !== null
		);
		assert.ok('id' in event.payload.volume);
		assert.equal(event.payload.volume.id, id);
	});

	it('assigns a Machine ID before creating its transactional outbox event', async () => {
		const manager = orm.em.fork();
		const organizationId = randomUUID();
		await manager.execute(
			'INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)',
			[organizationId, `outbox-${organizationId}`, organizationId]
		);
		const machine = new Machine({
			name: `outbox-${randomUUID()}`,
			apiVersion: '1',
			organizationId,
		});

		await manager.transactional(async (transaction) => {
			transaction.persist(machine);
		});

		assert.match(machine.id, /^[0-9a-f-]{36}$/);
		assert.ok(
			await manager.findOne(RealtimeOutboxEvent, {
				aggregateId: machine.id,
			})
		);
	});

	it('captures managed volume state and last-used updates in the same flush', async () => {
		const id = randomUUID();
		const manager = orm.em.fork();
		const now = new Date();
		manager.persist(
			manager.create(Volume, {
				id,
				userId: null,
				name: `outbox-update-${id}`,
				sizeGiB: 10,
				filesystem: 'ext4',
				generation: 1,
				attachmentGeneration: 0,
				backupState: VolumeBackupState.NONE,
				state: VolumeState.PENDING_DELETE,
				createdAt: now,
				updatedAt: now,
			})
		);
		await manager.flush();

		const volume = await manager.findOneOrFail(Volume, { id });
		volume.state = VolumeState.ERROR;
		volume.lastUsedAt = new Date(now.getTime() + 1_000);
		await manager.flush();

		const events = await manager.find(RealtimeOutboxEvent, {
			aggregateId: id,
		});
		const topics = events.flatMap((event) =>
			'topic' in event.payload && typeof event.payload.topic === 'string'
				? [event.payload.topic]
				: []
		);
		assert.ok(topics.includes(VolumeEvents.STATE_UPDATED));
		assert.ok(topics.includes(VolumeEvents.LAST_USED_AT_UPDATED));
	});

	it('claims and publishes committed records through the existing event topic', async () => {
		const eventEmitter = new EventEmitter2();
		const publishedVolumeIds = new Set<string>();
		eventEmitter.on(VolumeEvents.CREATED, (event: VolumeCreatedEvent) => {
			publishedVolumeIds.add(event.volume.id);
		});
		const dispatcher = new RealtimeOutboxDispatcherService(
			orm.em,
			eventEmitter
		);

		await dispatcher.dispatch();

		const event = await orm.em.fork().findOneOrFail(RealtimeOutboxEvent, {
			aggregateId: committedAggregateId,
		});
		assert.ok(publishedVolumeIds.has(committedAggregateId));
		assert.equal(event.status, RealtimeOutboxStatus.PUBLISHED);
		assert.equal(event.attempts, 1);
		assert.ok(event.publishedAt);
	});

	it('rolls the event back when the state transaction fails', async () => {
		const id = randomUUID();
		const manager = orm.em.fork();

		await assert.rejects(
			manager.transactional(async (transaction) => {
				const now = new Date();
				transaction.persist(
					transaction.create(Volume, {
						id,
						userId: null,
						name: `outbox-rollback-${id}`,
						sizeGiB: 10,
						filesystem: 'ext4',
						generation: 1,
						attachmentGeneration: 0,
						backupState: VolumeBackupState.NONE,
						state: VolumeState.READY,
						createdAt: now,
						updatedAt: now,
					})
				);
				await transaction.flush();
				throw new Error('rollback requested');
			})
		);

		assert.equal(
			await manager.count(RealtimeOutboxEvent, { aggregateId: id }),
			0
		);
	});

	it('releases a failed delivery for bounded retry with useful diagnostics', async () => {
		const source = await persistOutboxEvent({
			topic: VolumeEvents.CREATED,
			volume: { id: randomUUID() },
		});
		const eventEmitter = new EventEmitter2();
		eventEmitter.on(VolumeEvents.CREATED, () => {
			throw new Error('notification transport unavailable');
		});

		await new RealtimeOutboxDispatcherService(orm.em, eventEmitter).dispatch();

		const event = await orm.em.fork().findOneOrFail(RealtimeOutboxEvent, {
			id: source.id,
		});
		assert.equal(event.status, RealtimeOutboxStatus.PENDING);
		assert.equal(event.attempts, 1);
		assert.equal(event.lockId, null);
		assert.equal(event.lockedUntil, null);
		assert.match(event.lastError ?? '', /notification transport unavailable/);
		assert.ok(event.availableAt > source.createdAt);
	});

	it('marks poison events failed after the bounded attempt budget', async () => {
		const source = await persistOutboxEvent(
			{ topic: 'unsupported.realtime.topic' },
			{ attempts: REALTIME_OUTBOX.maximumAttempts - 1 }
		);

		await new RealtimeOutboxDispatcherService(
			orm.em,
			new EventEmitter2()
		).dispatch();

		const event = await orm.em.fork().findOneOrFail(RealtimeOutboxEvent, {
			id: source.id,
		});
		assert.equal(event.status, RealtimeOutboxStatus.FAILED);
		assert.equal(event.attempts, REALTIME_OUTBOX.maximumAttempts);
		assert.match(event.lastError ?? '', /Unsupported realtime outbox topic/);
	});

	it('recovers an event whose worker lease expired', async () => {
		const source = await persistOutboxEvent(
			{
				topic: VolumeEvents.CREATED,
				volume: { id: randomUUID() },
			},
			{ status: RealtimeOutboxStatus.PROCESSING }
		);
		await orm.em.fork().nativeUpdate(
			RealtimeOutboxEvent,
			{ id: source.id },
			{
				lockId: randomUUID(),
				lockedUntil: new Date(0),
			}
		);
		let publications = 0;
		const eventEmitter = new EventEmitter2();
		eventEmitter.on(VolumeEvents.CREATED, () => {
			publications += 1;
		});

		await new RealtimeOutboxDispatcherService(orm.em, eventEmitter).dispatch();

		const event = await orm.em.fork().findOneOrFail(RealtimeOutboxEvent, {
			id: source.id,
		});
		assert.equal(publications, 1);
		assert.equal(event.status, RealtimeOutboxStatus.PUBLISHED);
		assert.equal(event.attempts, 1);
	});

	it('allows only one concurrent worker to claim an event', async () => {
		const source = await persistOutboxEvent({
			topic: VolumeEvents.CREATED,
			volume: { id: randomUUID() },
		});
		let publications = 0;
		const createDispatcher = () => {
			const eventEmitter = new EventEmitter2();
			eventEmitter.on(VolumeEvents.CREATED, () => {
				publications += 1;
			});
			return new RealtimeOutboxDispatcherService(orm.em, eventEmitter);
		};

		await Promise.all([
			createDispatcher().dispatch(),
			createDispatcher().dispatch(),
		]);

		const event = await orm.em.fork().findOneOrFail(RealtimeOutboxEvent, {
			id: source.id,
		});
		assert.equal(publications, 1);
		assert.equal(event.status, RealtimeOutboxStatus.PUBLISHED);

		await createDispatcher().dispatch();
		assert.equal(publications, 1);
	});
});

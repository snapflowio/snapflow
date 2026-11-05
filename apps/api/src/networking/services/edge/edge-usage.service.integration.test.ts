/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { MikroORM } from '@mikro-orm/postgresql';
import { ConflictException, GoneException } from '@nestjs/common';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { MachinePlatformObservationService } from '../../../machine/services/machine-platform-observation.service';
import { ExposureNetworkUsage } from '../../../network-usage/entities/exposure-network-usage.entity';
import { NetworkUsagePeriod } from '../../../network-usage/entities/network-usage-period.entity';
import { NetworkUsageService } from '../../../network-usage/services/network-usage.service';
import type {
	EdgeUsageCheckpointAcknowledgementDto,
	EdgeUsageCheckpointDto,
} from '../../dto/edge-usage.dto';
import { Edge } from '../../entities/edge.entity';
import { EdgeUsageCheckpoint } from '../../entities/edge-usage-checkpoint.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import {
	deleteNetworkingFixture,
	fixtureEdgeSession,
	fixtureMaterializer,
	inertWakes,
	NETWORKING_FIXTURE_ENTITIES,
	networkingFixture,
	seedNetworkingFixture,
} from '../../testing/networking-database.fixtures';
import {
	edgeUsageDigest,
	edgeUsageSignaturePayload,
} from '../../utils/edge/edge-usage.util';
import { EdgeActivityService } from './edge-activity.service';
import { EdgeSessionService } from './edge-session.service';
import { EdgeUsageService } from './edge-usage.service';

const DATABASE_URL = integrationDatabaseUrl();
const INTERVAL_MILLISECONDS = 1_000;
const PUBLIC_KEY_FORMAT = { type: 'spki', format: 'pem' } as const;

interface ChainCursor {
	usageEpoch: number;
	sequence: number;
	previousDigest?: string;
}

describe('Edge usage epochs', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	let privateKey: KeyObject;
	let backend: ExposureBackend;
	let intervalIndex = 0;
	let intervalBase: Date;
	const fixture = networkingFixture('edge-usage-epochs');

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				...NETWORKING_FIXTURE_ENTITIES,
				EdgeUsageCheckpoint,
				ExposureNetworkUsage,
				NetworkUsagePeriod,
			],
		});
		await seedNetworkingFixture(orm.em.fork(), fixture);
		await fixtureMaterializer(orm.em.fork()).reconcile(fixture.exposureId);
		const keys = generateKeyPairSync('ed25519');
		privateKey = keys.privateKey;
		const manager = orm.em.fork();
		await manager.nativeUpdate(
			Edge,
			{ id: fixture.edgeId },
			{
				identityPublicKey: keys.publicKey.export(PUBLIC_KEY_FORMAT).toString(),
			}
		);
		intervalBase = new Date();
		backend = await manager.findOneOrFail(ExposureBackend, {
			exposureId: fixture.exposureId,
		});
	});

	after(async () => {
		if (!orm) return;
		const manager = orm.em.fork();
		await manager.nativeDelete(ExposureNetworkUsage, {
			edgeId: fixture.edgeId,
		});
		await manager.nativeDelete(EdgeUsageCheckpoint, { edgeId: fixture.edgeId });
		await deleteNetworkingFixture(manager, fixture);
		await orm.close(true);
	});

	it('meters exactly once across replays, conflicts and an Edge state wipe', async () => {
		const opened = await service().openEpoch(fixtureEdgeSession(fixture));
		assert.deepEqual(opened, { usageEpoch: 1, previousDigest: undefined });

		const first = signed({ usageEpoch: 1, sequence: 1 }, '10');
		await assertAccepted(first);
		const second = signed(
			{ usageEpoch: 1, sequence: 2, previousDigest: first.digest },
			'20'
		);
		const acknowledgement = await assertAccepted(second);
		assert.deepEqual(await ingest(second), acknowledgement);
		assert.equal(await meteredRows(), 2);

		const conflicting = signed(
			{ usageEpoch: 1, sequence: 2, previousDigest: first.digest },
			'99'
		);
		await assert.rejects(ingest(conflicting), ConflictException);

		const wiped = await service().openEpoch(fixtureEdgeSession(fixture));
		assert.deepEqual(wiped, { usageEpoch: 2, previousDigest: second.digest });
		const restarted = signed(
			{ usageEpoch: 2, sequence: 1, previousDigest: second.digest },
			'30'
		);
		await assertAccepted(restarted);
		assert.equal(await meteredRows(), 3);

		assert.deepEqual(await ingest(second), acknowledgement);
		await assert.rejects(
			ingest(
				signed(
					{ usageEpoch: 1, sequence: 3, previousDigest: second.digest },
					'40'
				)
			),
			GoneException
		);
		await assert.rejects(
			ingest(
				signed(
					{ usageEpoch: 2, sequence: 5, previousDigest: restarted.digest },
					'50'
				)
			),
			GoneException
		);
		assert.equal(await meteredRows(), 3);
	});

	async function assertAccepted(
		checkpoint: EdgeUsageCheckpointDto
	): Promise<EdgeUsageCheckpointAcknowledgementDto> {
		const acknowledgement = await ingest(checkpoint);
		assert.deepEqual(acknowledgement, {
			usageEpoch: checkpoint.usageEpoch,
			sequence: checkpoint.sequence,
			digest: checkpoint.digest,
		});
		return acknowledgement;
	}

	function ingest(
		checkpoint: EdgeUsageCheckpointDto
	): Promise<EdgeUsageCheckpointAcknowledgementDto> {
		return service().ingest(fixtureEdgeSession(fixture), checkpoint);
	}

	function meteredRows(): Promise<number> {
		return orm.em
			.fork()
			.count(ExposureNetworkUsage, { edgeId: fixture.edgeId });
	}

	function service(): EdgeUsageService {
		const manager = orm.em.fork();
		return new EdgeUsageService(
			manager,
			new EdgeSessionService(manager, inertWakes()),
			fakeInstance(EdgeActivityService, {
				recordSandboxActivity: async () => undefined,
			}),
			new NetworkUsageService(manager),
			fakeInstance(MachinePlatformObservationService, {
				observeEdgeServed: async () => undefined,
			})
		);
	}

	function signed(
		cursor: ChainCursor,
		bytesOut: string
	): EdgeUsageCheckpointDto {
		const startedAt = new Date(
			intervalBase.getTime() + intervalIndex * INTERVAL_MILLISECONDS
		);
		intervalIndex += 1;
		const body = {
			usageEpoch: cursor.usageEpoch,
			sequence: String(cursor.sequence),
			edgeSessionGeneration: 1,
			intervalStartedAt: startedAt.toISOString(),
			intervalEndedAt: new Date(
				startedAt.getTime() + INTERVAL_MILLISECONDS
			).toISOString(),
			samples: [
				{
					backendId: backend.id,
					assignmentGeneration: backend.assignmentGeneration,
					protocol: backend.protocol,
					bytesIn: '1',
					bytesOut,
					packetsIn: '1',
					packetsOut: '1',
					tcpConnections: 1,
					udpFlows: 0,
				},
			],
		};
		const digest = edgeUsageDigest(fixture.edgeId, {
			...body,
			previousDigest: cursor.previousDigest ?? null,
		});
		return {
			...body,
			previousDigest: cursor.previousDigest,
			digest,
			signature: sign(
				null,
				edgeUsageSignaturePayload(fixture.edgeId, { ...body, digest }),
				privateKey
			).toString('base64url'),
		};
	}
});

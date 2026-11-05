/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { fakeSettings } from '../../../settings/testing/settings.fake';
import { CloudflareDomainProvider } from '../../cloudflare/services/cloudflare-domain-provider.service';
import type { EdgeRouteSnapshotDto } from '../../dto/edge-route-snapshot.dto';
import { Edge } from '../../entities/edge.entity';
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
import { ControlSnapshotRefreshService } from '../control-snapshot-refresh.service';
import { EdgeRouteSnapshotService } from './edge-route-snapshot.service';

const DATABASE_URL = integrationDatabaseUrl();
const ITERATIONS = 25;
const CONCURRENT_BUILDS = 4;
const LEASE_MILLISECONDS = 60 * 1_000;
const CONFIGURATION: Record<string, unknown> = {
	deployment: { hosted: false },
};

describe('Edge route snapshot publication', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	const fixture = networkingFixture('route-publication');

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: NETWORKING_FIXTURE_ENTITIES,
		});
		await seedNetworkingFixture(orm.em.fork(), fixture);
		await fixtureMaterializer(orm.em.fork()).reconcile(fixture.exposureId);
	});

	beforeEach(() => setLease(orm.em.fork(), LEASE_MILLISECONDS));

	after(async () => {
		if (!orm) return;
		await deleteNetworkingFixture(orm.em.fork(), fixture);
		await orm.close(true);
	});

	it('serves an unchanged snapshot under the same version and digest', async () => {
		const first = await build();
		const second = await build();
		assert.equal(second.version, first.version);
		assert.equal(second.digest, first.digest);
	});

	it('re-issues the version when a lease lapses without a bump', async () => {
		const leased = await build();
		assert.equal(leased.httpRoutes.length, 1);

		await setLease(orm.em.fork(), -LEASE_MILLISECONDS);
		const lapsed = await build();

		assert.equal(lapsed.httpRoutes.length, 0);
		assertEdgeAccepts(leased, lapsed);
		assert.ok(BigInt(lapsed.version) > BigInt(leased.version));
		const manager = orm.em.fork();
		const edge = await manager.findOneOrFail(Edge, { id: fixture.edgeId });
		const backend = await manager.findOneOrFail(ExposureBackend, {
			exposureId: fixture.exposureId,
		});
		assert.equal(edge.routeTableVersion, lapsed.version);
		assert.equal(backend.routeTableVersion, lapsed.version);
	});

	it('never serves one version with two digests while content changes concurrently', async () => {
		const snapshots: EdgeRouteSnapshotDto[] = [];
		for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
			const lease =
				iteration % 2 === 0 ? -LEASE_MILLISECONDS : LEASE_MILLISECONDS;
			const [built] = await Promise.all([
				Promise.all(Array.from({ length: CONCURRENT_BUILDS }, () => build())),
				setLease(orm.em.fork(), lease),
			]);
			snapshots.push(...built);
		}

		const digestByVersion = new Map<string, string>();
		for (const snapshot of snapshots) {
			const digest = digestByVersion.get(snapshot.version) ?? snapshot.digest;
			assert.equal(
				snapshot.digest,
				digest,
				`version ${snapshot.version} was served with two digests`
			);
			digestByVersion.set(snapshot.version, digest);
		}
	});

	function build(): Promise<EdgeRouteSnapshotDto> {
		const manager = orm.em.fork();
		return new EdgeRouteSnapshotService(
			manager,
			fakeInstance(TypedConfigService, {
				get: (key: string) => CONFIGURATION[key],
			}),
			fakeSettings({ publicIngressEnabled: true }),
			fakeInstance(CloudflareDomainProvider, {
				trustedProxyCidrs: async (configured: string[]) => configured,
			}),
			new ControlSnapshotRefreshService(manager, inertWakes())
		).build(fixtureEdgeSession(fixture));
	}

	async function setLease(
		manager: EntityManager,
		offsetMilliseconds: number
	): Promise<void> {
		await manager.nativeUpdate(
			ExposureBackend,
			{ exposureId: fixture.exposureId },
			{ leaseExpiresAt: new Date(Date.now() + offsetMilliseconds) }
		);
	}
});

function assertEdgeAccepts(
	current: EdgeRouteSnapshotDto,
	next: EdgeRouteSnapshotDto
): void {
	const currentVersion = BigInt(current.version);
	const nextVersion = BigInt(next.version);
	assert.ok(nextVersion >= currentVersion, 'route snapshot regressed');
	if (nextVersion === currentVersion) {
		assert.equal(next.digest, current.digest, 'version replayed');
	}
}

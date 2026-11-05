/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { fakeInstance } from '../../common/testing/instance.fake';
import { addMilliseconds } from '../../common/utils/time.util';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { SandboxMode } from '../../sandbox/enums/sandbox-mode.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { Machine } from '../../sandbox/machine/entities/machine.entity';
import { fakeSettings } from '../../settings/testing/settings.fake';
import { EDGE_STATUS } from '../constants/edge.constants';
import {
	EXPOSURE_KIND,
	EXPOSURE_VISIBILITY,
} from '../constants/exposure.constants';
import {
	HTTP_UPSTREAM_PROTOCOL,
	NETWORK_PROTOCOL,
} from '../constants/networking.constants';
import type { EdgeCapacitySnapshotDto } from '../dto/edge-heartbeat.dto';
import { CustomDomain } from '../entities/custom-domain.entity';
import { Edge } from '../entities/edge.entity';
import { EdgeSession } from '../entities/edge-session.entity';
import { Exposure } from '../entities/exposure.entity';
import { ExposureBackend } from '../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../entities/machine-edge-binding.entity';
import { EdgeListenerAllocationService } from '../services/edge/edge-listener-allocation.service';
import { EdgePlacementService } from '../services/edge/edge-placement.service';
import { ExposureDeactivationService } from '../services/exposure/exposure-deactivation.service';
import { ExposureMaterializationLockService } from '../services/exposure/exposure-materialization-lock.service';
import { ExposureMaterializerService } from '../services/exposure/exposure-materializer.service';
import { MachineBindingTargetService } from '../services/machine-tunnel/machine-binding-target.service';
import { MachineEdgeBindingFenceService } from '../services/machine-tunnel/machine-edge-binding-fence.service';
import { NetworkControlVersionService } from '../services/network-control-version.service';

export const FIXTURE_SESSION_GENERATION = 1;
const SESSION_LIFETIME_MILLISECONDS = MILLISECONDS_PER_HOUR;
const TARGET_PORT = 3_000;
const ROUTING_KEY_BYTES = 32;
const PROOF_NONCE_BYTES = 16;
const HASH_HEX_LENGTH = 64;
const CAPACITY_HEADROOM = 1_000;

export const NETWORKING_FIXTURE_ENTITIES = [
	CustomDomain,
	Edge,
	EdgeSession,
	Exposure,
	ExposureBackend,
	Machine,
	MachineEdgeBinding,
	Sandbox,
	SandboxPlacement,
];

export interface NetworkingFixture {
	name: string;
	organizationId: string;
	label: string;
	machine: Machine;
	sandbox: Sandbox;
	edgeId: string;
	edgeSessionId: string;
	exposureId: string;
}

export function networkingFixture(name: string): NetworkingFixture {
	const organizationId = randomUUID();
	const machine = new Machine({
		name: `${name}-${randomUUID()}`,
		apiVersion: '1',
		organizationId,
	});
	return {
		name,
		organizationId,
		label: `${name}-${randomUUID()}`,
		machine,
		sandbox: Object.assign(new Sandbox({}), {
			organizationId,
			mode: SandboxMode.STANDARD,
			osUser: 'snapflow',
			state: SandboxState.STARTED,
			machineId: machine.id,
		}),
		edgeId: randomUUID(),
		edgeSessionId: randomUUID(),
		exposureId: randomUUID(),
	};
}

export async function seedNetworkingFixture(
	manager: EntityManager,
	fixture: NetworkingFixture
): Promise<void> {
	const { organizationId, label, machine, sandbox, edgeId, exposureId } =
		fixture;
	const now = new Date();
	const sessionExpiresAt = addMilliseconds(now, SESSION_LIFETIME_MILLISECONDS);
	await manager.execute(
		'INSERT INTO "organization" (id, name, slug) VALUES (?, ?, ?)',
		[organizationId, label, organizationId]
	);
	machine.sessionGeneration = FIXTURE_SESSION_GENERATION;
	machine.sessionExpiresAt = sessionExpiresAt;
	manager.persist([machine, sandbox]);
	await manager.flush();
	manager.persist(
		manager.create(SandboxPlacement, {
			id: randomUUID(),
			sandboxId: sandbox.id,
			machineId: machine.id,
			assignmentGeneration: 1,
			fencingToken: randomUUID(),
			placementKind: PlacementKind.FLEXIBLE,
			placedAt: now,
			releasedAt: null,
			releaseReason: null,
		})
	);
	await manager.flush();
	await manager.execute(
		`INSERT INTO "network_edge"
			(id, name, status, "publicHost", "tunnelAddress", "publicAddresses",
			 "portInventory", "capacityProfile", "supportedProtocols", "sessionGeneration",
			 "sessionExpiresAt", "lastHeartbeatAt", "observedCapacity")
		 VALUES (?, ?, ?, ?, '{}'::jsonb, '[]'::jsonb, ?::jsonb, '{}'::jsonb,
			 ARRAY[?]::text[], ?, ?, ?, ?::jsonb)`,
		[
			edgeId,
			label,
			EDGE_STATUS.ACTIVE,
			`${edgeId}.edge.test`,
			JSON.stringify({ http: [], tcp: [], udp: [] }),
			NETWORK_PROTOCOL.HTTP,
			FIXTURE_SESSION_GENERATION,
			sessionExpiresAt,
			now,
			JSON.stringify(fixtureCapacity()),
		]
	);
	await manager.execute(
		`INSERT INTO "network_edge_session"
			(id, "edgeId", generation, "tokenHash", "proofNonce", "proofIssuedAt", "expiresAt")
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			fixture.edgeSessionId,
			edgeId,
			FIXTURE_SESSION_GENERATION,
			'0'.repeat(HASH_HEX_LENGTH),
			randomBytes(PROOF_NONCE_BYTES).toString('hex'),
			now,
			sessionExpiresAt,
		]
	);
	await manager.execute(
		`INSERT INTO "sandbox_exposure"
			(id, "organizationId", "sandboxId", name, kind, protocol, visibility,
			 "targetPort", policy, "routingKey", "platformHostname",
			 "originHostname")
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)`,
		[
			exposureId,
			organizationId,
			sandbox.id,
			fixture.name,
			EXPOSURE_KIND.HTTP,
			NETWORK_PROTOCOL.HTTP,
			EXPOSURE_VISIBILITY.PROTECTED,
			TARGET_PORT,
			JSON.stringify(httpPolicy()),
			randomBytes(ROUTING_KEY_BYTES).toString('hex'),
			`${exposureId}.preview.test`,
			`${exposureId}.origin.test`,
		]
	);
}

export async function deleteNetworkingFixture(
	manager: EntityManager,
	fixture: NetworkingFixture
): Promise<void> {
	const { machine, sandbox, edgeId, exposureId } = fixture;
	await manager.nativeDelete(CustomDomain, { exposureId });
	await manager.nativeDelete(ExposureBackend, { exposureId });
	await manager.nativeDelete(MachineEdgeBinding, { machineId: machine.id });
	await manager.nativeDelete(Exposure, { id: exposureId });
	await manager.nativeDelete(EdgeSession, { edgeId });
	await manager.nativeDelete(Edge, { id: edgeId });
	await manager.nativeDelete(SandboxPlacement, { sandboxId: sandbox.id });
	await manager.nativeDelete(Sandbox, { id: sandbox.id });
	await manager.nativeDelete(Machine, { id: machine.id });
	await manager.execute('DELETE FROM "organization" WHERE id = ?', [
		fixture.organizationId,
	]);
}

export function fixtureEdgeSession(fixture: NetworkingFixture): EdgeSession {
	return Object.assign(new EdgeSession(), {
		id: fixture.edgeSessionId,
		edgeId: fixture.edgeId,
		generation: FIXTURE_SESSION_GENERATION,
		revokedAt: null,
		expiresAt: addMilliseconds(new Date(), SESSION_LIFETIME_MILLISECONDS),
	});
}

export function fixtureMaterializer(
	manager: EntityManager
): ExposureMaterializerService {
	const versions = new NetworkControlVersionService(inertWakes());
	const bindingTargets = new MachineBindingTargetService(manager, versions);
	return new ExposureMaterializerService(
		manager,
		fakeSettings({ publicIngressEnabled: true }),
		new ExposureMaterializationLockService(new EdgePlacementService()),
		new EdgeListenerAllocationService(),
		new MachineEdgeBindingFenceService(bindingTargets),
		new ExposureDeactivationService(versions, bindingTargets),
		versions,
		bindingTargets
	);
}

export function inertWakes(): ControlWakeService {
	return fakeInstance(ControlWakeService, {
		notify: () => undefined,
		notifyAfterCommit: () => undefined,
	});
}

export function fixtureCapacity(): Partial<EdgeCapacitySnapshotDto> {
	return {
		placementEligible: true,
		routeCount: 0,
		tunnelHeadroom: CAPACITY_HEADROOM,
		httpRequestHeadroom: CAPACITY_HEADROOM,
		httpConnectionHeadroom: CAPACITY_HEADROOM,
		httpStreamHeadroom: CAPACITY_HEADROOM,
		tcpConnectionHeadroom: CAPACITY_HEADROOM,
		udpFlowHeadroom: CAPACITY_HEADROOM,
		cpuUtilization: 0,
		memoryUtilization: 0,
	};
}

function httpPolicy() {
	return {
		protocol: NETWORK_PROTOCOL.HTTP,
		visibility: EXPOSURE_VISIBILITY.PROTECTED,
		path: '/',
		stripPath: false,
		forceHttps: false,
		maxBodyBytes: 0,
		readTimeoutSeconds: 1,
		sendTimeoutSeconds: 1,
		retries: 0,
		streaming: true,
		upstreamProtocol: HTTP_UPSTREAM_PROTOCOL.HTTP,
		allowedOrigins: [],
		allowCredentials: false,
		showBrowserWarning: true,
	};
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException } from '@nestjs/common';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_CUTOVER,
} from '../../constants/exposure.constants';
import { Edge } from '../../entities/edge.entity';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { MachineBindingTargetService } from '../machine-tunnel/machine-binding-target.service';
import { NetworkControlVersionService } from '../network-control-version.service';
import { ExposureActivationService } from './exposure-activation.service';
import { ExposureCutoverService } from './exposure-cutover.service';
import { ExposureManagedDnsService } from './exposure-managed-dns.service';

const CANDIDATE_ID = '1f0e2d3c-4b5a-4968-8776-655443322110';
const PREDECESSOR_ID = '2e1d3c4b-5a69-4877-8665-544332211009';
const PREDECESSOR_EDGE_ID = '3d2c4b5a-6978-4866-9554-433221100998';
const CANDIDATE_EDGE_ID = '4c3b5a69-7887-4955-8443-322110099887';
const PREDECESSOR_EDGE_HOST = 'edge-a.snapflow.test';
const CUTOVER_STARTED_AT = new Date('2026-10-04T12:00:00.000Z');
const OBSERVED_AT = new Date('2026-10-04T12:01:00.000Z');
const RESTARTED_AT = new Date('2026-10-04T12:01:30.000Z');

function lockedCutover(candidate: ExposureBackend) {
	return {
		candidate,
		predecessor: Object.assign(new ExposureBackend(), {
			id: PREDECESSOR_ID,
			edgeId: PREDECESSOR_EDGE_ID,
			state: EXPOSURE_BACKEND_STATE.ACTIVE,
		}),
		edges: [
			Object.assign(new Edge(), {
				id: PREDECESSOR_EDGE_ID,
				publicHost: PREDECESSOR_EDGE_HOST,
			}),
		],
		exposure: new Exposure(),
		observedAt: OBSERVED_AT,
	};
}

function startedCandidate(): ExposureBackend {
	return Object.assign(new ExposureBackend(), {
		id: CANDIDATE_ID,
		edgeId: CANDIDATE_EDGE_ID,
		state: EXPOSURE_BACKEND_STATE.PENDING,
		cutoverStartedAt: CUTOVER_STARTED_AT,
		cutoverVerifiedAt: null,
		dnsActivatedAt: CUTOVER_STARTED_AT,
	});
}

function rollbackHarness(onDnsCall: () => void = () => undefined) {
	const steps: string[] = [];
	let inTransaction = false;
	const manager = fakeInstance(EntityManager, {
		flush: async () => {
			steps.push('flush');
		},
	});
	const entityManager = fakeInstance(EntityManager, {
		transactional: async <T>(work: (manager: EntityManager) => Promise<T>) => {
			steps.push('begin');
			inTransaction = true;
			try {
				return await work(manager);
			} finally {
				inTransaction = false;
				steps.push('end');
			}
		},
	});
	const pointAt = mock.fn(async () => {
		steps.push(inTransaction ? 'dns inside a transaction' : 'dns');
		onDnsCall();
	});
	const record = (step: string) => async () => {
		steps.push(step);
	};
	const service = new ExposureCutoverService(
		entityManager,
		fakeInstance(ExposureActivationService),
		fakeInstance(ExposureManagedDnsService, { pointAt }),
		fakeInstance(NetworkControlVersionService, {
			bumpEdges: record('bump edges'),
			bumpMachines: record('bump machines'),
		}),
		fakeInstance(MachineBindingTargetService, {
			reviseOrRelease: record('revise binding'),
		})
	);
	return { pointAt, service, steps };
}

function lockInTurn(
	service: ExposureCutoverService,
	steps: string[],
	cutovers: readonly ReturnType<typeof lockedCutover>[]
): void {
	const queue = [...cutovers];
	Object.defineProperty(service, 'lockCutover', {
		value: async () => {
			steps.push('lock');
			return queue.shift();
		},
	});
}

describe('ExposureCutoverService rollback', () => {
	it('calls the DNS provider between the fencing and the release transactions', async () => {
		const candidate = startedCandidate();
		let fencedDuringDnsCall = false;
		const { pointAt, service, steps } = rollbackHarness(() => {
			fencedDuringDnsCall =
				candidate.cutoverStartedAt === null &&
				candidate.dnsActivatedAt === null;
		});
		const fencing = lockedCutover(candidate);
		const release = lockedCutover(candidate);
		lockInTurn(service, steps, [fencing, release]);

		await service.rollback(CANDIDATE_ID);

		assert.deepEqual(steps, [
			'begin',
			'lock',
			'end',
			'dns',
			'begin',
			'lock',
			'flush',
			'revise binding',
			'bump edges',
			'bump machines',
			'end',
		]);
		assert.equal(fencedDuringDnsCall, true);
		assert.deepEqual(pointAt.mock.calls[0]?.arguments, [
			fencing.exposure,
			fencing.edges[0],
		]);
		assert.equal(candidate.state, EXPOSURE_BACKEND_STATE.RELEASED);
		assert.equal(
			candidate.failureReason,
			EXPOSURE_CUTOVER.rollbackFailureReason
		);
		assert.equal(release.predecessor.dnsTargetHost, PREDECESSOR_EDGE_HOST);
		assert.equal(release.predecessor.dnsActivatedAt, OBSERVED_AT);
	});

	it('keeps the candidate when its cutover restarted during the DNS call', async () => {
		const candidate = startedCandidate();
		const { service, steps } = rollbackHarness(() => {
			candidate.cutoverStartedAt = RESTARTED_AT;
		});
		lockInTurn(service, steps, [
			lockedCutover(candidate),
			lockedCutover(candidate),
		]);

		await assert.rejects(service.rollback(CANDIDATE_ID), ConflictException);

		assert.equal(steps.includes('flush'), false);
		assert.equal(candidate.state, EXPOSURE_BACKEND_STATE.PENDING);
	});

	it('refuses a verified cutover before calling the DNS provider', async () => {
		const candidate = Object.assign(startedCandidate(), {
			cutoverVerifiedAt: OBSERVED_AT,
		});
		const { pointAt, service, steps } = rollbackHarness();
		lockInTurn(service, steps, [lockedCutover(candidate)]);

		await assert.rejects(service.rollback(CANDIDATE_ID), ConflictException);

		assert.equal(pointAt.mock.callCount(), 0);
		assert.equal(candidate.cutoverStartedAt, CUTOVER_STARTED_AT);
	});
});

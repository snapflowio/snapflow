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
import { Redis } from 'ioredis';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { AUTH_CREDENTIAL_TYPES } from '../../../common/types/organization-auth-context.types';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { ControlWakeService } from '../../../infra/control-wake/services/control-wake.service';
import { TransactionCommitHooks } from '../../../infra/database/subscribers/transaction-commit-hooks.subscriber';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_VISIBILITY,
	SYSTEM_EXPOSURE_SERVICE,
} from '../../constants/exposure.constants';
import { NETWORK_WAKE_TOPIC } from '../../constants/networking.constants';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import {
	type AccessCredential,
	type AccessRequester,
	parseStoredRecord,
	storedGrantSchema,
} from '../../utils/protected-access-session.util';
import { SystemExposureLeaseService } from '../exposure/system-exposure-lease.service';
import { ProtectedAccessGrantService } from './protected-access-grant.service';
import { ProtectedAccessSessionService } from './protected-access-session.service';

const USER_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const ORGANIZATION_ID = '8e0d3b5f-6c2e-4d4b-8f9a-2b3c4d5e6f70';
const SANDBOX_ID = 'sandbox-1';
const EXPOSURE_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
const BACKEND_ID = '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e';
const EDGE_ID = '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e7f';
const CREDENTIAL_ID = '5f607182-93a4-4b5c-8d6e-7f8091a2b3c4';
const EDGE_PUBLIC_ORIGIN = 'https://edge.snapflow.test';
const TARGET_PORT = 2_280;
const RECEIVING_CLIENTS = 1;

function protectedExposure(): Exposure {
	return Object.assign(new Exposure(), {
		id: EXPOSURE_ID,
		organizationId: ORGANIZATION_ID,
		sandboxId: SANDBOX_ID,
		name: SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
		systemService: SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
		visibility: EXPOSURE_VISIBILITY.PROTECTED,
		platformHostname: `toolbox-${SANDBOX_ID}.snapflow.test`,
		generation: 1,
		targetPort: TARGET_PORT,
	});
}

function activeBackend(): ExposureBackend {
	return Object.assign(new ExposureBackend(), {
		id: BACKEND_ID,
		edgeId: EDGE_ID,
		exposureId: EXPOSURE_ID,
		assignmentGeneration: 1,
		state: EXPOSURE_BACKEND_STATE.ACTIVE,
	});
}

class ActivationEntityManager {
	backend: ExposureBackend | null = null;
	backendLookups = 0;

	async findOne(entity: unknown): Promise<Exposure | ExposureBackend | null> {
		if (entity === Exposure) return protectedExposure();
		this.backendLookups += 1;
		return this.backend;
	}
}

const credential: AccessCredential = {
	type: AUTH_CREDENTIAL_TYPES.API_KEY,
	id: CREDENTIAL_ID,
};

const requester: AccessRequester = {
	organizationId: ORGANIZATION_ID,
	userId: USER_ID,
	credential,
};

function grantService(manager: ActivationEntityManager): {
	grants: ProtectedAccessGrantService;
	wakes: ControlWakeService;
	records: Map<string, string>;
} {
	const records = new Map<string, string>();
	const redis = fakeInstance(Redis, {
		duplicate: () => fakeInstance(Redis, { on: () => undefined }),
		publish: async () => RECEIVING_CLIENTS,
		setex: async (key: string, seconds: number, value: string) => {
			records.set(key, `${seconds}:${value}`);
			return 'OK';
		},
	});
	const wakes = new ControlWakeService(
		redis,
		fakeInstance(TransactionCommitHooks)
	);
	const config = fakeInstance(TypedConfigService, {
		getOrThrow: () => EDGE_PUBLIC_ORIGIN,
	});
	return {
		grants: new ProtectedAccessGrantService(
			redis,
			fakeInstance(EntityManager, {
				findOne: manager.findOne.bind(manager),
			}),
			config,
			wakes,
			fakeInstance(ProtectedAccessSessionService),
			fakeInstance(SystemExposureLeaseService)
		),
		wakes,
		records,
	};
}

describe('ProtectedAccessGrantService activation wait', () => {
	it('issues the grant as soon as the backend activation wake arrives', async () => {
		const manager = new ActivationEntityManager();
		const { grants, wakes } = grantService(manager);
		const issuing = grants.issueWhenActive(
			requester,
			SANDBOX_ID,
			EXPOSURE_ID,
			{},
			true
		);
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(manager.backendLookups, 1);

		manager.backend = activeBackend();
		wakes.notify(NETWORK_WAKE_TOPIC.EXPOSURE_ACTIVATION, [EXPOSURE_ID]);
		const grant = await issuing;

		assert.equal(grant.backendId, BACKEND_ID);
		assert.equal(manager.backendLookups, 2);
		assert.ok(grant.url.startsWith(`https://toolbox-${SANDBOX_ID}`));
	});

	it('returns an already active backend without waiting', async () => {
		const manager = new ActivationEntityManager();
		manager.backend = activeBackend();
		const { grants, records } = grantService(manager);

		const grant = await grants.issueWhenActive(
			requester,
			SANDBOX_ID,
			EXPOSURE_ID,
			{},
			true
		);

		assert.equal(grant.backendId, BACKEND_ID);
		assert.equal(manager.backendLookups, 1);
		const [stored] = records.values();
		const serialized = stored?.slice(stored.indexOf(':') + 1) ?? null;
		const storedGrant = parseStoredRecord(storedGrantSchema, serialized);
		assert.deepEqual(
			storedGrant?.credential,
			credential,
			'the grant records the credential it was issued with'
		);
		assert.equal(storedGrant?.organizationId, ORGANIZATION_ID);
		assert.equal(storedGrant?.userId, USER_ID);
	});
});

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
import { HttpException, HttpStatus } from '@nestjs/common';
import { PLATFORM_PRINCIPAL_TYPE } from '../../common/types/platform-principal.types';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { DeterministicHmacService } from '../../infra/encryption/services/deterministic-hmac.service';
import { EnvelopeEncryptionService } from '../../infra/encryption/services/envelope-encryption.service';
import { MarketplaceErrorCode } from '../../marketplace/enums/marketplace-error-code.enum';
import { PriceBelowFloorException } from '../../marketplace/exceptions/price-below-floor.exception';
import { IDEMPOTENCY_STATE } from '../constants/idempotency.constants';
import { ApiIdempotencyRecord } from '../entities/api-idempotency-record.entity';
import type { IdempotentRequestContext } from '../types/idempotent-request.types';
import { ApiIdempotentRequestService } from './api-idempotent-request.service';

const CONTEXT: IdempotentRequestContext = {
	key: 'price-card-key-0001',
	organizationId: '6f000000-0000-4000-8000-000000000006',
	principal: { type: PLATFORM_PRINCIPAL_TYPE.HUMAN, id: 'host-user' },
	method: 'POST',
	routeTemplate: '/host/machines/:machineId/price-cards',
	fingerprintInput: { vcpuHourMicroUsd: '1' },
};
const DIGEST = 'digest';
const RECORD_LIFETIME_MILLISECONDS = 60_000;

function prototypeOf<Service extends object>(
	service: abstract new (...args: never[]) => Service
): Service {
	return Object.create(service.prototype);
}

function harness(existing: ApiIdempotencyRecord | null) {
	const persisted: ApiIdempotencyRecord[] = [];
	const manager = prototypeOf(EntityManager);
	mock.method(manager, 'transactional', (operation: unknown) =>
		typeof operation === 'function' ? operation(manager) : undefined
	);
	mock.method(manager, 'execute', async () => [
		{ acquired: true, now: new Date() },
	]);
	mock.method(manager, 'findOne', async () => existing);
	mock.method(manager, 'persist', (record: ApiIdempotencyRecord) => {
		persisted.push(record);
		return manager;
	});
	mock.method(manager, 'flush', async () => undefined);
	const hmac = Object.assign(prototypeOf(DeterministicHmacService), {
		deriveCandidates: () => [DIGEST],
	});
	return {
		persisted,
		service: new ApiIdempotentRequestService(
			manager,
			hmac,
			prototypeOf(EnvelopeEncryptionService)
		),
	};
}

describe('ApiIdempotentRequestService terminal rejections', () => {
	it('answers the first request with the full domain error body', async () => {
		const { service, persisted } = harness(null);
		const rejection = new PriceBelowFloorException(
			MicroUsd.parse('10000'),
			MicroUsd.parse('2400')
		);

		await assert.rejects(
			service.execute(CONTEXT, async () => {
				throw rejection;
			}),
			(error: unknown) => {
				assert.equal(error, rejection);
				assert.deepEqual(rejection.getResponse(), {
					code: MarketplaceErrorCode.PRICE_BELOW_FLOOR,
					message: 'The reference price is below the market floor',
					floorMicroUsd: '10000',
					referencePriceMicroUsd: '2400',
				});
				return true;
			}
		);
		const [record] = persisted;
		assert.ok(record);
		assert.equal(record.state, IDEMPOTENCY_STATE.FAILED_TERMINAL);
		assert.deepEqual(record.terminalProblem, {
			code: MarketplaceErrorCode.PRICE_BELOW_FLOOR,
			detail: 'The reference price is below the market floor',
			status: HttpStatus.UNPROCESSABLE_ENTITY,
		});
	});

	it('replays a stored rejection with its code, message and status', async () => {
		const stored = Object.assign(new ApiIdempotencyRecord(), {
			requestFingerprint: DIGEST,
			state: IDEMPOTENCY_STATE.FAILED_TERMINAL,
			expiresAt: new Date(Date.now() + RECORD_LIFETIME_MILLISECONDS),
			terminalProblem: {
				code: MarketplaceErrorCode.PRICE_BELOW_FLOOR,
				detail: 'The reference price is below the market floor',
				status: HttpStatus.UNPROCESSABLE_ENTITY,
			},
		});
		const { service } = harness(stored);

		await assert.rejects(
			service.execute(CONTEXT, async () => {
				throw new Error('a replay must not run the mutation again');
			}),
			(error: unknown) => {
				assert.ok(error instanceof HttpException);
				assert.equal(error.getStatus(), HttpStatus.UNPROCESSABLE_ENTITY);
				assert.deepEqual(error.getResponse(), {
					code: MarketplaceErrorCode.PRICE_BELOW_FLOOR,
					message: 'The reference price is below the market floor',
				});
				return true;
			}
		);
	});
});

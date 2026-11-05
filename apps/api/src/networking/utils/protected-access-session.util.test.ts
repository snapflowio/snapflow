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
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { AUTH_CREDENTIAL_TYPES } from '../../common/types/organization-auth-context.types';
import { SYSTEM_EXPOSURE_SERVICE } from '../constants/exposure.constants';
import { PROTECTED_ACCESS } from '../constants/protected-access.constants';
import {
	parseStoredRecord,
	renewedSessionExpiry,
	STORED_ACCESS_RECORD,
	type StoredAccessSession,
	storedAccessSessionSchema,
} from './protected-access-session.util';

const PRE_CREDENTIAL_RECORD_VERSION = 1;

const IDLE_LIFETIME_SECONDS = 300;
const IDLE_MILLISECONDS = IDLE_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND;
const REMAINING_FRACTION = { fresh: 0.75, nearExpiry: 0.25, absoluteCap: 0.4 };
const NOW = new Date('2026-10-04T12:00:00.000Z');

function session(
	expiresInMilliseconds: number,
	absoluteInMilliseconds = PROTECTED_ACCESS.absoluteSessionLifetimeSeconds *
		MILLISECONDS_PER_SECOND
): StoredAccessSession {
	return {
		version: STORED_ACCESS_RECORD.version,
		credential: {
			type: AUTH_CREDENTIAL_TYPES.API_KEY,
			id: 'a4b5c6d7-e8f9-4a01-92b3-c4d5e6f70819',
		},
		sessionId: '5f607182-93a4-4b5c-8d6e-7f8091a2b3c4',
		edgeId: '3d4e5f60-7182-4c9d-8e1f-2a3b4c5d6e7f',
		backendId: '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e',
		sandboxId: 'sandbox-1',
		exposureId: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
		exposureGeneration: 1,
		systemService: SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
		interactive: false,
		organizationId: '8e0d3b5f-6c2e-4d4b-8f9a-2b3c4d5e6f70',
		userId: '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f',
		idleLifetimeSeconds: IDLE_LIFETIME_SECONDS,
		absoluteExpiresAt: new Date(
			NOW.getTime() + absoluteInMilliseconds
		).toISOString(),
		expiresAt: new Date(NOW.getTime() + expiresInMilliseconds).toISOString(),
	};
}

describe('renewedSessionExpiry', () => {
	it('does not renew a session with more than half its idle lifetime left', () => {
		assert.equal(
			renewedSessionExpiry(
				session(IDLE_MILLISECONDS * REMAINING_FRACTION.fresh),
				NOW
			),
			null
		);
	});

	it('slides a session close to expiry by its full idle lifetime', () => {
		const renewed = renewedSessionExpiry(
			session(IDLE_MILLISECONDS * REMAINING_FRACTION.nearExpiry),
			NOW
		);
		assert.equal(renewed?.getTime(), NOW.getTime() + IDLE_MILLISECONDS);
	});

	it('never renews past the absolute lifetime', () => {
		const absolute = IDLE_MILLISECONDS * REMAINING_FRACTION.absoluteCap;
		const renewed = renewedSessionExpiry(
			session(IDLE_MILLISECONDS * REMAINING_FRACTION.nearExpiry, absolute),
			NOW
		);
		assert.equal(renewed?.getTime(), NOW.getTime() + absolute);
		assert.equal(
			renewedSessionExpiry(session(absolute, absolute), NOW),
			null,
			'a session at its absolute lifetime cannot be renewed'
		);
	});
});

describe('storedAccessSessionSchema', () => {
	it('refuses a session recorded before it named its credential', () => {
		const uncredentialed = Object.fromEntries(
			Object.entries(session(IDLE_MILLISECONDS)).filter(
				([field]) => field !== 'credential'
			)
		);
		assert.equal(
			parseStoredRecord(
				storedAccessSessionSchema,
				JSON.stringify({
					...uncredentialed,
					version: PRE_CREDENTIAL_RECORD_VERSION,
				})
			),
			null
		);
	});
});

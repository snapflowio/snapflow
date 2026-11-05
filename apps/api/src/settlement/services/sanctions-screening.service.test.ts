/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { fakeInstance } from '../../common/testing/instance.fake';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { SANCTIONS_API_KEY_HEADER } from '../constants/settlement.constants';
import { SanctionsStatus } from '../enums/sanctions-status.enum';
import { SanctionsScreeningService } from './sanctions-screening.service';

const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const API_URL = 'https://sanctions.test/api/v1/address';
const API_KEY = 'sanctions-key';
const HTTP_INTERNAL_SERVER_ERROR = 500;

function service(apiKey: string | undefined): SanctionsScreeningService {
	return new SanctionsScreeningService(
		fakeInstance(TypedConfigService, {
			get: () => ({ apiKey, apiUrl: API_URL }),
		})
	);
}

function answer(body: unknown, status?: number) {
	return mock.method(
		globalThis,
		'fetch',
		async () => new Response(JSON.stringify(body), { status })
	);
}

describe('SanctionsScreeningService', () => {
	afterEach(() => mock.restoreAll());

	it('asks the screening API about the address with the API key', async () => {
		const fetch = answer({ identifications: [] });

		const screening = await service(API_KEY).screen(ADDRESS);

		assert.equal(screening.sanctionsStatus, SanctionsStatus.CLEAR);
		assert.ok(screening.sanctionsCheckedAt instanceof Date);
		const [url, init] = fetch.mock.calls[0]?.arguments ?? [];
		assert.equal(url, `${API_URL}/${ADDRESS}`);
		assert.deepEqual(init?.headers, { [SANCTIONS_API_KEY_HEADER]: API_KEY });
	});

	it('blocks an address with any identification', async () => {
		answer({
			identifications: [
				{ category: 'sanctions', name: 'SANCTIONS: OFAC SDN Test' },
			],
		});

		const screening = await service(API_KEY).screen(ADDRESS);

		assert.equal(screening.sanctionsStatus, SanctionsStatus.BLOCKED);
	});

	it('records the address as unchecked without calling out when no key is configured', async () => {
		const fetch = answer({ identifications: [] });

		assert.deepEqual(await service(undefined).screen(ADDRESS), {
			sanctionsStatus: SanctionsStatus.UNCHECKED,
			sanctionsCheckedAt: null,
		});
		assert.equal(fetch.mock.callCount(), 0);
	});

	it('fails closed when the API errors, answers malformed or is unreachable', async () => {
		for (const respond of [
			() => answer({ message: 'boom' }, HTTP_INTERNAL_SERVER_ERROR),
			() => answer({ unexpected: true }),
			() =>
				mock.method(globalThis, 'fetch', async () => {
					throw new TypeError('fetch failed');
				}),
		]) {
			respond();
			await assert.rejects(
				service(API_KEY).screen(ADDRESS),
				ServiceUnavailableException
			);
			mock.restoreAll();
		}
	});
});

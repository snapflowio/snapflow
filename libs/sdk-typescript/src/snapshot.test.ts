/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { SnapshotState } from '@snapflow/api-client';
import type { MockInstance } from 'vitest';
import {
	SnapflowError,
	SnapflowTimeoutError,
} from './errors/snapflow-error.js';
import { createApiClient } from './snapflow/client-config.js';
import { SnapshotService } from './snapshot.js';

const API_URL = 'https://api.snapflow.test';
const SDK_VERSION = '0.0.0-test';
const SHORT_TIMEOUT_SECONDS = 0.05;
const SNAPSHOT = {
	id: 'snapshot-id',
	name: 'snapshot',
	errorReason: 'base image missing',
};

function respondWithStates(states: SnapshotState[]): MockInstance {
	const remaining = [...states];
	return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
		const state = remaining.length > 1 ? remaining.shift() : remaining[0];
		return new Response(JSON.stringify({ ...SNAPSHOT, state }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	});
}

function snapshotService(): SnapshotService {
	return new SnapshotService(
		createApiClient({ apiKey: 'api-key', apiUrl: API_URL }, SDK_VERSION)
	);
}

describe('SnapshotService.create', () => {
	afterEach(() => vi.restoreAllMocks());

	it('stops waiting for a snapshot that never finishes once the timeout passes', async () => {
		respondWithStates([SnapshotState.Pending]);

		await expect(
			snapshotService().create(
				{ name: SNAPSHOT.name, image: 'python:3.13' },
				{ timeout: SHORT_TIMEOUT_SECONDS }
			)
		).rejects.toBeInstanceOf(SnapflowTimeoutError);
	});

	it('reports state changes and returns the active snapshot', async () => {
		respondWithStates([SnapshotState.Pending, SnapshotState.Active]);
		const logs: string[] = [];

		const snapshot = await snapshotService().create(
			{ name: SNAPSHOT.name, image: 'python:3.13' },
			{ onLogs: (chunk) => logs.push(chunk) }
		);

		expect(snapshot.state).toBe(SnapshotState.Active);
		expect(logs).toEqual([
			'Creating snapshot snapshot (pending)',
			'Creating snapshot snapshot (active)',
			'Created snapshot snapshot (active)',
		]);
	});

	it('rejects snapshots that fail to build', async () => {
		respondWithStates([SnapshotState.BuildFailed]);

		await expect(
			snapshotService().create({ name: SNAPSHOT.name, image: 'python:3.13' })
		).rejects.toThrow(
			new SnapflowError(
				'Failed to create snapshot. Name: snapshot Reason: base image missing'
			)
		);
	});
});

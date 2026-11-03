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
import pino from 'pino';
import { swapMessageAndObject } from './pino.util';

const MESSAGE = 'Machine sync failed';
const STACK = 'Error: boom\n    at sync (machine.ts:1:1)';

function swapped(...values: unknown[]): unknown[][] {
	const calls: unknown[][] = [];
	const method = (...received: unknown[]) => {
		calls.push(received);
	};
	Reflect.apply(swapMessageAndObject, pino({ enabled: false }), [
		values,
		method,
	]);
	return calls;
}

describe('swapMessageAndObject', () => {
	it('moves an error after the message into the err field', () => {
		const error = new Error('boom');
		assert.deepEqual(swapped(MESSAGE, error), [[{ err: error }, MESSAGE]]);
	});

	it('moves an object after the message into the log object', () => {
		assert.deepEqual(swapped(MESSAGE, { machineId: 'm1' }, 'extra'), [
			[{ machineId: 'm1' }, MESSAGE, 'extra'],
		]);
	});

	it('moves a stack trace after the message into the stack field', () => {
		assert.deepEqual(swapped(MESSAGE, STACK), [[{ stack: STACK }, MESSAGE]]);
	});

	it('merges the detail into a leading context object', () => {
		const error = new Error('boom');
		assert.deepEqual(swapped({ context: 'Sync' }, MESSAGE, error), [
			[{ context: 'Sync', err: error }, MESSAGE],
		]);
	});

	it('keeps arguments that need no swapping', () => {
		assert.deepEqual(swapped(MESSAGE, 'plain'), [[MESSAGE, 'plain']]);
	});
});

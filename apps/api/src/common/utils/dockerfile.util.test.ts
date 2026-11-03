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
import { entrypointFromDockerfile } from './dockerfile.util';

describe('entrypointFromDockerfile', () => {
	it('keeps the sandbox alive when no ENTRYPOINT is declared', () => {
		assert.deepEqual(entrypointFromDockerfile('FROM alpine\nRUN true\n'), [
			'sleep',
			'infinity',
		]);
	});

	it('uses an exec-form ENTRYPOINT as written', () => {
		assert.deepEqual(
			entrypointFromDockerfile('FROM node\nENTRYPOINT ["node", "server.js"]\n'),
			['node', 'server.js']
		);
	});

	it('runs a shell-form ENTRYPOINT through /bin/sh', () => {
		assert.deepEqual(
			entrypointFromDockerfile('FROM node\nentrypoint node server.js\n'),
			['/bin/sh', '-c', 'node server.js']
		);
	});

	it('uses the last ENTRYPOINT and ignores commented ones', () => {
		assert.deepEqual(
			entrypointFromDockerfile(
				'FROM node\nENTRYPOINT ["first"]\n# ENTRYPOINT ["comment"]\nENTRYPOINT ["second"]\n'
			),
			['second']
		);
	});
});

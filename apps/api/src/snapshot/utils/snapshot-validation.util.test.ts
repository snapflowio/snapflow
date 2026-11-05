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
import { BadRequestException } from '@nestjs/common';
import { assertValidImageName } from './snapshot-validation.util';

const DIGEST = `sha256:${'c'.repeat(64)}`;

describe('assertValidImageName', () => {
	it('accepts pinned tags and digests on any registry', () => {
		for (const name of [
			'ubuntu:24.04',
			`ubuntu@${DIGEST}`,
			`ubuntu:24.04@${DIGEST}`,
			`ubuntu:latest@${DIGEST}`,
			'localhost:5000/team/app:1',
			`registry.example.com:8443/team/app@${DIGEST}`,
		]) {
			assert.doesNotThrow(() => assertValidImageName(name), name);
		}
	});

	it('rejects unpinned, latest and malformed references', () => {
		for (const name of [
			'ubuntu',
			'localhost:5000/team/app',
			'ubuntu:latest',
			'Ubuntu:24.04',
			`ubuntu:${DIGEST}`,
		]) {
			assert.throws(
				() => assertValidImageName(name),
				BadRequestException,
				name
			);
		}
	});
});

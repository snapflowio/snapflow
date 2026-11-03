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
import { ImageReference, ImageReferenceError } from './image-reference.value';

const SHA256 = `sha256:${'a'.repeat(64)}`;
const SHA512 = `sha512:${'b'.repeat(128)}`;

describe('ImageReference', () => {
	it('parses and normalizes every reference form', () => {
		const cases: [string, string, string, string?, string?][] = [
			['ubuntu', 'docker.io/library/ubuntu', 'docker.io/library/ubuntu'],
			[
				'ubuntu:24.04',
				'docker.io/library/ubuntu:24.04',
				'docker.io/library/ubuntu',
				'24.04',
			],
			[
				`ubuntu@${SHA256}`,
				`docker.io/library/ubuntu@${SHA256}`,
				'docker.io/library/ubuntu',
				undefined,
				SHA256,
			],
			[
				`ubuntu:24.04@${SHA256}`,
				`docker.io/library/ubuntu:24.04@${SHA256}`,
				'docker.io/library/ubuntu',
				'24.04',
				SHA256,
			],
			[
				'library/ubuntu:24.04',
				'docker.io/library/ubuntu:24.04',
				'docker.io/library/ubuntu',
				'24.04',
			],
			[
				'index.docker.io/snapflow/app:1',
				'docker.io/snapflow/app:1',
				'docker.io/snapflow/app',
				'1',
			],
			[
				'localhost:5000/team/app',
				'localhost:5000/team/app',
				'localhost:5000/team/app',
			],
			[
				`registry.example.com:8443/a/b/c:v1.2_rc-1@${SHA512}`,
				`registry.example.com:8443/a/b/c:v1.2_rc-1@${SHA512}`,
				'registry.example.com:8443/a/b/c',
				'v1.2_rc-1',
				SHA512,
			],
			['localhost/app:1', 'localhost/app:1', 'localhost/app', '1'],
			['[::1]:5000/app:1', '[::1]:5000/app:1', '[::1]:5000/app', '1'],
			[
				'ghcr.io/org/my__app.x-y:1',
				'ghcr.io/org/my__app.x-y:1',
				'ghcr.io/org/my__app.x-y',
				'1',
			],
		];
		for (const [input, formatted, name, tag, digest] of cases) {
			const reference = ImageReference.parse(input);
			assert.equal(reference.toString(), formatted, input);
			assert.equal(reference.name, name, input);
			assert.equal(reference.tag, tag, input);
			assert.equal(reference.digest, digest, input);
		}
	});

	it('never turns a digest into a tag', () => {
		const reference = ImageReference.parse(`ubuntu@${SHA256}`);
		assert.equal(reference.manifestReference, SHA256);
		assert.ok(!reference.toString().includes(`:${SHA256}`));
	});

	it('identifies Docker Hub only by its normalized domain', () => {
		assert.equal(ImageReference.parse('ubuntu:24.04').isDockerHub, true);
		assert.equal(
			ImageReference.parse('docker.io/library/ubuntu:1').isDockerHub,
			true
		);
		assert.equal(ImageReference.parse('ghcr.io/org/app:1').isDockerHub, false);
		assert.equal(
			ImageReference.parse('localhost:5000/app').domain,
			'localhost:5000'
		);
	});

	it('rejects malformed references', () => {
		for (const input of [
			'',
			'Ubuntu:24.04',
			'docker.io/Library/ubuntu:1',
			'ubuntu:',
			'ubuntu:-bad',
			'ubuntu@sha256:abc',
			`ubuntu@sha256:${'A'.repeat(64)}`,
			`ubuntu@md5:${'a'.repeat(32)}`,
			`ubuntu:sha256:${'a'.repeat(64)}`,
			'registry.example.com/app//x:1',
			'app:1@',
			`ubuntu:${'t'.repeat(129)}`,
			`registry.example.com/${'a'.repeat(256)}`,
		]) {
			assert.throws(
				() => ImageReference.parse(input),
				ImageReferenceError,
				input
			);
		}
	});
});

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
import { assertSeparateSandboxSite } from './sandbox-site.util';

const PLATFORM_ORIGINS = {
	API_URL: 'https://snapflow.io',
	ADMIN_URL: 'https://snapflow.io',
	WEBSITE_URL: 'https://www.snapflow.io',
};

describe('assertSeparateSandboxSite', () => {
	it('accepts a sandbox domain on its own site', () => {
		assert.doesNotThrow(() =>
			assertSeparateSandboxSite('snapflow.run', PLATFORM_ORIGINS)
		);
	});

	it('refuses a sandbox subdomain of the platform site', () => {
		assert.throws(
			() => assertSeparateSandboxSite('sandbox.snapflow.io', PLATFORM_ORIGINS),
			/separate site from API_URL: both belong to snapflow\.io/
		);
	});

	it('refuses a sandbox domain equal to an origin site', () => {
		assert.throws(
			() =>
				assertSeparateSandboxSite('snapflow.run', {
					WEBSITE_URL: 'https://www.snapflow.run',
				}),
			/separate site from WEBSITE_URL/
		);
	});

	it('ignores unset origins', () => {
		assert.doesNotThrow(() =>
			assertSeparateSandboxSite('sandbox.snapflow.io', { API_URL: undefined })
		);
	});

	it('accepts a sandbox domain listed on the Public Suffix List', () => {
		assert.doesNotThrow(() =>
			assertSeparateSandboxSite('github.io', PLATFORM_ORIGINS)
		);
	});

	it('refuses a platform domain that is the origins site itself', () => {
		assert.throws(
			() => assertSeparateSandboxSite('snapflow.io', PLATFORM_ORIGINS),
			/separate site from API_URL/
		);
	});

	it('refuses a domain that cannot hold sandbox hosts', () => {
		assert.throws(
			() => assertSeparateSandboxSite('', PLATFORM_ORIGINS),
			/has no registrable domain/
		);
	});
});

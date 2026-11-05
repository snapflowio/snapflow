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
import {
	EXPOSURE_KIND,
	EXPOSURE_VISIBILITY,
} from '../../constants/exposure.constants';
import {
	HTTP_UPSTREAM_PROTOCOL,
	NETWORK_PROTOCOL,
	PROXY_PROTOCOL,
} from '../../constants/networking.constants';
import type { ExposurePolicy } from '../../types/networking.types';
import {
	isPublicExposure,
	isPublicExposurePolicy,
} from './public-ingress-policy.util';

const protectedHttpPolicy = {
	protocol: NETWORK_PROTOCOL.HTTP,
	visibility: EXPOSURE_VISIBILITY.PROTECTED,
	path: '/',
	stripPath: false,
	forceHttps: true,
	maxBodyBytes: 1,
	readTimeoutSeconds: 1,
	sendTimeoutSeconds: 1,
	retries: 0,
	streaming: true,
	upstreamProtocol: HTTP_UPSTREAM_PROTOCOL.HTTP,
	allowedOrigins: [],
	allowCredentials: false,
	showBrowserWarning: true,
} satisfies ExposurePolicy;

describe('public ingress policy', () => {
	it('allows protected HTTP and system exposures through the closed launch gate', () => {
		assert.equal(isPublicExposurePolicy(protectedHttpPolicy), false);
		assert.equal(
			isPublicExposure({
				kind: EXPOSURE_KIND.SYSTEM,
				policy: {
					protocol: NETWORK_PROTOCOL.TCP,
					proxyProtocol: PROXY_PROTOCOL.DISABLED,
					idleTimeoutSeconds: 1,
					connectionLimit: 1,
				},
			}),
			false
		);
	});

	it('classifies public HTTP, TCP, and UDP policies as public ingress', () => {
		assert.equal(
			isPublicExposurePolicy({
				...protectedHttpPolicy,
				visibility: EXPOSURE_VISIBILITY.PUBLIC,
			}),
			true
		);
		assert.equal(
			isPublicExposurePolicy({
				protocol: NETWORK_PROTOCOL.TCP,
				proxyProtocol: PROXY_PROTOCOL.DISABLED,
				idleTimeoutSeconds: 1,
				connectionLimit: 1,
			}),
			true
		);
		assert.equal(
			isPublicExposurePolicy({
				protocol: NETWORK_PROTOCOL.UDP,
				idleTimeoutSeconds: 1,
				flowLimit: 1,
				packetsPerSecond: 1,
				maximumDatagramPayloadBytes: 1,
			}),
			true
		);
	});
});

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_VISIBILITY,
} from '../../networking/constants/exposure.constants';
import {
	HTTP_UPSTREAM_PROTOCOL,
	NETWORK_PROTOCOL,
	PROXY_PROTOCOL,
} from '../../networking/constants/networking.constants';
import {
	type EdgeRouteSnapshotContent,
	edgeRouteSnapshotDigest,
} from '../../networking/utils/edge/edge-route-snapshot-digest.util';
import { canonicalJson } from './canonical-json.util';

const CROSS_LANGUAGE_VECTOR_INPUT = String.raw`{"z":"a&b<c>d e f","é":"ünïcødé 🚀","a":{"nested":[1,-2,9007199254740991,{"y":null,"x":true}],"empty":{}},"path":"/a&b","quote":"\"\/\b\f\n\r\t\u0001\u001f\u007f","￿":"bmp-last","😀":"astral"}`;
const CROSS_LANGUAGE_VECTOR_CANONICAL =
	'{"a":{"empty":{},"nested":[1,-2,9007199254740991,{"x":true,"y":null}]},' +
	'"path":"/a&b","quote":"\\"/\\b\\f\\n\\r\\t\\u0001\\u001f\u007f",' +
	'"z":"a&b<c>d e f",' +
	'"é":"ünïcødé \u{1F680}",' +
	'"\u{1F600}":"astral",' +
	'"￿":"bmp-last"}';
const CROSS_LANGUAGE_VECTOR_DIGEST =
	'6bcd7c00dcb4eae7a324cd0463fdd9b8a5ce3c4ab89c0545cc807965948fc8d8';
const ROUTE_SNAPSHOT_VECTOR_DIGEST =
	'70b3d78c4f5e8f3f485f2d639edf5f3974bd9cbb915f52ac14b687706127afe0';

const machineId = '22222222-2222-4222-8222-222222222222';
const bindingId = '33333333-3333-4333-8333-333333333333';

function routeBase(backendId: string) {
	return {
		backendId,
		state: EXPOSURE_BACKEND_STATE.ACTIVE,
		machineId,
		ownerId: '55555555-5555-4555-8555-555555555555',
		bindingId,
		interactive: true,
		assignmentGeneration: 9,
		exposureGeneration: 2,
		sandboxId: 'sandbox-ü',
		exposureId: '66666666-6666-4666-8666-666666666666',
		exposureName: 'web <ü> &   \u{1F680}',
		publicHost: 'app.example.test',
		targetHost: 'runtime',
		targetPort: 8080,
		leaseExpiresAt: '2026-09-01T12:00:50.000Z',
	};
}

const routeSnapshotVector: EdgeRouteSnapshotContent = {
	edgeId: '11111111-1111-4111-8111-111111111111',
	edgeSessionGeneration: 3,
	version: '42',
	generatedAt: '2026-09-01T12:00:00.000Z',
	expiresAt: '2026-09-01T12:00:45.000Z',
	trustedHttpProxyCidrs: ['192.0.2.0/24'],
	machineBindings: [
		{
			machineId,
			machineSessionGeneration: 4,
			bindingId,
			bindingRevision: 2_147_483_647,
			bindingDigest: 'b'.repeat(64),
			leaseExpiresAt: '2026-09-01T12:01:00.000Z',
		},
	],
	httpRoutes: [
		{
			...routeBase('44444444-4444-4444-8444-444444444444'),
			protocol: NETWORK_PROTOCOL.HTTP,
			trafficWeight: 100,
			hostnames: ['app.example.test', 'xn--bcher-kva.example'],
			policy: {
				visibility: EXPOSURE_VISIBILITY.PROTECTED,
				path: '/a&b',
				stripPath: true,
				forceHttps: false,
				requireTrustedProxy: true,
				maxBodyBytes: 1_073_741_824,
				readTimeoutSeconds: 30,
				sendTimeoutSeconds: 0,
				retries: 5,
				streaming: false,
				upstreamProtocol: HTTP_UPSTREAM_PROTOCOL.H2C,
				allowedOrigins: ['https://example.com/?a=1&b=2'],
				allowCredentials: true,
				showBrowserWarning: false,
			},
		},
	],
	tcpRoutes: [
		{
			...routeBase('77777777-7777-4777-8777-777777777777'),
			protocol: NETWORK_PROTOCOL.TCP,
			publicPort: 10_022,
			policy: {
				proxyProtocol: PROXY_PROTOCOL.V2,
				idleTimeoutSeconds: 600,
				connectionLimit: 1_000_000,
			},
		},
	],
	udpRoutes: [
		{
			...routeBase('88888888-8888-4888-8888-888888888888'),
			protocol: NETWORK_PROTOCOL.UDP,
			publicPort: 10_053,
			policy: {
				idleTimeoutSeconds: 60,
				flowLimit: 100,
				packetsPerSecond: 5_000,
				maximumDatagramPayloadBytes: 1_200,
			},
		},
	],
};

describe('canonical JSON cross-language vectors', () => {
	it('keeps HTML characters, line separators, and astral keys verbatim', () => {
		const encoded = canonicalJson(JSON.parse(CROSS_LANGUAGE_VECTOR_INPUT));

		assert.equal(encoded, CROSS_LANGUAGE_VECTOR_CANONICAL);
		assert.equal(
			createHash('sha256').update(encoded).digest('hex'),
			CROSS_LANGUAGE_VECTOR_DIGEST
		);
	});

	it('digests a route snapshot exactly as the Edge verifies it', () => {
		assert.equal(
			edgeRouteSnapshotDigest(routeSnapshotVector),
			ROUTE_SNAPSHOT_VECTOR_DIGEST
		);
	});
});

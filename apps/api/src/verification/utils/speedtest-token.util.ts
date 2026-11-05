/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createPrivateKey,
	createPublicKey,
	type KeyObject,
	sign,
} from 'node:crypto';
import { parse as parseUuid } from 'uuid';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { SPEEDTEST_TOKEN } from '../constants/benchmark-policy.constants';
import { uint64BigEndian } from './nonce-stream.util';

const PKCS8_PREFIX = Buffer.from(SPEEDTEST_TOKEN.ED25519_PKCS8_PREFIX, 'hex');
const DOMAIN_SEPARATOR = Uint8Array.of(0);

export interface SpeedtestSigningKey {
	keyId: string;
	privateKey: KeyObject;
	publicKey: KeyObject;
}

export interface SpeedtestTokenClaims {
	benchmarkId: string;
	expiresAt: Date;
	byteBudget: bigint;
}

export function speedtestSigningKey(
	keyId: string,
	seed: Uint8Array
): SpeedtestSigningKey {
	if (seed.length !== SPEEDTEST_TOKEN.ED25519_SEED_BYTES) {
		throw new Error('A speedtest signing seed must be 32 bytes');
	}
	const privateKey = createPrivateKey({
		key: Buffer.concat([PKCS8_PREFIX, seed]),
		format: 'der',
		type: 'pkcs8',
	});
	return { keyId, privateKey, publicKey: createPublicKey(privateKey) };
}

export function speedtestTokenPayload(claims: SpeedtestTokenClaims): Buffer {
	return Buffer.concat([
		Uint8Array.of(SPEEDTEST_TOKEN.VERSION),
		Uint8Array.from(parseUuid(claims.benchmarkId)),
		uint64BigEndian(
			BigInt(Math.floor(claims.expiresAt.getTime() / MILLISECONDS_PER_SECOND))
		),
		uint64BigEndian(claims.byteBudget),
	]);
}

export function speedtestTokenSignedBytes(payload: Uint8Array): Buffer {
	return Buffer.concat([
		Buffer.from(SPEEDTEST_TOKEN.SIGNATURE_DOMAIN, 'utf8'),
		DOMAIN_SEPARATOR,
		payload,
	]);
}

export function signSpeedtestToken(
	key: SpeedtestSigningKey,
	claims: SpeedtestTokenClaims
): string {
	const payload = speedtestTokenPayload(claims);
	const signature = sign(
		null,
		speedtestTokenSignedBytes(payload),
		key.privateKey
	);
	return `${key.keyId}${SPEEDTEST_TOKEN.KEY_SEPARATOR}${Buffer.concat([
		payload,
		signature,
	]).toString('base64url')}`;
}

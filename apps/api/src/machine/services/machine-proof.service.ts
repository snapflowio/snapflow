/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	createHash,
	createPublicKey,
	timingSafeEqual,
	verify,
} from 'node:crypto';
import {
	ForbiddenException,
	Injectable,
	ServiceUnavailableException,
	UnauthorizedException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	MACHINE_PROOF_ALGORITHM,
	MACHINE_PROOF_FUTURE_SKEW_SECONDS,
	MACHINE_PROOF_HEADER,
	MACHINE_PROOF_JTI_MAX_LENGTH,
	MACHINE_PROOF_MAX_AGE_SECONDS,
	MACHINE_PROOF_MAX_LENGTH,
	MACHINE_PROOF_REPLAY_KEY_PREFIX,
	MACHINE_PROOF_TYPE,
	MACHINE_SESSION_DURATION_MS,
} from '../constants/machine-session.constants';
import type { Machine } from '../entities/machine.entity';

const COMPACT_JWT_PARTS = 3;
const HTTP_HEADER_PAIR_SIZE = 2;
const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const REPLAY_VALUE = '1';
const REDIS_SET_IF_ABSENT = 'NX';
const REDIS_EXPIRY_MILLISECONDS = 'PX';

type MachineProofHeader = {
	typ: string;
	alg: string;
	jwk: {
		kty: string;
		crv: string;
		x: string;
		d?: string;
	};
};

type MachineProofClaims = {
	jti: string;
	htm: string;
	htu: string;
	iat: number;
	ath?: string;
};

@Injectable()
export class MachineProofService {
	constructor(
		@InjectRedis() private readonly redis: Redis,
		private readonly configService: TypedConfigService
	) {}

	async verify(
		request: Request,
		machine: Machine,
		accessToken?: string
	): Promise<void> {
		if (!machine.identityKeyId || !machine.identityPublicKey) {
			throw new ForbiddenException('Machine identity is revoked');
		}
		const compact = this.readProof(request);
		const [protectedPart, claimsPart, signaturePart] = compact.split('.');
		const header = this.decodePart<MachineProofHeader>(protectedPart);
		const claims = this.decodePart<MachineProofClaims>(claimsPart);
		this.validateHeader(header);
		this.validateClaims(claims, request, accessToken);

		const publicKey = this.publicKeyFromHeader(header);
		const signature = this.decodeBase64Url(signaturePart);
		if (
			signature.length !== ED25519_SIGNATURE_BYTES ||
			!verify(
				null,
				Buffer.from(`${protectedPart}.${claimsPart}`, 'ascii'),
				publicKey,
				signature
			)
		) {
			throw new UnauthorizedException('Machine proof signature is invalid');
		}

		const keyId = `ed25519:${createHash('sha256')
			.update(publicKey.export({ type: 'spki', format: 'der' }))
			.digest('hex')}`;
		if (!this.equalText(keyId, machine.identityKeyId)) {
			throw new UnauthorizedException(
				'Machine proof key does not match the enrolled identity'
			);
		}
		await this.claimReplayIdentifier(machine.id, claims.jti);
	}

	private readProof(request: Request): string {
		const value = request.headers[MACHINE_PROOF_HEADER];
		if (
			this.countRawProofHeaders(request) > 1 ||
			typeof value !== 'string' ||
			value.length === 0 ||
			value.length > MACHINE_PROOF_MAX_LENGTH ||
			value.split('.').length !== COMPACT_JWT_PARTS
		) {
			throw new UnauthorizedException('A valid DPoP machine proof is required');
		}
		return value;
	}

	private countRawProofHeaders(request: Request): number {
		let count = 0;
		for (
			let index = 0;
			index < request.rawHeaders.length;
			index += HTTP_HEADER_PAIR_SIZE
		) {
			if (
				request.rawHeaders[index]?.toLowerCase() ===
				MACHINE_PROOF_HEADER.toLowerCase()
			) {
				count += 1;
			}
		}
		return count;
	}

	private validateHeader(header: MachineProofHeader): void {
		if (
			header.typ !== MACHINE_PROOF_TYPE ||
			header.alg !== MACHINE_PROOF_ALGORITHM ||
			header.jwk?.kty !== 'OKP' ||
			header.jwk.crv !== 'Ed25519' ||
			typeof header.jwk.x !== 'string' ||
			header.jwk.d !== undefined
		) {
			throw new UnauthorizedException('Machine proof header is invalid');
		}
	}

	private validateClaims(
		claims: MachineProofClaims,
		request: Request,
		accessToken?: string
	): void {
		const now = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
		if (
			typeof claims.jti !== 'string' ||
			claims.jti.length === 0 ||
			claims.jti.length > MACHINE_PROOF_JTI_MAX_LENGTH ||
			typeof claims.iat !== 'number' ||
			!Number.isInteger(claims.iat) ||
			claims.iat < now - MACHINE_PROOF_MAX_AGE_SECONDS ||
			claims.iat > now + MACHINE_PROOF_FUTURE_SKEW_SECONDS ||
			claims.htm !== request.method.toUpperCase() ||
			claims.htu !== this.expectedTargetUri(request)
		) {
			throw new UnauthorizedException(
				'Machine proof claims are invalid or stale'
			);
		}

		if (accessToken === undefined) {
			if (claims.ath !== undefined) {
				throw new UnauthorizedException(
					'Bootstrap machine proof must not include an access-token hash'
				);
			}
			return;
		}
		const expectedHash = createHash('sha256')
			.update(accessToken)
			.digest('base64url');
		if (
			typeof claims.ath !== 'string' ||
			!this.equalText(claims.ath, expectedHash)
		) {
			throw new UnauthorizedException(
				'Machine proof is not bound to the active session'
			);
		}
	}

	private expectedTargetUri(request: Request): string {
		const configuredOrigin =
			this.configService.get('apiUrl') ??
			`http://localhost:${this.configService.getOrThrow('port')}`;
		const target = new URL(request.originalUrl, configuredOrigin);
		target.search = '';
		target.hash = '';
		return target.toString();
	}

	private publicKeyFromHeader(header: MachineProofHeader) {
		try {
			if (
				this.decodeBase64Url(header.jwk.x).length !== ED25519_PUBLIC_KEY_BYTES
			) {
				throw new Error('invalid Ed25519 public key length');
			}
			const key = createPublicKey({
				key: header.jwk,
				format: 'jwk',
			});
			if (key.asymmetricKeyType !== 'ed25519') {
				throw new Error('invalid Machine proof key type');
			}
			return key;
		} catch {
			throw new UnauthorizedException('Machine proof public key is invalid');
		}
	}

	private decodePart<T>(part: string): T {
		try {
			const decoded: unknown = JSON.parse(
				this.decodeBase64Url(part).toString('utf8')
			);
			if (
				typeof decoded !== 'object' ||
				decoded === null ||
				Array.isArray(decoded)
			) {
				throw new Error('proof part is not an object');
			}
			return decoded as T;
		} catch {
			throw new UnauthorizedException('Machine proof is malformed');
		}
	}

	private decodeBase64Url(value: string): Buffer {
		if (!BASE64URL_PATTERN.test(value)) {
			throw new UnauthorizedException('Machine proof encoding is invalid');
		}
		const decoded = Buffer.from(value, 'base64url');
		if (decoded.toString('base64url') !== value) {
			throw new UnauthorizedException(
				'Machine proof encoding is not canonical'
			);
		}
		return decoded;
	}

	private equalText(left: string, right: string): boolean {
		const leftBuffer = Buffer.from(left);
		const rightBuffer = Buffer.from(right);
		return (
			leftBuffer.length === rightBuffer.length &&
			timingSafeEqual(leftBuffer, rightBuffer)
		);
	}

	private async claimReplayIdentifier(
		machineId: string,
		identifier: string
	): Promise<void> {
		const digest = createHash('sha256').update(identifier).digest('hex');
		try {
			const result = await this.redis.set(
				`${MACHINE_PROOF_REPLAY_KEY_PREFIX}${machineId}:${digest}`,
				REPLAY_VALUE,
				REDIS_EXPIRY_MILLISECONDS,
				MACHINE_SESSION_DURATION_MS,
				REDIS_SET_IF_ABSENT
			);
			if (result !== 'OK') {
				throw new UnauthorizedException('Machine proof has already been used');
			}
		} catch (error: unknown) {
			if (error instanceof UnauthorizedException) throw error;
			throw new ServiceUnavailableException(
				'Machine proof replay protection is unavailable',
				{ cause: error }
			);
		}
	}
}

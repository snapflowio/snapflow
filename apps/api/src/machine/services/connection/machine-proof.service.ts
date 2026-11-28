/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, KeyObject, timingSafeEqual } from 'node:crypto';
import {
	Injectable,
	ServiceUnavailableException,
	UnauthorizedException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { EmbeddedJWK, errors, type JWTPayload, jwtVerify } from 'jose';
import { apiError } from '../../../common/utils/error/api-error.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { MACHINE_IDENTITY_KEY_PREFIX } from '../../constants/machine-registration.constants';
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
} from '../../constants/machine-session.constants';
import type { Machine } from '../../entities/machine.entity';
import { MachineApiErrorCode } from '../../enums/machine-api-error-code.enum';
import { machineProofRejected } from '../../utils/machine-error.util';
import { machineRemoved } from '../../utils/machine-removed.util';

const HTTP_HEADER_PAIR_SIZE = 2;
const KEY_ID_DIGEST = 'sha256';
const REPLAY_VALUE = '1';
const REDIS_SET_IF_ABSENT = 'NX';
const REDIS_EXPIRY_MILLISECONDS = 'PX';
const REQUIRED_CLAIMS = ['jti', 'htm', 'htu', 'iat'];
const TYP_CLAIM = 'typ';

const PROOF_REQUIRED = 'A valid DPoP machine proof is required';
const PROOF_KEY_MISMATCH =
	'Machine proof key does not match the enrolled identity';
const PROOF_BOOTSTRAP_TOKEN_HASH =
	'Bootstrap machine proof must not include an access-token hash';
const PROOF_SESSION_MISMATCH =
	'Machine proof is not bound to the active session';
const PROOF_REPLAYED = 'Machine proof has already been used';
const PROOF_MALFORMED = 'Machine proof is malformed';
const PROOF_HEADER_INVALID = 'Machine proof header is invalid';
const PROOF_KEY_INVALID = 'Machine proof public key is invalid';
const PROOF_SIGNATURE_INVALID = 'Machine proof signature is invalid';
const PROOF_CLAIMS_INVALID = 'Machine proof claims are invalid or stale';

type MachineProofClaims = JWTPayload & {
	htm?: unknown;
	htu?: unknown;
	ath?: unknown;
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
			throw machineRemoved(
				'Machine identity is revoked; the machine was removed'
			);
		}
		const { claims, key } = await this.verifyProof(this.readProof(request));
		const identifier = this.validateBinding(claims, request, accessToken);
		if (!this.equalText(this.keyId(key), machine.identityKeyId)) {
			throw machineProofRejected(PROOF_KEY_MISMATCH);
		}
		await this.claimReplayIdentifier(machine.id, identifier);
	}

	private readProof(request: Request): string {
		const value = request.headers[MACHINE_PROOF_HEADER];
		if (
			this.countRawProofHeaders(request) > 1 ||
			typeof value !== 'string' ||
			value.length === 0 ||
			value.length > MACHINE_PROOF_MAX_LENGTH
		) {
			throw machineProofRejected(PROOF_REQUIRED);
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
			if (request.rawHeaders[index]?.toLowerCase() === MACHINE_PROOF_HEADER) {
				count += 1;
			}
		}
		return count;
	}

	private async verifyProof(
		compact: string
	): Promise<{ claims: MachineProofClaims; key: CryptoKey }> {
		try {
			const { payload, key } = await jwtVerify<MachineProofClaims>(
				compact,
				EmbeddedJWK,
				{
					typ: MACHINE_PROOF_TYPE,
					algorithms: [MACHINE_PROOF_ALGORITHM],
					requiredClaims: REQUIRED_CLAIMS,
					maxTokenAge: MACHINE_PROOF_MAX_AGE_SECONDS,
					clockTolerance: MACHINE_PROOF_FUTURE_SKEW_SECONDS,
				}
			);
			if (!(key instanceof CryptoKey)) {
				throw machineProofRejected(PROOF_KEY_INVALID);
			}
			return { claims: payload, key };
		} catch (error: unknown) {
			throw this.proofError(error);
		}
	}

	private proofError(error: unknown): UnauthorizedException {
		if (error instanceof UnauthorizedException) return error;
		if (error instanceof errors.JWSSignatureVerificationFailed) {
			return machineProofRejected(PROOF_SIGNATURE_INVALID);
		}
		if (error instanceof errors.JOSEAlgNotAllowed) {
			return machineProofRejected(PROOF_HEADER_INVALID);
		}
		if (error instanceof errors.JWTClaimValidationFailed) {
			return machineProofRejected(
				error.claim === TYP_CLAIM ? PROOF_HEADER_INVALID : PROOF_CLAIMS_INVALID
			);
		}
		if (error instanceof errors.JWTExpired) {
			return machineProofRejected(PROOF_CLAIMS_INVALID);
		}
		if (
			error instanceof errors.JOSENotSupported ||
			error instanceof DOMException
		) {
			return machineProofRejected(PROOF_KEY_INVALID);
		}
		return machineProofRejected(PROOF_MALFORMED);
	}

	private validateBinding(
		claims: MachineProofClaims,
		request: Request,
		accessToken?: string
	): string {
		if (
			typeof claims.jti !== 'string' ||
			claims.jti.length === 0 ||
			claims.jti.length > MACHINE_PROOF_JTI_MAX_LENGTH ||
			claims.htm !== request.method.toUpperCase() ||
			claims.htu !== this.expectedTargetUri(request)
		) {
			throw machineProofRejected(PROOF_CLAIMS_INVALID);
		}

		if (accessToken === undefined) {
			if (claims.ath !== undefined) {
				throw machineProofRejected(PROOF_BOOTSTRAP_TOKEN_HASH);
			}
			return claims.jti;
		}
		const expectedHash = createHash(KEY_ID_DIGEST)
			.update(accessToken)
			.digest('base64url');
		if (
			typeof claims.ath !== 'string' ||
			!this.equalText(claims.ath, expectedHash)
		) {
			throw machineProofRejected(PROOF_SESSION_MISMATCH);
		}
		return claims.jti;
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

	private keyId(key: CryptoKey): string {
		const spki = KeyObject.from(key).export({ type: 'spki', format: 'der' });
		return `${MACHINE_IDENTITY_KEY_PREFIX}${createHash(KEY_ID_DIGEST)
			.update(spki)
			.digest('hex')}`;
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
		const digest = createHash(KEY_ID_DIGEST).update(identifier).digest('hex');
		try {
			const result = await this.redis.set(
				`${MACHINE_PROOF_REPLAY_KEY_PREFIX}${machineId}:${digest}`,
				REPLAY_VALUE,
				REDIS_EXPIRY_MILLISECONDS,
				MACHINE_SESSION_DURATION_MS,
				REDIS_SET_IF_ABSENT
			);
			if (result !== 'OK') {
				throw machineProofRejected(PROOF_REPLAYED);
			}
		} catch (error: unknown) {
			if (error instanceof UnauthorizedException) throw error;
			throw new ServiceUnavailableException(
				apiError(
					MachineApiErrorCode.AUTHENTICATION_UNAVAILABLE,
					'Machine authentication is unavailable right now. Retry in a few seconds.'
				),
				{ cause: error }
			);
		}
	}
}

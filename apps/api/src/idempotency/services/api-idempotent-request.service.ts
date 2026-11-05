/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	HttpException,
	HttpStatus,
	Injectable,
	InternalServerErrorException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { RETENTION_POLICY } from '../../common/constants/retention-policy.constants';
import { MILLISECONDS_PER_HOUR } from '../../common/constants/time.constants';
import { addMilliseconds } from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { ENCRYPTED_RECORD_KIND } from '../../infra/encryption/constants/encryption.constants';
import { DeterministicHmacService } from '../../infra/encryption/services/deterministic-hmac.service';
import { EnvelopeEncryptionService } from '../../infra/encryption/services/envelope-encryption.service';
import {
	IDEMPOTENCY_ADVISORY_LOCK_SEED,
	IDEMPOTENCY_FINGERPRINT_SCHEMA_VERSION,
	IDEMPOTENCY_HMAC_DOMAIN,
	IDEMPOTENCY_LIMITS,
	IDEMPOTENCY_PROBLEM_CODE,
	IDEMPOTENCY_RECORD_SCHEMA_VERSION,
	IDEMPOTENCY_RESPONSE_HEADER_ALLOWLIST,
	IDEMPOTENCY_RETRY_AFTER_SECONDS,
	IDEMPOTENCY_STATE,
} from '../constants/idempotency.constants';
import {
	ApiIdempotencyRecord,
	type IdempotencyTerminalProblem,
} from '../entities/api-idempotency-record.entity';
import type {
	IdempotentExecutionResult,
	IdempotentMutation,
	IdempotentMutationResponse,
	IdempotentRequestContext,
} from '../types/idempotent-request.types';
import { idempotencyFingerprintSubject } from '../utils/idempotency-fingerprint.util';
import { parseIdempotencyKey } from '../utils/idempotency-key.util';

const HTTP_STATUS_TOO_EARLY = 425;
const NON_TERMINAL_HTTP_STATUSES = new Set([
	HttpStatus.REQUEST_TIMEOUT,
	HTTP_STATUS_TOO_EARLY,
	HttpStatus.TOO_MANY_REQUESTS,
]);

@Injectable()
export class ApiIdempotentRequestService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly hmac: DeterministicHmacService,
		private readonly encryption: EnvelopeEncryptionService
	) {}

	async execute<T>(
		context: IdempotentRequestContext,
		mutation: IdempotentMutation<T>
	): Promise<IdempotentExecutionResult<T>> {
		this.validateContext(context);
		const key = parseIdempotencyKey(context.key);
		const fingerprintSubject = idempotencyFingerprintSubject({
			method: context.method.toUpperCase(),
			routeTemplate: context.routeTemplate,
			organizationId: context.organizationId,
			principalType: context.principal.type,
			principalId: context.principal.id,
			request: context.fingerprintInput,
		});
		const keyDigests = this.hmac.deriveCandidates(
			IDEMPOTENCY_HMAC_DOMAIN.KEY,
			key
		);
		const requestFingerprints = this.hmac.deriveCandidates(
			IDEMPOTENCY_HMAC_DOMAIN.REQUEST,
			fingerprintSubject
		);

		const outcome = await this.entityManager.transactional(
			async (manager) => {
				const activeKeyDigest = keyDigests[0];
				if (!activeKeyDigest) {
					throw new Error('The active HMAC keyring produced no key digest');
				}
				await this.acquireLock(manager, context, activeKeyDigest);
				const now = await databaseNow(manager);
				const existing = await manager.findOne(ApiIdempotencyRecord, {
					organizationId: context.organizationId,
					principalType: context.principal.type,
					principalId: context.principal.id,
					method: context.method.toUpperCase(),
					routeTemplate: context.routeTemplate,
					keyDigest: { $in: [...keyDigests] },
				});

				if (existing && existing.expiresAt > now) {
					return this.replay<T>(existing, requestFingerprints, context);
				}
				if (existing) {
					manager.remove(existing);
					await manager.flush();
				}

				return this.runMutation(
					manager,
					mutation,
					this.createRecord(
						context,
						activeKeyDigest,
						requestFingerprints[0],
						now
					),
					now
				);
			},
			{
				propagation: TransactionPropagation.REQUIRED,
			}
		);

		if ('rejection' in outcome) throw outcome.rejection;
		return outcome;
	}

	private async runMutation<T>(
		manager: EntityManager,
		mutation: IdempotentMutation<T>,
		record: ApiIdempotencyRecord,
		now: Date
	): Promise<IdempotentExecutionResult<T> | { rejection: HttpException }> {
		try {
			const response = await manager.transactional(mutation, {
				clear: true,
				propagation: TransactionPropagation.NESTED,
			});
			this.completeRecord(record, response, now);
			manager.persist(record);
			return { ...response, replayed: false };
		} catch (error) {
			if (!this.isTerminalError(error)) throw error;
			record.state = IDEMPOTENCY_STATE.FAILED_TERMINAL;
			record.terminalProblem = this.terminalProblem(error);
			record.completedAt = now;
			manager.persist(record);
			return { rejection: error };
		}
	}

	private createRecord(
		context: IdempotentRequestContext,
		keyDigest: string,
		requestFingerprint: string | undefined,
		now: Date
	): ApiIdempotencyRecord {
		if (!requestFingerprint) {
			throw new Error('The active HMAC keyring produced no derivation');
		}
		const record = new ApiIdempotencyRecord();
		record.id = v4();
		record.organizationId = context.organizationId;
		record.principalType = context.principal.type;
		record.principalId = context.principal.id;
		record.method = context.method.toUpperCase();
		record.routeTemplate = context.routeTemplate;
		record.keyDigest = keyDigest;
		record.requestFingerprint = requestFingerprint;
		record.fingerprintSchemaVersion = IDEMPOTENCY_FINGERPRINT_SCHEMA_VERSION;
		record.resourceType = null;
		record.resourceId = null;
		record.responseStatus = null;
		record.responseHeaders = null;
		record.responseBody = null;
		record.sensitiveResponseEnvelope = null;
		record.terminalProblem = null;
		record.completedAt = null;
		record.expiresAt = addMilliseconds(
			now,
			RETENTION_POLICY.idempotencyRecordHours * MILLISECONDS_PER_HOUR
		);
		return record;
	}

	private completeRecord<T>(
		record: ApiIdempotencyRecord,
		response: IdempotentMutationResponse<T>,
		now: Date
	): void {
		record.state = IDEMPOTENCY_STATE.COMPLETED;
		record.responseStatus = response.status;
		record.responseHeaders = this.allowedHeaders(response.headers);
		record.resourceType = response.resource?.type ?? null;
		record.resourceId = response.resource?.id ?? null;
		record.completedAt = now;
		if (response.sensitive) {
			const plaintext = Buffer.from(JSON.stringify(response.body), 'utf8');
			try {
				record.sensitiveResponseEnvelope = this.encryption.encrypt(plaintext, {
					recordKind: ENCRYPTED_RECORD_KIND.API_IDEMPOTENCY_RESPONSE,
					organizationId: record.organizationId,
					recordId: record.id,
					recordVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
					schemaVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
				});
			} finally {
				plaintext.fill(0);
			}
		} else {
			record.responseBody = response.body;
		}
	}

	private replay<T>(
		record: ApiIdempotencyRecord,
		requestFingerprints: readonly string[],
		context: IdempotentRequestContext
	): IdempotentExecutionResult<T> | { rejection: HttpException } {
		if (!requestFingerprints.includes(record.requestFingerprint)) {
			throw new UnprocessableEntityException({
				code: IDEMPOTENCY_PROBLEM_CODE.KEY_REUSED,
				message: 'Idempotency-Key was already used with a different request',
			});
		}
		if (record.state === IDEMPOTENCY_STATE.FAILED_TERMINAL) {
			if (!record.terminalProblem) throw this.corruptedResponse();
			return { rejection: this.problemException(record.terminalProblem) };
		}
		if (record.responseStatus === null) throw this.corruptedResponse();

		let body = record.responseBody as T;
		if (record.sensitiveResponseEnvelope) {
			const plaintext = this.encryption.decrypt(
				record.sensitiveResponseEnvelope,
				{
					recordKind: ENCRYPTED_RECORD_KIND.API_IDEMPOTENCY_RESPONSE,
					organizationId: context.organizationId,
					recordId: record.id,
					recordVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
					schemaVersion: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
				}
			);
			try {
				body = JSON.parse(plaintext.toString('utf8')) as T;
			} finally {
				plaintext.fill(0);
			}
		}
		return {
			body,
			status: record.responseStatus,
			headers: record.responseHeaders ?? undefined,
			resource:
				record.resourceType && record.resourceId
					? { type: record.resourceType, id: record.resourceId }
					: undefined,
			replayed: true,
		};
	}

	private async acquireLock(
		manager: EntityManager,
		context: IdempotentRequestContext,
		keyDigest: string
	): Promise<void> {
		const lockSubject = [
			context.organizationId,
			context.principal.type,
			context.principal.id,
			context.method.toUpperCase(),
			context.routeTemplate,
			keyDigest,
		].join('\u001f');
		const rows = await manager.execute<readonly { acquired: boolean }[]>(
			'SELECT pg_try_advisory_xact_lock(hashtextextended(?, ?)) AS acquired',
			[lockSubject, IDEMPOTENCY_ADVISORY_LOCK_SEED]
		);
		if (rows[0]?.acquired !== true) {
			throw new ConflictException({
				code: IDEMPOTENCY_PROBLEM_CODE.REQUEST_IN_PROGRESS,
				message: 'The original request is still in progress',
				retryAfterSeconds: IDEMPOTENCY_RETRY_AFTER_SECONDS,
			});
		}
	}

	private allowedHeaders(
		headers: Readonly<Record<string, string>> | undefined
	): Record<string, string> | null {
		if (!headers) return null;
		const allowed = Object.fromEntries(
			Object.entries(headers)
				.map(([name, value]) => [name.toLowerCase(), value] as const)
				.filter(([name]) =>
					IDEMPOTENCY_RESPONSE_HEADER_ALLOWLIST.includes(
						name as (typeof IDEMPOTENCY_RESPONSE_HEADER_ALLOWLIST)[number]
					)
				)
		);
		return Object.keys(allowed).length > 0 ? allowed : null;
	}

	private isTerminalError(error: unknown): error is HttpException {
		if (!(error instanceof HttpException)) return false;
		const status = error.getStatus();
		return (
			status >= HttpStatus.BAD_REQUEST &&
			status < HttpStatus.INTERNAL_SERVER_ERROR &&
			!NON_TERMINAL_HTTP_STATUSES.has(status)
		);
	}

	private terminalProblem(error: HttpException): IdempotencyTerminalProblem {
		const response = error.getResponse();
		const responseRecord =
			typeof response === 'object' && response !== null
				? (response as Record<string, unknown>)
				: undefined;
		const code =
			typeof responseRecord?.code === 'string'
				? responseRecord.code
				: 'request_rejected';
		const detailValue = responseRecord?.message ?? response;
		const detail =
			typeof detailValue === 'string' ? detailValue : 'Request was rejected';
		return {
			code,
			detail: detail.slice(0, IDEMPOTENCY_LIMITS.SAFE_DETAIL_MAX_LENGTH),
			status: error.getStatus(),
		};
	}

	private problemException(problem: IdempotencyTerminalProblem): HttpException {
		return new HttpException(
			{ code: problem.code, message: problem.detail },
			problem.status
		);
	}

	private corruptedResponse(): InternalServerErrorException {
		return new InternalServerErrorException({
			code: IDEMPOTENCY_PROBLEM_CODE.RESPONSE_CORRUPTED,
			message: 'The stored idempotent response is incomplete',
		});
	}

	private validateContext(context: IdempotentRequestContext): void {
		if (
			context.method.length === 0 ||
			context.method.length > IDEMPOTENCY_LIMITS.METHOD_MAX_LENGTH ||
			context.routeTemplate.length === 0 ||
			context.routeTemplate.length >
				IDEMPOTENCY_LIMITS.ROUTE_TEMPLATE_MAX_LENGTH
		) {
			throw new Error('Invalid idempotent request method or route template');
		}
	}
}

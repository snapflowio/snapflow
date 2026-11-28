/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CallHandler,
	ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
	InternalServerErrorException,
	Logger,
	NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { defer, firstValueFrom, Observable } from 'rxjs';
import { CustomHeaders } from '../../common/constants/header.constants';
import {
	BaseAuthContext,
	isBaseAuthContext,
} from '../../common/types/base-auth-context.types';
import { isOrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { getAuthContext } from '../../common/utils/auth-context.util';
import { normalizeHttpExceptionResponse } from '../../common/utils/error/http-exception-response.util';
import { truncateErrorMessage } from '../../common/utils/error/truncate-error-message.util';
import { AUDIT_CONTEXT_KEY, AuditContext } from '../decorators/audit.decorator';
import { AuditLog, AuditLogMetadata } from '../entities/audit-log.entity';
import { AuditService } from '../services/audit.service';
import {
	auditActorFromContext,
	auditOrganizationFromContext,
} from '../utils/audit-actor.util';
import { sanitizeAuditMetadata } from '../utils/audit-metadata.util';

const UNEXPECTED_ERROR_MESSAGE = 'An unexpected error occurred.';

interface AuditedRequest {
	auditContext: AuditContext;
	authContext: BaseAuthContext;
	request: Request;
	response: Response;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
	private readonly logger = new Logger(AuditInterceptor.name);

	constructor(
		private readonly reflector: Reflector,
		private readonly auditService: AuditService
	) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const auditContext = this.reflector.get<AuditContext | undefined>(
			AUDIT_CONTEXT_KEY,
			context.getHandler()
		);
		if (!auditContext) {
			return next.handle();
		}

		const audited: AuditedRequest = {
			auditContext,
			authContext: getAuthContext(context, isBaseAuthContext),
			request: context.switchToHttp().getRequest<Request>(),
			response: context.switchToHttp().getResponse<Response>(),
		};
		return defer(() => this.handleAuditedRequest(audited, next));
	}

	private async handleAuditedRequest(
		audited: AuditedRequest,
		next: CallHandler
	): Promise<unknown> {
		const { auditContext, authContext, request, response } = audited;
		const organizationId = auditOrganizationFromContext(authContext);
		const auditLog = await this.createLog(audited, organizationId);

		try {
			const result: unknown = await firstValueFrom(next.handle());
			await this.recordHandlerSuccess(
				auditLog,
				resolveOrganizationId(organizationId, result),
				this.resolveTargetId(auditContext, request, result),
				response.statusCode || HttpStatus.NO_CONTENT,
				this.resolveMetadata(auditContext.resultMetadata, result)
			);
			return result;
		} catch (handlerError) {
			await this.recordHandlerError(
				auditLog,
				handlerErrorMessage(handlerError),
				handlerErrorStatusCode(handlerError)
			);
			throw handlerError;
		}
	}

	private async createLog(
		{ auditContext, authContext, request }: AuditedRequest,
		organizationId: string | undefined
	): Promise<AuditLog> {
		try {
			return await this.auditService.createLog({
				...auditActorFromContext(authContext),
				organizationId,
				userId: isOrganizationAuthContext(authContext)
					? authContext.userId
					: undefined,
				action: auditContext.action,
				targetType: auditContext.targetType,
				targetId: this.resolveTargetId(auditContext, request) ?? undefined,
				ipAddress: request.ip,
				userAgent: request.get('user-agent'),
				source: request.get(CustomHeaders.SOURCE.name),
				metadata:
					this.resolveMetadata(auditContext.requestMetadata, request) ??
					undefined,
			});
		} catch (createLogError) {
			this.logger.error('Failed to create audit log:', createLogError);
			throw new InternalServerErrorException();
		}
	}

	private resolveTargetId(
		auditContext: AuditContext,
		request: Request,
		result?: unknown
	): string | null {
		const fromResult =
			auditContext.targetIdFromResult && result
				? normalizeTargetId(auditContext.targetIdFromResult(result))
				: null;
		return (
			fromResult ??
			normalizeTargetId(auditContext.targetIdFromRequest?.(request))
		);
	}

	private resolveMetadata<T>(
		resolvers: Record<string, (input: T) => unknown> | undefined,
		input: T
	): AuditLogMetadata | null {
		if (!resolvers) {
			return null;
		}

		const resolvedMetadata: AuditLogMetadata = {};

		for (const [key, resolver] of Object.entries(resolvers)) {
			try {
				resolvedMetadata[key] = resolver(input);
			} catch (error) {
				this.logger.warn(
					`Failed to resolve audit log metadata key "${key}":`,
					error
				);
				resolvedMetadata[key] = null;
			}
		}

		const sanitized = sanitizeAuditMetadata(resolvedMetadata);
		return Object.keys(sanitized).length > 0 ? sanitized : null;
	}

	private async recordHandlerSuccess(
		auditLog: AuditLog,
		organizationId: string | null,
		targetId: string | null,
		statusCode: number,
		metadata: AuditLogMetadata | null
	): Promise<void> {
		try {
			await this.auditService.updateLog(auditLog.id, {
				organizationId: organizationId ?? undefined,
				targetId: targetId ?? undefined,
				statusCode,
				metadata: metadata ?? undefined,
			});
		} catch (error) {
			this.logger.error('Failed to record handler result:', error);
		}
	}

	private async recordHandlerError(
		auditLog: AuditLog,
		errorMessage: string,
		statusCode: number
	): Promise<void> {
		try {
			await this.auditService.updateLog(auditLog.id, {
				errorMessage,
				statusCode,
			});
		} catch (error) {
			this.logger.error('Failed to record handler error:', error);
		}
	}
}

function resolveOrganizationId(
	organizationId: string | undefined,
	result: unknown
): string | null {
	const fromResult =
		typeof result === 'object' &&
		result !== null &&
		'organizationId' in result &&
		typeof result.organizationId === 'string'
			? result.organizationId
			: null;
	return fromResult || organizationId || null;
}

function normalizeTargetId(
	targetId: string | readonly string[] | null | undefined
): string | null {
	if (typeof targetId === 'string') {
		return targetId || null;
	}
	return targetId?.[0] || null;
}

function handlerErrorMessage(error: unknown): string {
	return error instanceof HttpException
		? truncateErrorMessage(
				normalizeHttpExceptionResponse(error.getResponse(), error.message)
					.message
			)
		: UNEXPECTED_ERROR_MESSAGE;
}

function handlerErrorStatusCode(error: unknown): number {
	return error instanceof HttpException
		? error.getStatus()
		: HttpStatus.INTERNAL_SERVER_ERROR;
}

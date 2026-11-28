/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import {
	enqueueLimitsNotice,
	noticeKey,
} from '../../notification/utils/notice-outbox.util';
import {
	LimitsNoticeKind,
	NO_QUOTA_TIER,
	QUOTA_INCREASE_REQUEST,
} from '../constants/organization-quota-tier.constants';
import {
	type AdminQuotaIncreaseRequestPageDto,
	type ApproveQuotaIncreaseRequestDto,
	type CreateQuotaIncreaseRequestDto,
	type DenyQuotaIncreaseRequestDto,
	type ListQuotaIncreaseRequestsQueryDto,
	QuotaIncreaseRequestDto,
} from '../dto/quota-increase-request.dto';
import { Organization } from '../entities/organization.entity';
import { OrganizationQuotaIncreaseRequest } from '../entities/organization-quota-increase-request.entity';
import { QuotaIncreaseRequestErrorCode } from '../enums/quota-increase-request-error-code.enum';
import { QuotaIncreaseRequestStatus } from '../enums/quota-increase-request-status.enum';
import {
	type LimitsNotice,
	LimitsNoticeEvent,
} from '../events/limits-notice.event';
import { OrganizationQuotaService } from './organization-quota.service';

type Decision =
	| { status: QuotaIncreaseRequestStatus.APPROVED; reason: string | null }
	| { status: QuotaIncreaseRequestStatus.DENIED; reason: string };

@Injectable()
export class OrganizationQuotaIncreaseRequestService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly quotas: OrganizationQuotaService
	) {}

	async create(
		organizationId: string,
		userId: string,
		input: CreateQuotaIncreaseRequestDto
	): Promise<QuotaIncreaseRequestDto> {
		const pending = await this.entityManager.count(
			OrganizationQuotaIncreaseRequest,
			{
				organizationId,
				sandboxClass: input.sandboxClass,
				status: QuotaIncreaseRequestStatus.PENDING,
			}
		);
		if (pending > 0) {
			throw new ConflictException(
				apiError(
					QuotaIncreaseRequestErrorCode.ALREADY_PENDING,
					`This organization already has a pending request for higher ${input.sandboxClass} limits. Wait for the review before sending another.`
				)
			);
		}
		const request = this.entityManager.create(
			OrganizationQuotaIncreaseRequest,
			{
				organizationId,
				sandboxClass: input.sandboxClass,
				requestedCpu: input.requestedCpu,
				requestedMemory: input.requestedMemory,
				requestedDisk: input.requestedDisk,
				requestedGpu: input.requestedGpu,
				useCase: input.useCase.trim(),
				requestedBy: userId,
			}
		);
		await this.entityManager.flush();
		return QuotaIncreaseRequestDto.from(request);
	}

	async listForOrganization(
		organizationId: string
	): Promise<QuotaIncreaseRequestDto[]> {
		const requests = await this.entityManager.find(
			OrganizationQuotaIncreaseRequest,
			{ organizationId },
			{
				orderBy: { createdAt: 'DESC', id: 'DESC' },
				limit: QUOTA_INCREASE_REQUEST.historyLimit,
			}
		);
		return requests.map(QuotaIncreaseRequestDto.from);
	}

	async list(
		query: ListQuotaIncreaseRequestsQueryDto
	): Promise<AdminQuotaIncreaseRequestPageDto> {
		const page = await findCursorPage(
			this.entityManager,
			OrganizationQuotaIncreaseRequest,
			{
				where: query.status ? { status: query.status } : {},
				orderBy: { createdAt: 'DESC', id: 'DESC' },
				limit: query.limit,
				cursor: query.cursor,
			}
		);
		const organizations = await this.entityManager.find(
			Organization,
			{
				id: {
					$in: [...new Set(page.items.map((item) => item.organizationId))],
				},
			},
			{ fields: ['name', 'quotaTier'] }
		);
		const byId = new Map(
			organizations.map((organization) => [organization.id, organization])
		);
		return {
			nextCursor: page.nextCursor,
			items: page.items.map((request) => {
				const organization = byId.get(request.organizationId);
				return {
					...QuotaIncreaseRequestDto.from(request),
					organizationName: organization?.name ?? null,
					organizationTier: organization?.quotaTier ?? NO_QUOTA_TIER,
				};
			}),
		};
	}

	approve(
		requestId: string,
		adminUserId: string,
		input: ApproveQuotaIncreaseRequestDto
	): Promise<QuotaIncreaseRequestDto> {
		return this.decide(requestId, adminUserId, {
			status: QuotaIncreaseRequestStatus.APPROVED,
			reason: input.note?.trim() || null,
		});
	}

	deny(
		requestId: string,
		adminUserId: string,
		input: DenyQuotaIncreaseRequestDto
	): Promise<QuotaIncreaseRequestDto> {
		return this.decide(requestId, adminUserId, {
			status: QuotaIncreaseRequestStatus.DENIED,
			reason: input.reason.trim(),
		});
	}

	private decide(
		requestId: string,
		adminUserId: string,
		decision: Decision
	): Promise<QuotaIncreaseRequestDto> {
		return this.entityManager.transactional(async (manager) => {
			const request = await manager.findOne(
				OrganizationQuotaIncreaseRequest,
				{ id: requestId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			if (!request) {
				throw new NotFoundException(
					`Quota increase request ${requestId} was not found`
				);
			}
			if (request.status !== QuotaIncreaseRequestStatus.PENDING) {
				throw new ConflictException(
					apiError(
						QuotaIncreaseRequestErrorCode.NOT_PENDING,
						`Quota increase request ${requestId} was already ${request.status}.`
					)
				);
			}
			const now = await databaseNow(manager);
			if (decision.status === QuotaIncreaseRequestStatus.APPROVED) {
				await this.quotas.raise(
					manager,
					request.organizationId,
					request.sandboxClass,
					{
						cpu: request.requestedCpu,
						memory: request.requestedMemory,
						disk: request.requestedDisk,
						gpu: request.requestedGpu,
					}
				);
			}
			request.status = decision.status;
			request.reviewedBy = adminUserId;
			request.reviewedAt = now;
			request.decisionReason = decision.reason;
			const notice = this.decisionNotice(request, decision);
			await enqueueLimitsNotice(
				manager,
				new LimitsNoticeEvent(
					request.organizationId,
					noticeKey(notice.kind, request.id),
					notice,
					now
				)
			);
			await manager.flush();
			return QuotaIncreaseRequestDto.from(request);
		});
	}

	private decisionNotice(
		request: OrganizationQuotaIncreaseRequest,
		decision: Decision
	): LimitsNotice {
		const decided = {
			requestId: request.id,
			requesterUserId: request.requestedBy,
			sandboxClass: request.sandboxClass,
			cpu: request.requestedCpu,
			memory: request.requestedMemory,
			disk: request.requestedDisk,
			gpu: request.requestedGpu,
		};
		return decision.status === QuotaIncreaseRequestStatus.APPROVED
			? { kind: LimitsNoticeKind.INCREASE_APPROVED, ...decided }
			: {
					kind: LimitsNoticeKind.INCREASE_DENIED,
					reason: decision.reason,
					...decided,
				};
	}
}

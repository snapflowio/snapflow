/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { findCursorPage } from '../../../common/utils/pagination/cursor-page.util';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Sandbox } from '../../../sandbox/instance/entities/sandbox.entity';
import { SandboxPlacement } from '../../../sandbox/instance/entities/sandbox-placement.entity';
import { SandboxBillingState } from '../constants/billing.constants';
import type {
	BillingLineItemDto,
	BillingLineItemPageDto,
	BillingSandboxUsageDto,
	BillingSandboxUsagePageDto,
	ExportBillingQueryDto,
	ListBillingSandboxUsageQueryDto,
	ListBillingUsageQueryDto,
	SandboxBillingSummaryDto,
} from '../dto/billing.dto';
import { BillingLineAdjustment } from '../entities/billing-line-adjustment.entity';
import { BillingLineItem } from '../entities/billing-line-item.entity';
import { PlacementBillingAuthorization } from '../entities/placement-billing-authorization.entity';
import { liveAccrualByPlacement } from '../queries/live-accrual.query';
import {
	SandboxUsageSort,
	SandboxUsageSortDirection,
	sandboxUsageRows,
	sandboxUsageTotal,
} from '../queries/sandbox-usage.query';
import {
	decodeSandboxUsageCursor,
	sandboxUsagePage,
	toSandboxUsageDto,
} from '../utils/billing-sandbox-usage.util';
import { billingLineAmounts } from '../utils/line-item/billing-line-amount.util';

const BILLING_EXPORT_MAXIMUM_LINES = 10_000;
const SINGLE_SANDBOX_LIMIT = 1;
const NEWEST_LINES_FIRST = {
	serviceThrough: QueryOrder.DESC,
	id: QueryOrder.DESC,
} as const;

@Injectable()
export class BillingLineQueryService {
	constructor(private readonly entityManager: EntityManager) {}

	async usage(
		organizationId: string,
		input: ListBillingUsageQueryDto
	): Promise<BillingLineItemPageDto> {
		const page = await findCursorPage(this.entityManager, BillingLineItem, {
			where: {
				customerOrganizationId: organizationId,
				...(input.chargeClass ? { chargeClass: input.chargeClass } : {}),
				...(input.sandboxId ? { sandboxId: input.sandboxId } : {}),
				...serviceWindow(input),
			},
			orderBy: NEWEST_LINES_FIRST,
			limit: input.limit,
			cursor: input.cursor,
		});
		return { ...page, items: await this.toLineDtos(page.items) };
	}

	async sandboxUsage(
		organizationId: string,
		input: ListBillingSandboxUsageQueryDto
	): Promise<BillingSandboxUsagePageDto> {
		const filter = {
			organizationId,
			search: input.search?.trim() || undefined,
			from: input.from,
			to: input.to,
		};
		const [rows, totalMicroUsd] = await Promise.all([
			sandboxUsageRows(this.entityManager, {
				...filter,
				limit: input.limit + 1,
				sort: input.sort,
				direction: input.direction,
				after: input.cursor
					? decodeSandboxUsageCursor(input.cursor, input.sort)
					: undefined,
			}),
			sandboxUsageTotal(this.entityManager, filter),
		]);
		return {
			...sandboxUsagePage(rows, input.limit, input.sort),
			totalMicroUsd,
		};
	}

	async sandboxUsageSummary(
		organizationId: string,
		sandboxId: string
	): Promise<BillingSandboxUsageDto> {
		const [row] = await sandboxUsageRows(this.entityManager, {
			organizationId,
			sandboxId,
			limit: SINGLE_SANDBOX_LIMIT,
			sort: SandboxUsageSort.LAST_ACTIVITY,
			direction: SandboxUsageSortDirection.DESC,
		});
		if (!row) {
			throw new NotFoundException('No billing usage was found for the sandbox');
		}
		return toSandboxUsageDto(row);
	}

	async line(
		organizationId: string,
		lineItemId: string
	): Promise<BillingLineItemDto> {
		const line = await this.entityManager.findOne(BillingLineItem, {
			id: lineItemId,
			customerOrganizationId: organizationId,
		});
		if (!line) throw new NotFoundException('Billing line item was not found');
		const [dto] = await this.toLineDtos([line]);
		return dto;
	}

	async exportUsage(
		organizationId: string,
		input: ExportBillingQueryDto
	): Promise<BillingLineItemDto[]> {
		const lines = await this.entityManager.find(
			BillingLineItem,
			{ customerOrganizationId: organizationId, ...serviceWindow(input) },
			{ orderBy: NEWEST_LINES_FIRST, limit: BILLING_EXPORT_MAXIMUM_LINES }
		);
		return this.toLineDtos(lines);
	}

	async sandboxSummary(
		organizationId: string,
		sandboxId: string
	): Promise<SandboxBillingSummaryDto> {
		const sandbox = await this.entityManager.findOne(Sandbox, {
			id: sandboxId,
			organizationId,
		});
		if (!sandbox) throw new NotFoundException('Sandbox was not found');
		const placement = await this.entityManager.findOne(SandboxPlacement, {
			sandboxId: sandbox.id,
			releasedAt: null,
		});
		if (!placement) return { state: SandboxBillingState.PENDING };
		const authorization = await this.entityManager.findOne(
			PlacementBillingAuthorization,
			{ placementId: placement.id }
		);
		if (!authorization) return { state: SandboxBillingState.PENDING };
		const liveAccrual = MicroUsd.sum(
			(
				await liveAccrualByPlacement(
					this.entityManager,
					{ placementId: placement.id, endAt: null },
					await databaseNow(this.entityManager)
				)
			).values()
		);
		return {
			state: SandboxBillingState.ACTIVE,
			placementId: placement.id,
			assignmentGeneration: placement.assignmentGeneration,
			estimatedHourlyMicroUsd: authorization.estimatedHourlyMicroUsd,
			liveAccrualMicroUsd: liveAccrual.toString(),
			remainingReservedMicroUsd: authorization.remainingReservedMicroUsd,
			leaseId: authorization.leaseId,
			reservationExpiresAt: authorization.expiresAt,
			fundingState: authorization.fundingState,
			billingCutoffAt: authorization.billingCutoffAt ?? undefined,
		};
	}

	private async toLineDtos(
		lines: readonly BillingLineItem[]
	): Promise<BillingLineItemDto[]> {
		const adjustments = await this.adjustmentsFor(lines);
		return lines.map((line) => toLineDto(line, adjustments.get(line.id) ?? []));
	}

	private async adjustmentsFor(
		lines: readonly BillingLineItem[]
	): Promise<Map<string, BillingLineAdjustment[]>> {
		if (lines.length === 0) return new Map();
		const adjustments = await this.entityManager.find(BillingLineAdjustment, {
			lineItemId: { $in: lines.map(({ id }) => id) },
		});
		const byLine = new Map<string, BillingLineAdjustment[]>();
		for (const adjustment of adjustments) {
			const entries = byLine.get(adjustment.lineItemId) ?? [];
			entries.push(adjustment);
			byLine.set(adjustment.lineItemId, entries);
		}
		return byLine;
	}
}

function serviceWindow(input: Pick<ExportBillingQueryDto, 'from' | 'to'>): {
	serviceThrough?: { $gte?: Date; $lt?: Date };
} {
	if (!input.from && !input.to) return {};
	return {
		serviceThrough: {
			...(input.from ? { $gte: input.from } : {}),
			...(input.to ? { $lt: input.to } : {}),
		},
	};
}

function toLineDto(
	line: BillingLineItem,
	adjustments: readonly BillingLineAdjustment[]
): BillingLineItemDto {
	const amounts = billingLineAmounts(line, adjustments);
	return {
		id: line.id,
		customerOrganizationId: line.customerOrganizationId,
		chargeClass: line.chargeClass,
		sandboxId: line.sandboxId,
		placementId: line.placementId,
		machineId: line.machineId,
		hostOrganizationId: line.hostOrganizationId ?? undefined,
		resourceSku: line.resourceSku,
		periodStart: line.periodStart,
		periodEnd: line.periodEnd,
		grossMicroUsd: line.grossMicroUsd,
		adjustmentMicroUsd: amounts.adjustmentMicroUsd,
		effectiveMicroUsd: amounts.effectiveMicroUsd,
		consumedQuantities: line.consumedQuantities,
		leaseId: line.leaseId ?? undefined,
		quantities: line.quantities ?? undefined,
		evidenceStatus: line.evidenceStatus,
		contentDigest: line.contentDigest,
		reconciliationReason: line.reconciliationReason ?? undefined,
		reconciledAt: line.reconciledAt ?? undefined,
		sourceType: line.sourceType,
		sourceId: line.sourceId,
		schemaVersion: line.schemaVersion,
	};
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { v4 } from 'uuid';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import type { NetworkUsagePeriod } from '../../network-usage/entities/network-usage-period.entity';
import type { SandboxBillableUsage } from '../../usage/entities/sandbox-billable-usage.entity';
import type { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import {
	BILLING_LINE_SCHEMA_VERSION,
	BillingBeneficiaryKind,
	BillingChargeClass,
	BillingEvidenceStatus,
	BillingLineSourceType,
} from '../constants/billing.constants';
import { BillingLineItem } from '../entities/billing-line-item.entity';
import {
	type BillingLineContentSource,
	billingLineContentDigest,
} from '../utils/line-item/billing-line-content.util';
import { networkLineContent } from '../utils/line-item/network-line-content.util';
import { lockChargedAuthorization } from '../utils/placement-admission.util';

type ReservationCharge = Pick<
	BillingLineContentSource,
	| 'placementId'
	| 'customerOrganizationId'
	| 'hostOrganizationId'
	| 'grossMicroUsd'
>;

@Injectable()
export class BillingLineItemService {
	async findRequired(
		manager: EntityManager,
		sourceType: BillingLineSourceType,
		sourceId: string,
		lockMode?: LockMode
	): Promise<BillingLineItem> {
		const line = await manager.findOne(
			BillingLineItem,
			{ sourceType, sourceId },
			{ lockMode }
		);
		if (!line) {
			throw new Error(`Billing line for ${sourceType}:${sourceId} is missing`);
		}
		return line;
	}

	async projectCompute(
		manager: EntityManager,
		period: SandboxUsagePeriod,
		billable: SandboxBillableUsage
	): Promise<BillingLineItem> {
		const content = {
			schemaVersion: BILLING_LINE_SCHEMA_VERSION,
			sourceType: BillingLineSourceType.SANDBOX_USAGE_PERIOD,
			sourceId: period.id,
			sourceVersion: billable.policyVersion,
			chargeClass: BillingChargeClass.COMPUTE,
			customerOrganizationId: billable.customerOrganizationId,
			beneficiaryKind: BillingBeneficiaryKind.HOST_ORGANIZATION,
			beneficiaryReference: billable.hostOrganizationId,
			hostOrganizationId: billable.hostOrganizationId,
			sandboxId: billable.sandboxId,
			placementId: billable.placementId,
			machineId: billable.machineId,
			assignmentGeneration: billable.assignmentGeneration,
			resourceSku: period.sandboxClass,
			periodStart: billable.startAt,
			periodEnd: billable.endAt,
			serviceThrough: billable.endAt,
			consumedQuantities: {
				durationMillis: billable.durationMillis,
				cpu: billable.cpu,
				memoryGiB: billable.memoryGiB,
				diskGiB: billable.diskGiB,
				gpu: billable.gpu,
			},
			leaseId: billable.leaseId,
			quantities: {
				vcpuMillis: billable.vcpuMillis,
				memoryGibMillis: billable.memoryGibMillis,
				gpuMillis: billable.gpuMillis,
				runningDiskGibMillis: billable.runningDiskGibMillis,
				stoppedDiskGibMillis: billable.stoppedDiskGibMillis,
			},
			grossMicroUsd: billable.totalChargeMicroUsd,
			hostMicroUsd: billable.hostChargeMicroUsd,
			markupMicroUsd: billable.markupChargeMicroUsd,
		} satisfies BillingLineContentSource;
		const values = {
			...content,
			contentDigest: billingLineContentDigest(content),
			evidenceStatus: billable.evidenceStatus,
			reconciliationReason: billable.reconciliationReason,
			reconciledAt: billable.reconciledAt,
			earningsReleasedAt: null,
		};
		const result = await this.createIdempotently(manager, values);
		if (result.created) {
			await this.consumeReservation(manager, content);
		}
		return result.line;
	}

	async projectNetwork(
		manager: EntityManager,
		period: NetworkUsagePeriod
	): Promise<BillingLineItem> {
		const content = networkLineContent(period);
		const result = await this.createIdempotently(manager, {
			...content,
			contentDigest: billingLineContentDigest(content),
			evidenceStatus: BillingEvidenceStatus.PENDING,
			reconciliationReason: null,
			reconciledAt: null,
			earningsReleasedAt: null,
		});
		if (result.created) {
			await this.consumeReservation(manager, content);
		}
		return result.line;
	}

	private async createIdempotently(
		manager: EntityManager,
		values: Omit<BillingLineItem, 'id' | 'createdAt'>
	): Promise<{ line: BillingLineItem; created: boolean }> {
		const existing = await manager.findOne(BillingLineItem, {
			sourceType: values.sourceType,
			sourceId: values.sourceId,
			sourceVersion: values.sourceVersion,
		});
		if (existing) {
			if (
				existing.contentDigest !== values.contentDigest ||
				billingLineContentDigest(existing) !== values.contentDigest
			) {
				throw new Error(
					`Billing source ${values.sourceType}:${values.sourceId}:${values.sourceVersion} was replayed with different content`
				);
			}
			return { line: existing, created: false };
		}
		const line = manager.create(BillingLineItem, {
			...values,
			id: v4(),
			createdAt: await databaseNow(manager),
		});
		manager.persist(line);
		return { line, created: true };
	}

	private async consumeReservation(
		manager: EntityManager,
		charge: ReservationCharge
	): Promise<void> {
		const chargeMicroUsd = MicroUsd.parse(charge.grossMicroUsd);
		if (!chargeMicroUsd.isPositive()) return;
		const authorization = await lockChargedAuthorization(
			manager,
			charge.placementId,
			[charge.customerOrganizationId, charge.hostOrganizationId]
		);
		if (!authorization || authorization.releasedAt) return;
		const remaining = MicroUsd.parse(authorization.remainingReservedMicroUsd);
		authorization.remainingReservedMicroUsd = remaining
			.subtract(chargeMicroUsd)
			.nonnegative()
			.toString();
	}
}

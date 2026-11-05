/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../common/utils/canonical-json.util';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';

export type BillingLineContentSource = Omit<
	BillingLineItem,
	| 'id'
	| 'contentDigest'
	| 'evidenceStatus'
	| 'reconciliationReason'
	| 'reconciledAt'
	| 'earningsReleasedAt'
	| 'createdAt'
>;

function billingLineContent(source: BillingLineContentSource) {
	return {
		schemaVersion: source.schemaVersion,
		sourceType: source.sourceType,
		sourceId: source.sourceId,
		sourceVersion: source.sourceVersion,
		chargeClass: source.chargeClass,
		customerOrganizationId: source.customerOrganizationId,
		beneficiaryKind: source.beneficiaryKind,
		beneficiaryReference: source.beneficiaryReference,
		hostOrganizationId: source.hostOrganizationId,
		sandboxId: source.sandboxId,
		placementId: source.placementId,
		machineId: source.machineId,
		assignmentGeneration: source.assignmentGeneration,
		resourceSku: source.resourceSku,
		periodStart: source.periodStart.toISOString(),
		periodEnd: source.periodEnd.toISOString(),
		serviceThrough: source.serviceThrough.toISOString(),
		consumedQuantities: source.consumedQuantities,
		leaseId: source.leaseId,
		quantities: source.quantities,
		grossMicroUsd: source.grossMicroUsd,
		hostMicroUsd: source.hostMicroUsd,
		markupMicroUsd: source.markupMicroUsd,
	};
}

export function billingLineContentDigest(
	source: BillingLineContentSource
): string {
	return createHash('sha256')
		.update(canonicalJson(billingLineContent(source)))
		.digest('hex');
}

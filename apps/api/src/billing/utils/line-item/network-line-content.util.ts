/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { NetworkUsagePeriod } from '../../../networking/usage/entities/network-usage-period.entity';
import {
	BILLING_LINE_SCHEMA_VERSION,
	BillingBeneficiaryKind,
	BillingChargeClass,
	BillingLineSourceType,
} from '../../constants/billing.constants';
import type { BillingLineContentSource } from './billing-line-content.util';

const NETWORK_LINE_SOURCE_VERSION = 1;
const NETWORK_EGRESS_SKU = 'egress';

export function networkLineContent(
	period: NetworkUsagePeriod
): BillingLineContentSource {
	return {
		schemaVersion: BILLING_LINE_SCHEMA_VERSION,
		sourceType: BillingLineSourceType.NETWORK_USAGE_PERIOD,
		sourceId: period.id,
		sourceVersion: NETWORK_LINE_SOURCE_VERSION,
		chargeClass: BillingChargeClass.NETWORK,
		customerOrganizationId: period.customerOrganizationId,
		beneficiaryKind: BillingBeneficiaryKind.HOST_ORGANIZATION,
		beneficiaryReference: period.hostOrganizationId,
		hostOrganizationId: period.hostOrganizationId,
		sandboxId: period.sandboxId,
		placementId: period.placementId,
		machineId: period.machineId,
		assignmentGeneration: period.assignmentGeneration,
		resourceSku: NETWORK_EGRESS_SKU,
		periodStart: period.periodStart,
		periodEnd: period.periodEnd,
		serviceThrough: period.periodEnd,
		consumedQuantities: {
			billedEgressBytes: period.billedEgressBytes,
			edgeEgressBytes: period.edgeEgressBytes,
			internetEgressBytes: period.internetEgressBytes,
			internetIngressBytes: period.internetIngressBytes,
		},
		leaseId: period.leaseId,
		quantities: null,
		grossMicroUsd: period.grossMicroUsd,
		hostMicroUsd: period.hostMicroUsd,
		markupMicroUsd: period.markupMicroUsd,
	};
}

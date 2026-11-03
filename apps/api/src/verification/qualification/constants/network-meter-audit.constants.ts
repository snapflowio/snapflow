/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BillingChargeClass } from '../../../billing/ledger/constants/billing.constants';
import { VerificationReviewKind } from '../enums/verification-review-kind.enum';

export const NETWORK_METER_AUDIT = {
	JOB: 'audit-network-meters',
	LOCK_TTL_SECONDS: 1_800,
	RECONCILIATION_WINDOW_HOURS: 24,
	MINIMUM_EDGE_BYTES: 64n * 1_024n * 1_024n,
	HOST_OVERHEAD_BASIS_POINTS: 1_500n,
	HOST_FLOOR_BASIS_POINTS: 9_000n,
	IDLE_ALLOWANCE_BYTES: 16n * 1_024n * 1_024n,
	ANOMALY_WINDOW_HOURS: 168,
	ANOMALY_MINIMUM_MACHINES: 4,
	ANOMALY_Z_SCORE: 3,
	ANOMALY_MINIMUM_CUSTOMERS: 2,
	ANOMALY_SPREAD_FLOOR_SHARE: 0.25,
	ANOMALY_SPREAD_FLOOR_BYTES: 1_048_576,
	REFERENCE_PREFIX: 'network-meter:',
} as const;

export const NETWORK_METER_REVIEW_KINDS: ReadonlySet<VerificationReviewKind> =
	new Set([
		VerificationReviewKind.NETWORK_METER_INFLATED,
		VerificationReviewKind.NETWORK_METER_MISMATCH,
		VerificationReviewKind.NETWORK_METER_ANOMALY,
	]);

export const ALL_FORFEITABLE_CHARGE_CLASSES: readonly BillingChargeClass[] =
	Object.values(BillingChargeClass);

export const NETWORK_FORFEITABLE_CHARGE_CLASSES: readonly BillingChargeClass[] =
	[BillingChargeClass.NETWORK];

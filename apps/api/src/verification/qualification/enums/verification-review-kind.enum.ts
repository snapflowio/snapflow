/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum VerificationReviewKind {
	SPOT_CHECK_FAILED = 'spot_check_failed',
	FINGERPRINT_CONFLICT = 'fingerprint_conflict',
	BENCHMARK_REGRESSION = 'benchmark_regression',
	NETWORK_METER_INFLATED = 'network_meter_inflated',
	NETWORK_METER_MISMATCH = 'network_meter_mismatch',
	NETWORK_METER_ANOMALY = 'network_meter_anomaly',
}

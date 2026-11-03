/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { VerificationReviewKind } from '@snapflow/api-client';

export const VERIFICATION_REVIEW_KIND_LABELS: Record<
	VerificationReviewKind,
	string
> = {
	[VerificationReviewKind.SpotCheckFailed]: 'Spot check failed',
	[VerificationReviewKind.FingerprintConflict]: 'Fingerprint conflict',
	[VerificationReviewKind.BenchmarkRegression]: 'Benchmark regression',
	[VerificationReviewKind.NetworkMeterInflated]: 'Network meter inflated',
	[VerificationReviewKind.NetworkMeterMismatch]:
		'Network meter disagrees with the Edge',
	[VerificationReviewKind.NetworkMeterAnomaly]: 'Network meter anomaly',
};

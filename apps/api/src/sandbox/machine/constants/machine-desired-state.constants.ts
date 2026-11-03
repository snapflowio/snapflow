/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MACHINE_DESIRED_STATE_WAKE_TOPIC = 'machine-desired-state';

export const MACHINE_OBSERVED_STATUS_LIMITS = {
	maximumStatusesPerReport: 100,
	maximumErrorReasonLength: 2_048,
	maximumDocumentLength: 96 * 1024,
} as const;

export const UNOBSERVED_CREATE_REASSIGNMENT = {
	batchSize: 32,
	graceMilliseconds: 2 * 60 * 1_000,
} as const;

export const CONVERGENCE_TIMEOUT_MINUTES = {
	creating: 15,
	restoring: 30,
	starting: 5,
	resuming: 5,
} as const;

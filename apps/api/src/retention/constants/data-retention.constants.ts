/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const DATA_RETENTION = {
	JOB: 'prune-expired-records',
	BATCH_SIZE: 1_000,
	MAXIMUM_BATCHES: 100,
	PUBLISHED_OUTBOX_DAYS: 7,
	FAILED_OUTBOX_DAYS: 30,
	FINISHED_MACHINE_JOB_DAYS: 30,
	EXPIRED_SESSION_DAYS: 1,
	ENDED_MACHINE_SESSION_DAYS: 7,
	ENDED_EDGE_SESSION_DAYS: 1,
	DELETED_ORGANIZATION_BILLING_PROFILE_DAYS: 30,
} as const;

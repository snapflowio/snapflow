/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';

export const AUDIT_PERSISTENCE = {
	DANGLING_LOG_AGE_MILLISECONDS: 30 * MILLISECONDS_PER_MINUTE,
	UNKNOWN_STATUS_CODE: 0,
	DANGLING_LOG_BATCH_SIZE: 500,
	RETENTION_DELETE_BATCH_SIZE: 10_000,
} as const;

export const AUDIT_JOB_LOCK = {
	TTL_SECONDS: 30,
	CLEANUP_KEY: 'lock:AuditService.cleanupOldAuditLogs',
	RESOLVE_DANGLING_KEY: 'lock:AuditService.resolveDanglingLogs',
} as const;

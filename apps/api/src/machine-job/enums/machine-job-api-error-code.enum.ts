/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum MachineJobApiErrorCode {
	NOT_FOUND = 'job_not_found',
	NOT_OWNED = 'job_not_owned',
	LEASE_STALE = 'job_lease_stale',
	LEASE_EXPIRED = 'job_lease_expired',
	RESULT_ALREADY_ACCEPTED = 'job_result_already_accepted',
	STATUS_NOT_TERMINAL = 'job_status_not_terminal',
	POLLING_UNAVAILABLE = 'job_polling_unavailable',
}

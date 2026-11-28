/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum UserErrorCode {
	NOT_FOUND = 'user_not_found',
	ACCOUNT_SUSPENDED = 'account_suspended',
	RESTRICTED_EVIDENCE_ADMIN_ONLY = 'restricted_evidence_admin_only',
	LAST_RESTRICTED_EVIDENCE_HOLDER = 'last_restricted_evidence_holder',
}

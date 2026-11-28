/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum MachineApiErrorCode {
	NAME_INVALID = 'machine_name_invalid',
	NAME_TAKEN = 'machine_name_taken',
	DELETE_BLOCKED = 'machine_delete_blocked',
	ASSESSMENT_NOT_FOUND = 'machine_assessment_not_found',
	IDENTITY_KEY_INVALID = 'machine_identity_key_invalid',
	IDENTITY_REGISTERED = 'machine_identity_registered',
	ENROLLMENT_PROOF_INVALID = 'machine_enrollment_proof_invalid',
	PROOF_INVALID = 'machine_proof_invalid',
	AUTHENTICATION_UNAVAILABLE = 'machine_authentication_unavailable',
	SESSION_INVALID = 'machine_session_invalid',
	SESSION_FENCED = 'machine_session_fenced',
	SESSION_NOT_RENEWABLE = 'machine_session_not_renewable',
	REPORT_INVALID = 'machine_report_invalid',
	USAGE_RECEIPT_INVALID = 'machine_usage_receipt_invalid',
	ASSIGNMENT_STALE = 'machine_assignment_stale',
	SECRET_DELIVERY_FAILED = 'secret_delivery_failed',
}

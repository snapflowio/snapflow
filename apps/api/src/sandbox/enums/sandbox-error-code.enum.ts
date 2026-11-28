/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum SandboxErrorCode {
	NOT_FOUND = 'sandbox_not_found',
	NOT_PLACED = 'sandbox_not_placed',
	QUOTA_EXCEEDED = 'sandbox_quota_exceeded',
	RESOURCE_LIMIT_EXCEEDED = 'sandbox_resource_limit_exceeded',
	CLASS_NOT_ALLOWED = 'sandbox_class_not_allowed',
	PERSISTENT_NOT_ALLOWED = 'persistent_sandbox_not_allowed',
	STATE_CHANGE_IN_PROGRESS = 'sandbox_state_change_in_progress',
	NO_AVAILABLE_MACHINE = 'no_available_machine',
	NAME_TAKEN = 'sandbox_name_taken',
	STATE_INVALID = 'sandbox_state_invalid',
	ERRORED = 'sandbox_errored',
	MODE_INVALID = 'sandbox_mode_invalid',
	SOURCE_INVALID = 'sandbox_source_invalid',
	INTERVAL_INVALID = 'sandbox_interval_invalid',
	NETWORK_POLICY_INVALID = 'sandbox_network_policy_invalid',
	NETWORK_POLICY_LOCKED = 'sandbox_network_policy_locked',
	VOLUME_CONFIG_INVALID = 'sandbox_volume_config_invalid',
	LABELS_INVALID = 'sandbox_labels_invalid',
	LABELS_RESERVED = 'sandbox_labels_reserved',
	LINK_INVALID = 'sandbox_link_invalid',
	HAS_FORKS = 'sandbox_has_forks',
	FORK_NOT_SUPPORTED = 'sandbox_fork_not_supported',
	PAUSE_NOT_SUPPORTED = 'sandbox_pause_not_supported',
	RESIZE_INVALID = 'sandbox_resize_invalid',
	BACKUP_UNAVAILABLE = 'sandbox_backup_unavailable',
	RECOVERY_TOO_SOON = 'sandbox_recovery_too_soon',
	ABUSE_HOLD = 'sandbox_abuse_hold',
	ABUSE_RESTRICTED = 'sandbox_abuse_restricted',
}

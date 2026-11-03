/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum AuditAction {
	CREATE = 'create',
	UPDATE = 'update',
	DELETE = 'delete',
	UPDATE_QUOTA = 'update_quota',
	CREATE_ORGANIZATION_QUOTA = 'create_organization_quota',
	UPDATE_ORGANIZATION_QUOTA = 'update_organization_quota',
	DELETE_ORGANIZATION_QUOTA = 'delete_organization_quota',
	UPDATE_SCHEDULING = 'update_scheduling',
	UPDATE_DRAINING = 'update_draining',
	START = 'start',
	STOP = 'stop',
	RESIZE = 'resize',
	REPLACE_LABELS = 'replace_labels',
	CREATE_BACKUP = 'create_backup',
	SET_AUTO_STOP_INTERVAL = 'set_auto_stop_interval',
	SET_AUTO_ARCHIVE_INTERVAL = 'set_auto_archive_interval',
	SET_AUTO_DELETE_INTERVAL = 'set_auto_delete_interval',
	ARCHIVE = 'archive',
	SNAPSHOT = 'snapshot',
	FORK = 'fork',
	PAUSE = 'pause',
	SET_GENERAL_STATUS = 'set_general_status',
	ACTIVATE = 'activate',
	DEACTIVATE = 'deactivate',
	UPDATE_NETWORK_SETTINGS = 'update_network_settings',
	CREATE_SSH_ACCESS = 'create_ssh_access',
	REVOKE_SSH_ACCESS = 'revoke_ssh_access',
	RECOVER = 'recover',
	REVOKE_MACHINE_IDENTITY = 'revoke_machine_identity',
	SET_MAINTENANCE_MODE = 'set_maintenance_mode',
	SET_DRAINING_POLICY = 'set_draining_policy',
	GRANT_CREDIT = 'grant_credit',
	IMPERSONATE = 'impersonate',
	STOP_IMPERSONATING = 'stop_impersonating',
	REGISTER = 'register',
	SUSPEND = 'suspend',
	UNSUSPEND = 'unsuspend',
}

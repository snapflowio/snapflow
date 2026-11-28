/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MACHINE_ENROLLMENT_TOKEN_MAX_LENGTH = 256;

export const MACHINE_INSTALL_SCRIPT_PATH = '/install.sh';

export const MACHINE_ENROLLMENT_KEY_NAME_MIN_LENGTH = 1;

export const MachineEnrollmentErrorCode = {
	HOST_KEY_IN_USE: 'machine_host_key_in_use',
	WEBSITE_URL_REQUIRED: 'machine_install_url_unavailable',
} as const;

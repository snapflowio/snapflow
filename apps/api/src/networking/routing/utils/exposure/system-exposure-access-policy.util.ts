/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { PermissionPair } from '../../../../organization/tenant/utils/organization-permissions.util';
import {
	SYSTEM_EXPOSURE_SERVICE,
	type SystemExposureService,
} from '../../constants/exposure.constants';

const SYSTEM_EXPOSURE_SERVICES_REQUIRING_SANDBOX_WRITE =
	new Set<SystemExposureService>([
		SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
		SYSTEM_EXPOSURE_SERVICE.TERMINAL,
		SYSTEM_EXPOSURE_SERVICE.DESKTOP,
		SYSTEM_EXPOSURE_SERVICE.SSH,
	]);

export const SANDBOX_WRITE_PERMISSION: PermissionPair = {
	resource: 'sandboxes',
	action: 'write',
};

export function systemExposureRequiresSandboxWrite(
	service: SystemExposureService | null
): boolean {
	return (
		service !== null &&
		SYSTEM_EXPOSURE_SERVICES_REQUIRING_SANDBOX_WRITE.has(service)
	);
}

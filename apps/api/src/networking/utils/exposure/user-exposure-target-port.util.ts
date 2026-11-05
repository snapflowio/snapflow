/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { RESERVED_RUNTIME_TARGET_PORTS } from '../../constants/exposure.constants';
import { NETWORKING_LIMITS } from '../../constants/networking.constants';

const reservedRuntimeTargetPorts = new Set<number>(
	RESERVED_RUNTIME_TARGET_PORTS
);

export function assertUserExposureTargetPort(targetPort: number): void {
	if (
		!Number.isInteger(targetPort) ||
		targetPort < NETWORKING_LIMITS.minimumPort ||
		targetPort > NETWORKING_LIMITS.maximumPort
	) {
		throw new BadRequestException('Invalid exposure target port');
	}
	if (reservedRuntimeTargetPorts.has(targetPort)) {
		throw new BadRequestException(
			`Port ${targetPort} is reserved for a Snapflow system service`
		);
	}
}

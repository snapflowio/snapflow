/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { RESERVED_LABEL_PREFIX } from '../constants/sandbox.constants';
import type { Sandbox } from '../entities/sandbox.entity';
import { SandboxErrorCode } from '../enums/sandbox-error-code.enum';

type SandboxLabels = NonNullable<Sandbox['labels']>;

export function requireCustomerLabels(labels: SandboxLabels): SandboxLabels {
	const reserved = Object.keys(labels).filter((key) =>
		key.toLowerCase().startsWith(RESERVED_LABEL_PREFIX)
	);
	if (reserved.length > 0) {
		throw new BadRequestException(
			apiError(
				SandboxErrorCode.LABELS_RESERVED,
				`Labels that start with ${RESERVED_LABEL_PREFIX} are reserved for Snapflow. Remove ${reserved.join(', ')}.`
			)
		);
	}
	return labels;
}

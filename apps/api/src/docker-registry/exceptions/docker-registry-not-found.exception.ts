/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { NotFoundException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { DockerRegistryErrorCode } from '../enums/docker-registry-error-code.enum';

export class DockerRegistryNotFoundException extends NotFoundException {
	constructor(registryId: string) {
		super(
			apiError(
				DockerRegistryErrorCode.NOT_FOUND,
				`Docker registry ${registryId} was not found. Check the registry ID; it may have been deleted.`
			)
		);
	}
}

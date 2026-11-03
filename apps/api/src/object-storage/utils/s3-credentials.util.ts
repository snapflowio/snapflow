/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ServiceUnavailableException } from '@nestjs/common';

export function staticCredentials(
	accessKeyId: string | undefined,
	secretAccessKey: string | undefined
) {
	if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
		throw new ServiceUnavailableException(
			'Static S3 access key and secret key must be configured together'
		);
	}
	return accessKeyId && secretAccessKey
		? { accessKeyId, secretAccessKey }
		: undefined;
}

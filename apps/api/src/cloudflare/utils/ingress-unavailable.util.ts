/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { CloudflareErrorCode } from '../enums/cloudflare-error-code.enum';

const INGRESS_UNAVAILABLE_MESSAGE =
	'Public ingress is unavailable right now. Try again in a few minutes; if it keeps happening, contact support@snapflow.io.';

const logger = new Logger('CloudflareIngress');

export function ingressUnavailable(
	detail: string
): ServiceUnavailableException {
	logger.error(detail);
	return new ServiceUnavailableException(
		apiError(
			CloudflareErrorCode.INGRESS_UNAVAILABLE,
			INGRESS_UNAVAILABLE_MESSAGE
		)
	);
}

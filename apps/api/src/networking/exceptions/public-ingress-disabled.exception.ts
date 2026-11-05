/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ServiceUnavailableException } from '@nestjs/common';
import { PLATFORM_PROBLEM_CODE } from '../../common/constants/platform-trust.constants';

export class PublicIngressDisabledException extends ServiceUnavailableException {
	constructor() {
		super({
			code: PLATFORM_PROBLEM_CODE.PUBLIC_INGRESS_DISABLED,
			message: 'Public workload ingress is not enabled',
		});
	}
}

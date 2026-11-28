/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ForbiddenException } from '@nestjs/common';
import { SandboxErrorCode } from '../enums/sandbox-error-code.enum';

const SANDBOX_ABUSE_RESTRICTED_MESSAGE =
	'The sandbox is restricted while Snapflow reviews an abuse case, so it cannot be forked or snapshotted. Open the abuse notice to see the case or appeal the decision.';

export class SandboxAbuseRestrictedException extends ForbiddenException {
	constructor() {
		super({
			code: SandboxErrorCode.ABUSE_RESTRICTED,
			message: SANDBOX_ABUSE_RESTRICTED_MESSAGE,
		});
	}
}

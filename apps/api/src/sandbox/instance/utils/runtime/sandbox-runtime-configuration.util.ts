/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DEFAULT_SANDBOX_OS_USER } from '../../constants/sandbox.constants';
import type { CreateSandboxDto } from '../../dto/create-sandbox.dto';

export function resolveSandboxRuntimeConfiguration(
	input: Pick<CreateSandboxDto, 'env' | 'user'>
) {
	return {
		env: input.env ?? {},
		osUser: input.user ?? DEFAULT_SANDBOX_OS_USER,
	};
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxClass } from '../enums/sandbox-class.enum';

export const BUILD_SANDBOX_CLASS = SandboxClass.LINUX_VM;

export const BUILD_SANDBOX_DEFAULT_RESOURCES = {
	cpu: 1,
	memoryGiB: 1,
	diskGiB: 3,
	gpu: 0,
} as const;

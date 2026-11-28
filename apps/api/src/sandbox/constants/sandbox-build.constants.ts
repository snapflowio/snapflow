/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxClass } from '../enums/sandbox-class.enum';
import {
	DEFAULT_SANDBOX_CPU,
	DEFAULT_SANDBOX_DISK_GIB,
	DEFAULT_SANDBOX_GPU,
	DEFAULT_SANDBOX_MEMORY_GIB,
} from './sandbox.constants';

export const BUILD_SANDBOX_CLASS = SandboxClass.LINUX_VM;

export const BUILD_SANDBOX_DEFAULT_RESOURCES = {
	cpu: DEFAULT_SANDBOX_CPU,
	memoryGiB: DEFAULT_SANDBOX_MEMORY_GIB,
	diskGiB: DEFAULT_SANDBOX_DISK_GIB,
	gpu: DEFAULT_SANDBOX_GPU,
} as const;

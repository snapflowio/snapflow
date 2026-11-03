/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export const STDOUT_PREFIX_BYTE = 0x01;
export const STDERR_PREFIX_BYTE = 0x02;
export const MAX_PREFIX_LEN = 3;
export const STDOUT_PREFIX_BYTES = new Uint8Array(MAX_PREFIX_LEN).fill(
	STDOUT_PREFIX_BYTE
);
export const STDERR_PREFIX_BYTES = new Uint8Array(MAX_PREFIX_LEN).fill(
	STDERR_PREFIX_BYTE
);

export class CodeRunParams {
	argv?: string[];
	env?: Record<string, string>;
}

export type {
	SessionCommandLogsResponse,
	SessionExecuteResponse,
} from '@snapflow/toolbox-api-client';

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

import { SnapflowError } from '../errors/snapflow-error.js';
import { RUNTIME } from './runtime.js';

type NodeBuiltinId =
	| 'node:fs'
	| 'node:os'
	| 'node:stream'
	| 'node:stream/consumers'
	| 'node:stream/promises';

type NodeBuiltin<K extends NodeBuiltinId> = ReturnType<
	typeof process.getBuiltinModule<K>
>;

export function nodeBuiltin<K extends NodeBuiltinId>(
	id: K,
	errorPrefix: string
): NodeBuiltin<K> {
	if (
		typeof process === 'undefined' ||
		typeof process.getBuiltinModule !== 'function'
	) {
		throw new SnapflowError(
			`${errorPrefix}Module "${id}" is not available in the "${RUNTIME}" runtime`
		);
	}
	return process.getBuiltinModule(id);
}

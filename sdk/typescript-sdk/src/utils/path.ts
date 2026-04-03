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

/*
 * Copyright 2025 Snapflow
 * SPDX-License-Identifier: Apache-2.0
 */

import * as _path from 'path';

/**
 * Prefixes a relative path with the given prefix, handling special cases for '~' and '~/'
 * Returns absolute paths unchanged.
 */
export function prefixRelativePath(prefix: string, path?: string): string {
	if (!path) return prefix;

	const trimmed = path.trim();
	if (trimmed === '~') return prefix;
	if (trimmed.startsWith('~/')) return _path.join(prefix, trimmed.slice(2));
	if (_path.isAbsolute(trimmed)) return trimmed;
	return _path.join(prefix, trimmed);
}

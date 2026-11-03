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

export function abortableDelay(
	delayMilliseconds: number,
	signal?: AbortSignal
): Promise<void> {
	signal?.throwIfAborted();
	return new Promise((resolve, reject) => {
		const timeout = globalThis.setTimeout(() => {
			signal?.removeEventListener('abort', abort);
			resolve();
		}, delayMilliseconds);
		const abort = () => {
			globalThis.clearTimeout(timeout);
			reject(signal?.reason ?? new Error('Operation aborted'));
		};
		signal?.addEventListener('abort', abort, { once: true });
	});
}

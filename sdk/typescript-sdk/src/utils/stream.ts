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

import type { AsyncFunction, StreamHandler } from '../types';

export interface StreamProcessingOptions {
	readonly chunkTimeout?: number;
	readonly requireConsecutiveTermination?: boolean;
}

export async function processStreamingResponse(
	getStream: AsyncFunction<any>,
	onChunk: StreamHandler,
	shouldTerminate: AsyncFunction<boolean>,
	options: StreamProcessingOptions = {}
): Promise<void> {
	const { chunkTimeout = 2000, requireConsecutiveTermination = true } = options;
	const response = await getStream();
	const stream = response.data;

	let nextChunkPromise: Promise<Buffer | null> | null = null;
	let exitCheckStreak = 0;
	let terminated = false;

	const readNext = (): Promise<Buffer | null> => {
		return new Promise<Buffer | null>((resolve) => {
			const onData = (data: Buffer) => {
				cleanup();
				resolve(data);
			};

			const cleanup = () => {
				stream.off('data', onData);
			};

			stream.once('data', onData);
		});
	};

	const createTerminationPromise = (): Promise<void> => {
		return new Promise<void>((resolve, reject) => {
			const handleTermination = () => {
				terminated = true;
				resolve();
			};

			const handleError = (err: Error) => {
				terminated = true;
				reject(err);
			};

			stream.on('end', handleTermination);
			stream.on('close', handleTermination);
			stream.on('error', handleError);
		});
	};

	const terminationPromise = createTerminationPromise();

	const processLoop = async () => {
		while (!terminated) {
			if (!nextChunkPromise) nextChunkPromise = readNext();

			const timeoutPromise = new Promise<null>((resolve) =>
				setTimeout(() => resolve(null), chunkTimeout)
			);
			const result = await Promise.race([nextChunkPromise, timeoutPromise]);

			if (result instanceof Buffer) {
				onChunk(result.toString('utf8'));
				nextChunkPromise = null;
				exitCheckStreak = 0;
			} else {
				const shouldEnd = await shouldTerminate();
				if (shouldEnd) {
					exitCheckStreak += 1;
					if (!requireConsecutiveTermination || exitCheckStreak > 1) {
						break;
					}
				} else {
					exitCheckStreak = 0;
				}
			}
		}
		if (!terminated) {
			stream.destroy();
			stream.removeAllListeners();
		}
	};

	await Promise.race([processLoop(), terminationPromise]);
}

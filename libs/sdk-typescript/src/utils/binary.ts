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

export function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
	const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const result = new Uint8Array(size);
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.byteLength;
	}
	return result;
}

export function toBuffer(data: Uint8Array): Buffer {
	if (typeof Buffer === 'undefined') {
		throw new SnapflowError(
			`Buffer is not available in the "${RUNTIME}" runtime`
		);
	}
	return Buffer.from(data);
}

export async function collectStreamBytes(
	stream: ReadableStream<Uint8Array> | null
): Promise<Uint8Array> {
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function isFile(value: unknown): value is File {
	return typeof File !== 'undefined' && value instanceof File;
}

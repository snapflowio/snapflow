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

import { collectStreamBytes, concatUint8Arrays } from './binary.js';

const encoder = new TextEncoder();

describe('binary utilities', () => {
	it('concatenates chunks in order', () => {
		expect([
			...concatUint8Arrays([
				new Uint8Array([1, 2]),
				new Uint8Array(0),
				new Uint8Array([3]),
			]),
		]).toEqual([1, 2, 3]);
	});

	it('collects WHATWG streams and empty bodies', async () => {
		const readable = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode('snap'));
				controller.enqueue(encoder.encode('flow'));
				controller.close();
			},
		});
		expect(new TextDecoder().decode(await collectStreamBytes(readable))).toBe(
			'snapflow'
		);
		expect(await collectStreamBytes(null)).toHaveLength(0);
	});
});

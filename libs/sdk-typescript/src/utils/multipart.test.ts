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

import { extractBoundary, parseMultipartWithFormData } from './multipart.js';

describe('multipart utilities', () => {
	it('extracts quoted and unquoted boundaries', () => {
		expect(extractBoundary('multipart/form-data; boundary=snapflow')).toBe(
			'snapflow'
		);
		expect(extractBoundary('multipart/mixed; boundary="machine-edge"')).toBe(
			'machine-edge'
		);
		expect(extractBoundary('application/json')).toBeNull();
	});

	it('parses binary file parts without decoding their payload', async () => {
		const boundary = 'snapflow-boundary';
		const body = new TextEncoder().encode(
			`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="data.bin"\r\nContent-Type: application/octet-stream\r\n\r\npayload\r\n--${boundary}--\r\n`
		);
		const parts = await parseMultipartWithFormData(
			body,
			`multipart/form-data; boundary=${boundary}`
		);
		expect(parts).toHaveLength(1);
		expect(parts[0]).toMatchObject({
			fieldName: 'file',
			filename: 'data.bin',
			contentType: 'application/octet-stream',
		});
		expect(new TextDecoder().decode(parts[0]?.data)).toBe('payload');
	});
});

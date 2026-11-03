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

const CRLF_TEXT = '\r\n';
const CRLF = Buffer.from(CRLF_TEXT);
const HEADER_SEPARATOR = Buffer.from(`${CRLF_TEXT}${CRLF_TEXT}`);
const DASH = 0x2d;
const CR = 0x0d;
const LF = 0x0a;
const CONTENT_LENGTH_HEADER = 'content-length';
const DECIMAL_RADIX = 10;

type ParserState = 'preamble' | 'headers' | 'body' | 'done';

export class MultipartHeaderObserver {
	private readonly boundary: Buffer;
	private readonly closingBoundary: Buffer;
	private buffer: Buffer = Buffer.alloc(0);
	private state: ParserState = 'preamble';
	private readonly queue: (number | undefined)[] = [];

	constructor(boundary: string) {
		this.boundary = Buffer.from(`--${boundary}`);
		this.closingBoundary = Buffer.concat([CRLF, this.boundary]);
	}

	observe(chunk: Buffer): void {
		if (this.state === 'done') return;
		this.buffer = Buffer.concat([this.buffer, chunk]);
		while (this.advance()) {}
	}

	next(): number | undefined {
		return this.queue.shift();
	}

	private advance(): boolean {
		switch (this.state) {
			case 'preamble':
				return this.consumeBoundary(0);
			case 'headers':
				return this.consumeHeaders();
			case 'body':
				return this.consumeBodyToBoundary();
			default:
				return false;
		}
	}

	private consumeHeaders(): boolean {
		const sepIdx = this.buffer.indexOf(HEADER_SEPARATOR);
		if (sepIdx < 0) {
			this.retainTail(HEADER_SEPARATOR.length - 1);
			return false;
		}
		this.queue.push(parseContentLength(this.buffer.subarray(0, sepIdx)));
		this.buffer = this.buffer.subarray(sepIdx + HEADER_SEPARATOR.length);
		this.state = 'body';
		return true;
	}

	private consumeBodyToBoundary(): boolean {
		const idx = this.buffer.indexOf(this.closingBoundary);
		if (idx < 0) {
			this.retainTail(this.closingBoundary.length - 1);
			return false;
		}
		return this.consumeBoundary(idx + CRLF.length);
	}

	private consumeBoundary(searchFrom: number): boolean {
		const idx = this.buffer.indexOf(this.boundary, searchFrom);
		if (idx < 0) {
			this.retainTail(this.boundary.length - 1);
			return false;
		}
		const after = idx + this.boundary.length;
		if (this.buffer.length < after + CRLF.length) {
			this.buffer = this.buffer.subarray(idx);
			return false;
		}
		if (this.buffer[after] === DASH && this.buffer[after + 1] === DASH) {
			this.state = 'done';
			return false;
		}
		if (this.buffer[after] === CR && this.buffer[after + 1] === LF) {
			this.buffer = this.buffer.subarray(after + CRLF.length);
			this.state = 'headers';
			return true;
		}
		return this.consumeBoundary(after);
	}

	private retainTail(keep: number): void {
		if (keep > 0 && this.buffer.length > keep) {
			this.buffer = this.buffer.subarray(this.buffer.length - keep);
		}
	}
}

function parseContentLength(headersBlock: Buffer): number | undefined {
	const text = headersBlock.toString('latin1');
	for (const line of text.split(CRLF_TEXT)) {
		const colon = line.indexOf(':');
		if (colon <= 0) continue;
		if (line.slice(0, colon).trim().toLowerCase() !== CONTENT_LENGTH_HEADER)
			continue;
		const value = Number.parseInt(line.slice(colon + 1).trim(), DECIMAL_RADIX);
		return Number.isFinite(value) && value >= 0 ? value : undefined;
	}
	return undefined;
}

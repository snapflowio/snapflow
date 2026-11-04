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

import { parse } from 'shell-quote';
import { describe, expect, it } from 'vitest';
import { formatRunCommand, toExecForm } from './dockerfile.js';

const HOSTILE_ARGUMENTS = [
	'echo',
	'it\'s "quoted"',
	'back\\slash',
	'$HOME',
	'`id`',
	'a; rm -rf /',
];

describe('formatRunCommand', () => {
	it('passes a shell-form string through unchanged', () => {
		expect(formatRunCommand('apt-get update && apt-get install -y git')).toBe(
			'apt-get update && apt-get install -y git'
		);
	});

	it('quotes every argument so the shell sees it literally', () => {
		expect(parse(formatRunCommand(HOSTILE_ARGUMENTS))).toEqual(
			HOSTILE_ARGUMENTS
		);
	});
});

describe('toExecForm', () => {
	it('encodes arguments as a JSON array body', () => {
		expect(JSON.parse(`[${toExecForm(HOSTILE_ARGUMENTS)}]`)).toEqual(
			HOSTILE_ARGUMENTS
		);
	});
});

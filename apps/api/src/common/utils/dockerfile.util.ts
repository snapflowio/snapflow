/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

// [ \t] rather than \s keeps every match on one line, and the \S after the
// separator leaves the regex one way to split a line, so it runs in linear time.
const ENTRYPOINT_INSTRUCTION = /^[ \t]*ENTRYPOINT[ \t]+(\S.*)$/gim;
const SHELL_FORM_PREFIX = ['/bin/sh', '-c'] as const;
const DEFAULT_ENTRYPOINT = ['sleep', 'infinity'] as const;

function parseExecForm(value: string): string[] | null {
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) &&
			parsed.every((part) => typeof part === 'string')
			? parsed
			: null;
	} catch {
		return null;
	}
}

export function entrypointFromDockerfile(dockerfileContent: string): string[] {
	const declared = [...dockerfileContent.matchAll(ENTRYPOINT_INSTRUCTION)]
		.at(-1)?.[1]
		.trim();
	if (!declared) return [...DEFAULT_ENTRYPOINT];
	return parseExecForm(declared) ?? [...SHELL_FORM_PREFIX, declared];
}

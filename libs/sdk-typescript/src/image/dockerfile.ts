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

import fastGlob from 'fast-glob';
import * as pathe from 'pathe';
import { parse as parseShellQuote, quote as quoteShell } from 'shell-quote';
import type { Context } from '../image.types.js';

const COPY_INSTRUCTION = 'COPY';
const LEADING_SEPARATORS = /^[/\\]+/;
const DEBIAN_SLIM_SETUP_COMMANDS = [
	'RUN apt-get update',
	'RUN apt-get install -y gcc gfortran build-essential',
	'RUN pip install --upgrade pip',
	"RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections",
];

export function debianSlimDockerfile(pythonVersion: string): string {
	const commands = [
		`FROM python:${pythonVersion}-slim-bookworm`,
		...DEBIAN_SLIM_SETUP_COMMANDS,
	];
	return `${commands.join('\n')}\n`;
}

export function formatRunCommand(command: string | string[]): string {
	if (!Array.isArray(command)) {
		return command;
	}
	return quoteShell(command);
}

export function isStringList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((x) => typeof x === 'string');
}

export function toExecForm(args: string[]): string {
	return args.map((arg) => JSON.stringify(arg)).join(', ');
}

export function collectCopyContexts(
	dockerfileContent: string,
	pathPrefix: string
): Context[] {
	return extractCopySources(dockerfileContent, pathPrefix).map(
		([contextPath, originalPath]) => {
			let archivePath = contextPath;
			if (pathPrefix && !originalPath.startsWith(pathPrefix)) {
				archivePath = contextPath
					.substring(pathPrefix.length)
					.replace(LEADING_SEPARATORS, '');
			}
			return { sourcePath: contextPath, archivePath };
		}
	);
}

function isLocalCopyInstruction(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#')) {
		return false;
	}
	return /^\s*COPY\s+(?!.*--from=)/i.test(line) && !line.includes('<<');
}

function extractCopySources(
	dockerfileContent: string,
	pathPrefix: string
): [string, string][] {
	const sources: [string, string][] = [];

	for (const line of dockerfileContent.split('\n')) {
		if (!isLocalCopyInstruction(line)) {
			continue;
		}

		for (const source of parseCopyCommand(line)?.sources ?? []) {
			const fullPathPattern = pathe.isAbsolute(source)
				? source
				: pathe.join(pathPrefix, source);

			const matchingFiles: string[] = fastGlob.sync([fullPathPattern], {
				dot: true,
			});
			if (matchingFiles.length === 0) {
				sources.push([fullPathPattern, source]);
			}
			for (const matchingFile of matchingFiles) {
				sources.push([matchingFile, source]);
			}
		}
	}

	return sources;
}

function parseCopyCommand(
	line: string
): { sources: string[]; dest: string } | null {
	const parts = line.trim().substring(COPY_INSTRUCTION.length).trim();

	if (parts.startsWith('[')) {
		return parseJsonArrayCopyArgs(parts);
	}

	const splitParts = parseShellQuote(parts).filter(
		(x): x is string => typeof x === 'string'
	);
	return copyTarget(splitParts.slice(skipCopyFlags(splitParts)));
}

function parseJsonArrayCopyArgs(
	parts: string
): { sources: string[]; dest: string } | null {
	try {
		const elements = parseShellQuote(
			parts.replace('[', '').replace(']', '')
		).filter((x): x is string => typeof x === 'string');
		return copyTarget(elements);
	} catch {
		return null;
	}
}

function copyTarget(
	args: readonly string[]
): { sources: string[]; dest: string } | null {
	const dest = args.at(-1);
	if (args.length < 2 || dest === undefined) {
		return null;
	}
	return { sources: args.slice(0, -1), dest };
}

function skipCopyFlags(splitParts: readonly string[]): number {
	let index = 0;
	for (
		let part = splitParts[index];
		part?.startsWith('--');
		part = splitParts[index]
	) {
		const next = splitParts[index + 1];
		const hasSeparateValue =
			!part.includes('=') && next !== undefined && !next.startsWith('--');
		index += hasSeparateValue ? 2 : 1;
	}
	return index;
}

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
import { parse as parseShellQuote } from 'shell-quote';
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
	return command
		.map((c) => `"${c.replace(/"/g, '\\\\\\"').replace(/'/g, "\\'")}"`)
		.join(' ');
}

export function isStringList(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((x) => typeof x === 'string');
}

export function toExecForm(args: string[]): string {
	return args.map((arg) => `"${arg}"`).join(', ');
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
	const sourcesStartIdx = skipCopyFlags(splitParts);

	if (splitParts.length - sourcesStartIdx < 2) {
		return null;
	}

	return {
		sources: splitParts.slice(sourcesStartIdx, -1),
		dest: splitParts[splitParts.length - 1],
	};
}

function parseJsonArrayCopyArgs(
	parts: string
): { sources: string[]; dest: string } | null {
	try {
		const elements = parseShellQuote(
			parts.replace('[', '').replace(']', '')
		).filter((x): x is string => typeof x === 'string');

		if (elements.length < 2) {
			return null;
		}

		return {
			sources: elements.slice(0, -1),
			dest: elements[elements.length - 1],
		};
	} catch {
		return null;
	}
}

function skipCopyFlags(splitParts: string[]): number {
	let sourcesStartIdx = 0;
	for (let i = 0; i < splitParts.length; i++) {
		const part = splitParts[i];
		if (!part.startsWith('--')) {
			break;
		}
		const hasSeparateValue =
			!part.includes('=') &&
			i + 1 < splitParts.length &&
			!splitParts[i + 1].startsWith('--');
		sourcesStartIdx = hasSeparateValue ? i + 2 : i + 1;
	}
	return sourcesStartIdx;
}

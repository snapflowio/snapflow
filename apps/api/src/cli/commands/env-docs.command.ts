/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Command, CommandRunner, Option } from 'nest-commander';
import { renderEnvironmentReference } from '../../config/environment/utils/environment-docs.util';
import { layoutEnvironmentFile } from '../../config/environment/utils/environment-file.util';
import { writeLine } from '../cli-output.util';

const ENVIRONMENT_DOCUMENTS = {
	REFERENCE: 'docs/reference/api-environment.md',
	LOCAL_FILE: 'apps/api/.env',
} as const;
const PUBLIC_FILE_MODE = 0o644;
const PRIVATE_FILE_MODE = 0o600;

type EnvironmentDocsOptions = Readonly<{ check?: boolean }>;

interface GeneratedDocument {
	path: string;
	current: string | undefined;
	expected: string;
	mode: number;
	added: readonly string[];
}

async function readIfPresent(path: string): Promise<string | undefined> {
	return existsSync(path) ? readFile(path, 'utf8') : undefined;
}

async function referenceDocument(): Promise<GeneratedDocument> {
	const path = ENVIRONMENT_DOCUMENTS.REFERENCE;
	return {
		path,
		current: await readIfPresent(path),
		expected: renderEnvironmentReference(),
		mode: PUBLIC_FILE_MODE,
		added: [],
	};
}

async function localDocument(): Promise<GeneratedDocument | undefined> {
	const path = ENVIRONMENT_DOCUMENTS.LOCAL_FILE;
	const current = await readIfPresent(path);
	if (current === undefined) return undefined;
	const { content, added, unregistered } = layoutEnvironmentFile(current);
	if (unregistered.length > 0) {
		throw new Error(
			`${path} sets unregistered variables: ${unregistered.join(', ')}`
		);
	}
	return { path, current, expected: content, mode: PRIVATE_FILE_MODE, added };
}

async function generatedDocuments(): Promise<GeneratedDocument[]> {
	const local = await localDocument();
	return [await referenceDocument(), ...(local ? [local] : [])];
}

function verify(documents: readonly GeneratedDocument[]): void {
	const stale = documents
		.filter((document) => document.current !== document.expected)
		.map((document) => document.path);
	if (stale.length > 0) {
		throw new Error(
			`Out of date: ${stale.join(', ')}; run moon run api:env-docs`
		);
	}
	writeLine(
		`Up to date: ${documents.map((document) => document.path).join(', ')}`
	);
}

async function write(documents: readonly GeneratedDocument[]): Promise<void> {
	for (const document of documents) {
		if (document.current === document.expected) continue;
		await mkdir(dirname(document.path), { recursive: true });
		await writeFile(document.path, document.expected, { mode: document.mode });
		writeLine(
			document.added.length > 0
				? `Wrote ${document.path}; listed ${document.added.join(', ')}`
				: `Wrote ${document.path}`
		);
	}
}

@Command({
	name: 'env-docs',
	description: 'Generate the environment reference and lay out apps/api/.env',
})
export class EnvironmentDocsCommand extends CommandRunner {
	@Option({
		flags: '--check',
		description: 'Fail when a document differs from its generated form',
	})
	parseCheck(): boolean {
		return true;
	}

	public async run(): Promise<void> {
		const { check } = this.command.opts<EnvironmentDocsOptions>();
		const documents = await generatedDocuments();
		if (check) verify(documents);
		else await write(documents);
	}
}

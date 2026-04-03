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

import type {
	FileInfo,
	Match,
	SearchFilesResponse,
} from '@snapflow/toolbox-client';
import * as nodePath from 'path';
import { SnapflowError, SnapflowNotFoundError } from '../errors';
import { type RuntimeConfig, runtimes } from '../runtimes';
import type { FileSystem } from '../services/filesystem';
import type { Process } from '../services/process';
import type { ExecuteResponse } from '../types';

export type WorkspaceLanguage =
	| 'typescript'
	| 'javascript'
	| 'bun'
	| 'go'
	| 'php'
	| 'ruby'
	| 'lua'
	| 'python'
	| 'c'
	| string;

export interface WorkspaceRunOptions {
	timeout?: number;
	build?: boolean;
}

export interface ServeOptions {
	sessionId?: string;
	entrypoint?: string;
}

export interface ServeResult {
	url: string;
	sessionId: string;
}

export interface WorkspaceCreateOptions {
	dir?: string;
	files?: Record<string, string>;
}

export class Workspace {
	public readonly language: WorkspaceLanguage;
	public readonly dir: string;

	private readonly fs: FileSystem;
	private readonly process: Process;
	private readonly runtime: RuntimeConfig;
	private readonly getPreviewLink: (port: number) => Promise<{ url: string }>;

	constructor(
		language: WorkspaceLanguage,
		dir: string,
		fs: FileSystem,
		process: Process,
		getPreviewLink: (port: number) => Promise<{ url: string }>
	) {
		this.language = language;
		this.dir = dir;
		this.fs = fs;
		this.process = process;
		this.getPreviewLink = getPreviewLink;

		const runtime = runtimes[language];
		if (!runtime) {
			throw new SnapflowError(`Unsupported workspace language: "${language}"`);
		}

		this.runtime = runtime;
	}

	public async addFile(path: string, content: string): Promise<void> {
		const absPath = nodePath.join(this.dir, path);
		await this.fs.uploadFile(Buffer.from(content, 'utf-8'), absPath);
	}

	public async addFiles(files: Record<string, string>): Promise<void> {
		for (const [path, content] of Object.entries(files)) {
			await this.addFile(path, content);
		}
	}

	public async readFile(path: string): Promise<string> {
		const absPath = nodePath.join(this.dir, path);
		const buffer = await this.fs.downloadFile(absPath);
		return (buffer as Buffer).toString('utf-8');
	}

	public async removeFile(path: string): Promise<void> {
		const absPath = nodePath.join(this.dir, path);
		await this.fs.deleteFile(absPath);
	}

	public async moveFile(from: string, to: string): Promise<void> {
		const absFrom = nodePath.join(this.dir, from);
		const absTo = nodePath.join(this.dir, to);
		await this.fs.moveFiles(absFrom, absTo);
	}

	public async hasFile(path: string): Promise<boolean> {
		try {
			await this.fs.getFileDetails(nodePath.join(this.dir, path));
			return true;
		} catch (e) {
			if (e instanceof SnapflowNotFoundError) return false;
			throw e;
		}
	}

	public async getFileInfo(path: string): Promise<FileInfo> {
		return this.fs.getFileDetails(nodePath.join(this.dir, path));
	}

	public async searchFiles(
		pattern: string,
		path?: string
	): Promise<SearchFilesResponse> {
		const absPath = nodePath.join(this.dir, path ?? '');
		return this.fs.searchFiles(absPath, pattern);
	}

	public async findInFiles(pattern: string, path?: string): Promise<Match[]> {
		const absPath = nodePath.join(this.dir, path ?? '');
		return this.fs.findFiles(absPath, pattern);
	}

	public async createDir(path: string, mode = '0755'): Promise<void> {
		await this.fs.createFolder(nodePath.join(this.dir, path), mode);
	}

	public async removeDir(path: string): Promise<void> {
		const absPath = nodePath.join(this.dir, path);
		await this.process.executeCommand(`rm -rf "${absPath}"`);
	}

	public async listFiles(path?: string): Promise<FileInfo[]> {
		return this.fs.listFiles(nodePath.join(this.dir, path ?? ''));
	}

	public async run(
		entrypoint?: string,
		options?: WorkspaceRunOptions
	): Promise<ExecuteResponse> {
		const ep = entrypoint ?? this.runtime.defaultEntrypoint;
		const command =
			options?.build && this.runtime.buildAndRunCommand
				? this.runtime.buildAndRunCommand(ep)
				: this.runtime.runCommand(ep);
		return this.process.executeCommand(command, {
			cwd: this.dir,
			timeout: options?.timeout,
		});
	}

	public async install(packages: string[]): Promise<ExecuteResponse> {
		if (packages.length === 0) {
			throw new SnapflowError('Provide at least one package to install');
		}

		if (!this.runtime.installCommand) {
			throw new SnapflowError(
				`No package manager available for language: ${this.language}`
			);
		}

		const command = this.runtime.installCommand(packages);
		return this.process.executeCommand(command, { cwd: this.dir });
	}

	public async serve(
		port: number,
		options?: ServeOptions
	): Promise<ServeResult> {
		const sessionId = options?.sessionId ?? `serve-${port}`;
		const ep = options?.entrypoint ?? this.runtime.defaultEntrypoint;
		const absEntrypoint = nodePath.join(this.dir, ep);
		const command = this.runtime.runCommand(absEntrypoint);

		await this.process.createSession(sessionId);
		await this.process.executeSessionCommand(sessionId, {
			command,
			async: true,
		});

		const preview = await this.getPreviewLink(port);
		return { url: preview.url, sessionId };
	}

	public async destroy(): Promise<void> {
		await this.process.executeCommand(`rm -rf "${this.dir}"`);
	}
}

export async function createWorkspaceInSandbox(
	language: WorkspaceLanguage,
	fs: FileSystem,
	process: Process,
	getRootDir: () => Promise<string>,
	getPreviewLink: (port: number) => Promise<{ url: string }>,
	options?: WorkspaceCreateOptions
): Promise<Workspace> {
	let dir = options?.dir;

	if (!dir) {
		const rootDir = await getRootDir();
		const id = Math.random().toString(36).slice(2, 10);
		dir = nodePath.join(
			rootDir,
			'.snapflow',
			'workspaces',
			`${language}-${id}`
		);
	}

	await process.executeCommand(`mkdir -p "${dir}"`);

	const workspace = new Workspace(language, dir, fs, process, getPreviewLink);

	if (options?.files) {
		await workspace.addFiles(options.files);
	}

	return workspace;
}

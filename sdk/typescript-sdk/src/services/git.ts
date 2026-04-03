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
	GitApi,
	GitStatus,
	ListBranchResponse,
} from '@snapflow/toolbox-client';
import { prefixRelativePath } from '../utils/path';

export interface GitCommitResponse {
	readonly sha: string;
}

export interface GitCredentials {
	readonly username?: string;
	readonly password?: string;
}

export interface GitCloneOptions extends GitCredentials {
	readonly branch?: string;
	readonly commitId?: string;
}

export class Git {
	constructor(
		private readonly apiClient: GitApi,
		private readonly getRootDir: () => Promise<string>
	) {}

	public async add(path: string, files: string[]): Promise<void> {
		await this.apiClient.gitAddFiles({
			path: prefixRelativePath(await this.getRootDir(), path),
			files,
		});
	}

	public async branches(path: string): Promise<ListBranchResponse> {
		const response = await this.apiClient.listBranches(
			prefixRelativePath(await this.getRootDir(), path)
		);
		return response.data;
	}

	public async createBranch(path: string, name: string): Promise<void> {
		await this.apiClient.createBranch({
			path: prefixRelativePath(await this.getRootDir(), path),
			name,
		});
	}

	public async deleteBranch(path: string, name: string): Promise<void> {
		await this.apiClient.deleteBranch({
			path: prefixRelativePath(await this.getRootDir(), path),
			name,
		});
	}

	public async checkoutBranch(path: string, branch: string): Promise<void> {
		await this.apiClient.gitCheckout({
			path: prefixRelativePath(await this.getRootDir(), path),
			branch,
		});
	}

	public async clone(
		url: string,
		path: string,
		options: GitCloneOptions = {}
	): Promise<void> {
		await this.apiClient.cloneRepository({
			url,
			branch: options.branch,
			path: prefixRelativePath(await this.getRootDir(), path),
			username: options.username,
			password: options.password,
			commit_id: options.commitId,
		});
	}

	public async commit(
		path: string,
		message: string,
		author: string,
		email: string
	): Promise<GitCommitResponse> {
		const response = await this.apiClient.gitCommit({
			path: prefixRelativePath(await this.getRootDir(), path),
			message,
			author,
			email,
		});
		return {
			sha: response.data.hash,
		};
	}

	public async push(
		path: string,
		credentials: GitCredentials = {}
	): Promise<void> {
		await this.apiClient.gitPush({
			path: prefixRelativePath(await this.getRootDir(), path),
			username: credentials.username,
			password: credentials.password,
		});
	}

	public async pull(
		path: string,
		credentials: GitCredentials = {}
	): Promise<void> {
		await this.apiClient.gitPull({
			path: prefixRelativePath(await this.getRootDir(), path),
			username: credentials.username,
			password: credentials.password,
		});
	}

	public async status(path: string): Promise<GitStatus> {
		const response = await this.apiClient.getGitStatus(
			prefixRelativePath(await this.getRootDir(), path)
		);

		return response.data;
	}
}

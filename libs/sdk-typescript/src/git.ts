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

import {
	addFiles,
	checkoutBranch,
	cloneRepository,
	commitChanges,
	createBranch,
	deleteBranch,
	type GitStatus,
	getStatus,
	type ListBranchResponse,
	listBranches,
	pullChanges,
	pushChanges,
} from '@snapflow/toolbox-api-client';
import type { ToolboxClientProvider } from './edge-toolbox-session.js';

export interface GitCommitResponse {
	sha: string;
}

export class Git {
	constructor(private readonly toolbox: ToolboxClientProvider) {}

	public async add(path: string, files: string[]): Promise<void> {
		await addFiles({ client: await this.toolbox(), body: { path, files } });
	}

	public async branches(path: string): Promise<ListBranchResponse> {
		const response = await listBranches({
			client: await this.toolbox(),
			query: { path },
		});
		return response.data;
	}

	public async createBranch(path: string, name: string): Promise<void> {
		await createBranch({ client: await this.toolbox(), body: { path, name } });
	}

	public async deleteBranch(path: string, name: string): Promise<void> {
		await deleteBranch({ client: await this.toolbox(), body: { path, name } });
	}

	public async checkoutBranch(path: string, branch: string): Promise<void> {
		await checkoutBranch({
			client: await this.toolbox(),
			body: { path, branch },
		});
	}

	public async clone(
		url: string,
		path: string,
		branch?: string,
		commitId?: string,
		username?: string,
		password?: string,
		insecureSkipTls?: boolean
	): Promise<void> {
		await cloneRepository({
			client: await this.toolbox(),
			body: {
				url,
				branch,
				path,
				username,
				password,
				commit_id: commitId,
				insecure_skip_tls: insecureSkipTls,
			},
		});
	}

	public async commit(
		path: string,
		message: string,
		author: string,
		email: string,
		allowEmpty?: boolean
	): Promise<GitCommitResponse> {
		const response = await commitChanges({
			client: await this.toolbox(),
			body: { path, message, author, email, allow_empty: allowEmpty },
		});
		return {
			sha: response.data.hash,
		};
	}

	public async push(
		path: string,
		username?: string,
		password?: string
	): Promise<void> {
		await pushChanges({
			client: await this.toolbox(),
			body: { path, username, password },
		});
	}

	public async pull(
		path: string,
		username?: string,
		password?: string
	): Promise<void> {
		await pullChanges({
			client: await this.toolbox(),
			body: { path, username, password },
		});
	}

	public async status(path: string): Promise<GitStatus> {
		const response = await getStatus({
			client: await this.toolbox(),
			query: { path },
		});
		return response.data;
	}
}

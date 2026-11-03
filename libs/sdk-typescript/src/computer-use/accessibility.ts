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
	type AccessibilityNodesResponse,
	type AccessibilityTreeResponse,
	type FindAccessibilityNodesRequest,
	findAccessibilityNodes,
	focusAccessibilityNode,
	type GetAccessibilityTreeData,
	getAccessibilityTree,
	invokeAccessibilityNode,
	setAccessibilityNodeValue,
} from '@snapflow/toolbox-api-client';
import type { ToolboxClientProvider } from '../edge-toolbox-session.js';

export type AccessibilityTreeOptions = NonNullable<
	GetAccessibilityTreeData['query']
>;

export type AccessibilityFindOptions = FindAccessibilityNodesRequest;

export class Accessibility {
	constructor(private readonly toolbox: ToolboxClientProvider) {}

	public async getTree(
		options: AccessibilityTreeOptions = {}
	): Promise<AccessibilityTreeResponse> {
		const response = await getAccessibilityTree({
			client: await this.toolbox(),
			query: options,
		});
		return response.data;
	}

	public async findNodes(
		options: AccessibilityFindOptions = {}
	): Promise<AccessibilityNodesResponse> {
		const response = await findAccessibilityNodes({
			client: await this.toolbox(),
			body: options,
		});
		return response.data;
	}

	public async focusNode(id: string): Promise<void> {
		await focusAccessibilityNode({
			client: await this.toolbox(),
			body: { id },
		});
	}

	public async invokeNode(id: string, action?: string): Promise<void> {
		await invokeAccessibilityNode({
			client: await this.toolbox(),
			body: { id, action },
		});
	}

	public async setNodeValue(id: string, value: string): Promise<void> {
		await setAccessibilityNodeValue({
			client: await this.toolbox(),
			body: { id, value },
		});
	}
}

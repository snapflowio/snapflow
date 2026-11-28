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

import { listSandboxes, type SandboxListItem } from '@snapflow/api-client';
import type { Client } from '@snapflow/api-client/client';
import type { ListSandboxesQuery } from '../sandbox.types.js';

export async function* listSandboxItems(
	client: Client,
	query: ListSandboxesQuery = {}
): AsyncGenerator<SandboxListItem> {
	const { labels, ...filters } = query;
	let cursor: string | undefined;
	do {
		const response = await listSandboxes({
			client,
			query: {
				...filters,
				cursor,
				labels: labels ? JSON.stringify(labels) : undefined,
			},
		});

		yield* response.data.items;

		cursor = response.data.nextCursor ?? undefined;
	} while (cursor);
}

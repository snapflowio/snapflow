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

import type { ListSandboxesData, StartSandbox } from '@snapflow/api-client';

export type StartSandboxOptions = StartSandbox & {
	timeout?: number;
	signal?: AbortSignal;
};

type ListSandboxesFilters = NonNullable<ListSandboxesData['query']>;

export type ListSandboxesQuery = Omit<
	ListSandboxesFilters,
	'cursor' | 'labels'
> & {
	labels?: Record<string, string>;
};

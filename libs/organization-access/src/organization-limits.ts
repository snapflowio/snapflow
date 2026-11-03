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

export const ORGANIZATION_MEMBERSHIP_LIMIT = 100;
export const ORGANIZATION_CUSTOM_ROLE_LIMIT = 50;

export const PERSONAL_ORGANIZATION_SLUG_PREFIX = 'personal-';
export const DELETED_ORGANIZATION_SLUG_PREFIX = 'deleted-';
export const RESERVED_ORGANIZATION_SLUG_PREFIXES = [
	PERSONAL_ORGANIZATION_SLUG_PREFIX,
	DELETED_ORGANIZATION_SLUG_PREFIX,
] as const;

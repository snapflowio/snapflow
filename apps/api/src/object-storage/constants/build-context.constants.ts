/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MAXIMUM_BUILD_CONTEXTS = 16;
export const BUILD_CONTEXT_HASH_PATTERN = /^[a-f0-9]{64}$/;
export const BUILD_CONTEXT_ARCHIVE_NAME = 'context.tar';

export const buildContextObjectKey = (
	organizationId: string,
	hash: string
): string => `${organizationId}/${hash}/${BUILD_CONTEXT_ARCHIVE_NAME}`;

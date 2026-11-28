/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum ObjectStorageErrorCode {
	UNAVAILABLE = 'object_storage_unavailable',
	BUILD_CONTEXT_LIMIT_EXCEEDED = 'build_context_limit_exceeded',
	BUILD_CONTEXT_HASH_INVALID = 'build_context_hash_invalid',
}

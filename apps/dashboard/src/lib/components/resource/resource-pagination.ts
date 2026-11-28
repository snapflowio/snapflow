/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

interface OffsetResourcePaginationConfig {
	mode?: 'offset';
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
	disabled?: boolean;
	onPageChange: (page: number) => void;
}

export interface CursorResourcePaginationConfig {
	mode: 'cursor';
	page: number;
	hasPrevious: boolean;
	hasNext: boolean;
	disabled?: boolean;
	onPrevious: () => void;
	onNext: () => void;
}

export type ResourcePaginationConfig =
	| OffsetResourcePaginationConfig
	| CursorResourcePaginationConfig;

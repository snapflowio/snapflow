/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { SortDirection } from '../enums/sort-direction.enum';

export const QUERY_ORDERS = {
	[SortDirection.ASC]: QueryOrder.ASC,
	[SortDirection.DESC]: QueryOrder.DESC,
} as const satisfies Record<SortDirection, QueryOrder>;

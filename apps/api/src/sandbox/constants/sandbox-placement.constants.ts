/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MILLISECONDS_PER_DAY,
	MILLISECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const MACHINE_ALTERNATIVE_LIMIT = 5;

export const SANDBOX_PRICE_JOB = {
	PRICE_CHANGE: 'apply-sandbox-price-changes',
	START_WAIT: 'settle-sandbox-start-waits',
} as const;

export const SANDBOX_PRICE_BATCH_SIZE = 100;

export const SANDBOX_REPRICE_BACKOFF = {
	baseMilliseconds: MILLISECONDS_PER_MINUTE,
	capMilliseconds: MILLISECONDS_PER_DAY,
} as const;

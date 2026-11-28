/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '../../common/constants/time.constants';

export const OBJECT_CONTENT_TYPE = {
	VOLUME_BACKUP: 'application/vnd.snapflow.volume-backup',
	IMMUTABLE_JSON: 'application/json',
	BUILD_LOG: 'text/plain; charset=utf-8',
} as const;

export const PRESIGNED_URL_LIFETIME_SECONDS = {
	BUILD_CONTEXT: 15 * SECONDS_PER_MINUTE,
	VOLUME_BACKUP: 2 * SECONDS_PER_HOUR,
	BUILD_LOG: 8 * SECONDS_PER_HOUR,
} as const;

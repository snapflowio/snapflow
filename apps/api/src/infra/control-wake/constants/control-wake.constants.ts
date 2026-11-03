/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS = 25;

export const CONTROL_DOCUMENT_READ = {
	defaultWaitSeconds: 0,
	maximumWaitSeconds: CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS,
	millisecondsPerSecond: 1_000,
	retryAfterSeconds: 5,
} as const;

export const CONTROL_WAKE = {
	channelPrefix: 'control:wake:',
	maximumTrackedKeys: 10_000,
} as const;

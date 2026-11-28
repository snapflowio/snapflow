/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';

export const TURNSTILE_SITEVERIFY = {
	url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
	timeoutMilliseconds: 10 * MILLISECONDS_PER_SECOND,
} as const;

export const ABUSE_REPORT_VERIFICATION_ACTION = 'abuse-report';

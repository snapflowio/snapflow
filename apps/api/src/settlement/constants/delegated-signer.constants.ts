/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	HOURS_PER_DAY,
	SECONDS_PER_HOUR,
} from '../../common/constants/time.constants';

export const DELEGATED_SIGNER_TRANSIT = {
	MOUNT: 'transit',
	KEY: 'snapflow-voucher-signer',
	ENCRYPT: 'encrypt',
	DECRYPT: 'decrypt',
	CIPHERTEXT_PATTERN: /^vault:v\d+:.+$/,
} as const;

export const DELEGATION_SUGGESTION = {
	proofLifetimeSeconds: HOURS_PER_DAY * SECONDS_PER_HOUR,
	hourlyCapHeadroomBasisPoints: 20_000n,
	expiryDays: 90,
} as const;

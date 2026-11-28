/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { encodeAbiParameters, type Hex, keccak256 } from 'viem';
import { PaymentChannelKind } from '../../enums/payment-channel-kind.enum';
import type { VoucherSigningMode } from '../../enums/voucher-signing-mode.enum';

const SALT_PARTS = [{ type: 'string[]' }] as const;

function salt(parts: readonly string[]): Hex {
	return keccak256(encodeAbiParameters(SALT_PARTS, [parts]));
}

export function sandboxChannelSalt(
	machineId: string,
	signingMode: VoucherSigningMode
): Hex {
	return salt([PaymentChannelKind.SANDBOX, machineId, signingMode]);
}

export function platformChannelSalt(organizationId: string): Hex {
	return salt([PaymentChannelKind.PLATFORM, organizationId]);
}

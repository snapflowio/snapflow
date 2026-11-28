/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MicroUsd } from '../../../common/values/micro-usd.value';
import { VoucherLimit } from '../../enums/voucher-limit.enum';
import type { AutomaticPaymentsGap } from '../../types/automatic-payments.types';

const NEXT_STEP =
	'Turn on automatic payments on the Funding page (billing/funding), or create the sandbox with voucherSigning: client and sign its vouchers with the SDK VoucherSigner.';

function hourly(microUsd: bigint): string {
	return `$${MicroUsd.of(microUsd).toUsd()} an hour`;
}

function reason(gap: AutomaticPaymentsGap): string {
	switch (gap.limit) {
		case VoucherLimit.SIGNER_MISSING:
			return 'Automatic payments are off for this organization, so Snapflow cannot pay hosts for this sandbox.';
		case VoucherLimit.SIGNER_REVOKED:
			return 'The automatic payment key of this organization was revoked, so Snapflow cannot pay hosts for this sandbox.';
		case VoucherLimit.SIGNER_THAWING:
			return 'Automatic payments are being turned off for this organization, so Snapflow no longer pays hosts with its key.';
		case VoucherLimit.SIGNER_EXPIRED:
			return `Automatic payments for this organization expired${gap.expiresAt ? ` on ${gap.expiresAt.toISOString()}` : ''}.`;
		case VoucherLimit.SIGNER_SCOPE:
			return 'The automatic payment key does not cover the current marketplace fee or is limited to a single host.';
		case VoucherLimit.SIGNER_CAP:
			return `The automatic payment limit${gap.hourlyCapMicroUsd === null ? '' : ` of ${hourly(gap.hourlyCapMicroUsd)}`} is below what the running sandboxes cost (${hourly(gap.hourlySpendMicroUsd)}). Raise the limit on the Funding page.`;
	}
}

export function automaticPaymentsMessage(gap: AutomaticPaymentsGap): string {
	return `${reason(gap)} ${NEXT_STEP}`;
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Address, Hex } from 'viem';
import type { BillingLineItem } from '../../billing/entities/billing-line-item.entity';
import type { LinePrice } from '../../marketplace/types/pricing.types';
import type { PaymentChannel } from '../entities/payment-channel.entity';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import type { VoucherLimit } from '../enums/voucher-limit.enum';

type ChargedLine = Pick<BillingLineItem, 'grossMicroUsd'>;

export interface PriceCharges {
	lines: readonly ChargedLine[];
	accruals: readonly LinePrice[];
}

export interface ReceiptChainHead {
	digest: Hex;
	receiptCount: number;
	sampledAt: Date | null;
}

export interface VoucherEvidence {
	chargedMicroUsd: string;
	availableMicroUsd: string;
	outstandingMicroUsd: string;
	signerRemainingMicroUsd: string | null;
	limitedBy: VoucherLimit | null;
	receiptHeads: Hex[];
}

interface SignerProofEvidence {
	customerAddress: Address;
	proofDeadline: string;
}

export type SignatureEvidence = VoucherEvidence | SignerProofEvidence;

export interface ChannelVoucher {
	channel: PaymentChannel;
	voucher: PaymentVoucher;
}

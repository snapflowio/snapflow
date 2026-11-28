/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Configuration } from '../../config/configuration.config';
import type {
	BillingReceiptDto,
	BillingReceiptSummaryDto,
} from '../dto/billing-receipt.dto';

export type BillingReceiptBillTo = BillingReceiptDto['billTo'];

export type BillingReceiptContent = Omit<
	BillingReceiptDto,
	keyof BillingReceiptSummaryDto | 'billTo'
> &
	Pick<BillingReceiptSummaryDto, 'totalMicroUsd'>;

export type BillingReceiptIssuer = NonNullable<
	Configuration['receipts']['issuer']
>;

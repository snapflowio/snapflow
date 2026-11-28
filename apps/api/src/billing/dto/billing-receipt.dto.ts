/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiProperty,
	ApiPropertyOptional,
	ApiSchema,
	OmitType,
} from '@nestjs/swagger';
import { IsIn, IsUUID, Matches } from 'class-validator';
import {
	ReceiptDocumentFormat,
	ReceiptPaymentKind,
} from '../constants/billing-receipt.constants';
import { STATEMENT_MONTH_PATTERN } from '../constants/billing-statement.constants';
import { BillingProfileDto } from './billing-profile.dto';

@ApiSchema({ name: 'IssueBillingReceipt' })
export class IssueBillingReceiptDto {
	@ApiProperty({
		description: 'Closed statement month to issue the receipt for, as YYYY-MM',
		example: '2026-10',
	})
	@Matches(STATEMENT_MONTH_PATTERN)
	month: string;
}

@ApiSchema({ name: 'BillingReceiptDocumentParams' })
export class BillingReceiptDocumentParamsDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	receiptId: string;

	@ApiProperty({ enum: Object.values(ReceiptDocumentFormat) })
	@IsIn(Object.values(ReceiptDocumentFormat))
	format: ReceiptDocumentFormat;
}

@ApiSchema({ name: 'BillingReceiptBillTo' })
export class BillingReceiptBillToDto extends OmitType(BillingProfileDto, [
	'updatedAt',
] as const) {}

@ApiSchema({ name: 'BillingReceiptSandboxUsage' })
class BillingReceiptSandboxUsageDto {
	@ApiProperty() sandboxId: string;
	@ApiPropertyOptional({ description: 'Omitted once the sandbox is deleted' })
	sandboxName?: string;
	@ApiProperty() amountMicroUsd: string;
}

@ApiSchema({ name: 'BillingReceiptPayment' })
class BillingReceiptPaymentDto {
	@ApiProperty({ enum: Object.values(ReceiptPaymentKind) })
	kind: ReceiptPaymentKind;
	@ApiProperty({ format: 'date-time' })
	occurredAt: string;
	@ApiProperty({ description: 'USDC moved, always positive' })
	amountMicroUsd: string;
	@ApiProperty({
		type: String,
		nullable: true,
		description: 'Settlement chain transaction that moved the USDC',
	})
	transactionHash: string | null;
}

@ApiSchema({ name: 'BillingReceiptSummary' })
export class BillingReceiptSummaryDto {
	@ApiProperty({ format: 'uuid' }) id: string;
	@ApiProperty({
		description: 'Receipt number, unique and sequential across Snapflow',
		example: 'SF-2026-000123',
	})
	number: string;
	@ApiProperty({
		description: 'Statement month as YYYY-MM',
		example: '2026-10',
	})
	month: string;
	@ApiProperty({ type: String, format: 'date-time' }) periodStart: Date;
	@ApiProperty({ type: String, format: 'date-time' }) periodEnd: Date;
	@ApiProperty({ type: String, format: 'date-time' }) issuedAt: Date;
	@ApiProperty({ description: 'Everything charged in the month' })
	totalMicroUsd: string;
}

@ApiSchema({ name: 'BillingReceipt' })
export class BillingReceiptDto extends BillingReceiptSummaryDto {
	@ApiProperty({
		type: BillingReceiptBillToDto,
		description: 'Billing details as they were when the receipt was issued',
	})
	billTo: BillingReceiptBillToDto;
	@ApiProperty({ description: 'What the hosts charged for their machines' })
	hostComputeMicroUsd: string;
	@ApiProperty({ description: "Snapflow's fee on the host compute" })
	snapflowFeeMicroUsd: string;
	@ApiProperty({
		description: 'Snapflow storage: archives, snapshots and backups',
	})
	storageMicroUsd: string;
	@ApiProperty() openingCreditMicroUsd: string;
	@ApiProperty() depositsMicroUsd: string;
	@ApiProperty() withdrawalsMicroUsd: string;
	@ApiProperty() closingCreditMicroUsd: string;
	@ApiProperty({ type: BillingReceiptSandboxUsageDto, isArray: true })
	usageBySandbox: BillingReceiptSandboxUsageDto[];
	@ApiProperty({ type: BillingReceiptPaymentDto, isArray: true })
	payments: BillingReceiptPaymentDto[];
	@ApiProperty({
		description: 'Network the USDC escrow settles on',
		example: 'Base',
	})
	networkName: string;
	@ApiProperty({
		type: String,
		nullable: true,
		description: "Block explorer of that network, for the payments' hashes",
	})
	explorerUrl: string | null;
}

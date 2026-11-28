/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common';
import { csvDocument } from '../../common/utils/csv.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SETTLEMENT_CHAINS } from '../../settlement/constants/settlement.constants';
import {
	BillingReceiptErrorCode,
	RECEIPT_DOCUMENT_CONTENT_TYPE,
	RECEIPT_FILENAME_PREFIX,
	ReceiptDocumentFormat,
} from '../constants/billing-receipt.constants';
import type {
	BillingReceiptDto,
	BillingReceiptSummaryDto,
} from '../dto/billing-receipt.dto';
import { BillingProfile } from '../entities/billing-profile.entity';
import { BillingReceipt } from '../entities/billing-receipt.entity';
import {
	lockReceiptIssuing,
	nextReceiptSequence,
} from '../queries/billing-receipt.query';
import {
	firstLedgerActivity,
	statementEscrowPayments,
} from '../queries/billing-statement.query';
import { renderReceiptPdf } from '../templates/billing-receipt-document';
import type { BillingReceiptIssuer } from '../types/billing-receipt.types';
import {
	receiptBillTo,
	receiptContent,
	receiptCsvRows,
	receiptDto,
	receiptSummary,
} from '../utils/reporting/billing-receipt.util';
import { parseStatementMonth } from '../utils/reporting/billing-statement.util';
import { BillingStatementService } from './billing-statement.service';

@Injectable()
export class BillingReceiptService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly statements: BillingStatementService,
		private readonly config: TypedConfigService
	) {}

	issuer(): BillingReceiptIssuer {
		const issuer = this.config.get('receipts.issuer');
		if (!issuer) {
			throw new ServiceUnavailableException({
				code: BillingReceiptErrorCode.NOT_CONFIGURED,
				message: 'Receipts are not set up on this deployment',
			});
		}
		return issuer;
	}

	async list(organizationId: string): Promise<BillingReceiptSummaryDto[]> {
		const receipts = await this.entityManager
			.fork()
			.find(BillingReceipt, { organizationId }, { orderBy: { month: 'DESC' } });
		return receipts.map(receiptSummary);
	}

	async get(
		organizationId: string,
		receiptId: string
	): Promise<BillingReceiptDto> {
		const receipt = await this.entityManager
			.fork()
			.findOne(BillingReceipt, { id: receiptId, organizationId });
		if (!receipt) {
			throw new NotFoundException({
				code: BillingReceiptErrorCode.NOT_FOUND,
				message: `Receipt ${receiptId} was not found`,
			});
		}
		return receiptDto(receipt);
	}

	async issue(
		organizationId: string,
		month: string
	): Promise<BillingReceiptDto> {
		this.issuer();
		const manager = this.entityManager.fork();
		const existing = await manager.findOne(BillingReceipt, {
			organizationId,
			month,
		});
		if (existing) return receiptDto(existing);
		await this.assertMonthIssuable(manager, organizationId, month);
		const profile = await manager.findOne(BillingProfile, { organizationId });
		if (!profile) {
			throw new ConflictException({
				code: BillingReceiptErrorCode.PROFILE_REQUIRED,
				message: 'Add billing details before issuing a receipt',
			});
		}
		const statement = await this.statements.get(organizationId, month);
		return this.entityManager.fork().transactional(async (transaction) => {
			await lockReceiptIssuing(transaction);
			const issued = await transaction.findOne(BillingReceipt, {
				organizationId,
				month,
			});
			if (issued) return receiptDto(issued);
			const payments = await statementEscrowPayments(
				transaction,
				organizationId,
				new Date(statement.periodStart),
				new Date(statement.periodEnd)
			);
			const receipt = transaction.create(BillingReceipt, {
				organizationId,
				month,
				sequence: await nextReceiptSequence(transaction),
				issuedAt: await databaseNow(transaction),
				billTo: receiptBillTo(profile),
				content: receiptContent(statement, payments, this.network()),
			});
			await transaction.flush();
			return receiptDto(receipt);
		});
	}

	async document(
		organizationId: string,
		receiptId: string,
		format: ReceiptDocumentFormat
	) {
		const issuer = this.issuer();
		const receipt = await this.get(organizationId, receiptId);
		return {
			body:
				format === ReceiptDocumentFormat.PDF
					? await renderReceiptPdf(receipt, issuer)
					: Buffer.from(
							csvDocument(receiptCsvRows(receipt), { byteOrderMark: true })
						),
			contentType: RECEIPT_DOCUMENT_CONTENT_TYPE[format],
			filename: `${RECEIPT_FILENAME_PREFIX}-${receipt.number}.${format}`,
		};
	}

	private async assertMonthIssuable(
		manager: EntityManager,
		organizationId: string,
		month: string
	): Promise<void> {
		const period = parseStatementMonth(month);
		if (!period || period.periodEnd > (await databaseNow(manager))) {
			throw new ConflictException({
				code: BillingReceiptErrorCode.MONTH_OPEN,
				message: 'Receipts are issued once the month has ended',
			});
		}
		const firstActivity = await firstLedgerActivity(manager, organizationId);
		if (firstActivity === null || period.periodEnd <= firstActivity) {
			throw new ConflictException({
				code: BillingReceiptErrorCode.MONTH_WITHOUT_ACTIVITY,
				message:
					'The organization had no billing activity by the end of this month, so it has no receipt',
			});
		}
	}

	private network() {
		const chain = SETTLEMENT_CHAINS[this.config.get('settlement.chainId')];
		return {
			name: chain.name,
			explorerUrl: chain.blockExplorers?.default.url ?? null,
		};
	}
}

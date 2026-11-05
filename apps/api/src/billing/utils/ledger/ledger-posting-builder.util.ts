/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	BILLING_LEDGER_SOURCE_VERSION,
	BillingLedgerSide,
} from '../../constants/billing.constants';
import type {
	BillingLedgerAccountReference,
	BillingLedgerPosting,
	BillingLedgerPostingEntry,
} from '../../services/billing-ledger.service';

export interface LedgerPostingSource {
	sourceType: string;
	descriptionCode: string;
	sourceReference: string;
	effectiveAt: Date;
	metadata: Record<string, unknown>;
	sourceVersion?: number;
}

export class LedgerPostingBuilder {
	private readonly entries: BillingLedgerPostingEntry[] = [];

	private constructor(private readonly source: LedgerPostingSource) {}

	static for(source: LedgerPostingSource): LedgerPostingBuilder {
		return new LedgerPostingBuilder(source);
	}

	debit(account: BillingLedgerAccountReference, amount: MicroUsd): this {
		return this.entry(account, BillingLedgerSide.DEBIT, amount);
	}

	credit(account: BillingLedgerAccountReference, amount: MicroUsd): this {
		return this.entry(account, BillingLedgerSide.CREDIT, amount);
	}

	debitIfPositive(
		account: BillingLedgerAccountReference,
		amount: MicroUsd
	): this {
		return amount.isPositive() ? this.debit(account, amount) : this;
	}

	creditIfPositive(
		account: BillingLedgerAccountReference,
		amount: MicroUsd
	): this {
		return amount.isPositive() ? this.credit(account, amount) : this;
	}

	build(): BillingLedgerPosting {
		return {
			sourceType: this.source.sourceType,
			sourceReference: this.source.sourceReference,
			sourceVersion: this.source.sourceVersion ?? BILLING_LEDGER_SOURCE_VERSION,
			descriptionCode: this.source.descriptionCode,
			effectiveAt: this.source.effectiveAt,
			metadata: this.source.metadata,
			entries: [...this.entries],
		};
	}

	private entry(
		account: BillingLedgerAccountReference,
		side: BillingLedgerSide,
		amount: MicroUsd
	): this {
		this.entries.push({ account, side, amount: amount.toString() });
		return this;
	}
}

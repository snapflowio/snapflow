/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OptionalProps } from '@mikro-orm/core';
import {
	Check,
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address, Hash, Hex } from 'viem';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { SettlementTransactionKind } from '../enums/settlement-transaction-kind.enum';
import { SettlementTransactionStatus } from '../enums/settlement-transaction-status.enum';
import {
	addressColumn,
	amountColumn,
	createdAtColumn,
	hashColumn,
	integerColumn,
	textColumn,
	timestampColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../utils/settlement-columns.util';
import { HostSettlement } from './host-settlement.entity';
import { WalletTransaction } from './wallet-transaction.entity';

@Entity({ tableName: 'settlement_transaction' })
@Unique({
	name: 'UQ_settlement_transaction_hash',
	properties: ['chainId', 'transactionHash'],
})
@Index({
	name: 'IDX_settlement_transaction_pending',
	expression: `create index "IDX_settlement_transaction_pending" on "settlement_transaction" ("sentAt") where "status" = '${SettlementTransactionStatus.PENDING}'`,
})
@Index({
	name: 'IDX_settlement_transaction_kind',
	properties: ['kind', 'sentAt'],
})
@Check({
	name: 'CHK_settlement_transaction_kind',
	expression: `"kind" in (${sqlValueList(SettlementTransactionKind)})`,
})
@Check({
	name: 'CHK_settlement_transaction_status',
	expression: `"status" in (${sqlValueList(SettlementTransactionStatus)})`,
})
export class SettlementTransaction {
	[OptionalProps]?: 'id' | 'createdAt' | 'replacedTransactionHashes';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(integerColumn('chainId'))
	chainId: number;

	@Property(addressColumn('contractAddress'))
	contractAddress: Address;

	@Property(varcharColumn('kind'))
	kind: SettlementTransactionKind;

	@Property(hashColumn('transactionHash'))
	transactionHash: Hash;

	@Property(integerColumn('nonce'))
	nonce: number;

	@Property(textColumn('signedTransaction'))
	signedTransaction: Hex;

	@Property(amountColumn('initialMaxFeePerGas'))
	initialMaxFeePerGas: string;

	@Property({
		type: 'json',
		columnType: 'jsonb',
		fieldName: 'replacedTransactionHashes',
		defaultRaw: `'[]'`,
	})
	replacedTransactionHashes: Hash[] = [];

	@Property(timestampColumn('signedAt'))
	signedAt: Date;

	@Property(varcharColumn('status'))
	status: SettlementTransactionStatus;

	@ManyToOne({
		entity: () => WalletTransaction,
		mapToPk: true,
		joinColumn: 'walletTransactionId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_settlement_transaction_wallet_transaction',
	})
	walletTransactionId: string | null;

	@ManyToOne({
		entity: () => HostSettlement,
		mapToPk: true,
		joinColumn: 'hostSettlementId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_settlement_transaction_host_settlement',
	})
	hostSettlementId: string | null;

	@Property({ ...addressColumn('hostAddress'), nullable: true })
	hostAddress: Address | null;

	@Property({ ...textColumn('error'), nullable: true })
	error: string | null;

	@Property(timestampColumn('sentAt'))
	sentAt: Date;

	@Property({ ...timestampColumn('settledAt'), nullable: true })
	settledAt: Date | null;

	@Property(createdAtColumn)
	createdAt: Date;
}

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
import { RecoveryOwnerKind } from '../enums/recovery-owner-kind.enum';
import { WalletTransactionStatus } from '../enums/wallet-transaction-status.enum';
import {
	addressColumn,
	amountColumn,
	createdAtColumn,
	hashColumn,
	integerColumn,
	textColumn,
	timestampColumn,
	updatedAtColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../utils/settlement-columns.util';
import { UserWallet } from './user-wallet.entity';

@Entity({ tableName: 'wallet_transaction' })
@Unique({
	name: 'UQ_wallet_transaction_safe_tx_hash',
	properties: ['userWalletId', 'safeTxHash'],
})
@Index({
	name: 'IDX_wallet_transaction_wallet_created',
	properties: ['userWalletId', 'createdAt'],
})
@Index({
	name: 'IDX_wallet_transaction_open',
	expression: `create index "IDX_wallet_transaction_open" on "wallet_transaction" ("createdAt") where "status" in ('${WalletTransactionStatus.QUEUED}', '${WalletTransactionStatus.SENT}')`,
})
@Check({
	name: 'CHK_wallet_transaction_status',
	expression: `"status" in (${sqlValueList(WalletTransactionStatus)})`,
})
@Check({
	name: 'CHK_wallet_transaction_recovery_owner_kind',
	expression: `"recoveryOwnerKind" is null or "recoveryOwnerKind" in (${sqlValueList(RecoveryOwnerKind)})`,
})
export class WalletTransaction {
	[OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => UserWallet,
		mapToPk: true,
		joinColumn: 'userWalletId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_wallet_transaction_user_wallet',
	})
	userWalletId: string;

	@Property(addressColumn('signerAddress'))
	signerAddress: Address;

	@Property(hashColumn('signerPublicKeyX'))
	signerPublicKeyX: Hex;

	@Property(hashColumn('signerPublicKeyY'))
	signerPublicKeyY: Hex;

	@Property(textColumn('signerVerifiers'))
	signerVerifiers: Hex;

	@Property(amountColumn('safeNonce'))
	safeNonce: string;

	@Property(addressColumn('to'))
	to: Address;

	@Property(textColumn('data'))
	data: Hex;

	@Property(integerColumn('operation'))
	operation: number;

	@Property(hashColumn('safeTxHash'))
	safeTxHash: Hash;

	@Property(amountColumn('feeMicroUsd'))
	feeMicroUsd: string;

	@Property({ ...amountColumn('feePaidMicroUsd'), nullable: true })
	feePaidMicroUsd: string | null;

	@Property(textColumn('signatures'))
	signatures: Hex;

	@Property({ ...varcharColumn('recoveryOwnerKind'), nullable: true })
	recoveryOwnerKind: RecoveryOwnerKind | null;

	@Property({ ...addressColumn('recoveryOwnerAddress'), nullable: true })
	recoveryOwnerAddress: Address | null;

	@Property(varcharColumn('status'))
	status: WalletTransactionStatus;

	@Property({ ...hashColumn('transactionHash'), nullable: true })
	transactionHash: Hash | null;

	@Property({ ...textColumn('error'), nullable: true })
	error: string | null;

	@Property({ ...timestampColumn('settledAt'), nullable: true })
	settledAt: Date | null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}

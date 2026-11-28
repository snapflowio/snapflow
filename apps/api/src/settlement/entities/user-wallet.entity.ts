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
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import type { Address, Hex } from 'viem';
import { Passkey } from '../../auth/entities/passkey.entity';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { User } from '../../user/entities/user.entity';
import { RecoveryOwnerKind } from '../enums/recovery-owner-kind.enum';
import { RecoveryStatus } from '../enums/recovery-status.enum';
import {
	addressColumn,
	createdAtColumn,
	hashColumn,
	integerColumn,
	textColumn,
	timestampColumn,
	updatedAtColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../utils/settlement-columns.util';

@Entity({ tableName: 'user_wallet' })
@Unique({ name: 'UQ_user_wallet_user', properties: ['userId'] })
@Unique({
	name: 'UQ_user_wallet_safe',
	properties: ['chainId', 'safeAddress'],
})
@Check({
	name: 'CHK_user_wallet_recovery_status',
	expression: `"recoveryStatus" in (${sqlValueList(RecoveryStatus)})`,
})
@Check({
	name: 'CHK_user_wallet_recovery_owner_kind',
	expression: `"recoveryOwnerKind" is null or "recoveryOwnerKind" in (${sqlValueList(RecoveryOwnerKind)})`,
})
export class UserWallet {
	[OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'userId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_user_wallet_user',
	})
	userId: string | null;

	@ManyToOne({
		entity: () => Passkey,
		mapToPk: true,
		joinColumn: 'passkeyId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_user_wallet_passkey',
	})
	passkeyId: string | null;

	@Property(integerColumn('chainId'))
	chainId: number;

	@Property(hashColumn('publicKeyX'))
	publicKeyX: Hex;

	@Property(hashColumn('publicKeyY'))
	publicKeyY: Hex;

	@Property(textColumn('verifiers'))
	verifiers: Hex;

	@Property(addressColumn('signerAddress'))
	signerAddress: Address;

	@Property(addressColumn('safeAddress'))
	safeAddress: Address;

	@Property({ ...timestampColumn('deployedAt'), nullable: true })
	deployedAt: Date | null;

	@Property(varcharColumn('recoveryStatus'))
	recoveryStatus: RecoveryStatus;

	@Property({ ...addressColumn('recoveryOwnerAddress'), nullable: true })
	recoveryOwnerAddress: Address | null;

	@Property({ ...varcharColumn('recoveryOwnerKind'), nullable: true })
	recoveryOwnerKind: RecoveryOwnerKind | null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}

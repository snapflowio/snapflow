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
} from '@mikro-orm/decorators/legacy';
import type { Address, Hash, Hex } from 'viem';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Machine } from '../../machine/entities/machine.entity';
import { HostSettlementStatus } from '../enums/host-settlement-status.enum';
import type { HostSettlementItem } from '../types/host-settlement.types';
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

@Entity({ tableName: 'host_settlement' })
@Index({
	name: 'UQ_host_settlement_open',
	expression: `create unique index "UQ_host_settlement_open" on "host_settlement" ("chainId", "contractAddress", "hostAddress") where "status" in ('${HostSettlementStatus.QUEUED}', '${HostSettlementStatus.SENT}')`,
})
@Index({
	name: 'IDX_host_settlement_machine',
	properties: ['machineId', 'createdAt'],
})
@Check({
	name: 'CHK_host_settlement_status',
	expression: `"status" in (${sqlValueList(HostSettlementStatus)})`,
})
@Check({
	name: 'CHK_host_settlement_relay_fee',
	expression: '"relayFeeMicroUsd" >= 0',
})
export class HostSettlement {
	[OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(integerColumn('chainId'))
	chainId: number;

	@Property(addressColumn('contractAddress'))
	contractAddress: Address;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_host_settlement_machine',
	})
	machineId: string;

	@Property(addressColumn('hostAddress'))
	hostAddress: Address;

	@Property(addressColumn('payoutAddress'))
	payoutAddress: Address;

	@Property(amountColumn('relayFeeMicroUsd'))
	relayFeeMicroUsd: string;

	@Property(amountColumn('nonce'))
	nonce: string;

	@Property(timestampColumn('deadline'))
	deadline: Date;

	@Property(textColumn('signature'))
	signature: Hex;

	@Property({ type: 'json', columnType: 'jsonb', fieldName: 'items' })
	items: HostSettlementItem[];

	@Property(varcharColumn('status'))
	status: HostSettlementStatus;

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

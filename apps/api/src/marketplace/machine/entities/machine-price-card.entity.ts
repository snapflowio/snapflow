/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType } from '@mikro-orm/core';
import {
	Check,
	Entity,
	ManyToOne,
	PrimaryKey,
	Property,
	Trigger,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { User } from '../../../user/entities/user.entity';
import { MARKETPLACE_MONEY_COLUMN_TYPE } from '../constants/marketplace.constants';
import { MACHINE_PRICE_CARD_IMMUTABLE_TRIGGER } from './machine-price-card.triggers';

const moneyColumn = (fieldName: string) =>
	({
		type: DecimalType,
		columnType: MARKETPLACE_MONEY_COLUMN_TYPE,
		runtimeType: 'string',
		fieldName,
	}) as const;

@Entity({ tableName: 'machine_price_card' })
@Trigger(MACHINE_PRICE_CARD_IMMUTABLE_TRIGGER)
@Unique({
	name: 'UQ_machine_price_card_version',
	properties: ['machineId', 'version'],
})
@Check({
	name: 'CHK_machine_price_card_rates',
	expression:
		'"vcpuHourMicroUsd" > 0 and "memoryGibHourMicroUsd" > 0 and "gpuHourMicroUsd" >= 0 and "diskGibMonthMicroUsd" > 0 and "stoppedDiskGibMonthMicroUsd" > 0 and "egressMicroUsdPerGiB" >= 0',
})
@Check({
	name: 'CHK_machine_price_card_egress_ceiling',
	expression: '"egressMicroUsdPerGiB" <= "egressCeilingMicroUsdPerGiB"',
})
@Check({
	name: 'CHK_machine_price_card_version',
	expression: '"version" > 0',
})
export class MachinePriceCard {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_price_card_machine',
	})
	machineId: string;

	@ManyToOne({
		entity: () => Organization,
		mapToPk: true,
		joinColumn: 'organizationId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_price_card_organization',
	})
	organizationId: string;

	@Property({ type: 'integer', columnType: 'integer', fieldName: 'version' })
	version: number;

	@Property(moneyColumn('vcpuHourMicroUsd'))
	vcpuHourMicroUsd: string;

	@Property(moneyColumn('memoryGibHourMicroUsd'))
	memoryGibHourMicroUsd: string;

	@Property(moneyColumn('gpuHourMicroUsd'))
	gpuHourMicroUsd: string;

	@Property(moneyColumn('diskGibMonthMicroUsd'))
	diskGibMonthMicroUsd: string;

	@Property(moneyColumn('stoppedDiskGibMonthMicroUsd'))
	stoppedDiskGibMonthMicroUsd: string;

	@Property(moneyColumn('egressMicroUsdPerGiB'))
	egressMicroUsdPerGiB: string;

	@Property(moneyColumn('referencePriceMicroUsd'))
	referencePriceMicroUsd: string;

	@Property(moneyColumn('floorMicroUsd'))
	floorMicroUsd: string;

	@Property(moneyColumn('egressCeilingMicroUsdPerGiB'))
	egressCeilingMicroUsdPerGiB: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'createdAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
	})
	createdAt: Date;

	@ManyToOne({
		entity: () => User,
		mapToPk: true,
		joinColumn: 'createdBy',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'set null',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_price_card_created_by',
	})
	createdBy: string | null = null;
}

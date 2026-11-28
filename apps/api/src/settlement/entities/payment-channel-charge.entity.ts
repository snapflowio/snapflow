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
import { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import {
	amountColumn,
	createdAtColumn,
	timestampColumn,
	updatedAtColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../utils/settlement-columns.util';
import { PaymentChannel } from './payment-channel.entity';

@Entity({ tableName: 'payment_channel_charge' })
@Unique({
	name: 'UQ_payment_channel_charge_placement_price',
	properties: ['placementPriceId'],
})
@Index({
	name: 'IDX_payment_channel_charge_channel',
	properties: ['paymentChannelId', 'settledAt'],
})
@Index({
	name: 'IDX_payment_channel_charge_sandbox',
	properties: ['sandboxId', 'createdAt'],
})
@Check({
	name: 'CHK_payment_channel_charge_amount',
	expression: '"chargedMicroUsd" >= 0',
})
export class PaymentChannelCharge {
	[OptionalProps]?: 'id' | 'createdAt' | 'updatedAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@ManyToOne({
		entity: () => PaymentChannel,
		mapToPk: true,
		joinColumn: 'paymentChannelId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_channel_charge_channel',
	})
	paymentChannelId: string;

	@ManyToOne({
		entity: () => PlacementPrice,
		mapToPk: true,
		joinColumn: 'placementPriceId',
		columnType: 'uuid',
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_payment_channel_charge_placement_price',
	})
	placementPriceId: string;

	@Property(varcharColumn('sandboxId'))
	sandboxId: string;

	@Property(amountColumn('chargedMicroUsd'))
	chargedMicroUsd: string;

	@Property({ ...timestampColumn('endedAt'), nullable: true })
	endedAt: Date | null;

	@Property({ ...timestampColumn('settledAt'), nullable: true })
	settledAt: Date | null;

	@Property(createdAtColumn)
	createdAt: Date;

	@Property(updatedAtColumn)
	updatedAt: Date;
}

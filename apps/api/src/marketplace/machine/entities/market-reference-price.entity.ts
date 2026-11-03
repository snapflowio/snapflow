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
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import { MARKETPLACE_MONEY_COLUMN_TYPE } from '../constants/marketplace.constants';

const nullableMoneyColumn = (fieldName: string) =>
	({
		type: DecimalType,
		columnType: MARKETPLACE_MONEY_COLUMN_TYPE,
		runtimeType: 'string',
		fieldName,
		nullable: true,
	}) as const;

@Entity({ tableName: 'market_reference_price' })
@Check({
	name: 'CHK_market_reference_price_samples',
	expression: '"sampleCount" >= 0',
})
export class MarketReferencePrice {
	@PrimaryKey({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'priceClass',
	})
	priceClass: string;

	@Property(nullableMoneyColumn('bootstrapMedianMicroUsd'))
	bootstrapMedianMicroUsd: string | null = null;

	@Property(nullableMoneyColumn('marketMedianMicroUsd'))
	marketMedianMicroUsd: string | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'sampleCount',
		default: 0,
	})
	sampleCount = 0;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'computedAt',
		nullable: true,
	})
	computedAt: Date | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;

	@Property({
		type: 'uuid',
		columnType: 'uuid',
		fieldName: 'updatedBy',
		nullable: true,
	})
	updatedBy: string | null = null;
}

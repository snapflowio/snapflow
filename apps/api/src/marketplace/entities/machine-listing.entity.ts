/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Check,
	Entity,
	ManyToOne,
	Property,
} from '@mikro-orm/decorators/legacy';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { Machine } from '../../sandbox/machine/entities/machine.entity';
import { MARKETPLACE_INITIAL_VERSION } from '../constants/marketplace.constants';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import { MachinePriceCard } from './machine-price-card.entity';

@Entity({ tableName: 'machine_listing' })
@Check({
	name: 'CHK_machine_listing_priced',
	expression: `"state" <> '${ListingState.LISTED}' or "visibility" = '${ListingVisibility.PRIVATE}' or "currentPriceCardId" is not null`,
})
@Check({
	name: 'CHK_machine_listing_state',
	expression: `"state" in (${sqlValueList(ListingState)})`,
})
@Check({
	name: 'CHK_machine_listing_visibility',
	expression: `"visibility" in (${sqlValueList(ListingVisibility)})`,
})
export class MachineListing {
	@ManyToOne({
		entity: () => Machine,
		mapToPk: true,
		primary: true,
		joinColumn: 'machineId',
		columnType: 'uuid',
		deleteRule: 'cascade',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_listing_machine',
	})
	machineId: string;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'state',
		default: ListingState.DRAFT,
	})
	state: ListingState = ListingState.DRAFT;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'visibility',
		default: ListingVisibility.PRIVATE,
	})
	visibility: ListingVisibility = ListingVisibility.PRIVATE;

	@ManyToOne({
		entity: () => MachinePriceCard,
		mapToPk: true,
		joinColumn: 'currentPriceCardId',
		columnType: 'uuid',
		nullable: true,
		deleteRule: 'restrict',
		updateRule: 'no action',
		foreignKeyName: 'FK_machine_listing_current_price_card',
	})
	currentPriceCardId: string | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'belowFloorSince',
		nullable: true,
	})
	belowFloorSince: Date | null = null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'aboveEgressCeilingSince',
		nullable: true,
	})
	aboveEgressCeilingSince: Date | null = null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'version',
		version: true,
		default: MARKETPLACE_INITIAL_VERSION,
	})
	version = MARKETPLACE_INITIAL_VERSION;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'updatedAt',
		defaultRaw: 'now()',
		onCreate: () => new Date(),
		onUpdate: () => new Date(),
	})
	updatedAt: Date;
}

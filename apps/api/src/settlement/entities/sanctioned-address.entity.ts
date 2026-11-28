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
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import {
	addressColumn,
	integerColumn,
	textColumn,
	timestampColumn,
	varcharColumn,
} from '../utils/settlement-columns.util';

@Entity({ tableName: 'sanctioned_address' })
@Check({
	name: 'CHK_sanctioned_address_lowercase',
	expression: '"address" = lower("address")',
})
export class SanctionedAddress {
	@PrimaryKey(addressColumn('address'))
	address: Address;

	@Property(integerColumn('sdnEntryUid'))
	sdnEntryUid: number;

	@Property(textColumn('entityName'))
	entityName: string;

	@Property(varcharColumn('currency'))
	currency: string;

	@Property(timestampColumn('listedAt'))
	listedAt: Date;
}

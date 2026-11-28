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
	PrimaryKey,
	Property,
} from '@mikro-orm/decorators/legacy';
import type { Address } from 'viem';
import { sqlValueList } from '../../infra/database/utils/sql-value-list.util';
import { SanctionsPendingAlertKind } from '../constants/sanctions.constants';
import { PaymentWalletPurpose } from '../enums/payment-wallet-purpose.enum';
import {
	addressColumn,
	createdAtColumn,
	uuidColumn,
	uuidPrimaryKey,
	varcharColumn,
} from '../utils/settlement-columns.util';

@Entity({ tableName: 'sanctions_pending_alert' })
@Check({
	name: 'CHK_sanctions_pending_alert_kind',
	expression: `"kind" in (${sqlValueList(SanctionsPendingAlertKind)})`,
})
@Check({
	name: 'CHK_sanctions_pending_alert_purpose',
	expression: `"purpose" in (${sqlValueList(PaymentWalletPurpose)})`,
})
export class SanctionsPendingAlert {
	[OptionalProps]?: 'id' | 'createdAt';

	@PrimaryKey(uuidPrimaryKey)
	id: string;

	@Property(varcharColumn('kind'))
	kind: SanctionsPendingAlertKind;

	@Property(uuidColumn('paymentWalletId'))
	paymentWalletId: string;

	@Property(uuidColumn('organizationId'))
	organizationId: string;

	@Property(varcharColumn('purpose'))
	purpose: PaymentWalletPurpose;

	@Property(addressColumn('address'))
	address: Address;

	@Property(createdAtColumn)
	createdAt: Date;
}

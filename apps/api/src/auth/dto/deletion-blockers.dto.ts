/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import {
	LIVE_ORGANIZATION_RESOURCE,
	type LiveOrganizationResource,
} from '../../organization/constants/live-organization-resource.constants';
import {
	HELD_FUND,
	type HeldFund,
} from '../../settlement/constants/held-funds.constants';

export class OrganizationDeletionBlockersDto {
	@ApiProperty({
		enum: Object.values(LIVE_ORGANIZATION_RESOURCE),
		enumName: 'LiveOrganizationResource',
		isArray: true,
		description: 'Resource kinds that must be deleted first',
	})
	liveResources: LiveOrganizationResource[];

	@ApiProperty({
		enum: Object.values(HELD_FUND),
		enumName: 'HeldFund',
		isArray: true,
		description: 'Funds that must be withdrawn first',
	})
	heldFunds: HeldFund[];
}

export class AccountDeletionBlockersDto extends OrganizationDeletionBlockersDto {
	@ApiProperty({
		type: [String],
		description:
			'Shared organizations the account solely owns; transfer or delete them first',
	})
	sharedOrganizations: string[];
}

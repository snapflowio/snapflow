/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'BillingStatementSummary' })
export class BillingStatementSummaryDto {
	@ApiProperty({
		description: 'Statement month as YYYY-MM',
		example: '2026-10',
	})
	month: string;

	@ApiProperty({ type: String, format: 'date-time' })
	periodStart: Date;

	@ApiProperty({ type: String, format: 'date-time' })
	periodEnd: Date;

	@ApiProperty({ description: 'Whether the month is still in progress' })
	open: boolean;
}

@ApiSchema({ name: 'BillingStatementSandboxUsage' })
export class BillingStatementSandboxUsageDto {
	@ApiProperty() sandboxId: string;
	@ApiPropertyOptional({ description: 'Omitted once the sandbox is deleted' })
	sandboxName?: string;
	@ApiProperty() amountMicroUsd: string;
}

@ApiSchema({ name: 'BillingStatementCustomer' })
export class BillingStatementCustomerDto {
	@ApiProperty() openingCreditMicroUsd: string;
	@ApiProperty() closingCreditMicroUsd: string;
	@ApiProperty() adminGrantsMicroUsd: string;
	@ApiProperty() usageMicroUsd: string;
	@ApiProperty({ type: BillingStatementSandboxUsageDto, isArray: true })
	usageBySandbox: BillingStatementSandboxUsageDto[];
	@ApiProperty({
		description: 'Monthly fees of the machines kept in the private pool',
	})
	privatePoolMicroUsd: string;
	@ApiProperty({
		description: 'Credit returned by forfeited host earnings',
	})
	forfeitureCreditsMicroUsd: string;
}

@ApiSchema({ name: 'BillingStatementHost' })
export class BillingStatementHostDto {
	@ApiProperty({ description: 'Host earnings recorded in the month' })
	earningsMicroUsd: string;
	@ApiProperty({ description: 'Earnings forfeited after fraud reviews' })
	forfeitedMicroUsd: string;
}

@ApiSchema({ name: 'BillingStatement' })
export class BillingStatementDto extends BillingStatementSummaryDto {
	@ApiProperty({ type: BillingStatementCustomerDto })
	customer: BillingStatementCustomerDto;

	@ApiProperty({ type: BillingStatementHostDto })
	host: BillingStatementHostDto;
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { BillingRestriction } from '../../../billing/ledger/enums/billing-restriction.enum';
import { MachineUnavailableReason } from '../../../marketplace/machine/enums/machine-unavailable-reason.enum';
import { SandboxPlacementErrorCode } from '../enums/sandbox-placement-error-code.enum';
import {
	SandboxPlacementAlternativeDto,
	SandboxQuoteDto,
} from './sandbox-quote.dto';

const PLACEMENT_ERROR_CODE_PROPERTY = {
	enum: SandboxPlacementErrorCode,
	enumName: 'SandboxPlacementErrorCode',
} as const;

@ApiSchema({ name: 'MachineUnavailableError' })
export class MachineUnavailableErrorDto {
	@ApiProperty({
		...PLACEMENT_ERROR_CODE_PROPERTY,
		example: SandboxPlacementErrorCode.MACHINE_UNAVAILABLE,
	})
	code: SandboxPlacementErrorCode.MACHINE_UNAVAILABLE;

	@ApiProperty() message: string;

	@ApiProperty({ format: 'uuid' }) machineId: string;

	@ApiProperty({
		enum: MachineUnavailableReason,
		enumName: 'MachineUnavailableReason',
	})
	reason: MachineUnavailableReason;

	@ApiProperty({ type: [SandboxPlacementAlternativeDto] })
	alternatives: SandboxPlacementAlternativeDto[];
}

@ApiSchema({ name: 'PriceChangedError' })
export class PriceChangedErrorDto {
	@ApiProperty({
		...PLACEMENT_ERROR_CODE_PROPERTY,
		example: SandboxPlacementErrorCode.PRICE_CHANGED,
	})
	code: SandboxPlacementErrorCode.PRICE_CHANGED;

	@ApiProperty() message: string;

	@ApiProperty({ type: SandboxQuoteDto }) quote: SandboxQuoteDto;
}

@ApiSchema({ name: 'LeaseRenewalRequiredError' })
export class LeaseRenewalRequiredErrorDto {
	@ApiProperty({
		...PLACEMENT_ERROR_CODE_PROPERTY,
		example: SandboxPlacementErrorCode.LEASE_RENEWAL_REQUIRED,
	})
	code: SandboxPlacementErrorCode.LEASE_RENEWAL_REQUIRED;

	@ApiProperty() message: string;

	@ApiProperty({ format: 'uuid' }) leaseId: string;

	@ApiProperty({ format: 'date-time' }) renewalDeadline: Date;
}

@ApiSchema({ name: 'BillingRestrictedError' })
export class BillingRestrictedErrorDto {
	@ApiProperty({
		enum: BillingRestriction,
		enumName: 'BillingRestriction',
		example: BillingRestriction.INSUFFICIENT_CREDIT,
	})
	code: BillingRestriction;

	@ApiProperty() message: string;

	@ApiProperty({
		description: 'Credit the sandbox must reserve before it runs',
	})
	requiredMicroUsd: string;

	@ApiProperty({
		description: 'Credit available after charges and reservations',
	})
	availableMicroUsd: string;
}

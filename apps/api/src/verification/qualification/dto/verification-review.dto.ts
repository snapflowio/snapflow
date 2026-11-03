/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
	IsEnum,
	IsIn,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';
import {
	CursorPageDto,
	CursorPageQueryDto,
} from '../../../common/dto/cursor-page.dto';
import type { VerificationReview } from '../entities/verification-review.entity';
import { VerificationReviewKind } from '../enums/verification-review-kind.enum';
import { VerificationReviewState } from '../enums/verification-review-state.enum';

const RESOLUTION_REASON_MAXIMUM_LENGTH = 1_000;

export const VERIFICATION_REVIEW_OUTCOMES = [
	VerificationReviewState.CLEARED,
	VerificationReviewState.FORFEITED,
	VerificationReviewState.DELISTED,
] as const;

export type VerificationReviewOutcome =
	(typeof VERIFICATION_REVIEW_OUTCOMES)[number];

@ApiSchema({ name: 'VerificationReview' })
export class VerificationReviewDto {
	@ApiProperty({ format: 'uuid' }) id: string;
	@ApiProperty({ format: 'uuid' }) machineId: string;
	@ApiProperty({
		enum: VerificationReviewKind,
		enumName: 'VerificationReviewKind',
	})
	kind: VerificationReviewKind;
	@ApiProperty({ format: 'uuid' }) referenceId: string;
	@ApiProperty({
		enum: VerificationReviewState,
		enumName: 'VerificationReviewState',
	})
	state: VerificationReviewState;
	@ApiProperty({ type: String, format: 'date-time' }) openedAt: Date;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	resolvedAt: Date | null;
	@ApiProperty({ type: String, format: 'uuid', nullable: true })
	resolvedBy: string | null;
	@ApiProperty({ type: String, nullable: true })
	resolutionReason: string | null;

	static from(review: VerificationReview): VerificationReviewDto {
		return {
			id: review.id,
			machineId: review.machineId,
			kind: review.kind,
			referenceId: review.referenceId,
			state: review.state,
			openedAt: review.openedAt,
			resolvedAt: review.resolvedAt,
			resolvedBy: review.resolvedBy,
			resolutionReason: review.resolutionReason,
		};
	}
}

@ApiSchema({ name: 'VerificationReviewPage' })
export class VerificationReviewPageDto extends CursorPageDto<VerificationReviewDto> {
	@ApiProperty({ type: VerificationReviewDto, isArray: true })
	declare items: VerificationReviewDto[];
}

@ApiSchema({ name: 'ListVerificationReviewsQuery' })
export class ListVerificationReviewsQueryDto extends CursorPageQueryDto {
	@ApiPropertyOptional({
		enum: VerificationReviewState,
		enumName: 'VerificationReviewState',
	})
	@IsOptional()
	@IsEnum(VerificationReviewState)
	state?: VerificationReviewState;
}

@ApiSchema({ name: 'ResolveVerificationReview' })
export class ResolveVerificationReviewDto {
	@ApiProperty({
		enum: VERIFICATION_REVIEW_OUTCOMES,
		enumName: 'VerificationReviewOutcome',
	})
	@IsIn(VERIFICATION_REVIEW_OUTCOMES)
	outcome: VerificationReviewOutcome;

	@ApiProperty({ maxLength: RESOLUTION_REASON_MAXIMUM_LENGTH })
	@IsString()
	@IsNotEmpty()
	@MaxLength(RESOLUTION_REASON_MAXIMUM_LENGTH)
	reason: string;
}

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
	EXPOSURE_BACKEND_STATE,
	type ExposureBackendState,
} from '../constants/exposure.constants';
import type { ExposureCutoverPair } from '../types/exposure-cutover.types';

export class ExposureCutoverDto {
	@ApiProperty({ format: 'uuid' })
	backendId: string;

	@ApiProperty({ format: 'uuid' })
	exposureId: string;

	@ApiProperty({ format: 'uuid' })
	edgeId: string;

	@ApiProperty({ format: 'uuid' })
	predecessorBackendId: string;

	@ApiProperty({ format: 'uuid' })
	predecessorEdgeId: string;

	@ApiProperty({
		enum: EXPOSURE_BACKEND_STATE,
		enumName: 'ExposureBackendState',
	})
	state: ExposureBackendState;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	startedAt: string | null;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	dnsActivatedAt: string | null;

	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	verifiedAt: string | null;

	static from({
		candidate,
		predecessor,
	}: ExposureCutoverPair): ExposureCutoverDto {
		return {
			backendId: candidate.id,
			exposureId: candidate.exposureId,
			edgeId: candidate.edgeId,
			predecessorBackendId: predecessor.id,
			predecessorEdgeId: predecessor.edgeId,
			state: candidate.state,
			startedAt: candidate.cutoverStartedAt?.toISOString() ?? null,
			dnsActivatedAt: candidate.dnsActivatedAt?.toISOString() ?? null,
			verifiedAt: candidate.cutoverVerifiedAt?.toISOString() ?? null,
		};
	}
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import {
	addMilliseconds,
	addMinutes,
	millisecondsBetween,
} from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import {
	SPOT_CHECK,
	SPOT_CHECK_ABORT,
	SPOT_CHECK_CANARY,
	type SpotCheckAbort,
	type SpotCheckFailure,
} from '../constants/spot-check.constants';
import type { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import { CANARY_METER_WINDOW_SQL } from '../queries/spot-check-canary.query';
import { verifySpeedtestReceipt } from '../utils/speedtest-receipt.util';
import {
	type CanaryReceipts,
	type CanaryVariable,
	canaryByteCount,
	canaryCommand,
	judgeCanary,
	parseCanaryReceipts,
} from '../utils/spot-check-canary.util';
import { hiddenVariableName } from '../utils/spot-check-command.util';
import { SpeedtestReceiptService } from './speedtest-receipt.service';
import { SpeedtestTokenService } from './speedtest-token.service';
import {
	type SpotCheckCredential,
	SpotCheckToolboxService,
} from './spot-check-toolbox.service';

export type CanaryVerdict =
	| { state: 'pending' }
	| { state: 'aborted'; reason: SpotCheckAbort }
	| { state: 'judged'; failures: SpotCheckFailure[] };

interface MeterWindowRow {
	settled: boolean;
	egressBytes: string;
	ingressBytes: string;
}

@Injectable()
export class SpotCheckCanaryService {
	private readonly logger = new Logger(SpotCheckCanaryService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly toolbox: SpotCheckToolboxService,
		private readonly tokens: SpeedtestTokenService,
		private readonly receipts: SpeedtestReceiptService
	) {}

	async transfer(
		check: MachineSpotCheck,
		sandbox: Sandbox,
		credential: SpotCheckCredential
	): Promise<SpotCheckAbort | null> {
		const endpoint = await this.receipts.endpoint(
			this.entityManager,
			check.machineId
		);
		if (!endpoint) return SPOT_CHECK_ABORT.CANARY_FAILED;
		const startedAt = await databaseNow(this.entityManager);
		const expiresAt = addMinutes(
			startedAt,
			SPOT_CHECK_CANARY.TOKEN_TTL_MINUTES
		);
		const uploadBytes = canaryByteCount();
		const downloadBytes = canaryByteCount();
		const downloadToken = this.tokens.mintExact(
			{ id: randomUUID(), expiresAt },
			downloadBytes
		);
		const uploadToken = this.tokens.mintExact(
			{ id: randomUUID(), expiresAt },
			uploadBytes
		);
		let output: string;
		try {
			const response = await this.toolbox.execute(
				sandbox.id,
				credential,
				canaryCommand(hiddenVariables(), {
					endpoint,
					downloadToken,
					uploadToken,
					uploadBytes,
				})
			);
			if (response.exitCode !== SPOT_CHECK.SUCCESS_EXIT_CODE) {
				return SPOT_CHECK_ABORT.CANARY_FAILED;
			}
			output = response.result;
		} catch (error) {
			this.logger.warn(`Spot check ${check.id} canary transfer failed`, error);
			return SPOT_CHECK_ABORT.CANARY_FAILED;
		}
		const finishedAt = await databaseNow(this.entityManager);
		const receipts = parseCanaryReceipts(output);
		if (
			!receipts ||
			!(await this.signed(receipts, {
				downloadToken,
				uploadToken,
				downloadBytes,
				uploadBytes,
				startedAt,
				finishedAt,
			}))
		) {
			return SPOT_CHECK_ABORT.CANARY_FAILED;
		}
		check.canaryStartedAt = startedAt;
		check.canaryFinishedAt = finishedAt;
		check.canaryUploadBytes = uploadBytes.toString();
		check.canaryDownloadBytes = downloadBytes.toString();
		await this.entityManager.flush();
		return null;
	}

	async judge(check: MachineSpotCheck, now: Date): Promise<CanaryVerdict> {
		if (
			!check.sandboxId ||
			!check.canaryStartedAt ||
			!check.canaryFinishedAt ||
			check.canaryUploadBytes === null ||
			check.canaryDownloadBytes === null
		) {
			throw new Error(`Spot check ${check.id} has no canary transfer`);
		}
		const [window] = await this.entityManager.execute<MeterWindowRow[]>(
			CANARY_METER_WINDOW_SQL,
			[
				check.sandboxId,
				check.canaryStartedAt,
				addMilliseconds(
					check.canaryFinishedAt,
					SPOT_CHECK_CANARY.REPORT_SETTLE_MILLISECONDS
				),
			]
		);
		if (!window?.settled) {
			const waited = millisecondsBetween(check.canaryFinishedAt, now);
			return waited >
				SPOT_CHECK_CANARY.MEASUREMENT_TIMEOUT_MINUTES * MILLISECONDS_PER_MINUTE
				? { state: 'aborted', reason: SPOT_CHECK_ABORT.CANARY_UNMEASURED }
				: { state: 'pending' };
		}
		check.canaryMeasuredEgressBytes = window.egressBytes;
		check.canaryMeasuredIngressBytes = window.ingressBytes;
		await this.entityManager.flush();
		return {
			state: 'judged',
			failures: judgeCanary(
				{
					uploadBytes: BigInt(check.canaryUploadBytes),
					downloadBytes: BigInt(check.canaryDownloadBytes),
				},
				{
					egressBytes: BigInt(window.egressBytes),
					ingressBytes: BigInt(window.ingressBytes),
				}
			),
		};
	}

	private async signed(
		receipts: CanaryReceipts,
		expected: {
			downloadToken: string;
			uploadToken: string;
			downloadBytes: bigint;
			uploadBytes: bigint;
			startedAt: Date;
			finishedAt: Date;
		}
	): Promise<boolean> {
		const keys = await this.receipts.edgeKeys(this.entityManager);
		const window = (token: string, bytes: bigint) => ({
			tokens: [token],
			notBefore: expected.startedAt,
			notAfter: expected.finishedAt,
			minimumBytes: Number(bytes),
		});
		const download = verifySpeedtestReceipt(
			receipts.download,
			window(expected.downloadToken, expected.downloadBytes),
			keys
		);
		const upload = verifySpeedtestReceipt(
			receipts.upload,
			window(expected.uploadToken, expected.uploadBytes),
			keys
		);
		return (
			download?.bytes === expected.downloadBytes &&
			upload?.bytes === expected.uploadBytes
		);
	}
}

function hiddenVariables(): Record<CanaryVariable, string> {
	return {
		endpoint: hiddenVariableName(),
		downloadToken: hiddenVariableName(),
		uploadToken: hiddenVariableName(),
		uploadBytes: hiddenVariableName(),
	};
}

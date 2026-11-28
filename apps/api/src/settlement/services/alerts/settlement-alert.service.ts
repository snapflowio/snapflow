/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import { truncateErrorMessage } from '../../../common/utils/error/truncate-error-message.util';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import {
	SETTLEMENT_ALERT,
	type SettlementAlertKind,
} from '../../constants/settlement-alert.constants';

@Injectable()
export class SettlementAlertService {
	private readonly logger = new Logger(SettlementAlertService.name);

	constructor(
		private readonly config: TypedConfigService,
		private readonly locks: RedisLockProvider
	) {}

	async raise(kind: SettlementAlertKind, message: string): Promise<void> {
		this.logger.error(message);
		const alertmanagerUrl = this.config.get('settlement.alertmanagerUrl');
		if (!alertmanagerUrl) return;
		const key = `${SETTLEMENT_ALERT.CLAIM_KEY_PREFIX}${kind}`;
		if (!(await this.locks.claim(key, SETTLEMENT_ALERT.REPEAT_SECONDS))) {
			return;
		}
		if (!(await this.posted(alertmanagerUrl, kind, message))) {
			await this.locks.releaseClaim(key);
		}
	}

	async deliver(
		kind: SettlementAlertKind,
		message: string,
		alertId: string
	): Promise<boolean> {
		this.logger.error(message);
		const alertmanagerUrl = this.config.get('settlement.alertmanagerUrl');
		if (!alertmanagerUrl) return true;
		return this.posted(alertmanagerUrl, kind, message, {
			[SETTLEMENT_ALERT.ALERT_ID_LABEL]: alertId,
		});
	}

	private async posted(
		alertmanagerUrl: string,
		kind: SettlementAlertKind,
		message: string,
		labels: Readonly<Record<string, string>> = {}
	): Promise<boolean> {
		try {
			await this.post(alertmanagerUrl, kind, message, labels);
			return true;
		} catch (error) {
			this.logger.warn(
				`Could not deliver the ${kind} settlement alert: ${errorMessage(error)}`
			);
			return false;
		}
	}

	private async post(
		alertmanagerUrl: string,
		kind: SettlementAlertKind,
		message: string,
		labels: Readonly<Record<string, string>>
	): Promise<void> {
		const startsAt = new Date();
		const endsAt = new Date(
			startsAt.getTime() +
				SETTLEMENT_ALERT.REPEAT_SECONDS * MILLISECONDS_PER_SECOND
		);
		const response = await fetch(
			new URL(SETTLEMENT_ALERT.ALERTMANAGER_ALERTS_PATH, alertmanagerUrl),
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify([
					{
						labels: {
							...labels,
							alertname: SETTLEMENT_ALERT.ALERT_NAME,
							kind,
							severity: SETTLEMENT_ALERT.SEVERITY,
						},
						annotations: {
							summary: truncateErrorMessage(
								message,
								SETTLEMENT_ALERT.SUMMARY_MAXIMUM_LENGTH
							),
						},
						startsAt: startsAt.toISOString(),
						endsAt: endsAt.toISOString(),
					},
				]),
				signal: AbortSignal.timeout(
					SETTLEMENT_ALERT.REQUEST_TIMEOUT_MILLISECONDS
				),
			}
		);
		await response.body?.cancel();
		if (!response.ok) {
			throw new Error(`Alertmanager answered HTTP ${response.status}`);
		}
	}
}

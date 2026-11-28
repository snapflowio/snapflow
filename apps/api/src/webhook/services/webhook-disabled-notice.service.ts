/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { settleSequentially } from '../../common/utils/concurrency/sequential-async.util';
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { EMAIL_CATEGORY } from '../../infra/email/constants/email.constants';
import { EmailService } from '../../infra/email/services/email.service';
import { noticeRecipients } from '../../notification/queries/notice-recipients.query';
import { noticeUrl } from '../../notification/utils/notice-format.util';
import { noticeKey } from '../../notification/utils/notice-outbox.util';
import { Organization } from '../../organization/entities/organization.entity';
import { WEBHOOK_DISABLED_NOTICE } from '../constants/webhook.constants';
import { WebhookEndpointDisabledReason } from '../enums/webhook-endpoint-disabled-reason.enum';

const CLAIM_SQL = `
	WITH candidates AS (
		SELECT id
		FROM webhook_endpoint
		WHERE "disabledReason" = ?
		  AND "disabledNoticeSentAt" IS NULL
		ORDER BY "disabledAt" ASC
		FOR UPDATE SKIP LOCKED
		LIMIT ?
	)
	UPDATE webhook_endpoint AS endpoint
	SET "disabledNoticeSentAt" = transaction_timestamp()
	FROM candidates
	WHERE endpoint.id = candidates.id
	RETURNING endpoint.id, endpoint."organizationId", endpoint.url, endpoint."disabledAt"`;

const RELEASE_SQL = `
	UPDATE webhook_endpoint
	SET "disabledNoticeSentAt" = NULL
	WHERE id = ? AND "disabledReason" = ?`;

interface DisabledEndpoint {
	id: string;
	organizationId: string;
	url: string;
	disabledAt: Date;
}

@Injectable()
export class WebhookDisabledNoticeService {
	private readonly logger = new Logger(WebhookDisabledNoticeService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly email: EmailService,
		private readonly config: TypedConfigService
	) {}

	async send(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const endpoints = await this.entityManager.execute<DisabledEndpoint[]>(
				CLAIM_SQL,
				[
					WebhookEndpointDisabledReason.FAILING,
					WEBHOOK_DISABLED_NOTICE.batchSize,
				]
			);
			for (const endpoint of endpoints) {
				try {
					await this.notify(endpoint);
				} catch (error) {
					this.logger.error(
						`Could not email the disabled notice of webhook endpoint ${endpoint.id}: ${errorMessage(error)}`,
						errorStack(error)
					);
					await this.entityManager.execute(RELEASE_SQL, [
						endpoint.id,
						WebhookEndpointDisabledReason.FAILING,
					]);
				}
			}
		});
	}

	private async notify(endpoint: DisabledEndpoint): Promise<void> {
		const organization = await this.entityManager.findOne(
			Organization,
			{ id: endpoint.organizationId },
			{ fields: ['name'] }
		);
		if (!organization) return;
		const disableAfterDays = this.config.get('webhooks.disableAfterDays');
		const dashboardUrl = this.config.get('dashboardUrl');
		const action = {
			label: 'Review webhooks',
			path: WEBHOOK_DISABLED_NOTICE.dashboardPath,
		};
		const recipients = await noticeRecipients(
			this.entityManager,
			endpoint.organizationId,
			{ roles: WEBHOOK_DISABLED_NOTICE.recipientRoles }
		);
		const noticeId = noticeKey(
			WEBHOOK_DISABLED_NOTICE.noticeKeyPrefix,
			endpoint.id,
			new Date(endpoint.disabledAt).getTime()
		);
		const failures = await settleSequentially(recipients, (recipient) =>
			this.email.sendNotice({
				category: EMAIL_CATEGORY.WEBHOOK_NOTICE,
				noticeId,
				recipient,
				subject: `A webhook endpoint of ${organization.name} was disabled`,
				heading: 'Webhook endpoint disabled',
				paragraphs: [
					`Every delivery to ${endpoint.url} failed for ${disableAfterDays} days, so Snapflow stopped sending events to it.`,
					'Fix the endpoint, then enable it again and resend the deliveries you need from the delivery log.',
				],
				note: `You received this because you own or administer ${organization.name}.`,
				action: dashboardUrl
					? {
							label: action.label,
							url: noticeUrl(dashboardUrl, endpoint.organizationId, action),
						}
					: null,
			})
		);
		const rejected = failures.find(
			(result): result is PromiseRejectedResult => result.status === 'rejected'
		);
		if (rejected) throw rejected.reason;
	}
}

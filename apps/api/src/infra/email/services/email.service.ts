/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ReactElement } from 'react';
import { render, toPlainText } from 'react-email';
import type { CreateEmailResponse } from 'resend';
import { fullJitterBackoffMilliseconds } from '../../../common/utils/concurrency/full-jitter-backoff.util';
import {
	EMAIL_CATEGORY,
	EMAIL_DELIVERY,
	EMAIL_DELIVERY_POLICY,
	EMAIL_PRODUCT_NAME,
	EMAIL_TAG_NAME,
	EMAIL_THREAD_HEADER,
	type EmailCategory,
	FIRST_SERVER_ERROR_STATUS,
	ONE_TIME_CODE_COPY,
	ONE_TIME_CODE_PURPOSE,
	type OneTimeCodePurpose,
	RETRYABLE_RESEND_ERRORS,
} from '../constants/email.constants';
import { EmailDeliveryError } from '../exceptions/email-delivery.exception';
import type { OneTimeCodeEmailProps } from '../templates/_components/one-time-code-email';
import { EmailVerificationCodeEmail } from '../templates/email-verification-code-email';
import { OrganizationInvitationEmail } from '../templates/organization-invitation-email';
import { SignInCodeEmail } from '../templates/sign-in-code-email';
import type { EmailBrand, EmailDelivery } from '../types/email.types';

type ResendError = NonNullable<CreateEmailResponse['error']>;

interface OutgoingEmail {
	category: EmailCategory;
	to: string;
	subject: string;
	idempotencyKey: string;
	template: (brand: EmailBrand) => ReactElement;
	tags?: readonly { name: string; value: string }[];
	headers?: Record<string, string>;
}

const ONE_TIME_CODE_TEMPLATE: Record<
	OneTimeCodePurpose,
	(props: OneTimeCodeEmailProps) => ReactElement
> = {
	[ONE_TIME_CODE_PURPOSE.SIGN_IN]: SignInCodeEmail,
	[ONE_TIME_CODE_PURPOSE.EMAIL_VERIFICATION]: EmailVerificationCodeEmail,
};

const INVITATION_EXPIRY_FORMAT = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	timeZone: 'UTC',
	timeZoneName: 'short',
});

function digest(...parts: readonly string[]): string {
	return createHash('sha256').update(parts.join('\0')).digest('hex');
}

function isRetryable(error: ResendError): boolean {
	return (
		RETRYABLE_RESEND_ERRORS.has(error.name) ||
		error.statusCode === null ||
		error.statusCode >= FIRST_SERVER_ERROR_STATUS
	);
}

@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);

	constructor(
		@Inject(EMAIL_DELIVERY)
		private readonly delivery: EmailDelivery | null
	) {
		if (!delivery) {
			this.logger.warn('RESEND_API_KEY is not set; email delivery is off');
		}
	}

	async sendOneTimeCode(input: {
		recipient: string;
		code: string;
		purpose: OneTimeCodePurpose;
		expiresInMinutes: number;
	}): Promise<void> {
		const reference = digest(input.purpose, input.recipient, input.code);
		const Template = ONE_TIME_CODE_TEMPLATE[input.purpose];
		await this.send({
			category: EMAIL_CATEGORY.ONE_TIME_CODE,
			to: input.recipient,
			subject: ONE_TIME_CODE_COPY[input.purpose].subject,
			idempotencyKey: `${EMAIL_CATEGORY.ONE_TIME_CODE}/${reference}`,
			template: (brand) =>
				Template({
					brand,
					code: input.code,
					expiresInMinutes: input.expiresInMinutes,
				}),
			tags: [{ name: EMAIL_TAG_NAME.PURPOSE, value: input.purpose }],
			headers: { [EMAIL_THREAD_HEADER]: reference },
		});
	}

	async sendOrganizationInvitation(input: {
		invitationId: string;
		recipient: string;
		organizationName: string;
		invitedBy: string;
		invitationUrl: string;
		expiresAt: Date;
	}): Promise<void> {
		await this.send({
			category: EMAIL_CATEGORY.ORGANIZATION_INVITATION,
			to: input.recipient,
			subject: `${input.invitedBy} invited you to ${input.organizationName} on ${EMAIL_PRODUCT_NAME}`,
			idempotencyKey: `${EMAIL_CATEGORY.ORGANIZATION_INVITATION}/${input.invitationId}/${input.expiresAt.getTime()}`,
			template: (brand) =>
				OrganizationInvitationEmail({
					brand,
					organizationName: input.organizationName,
					invitedBy: input.invitedBy,
					invitationUrl: input.invitationUrl,
					expiresAt: INVITATION_EXPIRY_FORMAT.format(input.expiresAt),
				}),
		});
	}

	private async send(email: OutgoingEmail): Promise<void> {
		if (!this.delivery) {
			throw new EmailDeliveryError(email.category, 'RESEND_API_KEY is not set');
		}
		const { emails, from, replyTo, brand } = this.delivery;
		const html = await render(email.template(brand));
		const payload = {
			from,
			replyTo,
			to: email.to,
			subject: email.subject,
			html,
			text: toPlainText(html),
			headers: email.headers,
			tags: [
				{ name: EMAIL_TAG_NAME.CATEGORY, value: email.category },
				...(email.tags ?? []),
			],
		};

		for (let attempt = 1; ; attempt += 1) {
			const response = await emails.send(payload, {
				idempotencyKey: email.idempotencyKey,
			});
			if (response.error === null) {
				this.logger.log(
					`Resend accepted ${email.category} email ${response.data.id}`
				);
				return;
			}
			const { error } = response;
			const retry =
				isRetryable(error) && attempt < EMAIL_DELIVERY_POLICY.maxAttempts;
			this.logger.warn(
				`Resend rejected ${email.category} email (attempt ${attempt}/${EMAIL_DELIVERY_POLICY.maxAttempts}, ${retry ? 'retrying' : 'giving up'}): ${error.name} ${error.statusCode ?? 'no status'}: ${error.message}`
			);
			if (!retry) {
				throw new EmailDeliveryError(email.category, error.name);
			}
			await delay(
				fullJitterBackoffMilliseconds(
					attempt - 1,
					EMAIL_DELIVERY_POLICY.backoff
				)
			);
		}
	}
}

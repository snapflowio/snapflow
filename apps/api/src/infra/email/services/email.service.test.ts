/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
	CreateEmailOptions,
	CreateEmailRequestOptions,
	CreateEmailResponse,
} from 'resend';
import {
	EMAIL_DELIVERY_POLICY,
	ONE_TIME_CODE_PURPOSE,
} from '../constants/email.constants';
import { EmailDeliveryError } from '../exceptions/email-delivery.exception';
import type { EmailDelivery } from '../types/email.types';
import { EmailService } from './email.service';

const WEBSITE_URL = 'https://snapflow.test';
const CODE = '482913';
const RECIPIENT = 'ada@example.com';

type SentEmail = {
	payload: CreateEmailOptions;
	options: CreateEmailRequestOptions | undefined;
};

function accepted(): CreateEmailResponse {
	return { data: { id: 'email-id' }, error: null, headers: null };
}

function rejected(name: string, statusCode: number): CreateEmailResponse {
	return {
		data: null,
		error: { name, statusCode, message: name },
		headers: null,
	} as CreateEmailResponse;
}

function serviceWith(responses: readonly CreateEmailResponse[] = []) {
	const sent: SentEmail[] = [];
	const delivery: EmailDelivery = {
		emails: {
			send: async (payload, options) => {
				sent.push({ payload, options });
				return responses[sent.length - 1] ?? accepted();
			},
		},
		from: 'Snapflow <noreply@mail.snapflow.test>',
		replyTo: 'support@snapflow.test',
		brand: { websiteUrl: WEBSITE_URL },
	};
	return { service: new EmailService(delivery), sent };
}

function sendSignInCode(service: EmailService, code = CODE) {
	return service.sendOneTimeCode({
		recipient: RECIPIENT,
		code,
		purpose: ONE_TIME_CODE_PURPOSE.SIGN_IN,
		expiresInMinutes: 10,
	});
}

describe('EmailService', () => {
	it('sends a branded sign-in code with html, text, tags and an idempotency key', async () => {
		const { service, sent } = serviceWith();
		await sendSignInCode(service);

		assert.equal(sent.length, 1);
		const [{ payload, options }] = sent;
		assert.equal(payload.to, RECIPIENT);
		assert.equal(payload.subject, 'Your Snapflow sign-in code');
		assert.equal(payload.replyTo, 'support@snapflow.test');
		assert.ok(payload.html?.includes(CODE));
		assert.ok(payload.html?.includes(`${WEBSITE_URL}/email/snapflow-logo.png`));
		assert.ok(payload.text?.includes(CODE));
		assert.ok(!payload.text?.startsWith(WEBSITE_URL));
		assert.deepEqual(payload.tags, [
			{ name: 'category', value: 'one-time-code' },
			{ name: 'purpose', value: 'sign-in' },
		]);
		assert.match(
			options?.idempotencyKey ?? '',
			/^one-time-code\/[0-9a-f]{64}$/
		);
		assert.ok(!options?.idempotencyKey?.includes(CODE));
	});

	it('gives each new code its own idempotency key', async () => {
		const { service, sent } = serviceWith();
		await sendSignInCode(service, '111111');
		await sendSignInCode(service, '222222');
		assert.notEqual(
			sent[0].options?.idempotencyKey,
			sent[1].options?.idempotencyKey
		);
	});

	it('sends an organization invitation with an accept button and expiry', async () => {
		const { service, sent } = serviceWith();
		await service.sendOrganizationInvitation({
			invitationId: 'invitation-id',
			recipient: RECIPIENT,
			organizationName: 'Acme Robotics',
			invitedBy: 'Grace Hopper',
			invitationUrl:
				'https://snapflow.test/dashboard/invitations/invitation-id',
			expiresAt: new Date('2026-10-28T16:00:00Z'),
		});

		const [{ payload, options }] = sent;
		assert.equal(
			payload.subject,
			'Grace Hopper invited you to Acme Robotics on Snapflow'
		);
		assert.ok(payload.html?.includes('Accept invitation'));
		assert.ok(payload.html?.includes('#8b5cf6'));
		assert.ok(payload.text?.includes('October 28, 2026 at 4:00 PM UTC'));
		assert.equal(
			options?.idempotencyKey,
			`organization-invitation/invitation-id/${Date.parse('2026-10-28T16:00:00Z')}`
		);
	});

	it('retries transient Resend errors with the same idempotency key', async () => {
		const { service, sent } = serviceWith([
			rejected('application_error', 500),
			accepted(),
		]);
		await sendSignInCode(service);
		assert.equal(sent.length, 2);
		assert.equal(
			sent[0].options?.idempotencyKey,
			sent[1].options?.idempotencyKey
		);
	});

	it('gives up after the attempt limit', async () => {
		const { service, sent } = serviceWith(
			Array.from({ length: EMAIL_DELIVERY_POLICY.maxAttempts }, () =>
				rejected('rate_limit_exceeded', 429)
			)
		);
		await assert.rejects(sendSignInCode(service), EmailDeliveryError);
		assert.equal(sent.length, EMAIL_DELIVERY_POLICY.maxAttempts);
	});

	it('does not retry permanent Resend errors', async () => {
		const { service, sent } = serviceWith([rejected('validation_error', 403)]);
		await assert.rejects(sendSignInCode(service), EmailDeliveryError);
		assert.equal(sent.length, 1);
	});

	it('fails every send when delivery is not configured', async () => {
		await assert.rejects(
			sendSignInCode(new EmailService(null)),
			EmailDeliveryError
		);
	});
});

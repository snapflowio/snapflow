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
import { HttpStatus } from '@nestjs/common';
import Stripe from 'stripe';
import {
	isStripeObjectMissing,
	stripeErrorDetails,
	stripeErrorResponse,
} from './stripe-error.util';

const DECLINED_MESSAGE = 'Your card was declined.';
const REQUEST_ID = 'req_fixture';
const CUSTOMER_ACCOUNT_PARAM = 'customer_account';

function missingCustomer(code = 'resource_missing') {
	return new Stripe.errors.StripeInvalidRequestError({
		message: "No such customer: 'acct_missing'",
		code,
		param: CUSTOMER_ACCOUNT_PARAM,
		statusCode: HttpStatus.BAD_REQUEST,
		requestId: REQUEST_ID,
	});
}

describe('stripeErrorDetails', () => {
	it('appends the identifying fields of a Stripe error', () => {
		const details = stripeErrorDetails(missingCustomer());
		assert.match(details, /^No such customer: 'acct_missing' \(/);
		assert.match(details, /code=resource_missing/);
		assert.match(details, /param=customer_account/);
		assert.match(details, /statusCode=400/);
		assert.match(details, new RegExp(`requestId=${REQUEST_ID}`));
	});

	it('keeps the plain message of other errors', () => {
		assert.equal(stripeErrorDetails(new Error('boom')), 'boom');
	});
});

describe('isStripeObjectMissing', () => {
	it('matches a missing or invalid stored id on the named field', () => {
		assert.equal(
			isStripeObjectMissing(missingCustomer(), CUSTOMER_ACCOUNT_PARAM),
			true
		);
		assert.equal(
			isStripeObjectMissing(
				missingCustomer('invalid_fields'),
				CUSTOMER_ACCOUNT_PARAM
			),
			true
		);
		assert.equal(isStripeObjectMissing(missingCustomer()), true);
	});

	it('ignores other fields, other codes and other errors', () => {
		assert.equal(
			isStripeObjectMissing(missingCustomer(), 'destination'),
			false
		);
		assert.equal(
			isStripeObjectMissing(
				missingCustomer('parameter_invalid_integer'),
				CUSTOMER_ACCOUNT_PARAM
			),
			false
		);
		assert.equal(isStripeObjectMissing(new Error('boom')), false);
	});
});

describe('stripeErrorResponse', () => {
	it('answers a declined card with 402 and the card message', () => {
		assert.deepEqual(
			stripeErrorResponse(
				new Stripe.errors.StripeCardError({
					message: DECLINED_MESSAGE,
					code: 'card_declined',
				})
			),
			{
				statusCode: HttpStatus.PAYMENT_REQUIRED,
				code: 'card_declined',
				requestId: null,
				message: DECLINED_MESSAGE,
			}
		);
	});

	it('names an out-of-date payment record and keeps the Stripe request id', () => {
		const missing = stripeErrorResponse(
			new Stripe.errors.StripeInvalidRequestError({
				message: 'No such checkout.session: cs_missing',
				code: 'resource_missing',
				statusCode: HttpStatus.NOT_FOUND,
				requestId: REQUEST_ID,
			})
		);
		assert.equal(missing?.statusCode, HttpStatus.BAD_REQUEST);
		assert.equal(missing?.requestId, REQUEST_ID);
		assert.match(missing?.message ?? '', /out of date/);
	});

	it('keeps the Stripe code of a rejected request and maps lock conflicts to 409', () => {
		const rejected = stripeErrorResponse(
			new Stripe.errors.StripeInvalidRequestError({
				message: 'No such payment_method',
				code: 'resource_missing',
				statusCode: HttpStatus.BAD_REQUEST,
			})
		);
		assert.equal(rejected?.statusCode, HttpStatus.BAD_REQUEST);
		assert.equal(rejected?.code, 'resource_missing');
		assert.equal(
			stripeErrorResponse(
				new Stripe.errors.StripeInvalidRequestError({
					code: 'lock_timeout',
					statusCode: HttpStatus.CONFLICT,
				})
			)?.statusCode,
			HttpStatus.CONFLICT
		);
		assert.equal(
			stripeErrorResponse(new Stripe.errors.StripeIdempotencyError({}))
				?.statusCode,
			HttpStatus.CONFLICT
		);
	});

	it('asks to retry when Stripe is rate limiting or unreachable', () => {
		assert.equal(
			stripeErrorResponse(new Stripe.errors.StripeRateLimitError({}))
				?.statusCode,
			HttpStatus.TOO_MANY_REQUESTS
		);
		assert.equal(
			stripeErrorResponse(new Stripe.errors.StripeConnectionError({}))
				?.statusCode,
			HttpStatus.SERVICE_UNAVAILABLE
		);
		assert.equal(
			stripeErrorResponse(new Stripe.errors.StripeAPIError({}))?.statusCode,
			HttpStatus.SERVICE_UNAVAILABLE
		);
	});

	it('leaves credential faults and other errors to the server error path', () => {
		assert.equal(
			stripeErrorResponse(new Stripe.errors.StripeAuthenticationError({})),
			null
		);
		assert.equal(stripeErrorResponse(new Error('boom')), null);
	});
});

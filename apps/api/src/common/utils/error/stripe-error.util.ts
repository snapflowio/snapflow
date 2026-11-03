/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HttpStatus } from '@nestjs/common';
import Stripe from 'stripe';
import { errorMessage } from './error.util';

export interface StripeErrorResponse {
	statusCode: HttpStatus;
	code: string | null;
	requestId: string | null;
	message: string;
}

const STRIPE_ERROR_MESSAGE = {
	REJECTED: 'The payment provider rejected the request.',
	OUT_OF_DATE:
		'A payment record is out of date. Retry, or contact support with the reference.',
	CONFLICT: 'The payment provider is still processing a conflicting request.',
	RATE_LIMITED: 'The payment provider is busy. Retry shortly.',
	UNAVAILABLE: 'The payment provider is unavailable. Retry shortly.',
} as const;

const StripeErrorCode = {
	RESOURCE_MISSING: 'resource_missing',
	INVALID_FIELDS: 'invalid_fields',
} as const;

const STRIPE_OBJECT_MISSING_CODES: readonly string[] = [
	StripeErrorCode.RESOURCE_MISSING,
	StripeErrorCode.INVALID_FIELDS,
];

const DETAIL_SEPARATOR = ', ';

function response(
	statusCode: HttpStatus,
	error: Stripe.errors.StripeError,
	message: string
): StripeErrorResponse {
	return {
		statusCode,
		code: error.code ?? null,
		requestId: error.requestId ?? null,
		message,
	};
}

function rejectedMessage(error: Stripe.errors.StripeError): string {
	return error.code === StripeErrorCode.RESOURCE_MISSING
		? STRIPE_ERROR_MESSAGE.OUT_OF_DATE
		: STRIPE_ERROR_MESSAGE.REJECTED;
}

// Maps the Stripe SDK errors a request can surface onto HTTP responses; other
// Stripe errors (authentication, permission) are server faults.
export function stripeErrorResponse(
	error: unknown
): StripeErrorResponse | null {
	if (error instanceof Stripe.errors.StripeCardError) {
		return response(HttpStatus.PAYMENT_REQUIRED, error, error.message);
	}
	if (error instanceof Stripe.errors.StripeIdempotencyError) {
		return response(HttpStatus.CONFLICT, error, STRIPE_ERROR_MESSAGE.CONFLICT);
	}
	if (error instanceof Stripe.errors.StripeInvalidRequestError) {
		return error.statusCode === HttpStatus.CONFLICT
			? response(HttpStatus.CONFLICT, error, STRIPE_ERROR_MESSAGE.CONFLICT)
			: response(HttpStatus.BAD_REQUEST, error, rejectedMessage(error));
	}
	if (
		error instanceof Stripe.errors.StripeRateLimitError ||
		error instanceof Stripe.errors.RateLimitError
	) {
		return response(
			HttpStatus.TOO_MANY_REQUESTS,
			error,
			STRIPE_ERROR_MESSAGE.RATE_LIMITED
		);
	}
	if (
		error instanceof Stripe.errors.StripeConnectionError ||
		error instanceof Stripe.errors.StripeAPIError
	) {
		return response(
			HttpStatus.SERVICE_UNAVAILABLE,
			error,
			STRIPE_ERROR_MESSAGE.UNAVAILABLE
		);
	}
	return null;
}

// The message of any error, with the identifying fields of a Stripe error
// appended so a failure can be traced in the Stripe dashboard.
export function stripeErrorDetails(error: unknown): string {
	if (!(error instanceof Stripe.errors.StripeError)) return errorMessage(error);
	const details = Object.entries({
		type: error.type,
		code: error.code,
		param: error.param,
		statusCode: error.statusCode,
		requestId: error.requestId,
		docUrl: error.doc_url,
	})
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${value}`);
	return `${error.message} (${details.join(DETAIL_SEPARATOR)})`;
}

// True when Stripe no longer has an object we stored the id of. `param` names
// the request field that carried the id; omit it when the id is in the path.
export function isStripeObjectMissing(
	error: unknown,
	param?: string
): error is Stripe.errors.StripeInvalidRequestError {
	return (
		error instanceof Stripe.errors.StripeInvalidRequestError &&
		error.code !== undefined &&
		STRIPE_OBJECT_MISSING_CODES.includes(error.code) &&
		(param === undefined || error.param === param)
	);
}

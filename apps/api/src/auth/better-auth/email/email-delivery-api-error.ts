/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { APIError } from 'better-auth/api';
import { EmailDeliveryError } from '../../../infra/email/exceptions/email-delivery.exception';

const EMAIL_DELIVERY_FAILED = {
	code: 'EMAIL_DELIVERY_FAILED',
	message: 'The email could not be sent. Try again in a moment.',
} as const;

export async function sendOrThrowApiError(
	send: () => Promise<void>
): Promise<void> {
	try {
		await send();
	} catch (error) {
		if (error instanceof EmailDeliveryError) {
			throw APIError.from('SERVICE_UNAVAILABLE', EMAIL_DELIVERY_FAILED);
		}
		throw error;
	}
}

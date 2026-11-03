/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { APIError } from 'better-auth/api';
import type { EmailOTPOptions } from 'better-auth/plugins';
import {
	ONE_TIME_CODE_PURPOSE,
	type OneTimeCodePurpose,
} from '../../../infra/email/constants/email.constants';
import type { EmailService } from '../../../infra/email/services/email.service';
import { EMAIL_OTP_EXPIRES_IN_SECONDS } from '../../constants/auth-security.constants';
import { sendOrThrowApiError } from './email-delivery-api-error';

const SECONDS_PER_MINUTE = 60;

type SendVerificationOtp = EmailOTPOptions['sendVerificationOTP'];
type OneTimeCodeRequest = Parameters<SendVerificationOtp>[0];

const ONE_TIME_CODE_PURPOSE_BY_OTP_TYPE: Partial<
	Record<OneTimeCodeRequest['type'], OneTimeCodePurpose>
> = {
	'sign-in': ONE_TIME_CODE_PURPOSE.SIGN_IN,
	'email-verification': ONE_TIME_CODE_PURPOSE.EMAIL_VERIFICATION,
};

export function createOneTimeCodeSender(
	emailService: Pick<EmailService, 'sendOneTimeCode'>
): (request: OneTimeCodeRequest) => Promise<void> {
	return async ({ email, otp, type }) => {
		const purpose = ONE_TIME_CODE_PURPOSE_BY_OTP_TYPE[type];
		if (!purpose) {
			throw APIError.from('BAD_REQUEST', {
				code: 'ONE_TIME_CODE_TYPE_UNSUPPORTED',
				message: 'This one-time code type is not supported',
			});
		}
		await sendOrThrowApiError(() =>
			emailService.sendOneTimeCode({
				recipient: email,
				code: otp,
				purpose,
				expiresInMinutes: EMAIL_OTP_EXPIRES_IN_SECONDS / SECONDS_PER_MINUTE,
			})
		);
	};
}

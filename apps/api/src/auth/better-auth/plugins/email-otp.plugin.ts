/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { emailOTP } from 'better-auth/plugins';
import type { EmailService } from '../../../infra/email/services/email.service';
import {
	EMAIL_OTP_ALLOWED_ATTEMPTS,
	EMAIL_OTP_EXPIRES_IN_SECONDS,
	EMAIL_OTP_LENGTH,
} from '../../constants/auth-security.constants';
import { createOneTimeCodeSender } from '../email/one-time-code-sender';

const STORE_HASHED = 'hashed';

export const createEmailOtpPlugin = (
	emailService: Pick<EmailService, 'sendOneTimeCode'>
) =>
	emailOTP({
		otpLength: EMAIL_OTP_LENGTH,
		expiresIn: EMAIL_OTP_EXPIRES_IN_SECONDS,
		allowedAttempts: EMAIL_OTP_ALLOWED_ATTEMPTS,
		storeOTP: STORE_HASHED,
		overrideDefaultEmailVerification: true,
		sendVerificationOTP: createOneTimeCodeSender(emailService),
	});

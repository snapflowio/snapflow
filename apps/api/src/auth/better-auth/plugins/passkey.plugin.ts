/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { passkey } from '@better-auth/passkey';
import { APIError } from 'better-auth/api';
import type { TypedConfigService } from '../../../config/services/typed-config.service';
import { AUTH_PRODUCT_NAME } from '../../constants/auth-product.constants';

export function createPasskeyPlugin(configService: TypedConfigService) {
	const passkeyRpId = configService.get('passkeyRpId');
	const trustedOrigins = configService.get('trustedBrowserOrigins');
	return passkey({
		rpName: AUTH_PRODUCT_NAME,
		...(passkeyRpId && {
			rpID: passkeyRpId,
			origin: trustedOrigins.length === 1 ? trustedOrigins[0] : trustedOrigins,
		}),
		authenticatorSelection: {
			residentKey: 'preferred',
			userVerification: 'required',
		},
		registration: {
			afterVerification: ({ verification }) =>
				assertPasskeyUserVerified(verification.registrationInfo?.userVerified),
		},
		authentication: {
			afterVerification: ({ verification }) =>
				assertPasskeyUserVerified(verification.authenticationInfo.userVerified),
		},
	});
}

function assertPasskeyUserVerified(userVerified: boolean | undefined): void {
	if (userVerified) return;
	throw APIError.from('UNAUTHORIZED', {
		code: 'PASSKEY_USER_VERIFICATION_REQUIRED',
		message: 'Passkey user verification is required',
	});
}

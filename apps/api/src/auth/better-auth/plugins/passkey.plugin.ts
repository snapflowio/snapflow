/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { passkey } from '@better-auth/passkey';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { TypedConfigService } from '../../../config/services/typed-config.service';
import {
	p256PublicKey,
	WALLET_PASSKEY_ALGORITHM,
} from '../../../settlement/utils/wallets/passkey-public-key.util';
import { AUTH_PATH } from '../../constants/auth-paths.constants';
import { AUTH_PRODUCT_NAME } from '../../constants/auth-product.constants';

const PUBLIC_KEY_CREDENTIAL_TYPE = 'public-key';

const WALLET_CREDENTIAL_PARAMETERS = [
	{ alg: WALLET_PASSKEY_ALGORITHM, type: PUBLIC_KEY_CREDENTIAL_TYPE },
] as const;

export function createPasskeyPlugin(configService: TypedConfigService) {
	const passkeyRpId = configService.get('passkeyRpId');
	const trustedOrigins = configService.get('trustedBrowserOrigins');
	const plugin = passkey({
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
			afterVerification: ({ verification }) => {
				assertPasskeyUserVerified(verification.registrationInfo?.userVerified);
				assertWalletCapable(
					verification.registrationInfo?.credential.publicKey
				);
			},
		},
		authentication: {
			afterVerification: ({ verification }) =>
				assertPasskeyUserVerified(verification.authenticationInfo.userVerified),
		},
	});
	return {
		...plugin,
		hooks: {
			after: [
				{
					matcher: (context: { path?: string }) =>
						context.path === AUTH_PATH.PASSKEY_REGISTRATION_OPTIONS,
					handler: createAuthMiddleware(async (context) => {
						const options: unknown = context.context.returned;
						if (typeof options !== 'object' || options === null) return;
						return context.json({
							...options,
							pubKeyCredParams: WALLET_CREDENTIAL_PARAMETERS,
						});
					}),
				},
			],
		},
	};
}

function assertPasskeyUserVerified(userVerified: boolean | undefined): void {
	if (userVerified) return;
	throw APIError.from('UNAUTHORIZED', {
		code: 'PASSKEY_USER_VERIFICATION_REQUIRED',
		message: 'Passkey user verification is required',
	});
}

function assertWalletCapable(publicKey: Uint8Array | undefined): void {
	if (publicKey && p256PublicKey(publicKey)) return;
	throw APIError.from('BAD_REQUEST', {
		code: 'PASSKEY_ALGORITHM_UNSUPPORTED',
		message: 'Passkeys must use a P-256 (ES256) key',
	});
}

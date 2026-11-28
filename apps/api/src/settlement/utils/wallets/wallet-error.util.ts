/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { UserWalletErrorCode } from '../../constants/user-wallet.constants';

export function walletNotFound(): NotFoundException {
	return new NotFoundException({
		code: UserWalletErrorCode.WALLET_NOT_FOUND,
		message: 'Create your wallet first',
	});
}

export function passkeyNotWalletCapable(): UnprocessableEntityException {
	return new UnprocessableEntityException({
		code: UserWalletErrorCode.PASSKEY_NOT_WALLET_CAPABLE,
		message:
			'A wallet needs a passkey with a P-256 (ES256) key; register a passkey first',
	});
}

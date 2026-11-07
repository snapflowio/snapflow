/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FactoryProvider } from '@nestjs/common';
import { type PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { SETTLEMENT_VOUCHER_SIGNER } from '../constants/settlement.constants';

// Snapflow's delegated signer. It holds no funds and can only sign vouchers
// within the session keys customers granted its address.
export const voucherSignerProvider: FactoryProvider<PrivateKeyAccount> = {
	provide: SETTLEMENT_VOUCHER_SIGNER,
	inject: [TypedConfigService],
	useFactory: (config: TypedConfigService): PrivateKeyAccount =>
		privateKeyToAccount(config.get('settlement.signerPrivateKey')),
};

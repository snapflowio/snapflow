/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { MachineModule } from '../machine/machine.module';
import { SettingsModule } from '../settings/settings.module';
import { MachineSettlementController } from './controllers/machine-settlement.controller';
import { PaymentChannel } from './entities/payment-channel.entity';
import { PaymentVoucher } from './entities/payment-voucher.entity';
import { MachineVoucherRelayService } from './services/machine-voucher-relay.service';

// The machine-facing voucher relay lives apart from SettlementModule because
// machine authentication comes from MachineModule, which itself depends on
// SettlementModule for payout readiness.
@Module({
	imports: [
		MikroOrmModule.forFeature([PaymentChannel, PaymentVoucher]),
		ControlWakeModule,
		MachineModule,
		SettingsModule,
	],
	controllers: [MachineSettlementController],
	providers: [MachineVoucherRelayService],
})
export class SettlementMachineModule {}

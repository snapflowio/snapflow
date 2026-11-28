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
import { LocationModule } from '../location/location.module';
import { MachineModule } from '../machine/machine.module';
import { SettingsModule } from '../settings/settings.module';
import { MachineSettlementController } from './controllers/machine-settlement.controller';
import { EscrowAccount } from './entities/escrow-account.entity';
import { EscrowSigner } from './entities/escrow-signer.entity';
import { HostSettlement } from './entities/host-settlement.entity';
import { PaymentChannel } from './entities/payment-channel.entity';
import { PaymentChannelCharge } from './entities/payment-channel-charge.entity';
import { PaymentVoucher } from './entities/payment-voucher.entity';
import { MachineSettlementService } from './services/machine-settlement.service';
import { SettlementModule } from './settlement.module';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			EscrowAccount,
			EscrowSigner,
			HostSettlement,
			PaymentChannel,
			PaymentChannelCharge,
			PaymentVoucher,
		]),
		ControlWakeModule,
		LocationModule,
		MachineModule,
		SettingsModule,
		SettlementModule,
	],
	controllers: [MachineSettlementController],
	providers: [MachineSettlementService],
})
export class SettlementMachineModule {}

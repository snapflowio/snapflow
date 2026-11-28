/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Global, Module } from '@nestjs/common';
import { Resend } from 'resend';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { TypedConfigModule } from '../../config/typed-config.module';
import { EMAIL_DELIVERY } from './constants/email.constants';
import { EmailService } from './services/email.service';
import type { EmailDelivery } from './types/email.types';

@Global()
@Module({
	imports: [TypedConfigModule],
	providers: [
		{
			provide: EMAIL_DELIVERY,
			inject: [TypedConfigService],
			useFactory: (configService: TypedConfigService): EmailDelivery | null => {
				const email = configService.get('email');
				if (!email) return null;
				return {
					emails: new Resend(email.resendApiKey, {
						baseUrl: email.resendBaseUrl,
					}).emails,
					from: email.from,
					replyTo: email.replyTo,
					brand: { websiteUrl: email.websiteUrl },
				};
			},
		},
		EmailService,
	],
	exports: [EmailService],
})
export class EmailModule {}

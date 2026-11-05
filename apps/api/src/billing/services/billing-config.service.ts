/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/services/settings.service';
import { BillingConfigDto } from '../dto/billing-config.dto';

@Injectable()
export class BillingConfigService {
	constructor(private readonly settings: SettingsService) {}

	async get(): Promise<BillingConfigDto> {
		return BillingConfigDto.from(await this.settings.get());
	}
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Module } from '@nestjs/common';
import { SanctionedRegionGuard } from './guards/sanctioned-region.guard';
import { GeoIpService } from './services/geo-ip.service';

@Module({
	providers: [GeoIpService, SanctionedRegionGuard],
	exports: [GeoIpService, SanctionedRegionGuard],
})
export class LocationModule {}

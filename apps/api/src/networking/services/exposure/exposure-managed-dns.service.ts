/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { CloudflareDomainProvider } from '../../../cloudflare/services/cloudflare-domain-provider.service';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import type { Edge } from '../../entities/edge.entity';
import type { Exposure } from '../../entities/exposure.entity';

type ManagedHttpExposure = Exposure & {
	platformHostname: string;
	originHostname: string;
};

@Injectable()
export class ExposureManagedDnsService {
	private readonly hosted: boolean;

	constructor(
		private readonly provider: CloudflareDomainProvider,
		config: TypedConfigService
	) {
		this.hosted = config.get('deployment').hosted;
	}

	async pointAt(exposure: Exposure, edge: Edge): Promise<void> {
		this.assertInputs(exposure, edge);
		if (!this.provider.isConfigured()) {
			this.assertProviderConfigured();
			return;
		}
		await this.provider.ensureManagedCname(
			exposure.originHostname,
			edge.publicHost,
			true
		);
		await this.provider.ensureManagedCname(
			exposure.platformHostname,
			edge.publicHost,
			true
		);
	}

	async remove(exposure: Exposure): Promise<void> {
		this.assertExposureHostnames(exposure);
		if (!this.provider.isConfigured()) {
			this.assertProviderConfigured();
			return;
		}
		await this.provider.removeManagedCname(exposure.platformHostname);
		await this.provider.removeManagedCname(exposure.originHostname);
	}

	private assertProviderConfigured(): void {
		if (this.hosted) {
			throw new Error('Cloudflare ingress is required for hosted HTTP DNS');
		}
	}

	private assertInputs(
		exposure: Exposure,
		edge: Edge
	): asserts exposure is ManagedHttpExposure {
		this.assertExposureHostnames(exposure);
		if (!edge.publicHost) {
			throw new Error('HTTP exposure DNS target is incomplete');
		}
	}

	private assertExposureHostnames(
		exposure: Exposure
	): asserts exposure is ManagedHttpExposure {
		if (!exposure.platformHostname || !exposure.originHostname) {
			throw new Error('HTTP exposure managed hostnames are incomplete');
		}
	}
}

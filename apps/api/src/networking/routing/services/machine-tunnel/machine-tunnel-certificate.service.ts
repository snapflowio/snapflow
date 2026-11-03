/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { IsolationLevel, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import type { MachineSession } from '../../../../sandbox/machine/entities/machine-session.entity';
import { MachineSessionService } from '../../../../sandbox/machine/services/machine-session.service';
import {
	LIVE_BINDING_STATES,
	TUNNEL_CERTIFICATE_AUTHORITY,
} from '../../constants/machine-tunnel.constants';
import type {
	IssueMachineTunnelCertificateDto,
	MachineTunnelCertificateDto,
} from '../../dto/machine-tunnel-certificate.dto';
import { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import {
	TUNNEL_CERTIFICATE_SIGNER,
	type TunnelCertificateSigner,
} from '../../types/tunnel-certificate-signer.types';

const TUNNEL_TRUST_DOMAIN = 'tunnel.snapflow.internal';

@Injectable()
export class MachineTunnelCertificateService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessions: MachineSessionService,
		@Inject(TUNNEL_CERTIFICATE_SIGNER)
		private readonly signer: TunnelCertificateSigner
	) {}

	async issue(
		machineId: string,
		session: MachineSession,
		input: IssueMachineTunnelCertificateDto
	): Promise<MachineTunnelCertificateDto> {
		const identity = await this.entityManager.transactional(
			async (manager) => {
				const observedAt = await databaseNow(manager);
				await this.machineSessions.assertCurrent(
					manager,
					machineId,
					session.id,
					observedAt
				);
				const binding = await manager.findOne(MachineEdgeBinding, {
					id: input.bindingId,
					machineId,
					edgeId: input.edgeId,
					machineSessionGeneration: session.generation,
					revision: input.bindingRevision,
					digest: input.bindingDigest,
					observedState: { $in: LIVE_BINDING_STATES },
					leaseExpiresAt: { $gt: observedAt },
				});
				if (!binding) {
					throw new ConflictException(
						'Machine tunnel certificate binding has been fenced'
					);
				}
				return this.spiffeId(
					machineId,
					binding.edgeId,
					session.generation,
					binding.id,
					binding.revision
				);
			},
			{
				isolationLevel: IsolationLevel.REPEATABLE_READ,
				propagation: TransactionPropagation.REQUIRED,
			}
		);
		const signed = await this.signer.sign({
			csr: input.csr,
			spiffeId: identity,
			ttlSeconds: TUNNEL_CERTIFICATE_AUTHORITY.CERTIFICATE_TTL_SECONDS,
		});
		return {
			certificateChain: signed.certificateChain,
			expiresAt: signed.expiresAt.toISOString(),
			spiffeId: identity,
		};
	}

	private spiffeId(
		machineId: string,
		edgeId: string,
		sessionGeneration: number,
		bindingId: string,
		bindingRevision: number
	): string {
		return `spiffe://${TUNNEL_TRUST_DOMAIN}/machine/${machineId}/edge/${edgeId}/session/${sessionGeneration}/binding/${bindingId}/revision/${bindingRevision}`;
	}
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { BadRequestException, Injectable } from '@nestjs/common';
import { customAlphabet as customNanoid, urlAlphabet } from 'nanoid';
import { ID_OR_NAME_MATCH_LIMIT } from '../../../common/constants/query.constants';
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { apiError } from '../../../common/utils/error/api-error.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { Sandbox } from '../../entities/sandbox.entity';
import { SshAccess } from '../../entities/ssh-access.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxErrorCode } from '../../enums/sandbox-error-code.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxNotFoundException } from '../../exceptions/sandbox-not-found.exception';
import { StateChangeInProgressException } from '../../exceptions/state-change-in-progress.exception';
import type { ValidatedSshAccess } from '../../types/validated-ssh-access.types';

const SSH_TOKEN_LENGTH = 32;
const SSH_TOKEN_ALPHABET = urlAlphabet.replace('_', '').replace('-', '');

@Injectable()
export class SandboxService {
	constructor(private readonly entityManager: EntityManager) {}

	async findOneByIdOrName(
		sandboxIdOrName: string,
		organizationId: string,
		returnDestroyed?: boolean,
		manager?: EntityManager
	): Promise<Sandbox> {
		const stateFilter = returnDestroyed
			? {}
			: { state: { $ne: SandboxState.DESTROYED } };
		const populate = ['buildInfo', 'lastActivityAt'] as const;

		const entityManager = manager ?? this.entityManager;
		const matches = await entityManager.find(
			Sandbox,
			{
				organizationId,
				...stateFilter,
				$or: [{ id: sandboxIdOrName }, { name: sandboxIdOrName }],
			},
			{ populate, limit: ID_OR_NAME_MATCH_LIMIT }
		);
		const sandbox =
			matches.find(({ id }) => id === sandboxIdOrName) ??
			matches.find(({ name }) => name === sandboxIdOrName) ??
			null;

		if (!sandbox || (!returnDestroyed && isDestroyedAfterError(sandbox))) {
			throw new SandboxNotFoundException(sandboxIdOrName);
		}

		return sandbox;
	}

	async findOne(
		sandboxId: string,
		returnDestroyed?: boolean
	): Promise<Sandbox> {
		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{
				id: sandboxId,
				...(returnDestroyed ? {} : { state: { $ne: SandboxState.DESTROYED } }),
			},
			{ populate: ['lastActivityAt'] }
		);

		if (!sandbox || (!returnDestroyed && isDestroyedAfterError(sandbox))) {
			throw new SandboxNotFoundException(sandboxId);
		}

		return sandbox;
	}

	async getAccessScope(
		sandboxIdOrName: string,
		organizationId: string
	): Promise<Pick<Sandbox, 'id' | 'organizationId' | 'state'>> {
		const fields = ['id', 'organizationId', 'state'] as const;
		const sandbox =
			(await this.entityManager.findOne(
				Sandbox,
				{ id: sandboxIdOrName, organizationId },
				{ fields, disableIdentityMap: true }
			)) ??
			(await this.entityManager.findOne(
				Sandbox,
				{ name: sandboxIdOrName, organizationId },
				{ fields, disableIdentityMap: true }
			));

		if (!sandbox?.organizationId) {
			throw new SandboxNotFoundException(sandboxIdOrName);
		}

		return {
			id: sandbox.id,
			organizationId: sandbox.organizationId,
			state: sandbox.state,
		};
	}

	async createSshAccess(
		sandboxIdOrName: string,
		expiresInMinutes: number,
		organizationId: string,
		manager?: EntityManager
	): Promise<SshAccess> {
		const sandbox = await this.findOneByIdOrName(
			sandboxIdOrName,
			organizationId,
			false,
			manager
		);
		if (sandbox.state !== SandboxState.STARTED) {
			throw new BadRequestException(
				apiError(
					SandboxErrorCode.STATE_INVALID,
					'SSH access can only be created for a started sandbox. Start the sandbox, then try again.'
				)
			);
		}
		if (sandbox.pending) {
			throw new StateChangeInProgressException();
		}

		const entityManager = manager ?? this.entityManager;
		await entityManager.nativeDelete(SshAccess, { sandboxId: sandbox.id });

		const sshAccess = new SshAccess();
		sshAccess.sandboxId = sandbox.id;
		sshAccess.token = customNanoid(SSH_TOKEN_ALPHABET)(SSH_TOKEN_LENGTH);
		sshAccess.expiresAt = addMilliseconds(
			new Date(),
			expiresInMinutes * MILLISECONDS_PER_MINUTE
		);

		entityManager.persist(sshAccess);
		await entityManager.flush();
		return sshAccess;
	}

	async revokeSshAccess(
		sandboxIdOrName: string,
		token: string | undefined,
		organizationId: string
	): Promise<Sandbox> {
		const sandbox = await this.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);

		await this.entityManager.nativeDelete(SshAccess, {
			sandboxId: sandbox.id,
			...(token ? { token } : {}),
		});

		return sandbox;
	}

	async listActiveSshAccess(
		sandboxIdOrName: string,
		organizationId: string
	): Promise<SshAccess[]> {
		const sandbox = await this.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		return this.entityManager.find(
			SshAccess,
			{ sandboxId: sandbox.id, expiresAt: { $gt: new Date() } },
			{ orderBy: { expiresAt: 'asc' } }
		);
	}

	async revokeSshAccessGrant(
		sandboxIdOrName: string,
		accessId: string,
		organizationId: string
	): Promise<void> {
		const sandbox = await this.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		await this.entityManager.nativeDelete(SshAccess, {
			id: accessId,
			sandboxId: sandbox.id,
		});
	}

	async validateSshAccess(token: string): Promise<ValidatedSshAccess> {
		const sshAccess = await this.entityManager.findOne(SshAccess, { token });

		if (!sshAccess || sshAccess.expiresAt < new Date()) {
			return { valid: false };
		}

		const sandbox = await this.entityManager.findOne(Sandbox, {
			id: sshAccess.sandboxId,
		});
		if (!sandbox) return { valid: false };

		return {
			valid: true,
			sandboxId: sandbox.id,
			organizationId: sandbox.organizationId,
			expiresAt: sshAccess.expiresAt,
		};
	}
}

function isDestroyedAfterError(sandbox: Sandbox): boolean {
	return (
		sandbox.isErrored() &&
		sandbox.desiredState === SandboxDesiredState.DESTROYED
	);
}

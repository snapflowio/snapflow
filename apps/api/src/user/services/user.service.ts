/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { generateKeyPair } from 'node:crypto';
import { TransactionPropagation } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, type EntityRepository } from '@mikro-orm/postgresql';
import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import forge from 'node-forge';
import { UserEvents } from '../constants/user-events.constants';
import type { UserSSHKeyPair } from '../entities/user.entity';
import { User } from '../entities/user.entity';
import { SystemRole } from '../enums/system-role.enum';
import { UserAuthorizationChangedEvent } from '../events/user-authorization-changed.event';
import { UserDeletedEvent } from '../events/user-deleted.event';
import { isBanActive } from '../utils/user-ban.util';

const SSH_KEY_MODULUS_LENGTH = 4096;
const SSH_KEY_COMMENT = 'snapflow';

@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		private readonly eventEmitter: EventEmitter2,
		private readonly entityManager: EntityManager
	) {}

	async findOldestAdministrator(): Promise<User | null> {
		return this.userRepository.findOne(
			{ role: SystemRole.ADMIN, banned: false },
			{ orderBy: { createdAt: 'ASC' } }
		);
	}

	async findByIds(ids: string[]): Promise<User[]> {
		if (ids.length === 0) return [];
		return this.userRepository.find({ id: { $in: ids } });
	}

	findOne(id: string): Promise<User | null> {
		return this.userRepository.findOne({ id });
	}

	findOneOrFail(id: string): Promise<User> {
		return this.userRepository.findOneOrFail({ id });
	}

	findOneByEmail(email: string): Promise<User | null> {
		return this.userRepository.findOne({ email: email.toLowerCase() });
	}

	async updateName(userId: string, name: string): Promise<User> {
		const user = await this.findUserOrFail(userId);
		user.name = name;
		await this.entityManager.flush();
		return user;
	}

	async updateEmail(userId: string, email: string): Promise<User> {
		const user = await this.findUserOrFail(userId);
		user.email = email.toLowerCase();
		await this.entityManager.flush();
		return user;
	}

	async updateEmailVerified(userId: string, verified: boolean): Promise<User> {
		return this.entityManager.transactional(
			async (manager) => {
				const user = await manager.findOneOrFail(User, { id: userId });
				user.emailVerified = verified;
				return user;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async updateRole(userId: string, role: SystemRole): Promise<User> {
		const user = await this.findUserOrFail(userId);
		user.role = role;
		await this.entityManager.flush();
		this.eventEmitter.emit(
			UserEvents.AUTHORIZATION_CHANGED,
			new UserAuthorizationChangedEvent(userId)
		);
		return user;
	}

	async completeAuthenticationProvisioning(userId: string): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const user = await manager.findOneOrFail(User, { id: userId });
				user.keyPair ??= await generateSshKeyPair();
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async assertActive(userId: string): Promise<User> {
		const user = await this.findUserOrFail(userId);
		if (isBanActive(user)) {
			throw new ForbiddenException(
				user.banReason
					? `Account is suspended: ${user.banReason}`
					: 'Account is suspended'
			);
		}
		return user;
	}

	async notifyAuthenticationDeleted(userId: string): Promise<void> {
		await this.entityManager.transactional(
			(manager) =>
				this.eventEmitter.emitAsync(
					UserEvents.DELETED,
					new UserDeletedEvent(manager, userId)
				),
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async findUserOrFail(id: string): Promise<User> {
		const user = await this.findOne(id);
		if (!user) throw new NotFoundException(`User with ID ${id} not found.`);
		return user;
	}
}

function generateSshKeyPair(): Promise<UserSSHKeyPair> {
	return new Promise((resolve, reject) => {
		generateKeyPair(
			'rsa',
			{
				modulusLength: SSH_KEY_MODULUS_LENGTH,
				publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
				privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
			},
			(error, publicKey, privateKey) => {
				if (error) {
					reject(error);
					return;
				}
				resolve({
					publicKey: forge.ssh.publicKeyToOpenSSH(
						forge.pki.publicKeyFromPem(publicKey),
						SSH_KEY_COMMENT
					),
					privateKey: forge.ssh.privateKeyToOpenSSH(
						forge.pki.privateKeyFromPem(privateKey)
					),
				});
			}
		);
	});
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import type { User } from '../../user/entities/user.entity';
import { SystemRole } from '../../user/enums/system-role.enum';
import { UserService } from '../../user/services/user.service';
import type { Auth } from '../better-auth/better-auth.config';
import { InjectBetterAuth } from '../better-auth/better-auth.provider';

export type FirstAdministrator = Pick<User, 'name' | 'email'>;

@Injectable()
export class AdministratorBootstrapService {
	constructor(
		@InjectBetterAuth() private readonly auth: Auth,
		private readonly users: UserService
	) {}

	async createFirst(administrator: FirstAdministrator): Promise<boolean> {
		if (await this.users.findOldestAdministrator()) return false;
		const { user } = await this.auth.api.createUser({
			body: { ...administrator, role: SystemRole.ADMIN },
		});
		await this.users.updateEmailVerified(user.id, true);
		return true;
	}
}

/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Entity,
	Index,
	ManyToOne,
	PrimaryKey,
	Property,
	Unique,
} from '@mikro-orm/decorators/legacy';
import { User } from '../../user/entities/user.entity';

const DEVICE_CODE_MAX_LENGTH = 191;

@Entity({ tableName: 'deviceCode' })
@Unique({ name: 'device_code_device_code_unique', properties: ['deviceCode'] })
@Unique({ name: 'device_code_user_code_unique', properties: ['userCode'] })
export class DeviceCode {
	@PrimaryKey({
		type: 'uuid',
		columnType: 'uuid',
		defaultRaw: 'gen_random_uuid()',
	})
	id: string;

	@Property({
		type: 'string',
		columnType: `varchar(${DEVICE_CODE_MAX_LENGTH})`,
		fieldName: 'deviceCode',
	})
	deviceCode: string;

	@Property({
		type: 'string',
		columnType: `varchar(${DEVICE_CODE_MAX_LENGTH})`,
		fieldName: 'userCode',
	})
	userCode: string;

	@Index({ name: 'device_code_user_id_index' })
	@ManyToOne(() => User, {
		mapToPk: true,
		joinColumn: 'userId',
		columnType: 'uuid',
		nullable: true,
		foreignKeyName: 'device_code_user_id_fk',
		deleteRule: 'cascade',
	})
	userId: string | null;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'expiresAt',
	})
	expiresAt: Date;

	@Property({ type: 'string', columnType: 'varchar' })
	status: string;

	@Property({
		type: 'datetime',
		columnType: 'timestamptz(3)',
		fieldName: 'lastPolledAt',
		nullable: true,
	})
	lastPolledAt: Date | null;

	@Property({
		type: 'integer',
		columnType: 'integer',
		fieldName: 'pollingInterval',
		nullable: true,
	})
	pollingInterval: number | null;

	@Property({
		type: 'string',
		columnType: 'varchar',
		fieldName: 'clientId',
		nullable: true,
	})
	clientId: string | null;

	@Property({ type: 'string', columnType: 'text', nullable: true })
	scope: string | null;
}

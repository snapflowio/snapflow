/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DecimalType } from '@mikro-orm/core';
import {
	EVM_ADDRESS_LENGTH,
	EVM_HASH_LENGTH,
} from '../constants/settlement.constants';

export const addressColumn = (fieldName: string) =>
	({
		type: 'string',
		columnType: `varchar(${EVM_ADDRESS_LENGTH})`,
		fieldName,
	}) as const;

export const hashColumn = (fieldName: string) =>
	({
		type: 'string',
		columnType: `varchar(${EVM_HASH_LENGTH})`,
		fieldName,
	}) as const;

export const amountColumn = (fieldName: string) =>
	({
		type: new DecimalType('string'),
		columnType: 'numeric(40,0)',
		fieldName,
	}) as const;

export const timestampColumn = (fieldName: string) =>
	({ type: 'datetime', columnType: 'timestamptz(3)', fieldName }) as const;

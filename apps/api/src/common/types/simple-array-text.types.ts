/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Type } from '@mikro-orm/core';

const SIMPLE_ARRAY_COLUMN_TYPE = 'text';
const SIMPLE_ARRAY_SEPARATOR = ',';

export class SimpleArrayTextType extends Type<string[] | null, string | null> {
	convertToDatabaseValue(value: string[] | null): string | null {
		return value?.map(String).join(SIMPLE_ARRAY_SEPARATOR) ?? null;
	}

	convertToJSValue(value: string | null): string[] | null {
		if (value === null) return null;
		return value.length === 0 ? [] : value.split(SIMPLE_ARRAY_SEPARATOR);
	}

	compareAsType(): string {
		return 'string[]';
	}

	getColumnType(): string {
		return SIMPLE_ARRAY_COLUMN_TYPE;
	}
}

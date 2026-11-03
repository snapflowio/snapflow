/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Type } from '@mikro-orm/core';

const JSON_TEXT_COLUMN_TYPE = 'text';

export class JsonTextType extends Type<unknown, string> {
	convertToDatabaseValue(value: unknown): string {
		const serialized = JSON.stringify(value);
		if (serialized === undefined) {
			throw new TypeError('JSON text values must be JSON-serializable');
		}
		return serialized;
	}

	convertToJSValue(value: string): unknown {
		try {
			return JSON.parse(value);
		} catch (error) {
			throw new TypeError('Database JSON text is invalid', { cause: error });
		}
	}

	compareAsType(): string {
		return 'any';
	}

	getColumnType(): string {
		return JSON_TEXT_COLUMN_TYPE;
	}
}

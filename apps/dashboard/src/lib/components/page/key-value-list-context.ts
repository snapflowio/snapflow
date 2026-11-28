/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Context } from 'runed';

export interface KeyValueListScope {
	readonly framed: boolean;
	readonly review: boolean;
}

const keyValueListContext = new Context<KeyValueListScope>('KeyValueList');

export function provideKeyValueList(scope: KeyValueListScope): void {
	keyValueListContext.set(scope);
}

export function keyValueListScope(): KeyValueListScope | null {
	return keyValueListContext.getOr(null);
}

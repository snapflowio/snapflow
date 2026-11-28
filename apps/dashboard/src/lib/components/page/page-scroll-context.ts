/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Context } from 'runed';

const pageScrollOwnerContext = new Context<boolean>('PageScrollOwner');

export function providePageScrollOwner(): void {
	pageScrollOwnerContext.set(true);
}

export function hasPageScrollOwner(): boolean {
	return pageScrollOwnerContext.getOr(false);
}

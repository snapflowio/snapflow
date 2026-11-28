/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createContext } from 'svelte';

export type ChipModalVariant = 'dialog' | 'sheet';

const DEFAULT_VARIANT: ChipModalVariant = 'dialog';

const [getVariant, setVariant, hasVariant] =
	createContext<() => ChipModalVariant>();

export function setChipModalVariant(variant: () => ChipModalVariant): void {
	setVariant(variant);
}

export function findChipModalVariant(): () => ChipModalVariant {
	return hasVariant() ? getVariant() : () => DEFAULT_VARIANT;
}

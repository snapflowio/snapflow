/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { renderComponent } from '@tanstack/svelte-table';
import AddressDisplay, {
	type AddressKind,
} from '#lib/components/ui/address/address-display.svelte';
import CopyableText from '#lib/components/ui/clipboard/copyable-text.svelte';
import Money from '#lib/components/ui/money.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { renderResourceLabel } from './resource-cell.ts';

export const NUMERIC_COLUMN = { align: 'end' } as const;

export function timestampCell(
	value: string | null | undefined,
	emptyLabel?: string
) {
	return value
		? renderComponent(Timestamp, { value })
		: renderResourceLabel({ label: emptyLabel ?? null });
}

export function moneyCell(microUsd: string) {
	return renderComponent(Money, { microUsd });
}

export function addressCell(value: string, kind?: AddressKind) {
	return renderComponent(AddressDisplay, { value, kind });
}

export function copyableCell(value: string | null | undefined, label?: string) {
	return value
		? renderComponent(CopyableText, { value, label })
		: renderResourceLabel({ label: null });
}

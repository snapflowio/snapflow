/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

export interface ResourceContextActions<TRow> {
	readonly empty: () => ResourceRowAction[];
	readonly selection: () => ResourceRowAction[];
	readonly row: (row: TRow) => ResourceRowAction[];
}

export class ResourceSelection<TRow> {
	readonly #rows: () => readonly TRow[];
	readonly #rowId: (row: TRow) => string;
	readonly #isSelectable: (row: TRow) => boolean;

	ids = $state.raw<string[]>([]);
	readonly selected: TRow[] = $derived.by(() =>
		this.#rows().filter(
			(row) => this.#isSelectable(row) && this.ids.includes(this.#rowId(row))
		)
	);

	constructor(
		rows: () => readonly TRow[],
		rowId: (row: TRow) => string,
		isSelectable: (row: TRow) => boolean = () => true
	) {
		this.#rows = rows;
		this.#rowId = rowId;
		this.#isSelectable = isSelectable;
	}

	clear = (): void => {
		this.ids = [];
	};

	retarget = (rowId: string | null): void => {
		if (!rowId || this.ids.length === 0 || this.ids.includes(rowId)) return;
		const row = this.#find(rowId);
		this.ids = row && this.#isSelectable(row) ? [rowId] : [];
	};

	contextActions(
		rowId: string | null,
		actions: ResourceContextActions<TRow>
	): ResourceRowAction[] {
		if (rowId === null) return actions.empty();
		if (this.ids.length > 1 && this.ids.includes(rowId)) {
			return actions.selection();
		}
		const row = this.#find(rowId);
		return row ? actions.row(row) : [];
	}

	#find(rowId: string): TRow | undefined {
		return this.#rows().find((row) => this.#rowId(row) === rowId);
	}
}

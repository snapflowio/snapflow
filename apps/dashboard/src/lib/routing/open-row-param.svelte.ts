/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { goto } from '$app/navigation';
import { page } from '$app/state';

const DEFAULT_OPEN_ROW_PARAM = 'row';

export interface OpenRowParamOptions {
	readonly param?: string;
	readonly pushOnSwitch?: boolean;
	readonly closeWithBack?: boolean;
}

export class OpenRowParam<TRow> {
	readonly #rows: () => readonly TRow[];
	readonly #rowId: (row: TRow) => string;
	readonly #param: string;
	readonly #pushOnSwitch: boolean;
	readonly #closeWithBack: boolean;
	#pushed = false;

	readonly openId: string | null = $derived.by(() =>
		page.url.searchParams.get(this.#param)
	);
	readonly index: number = $derived.by(() =>
		this.openId === null
			? -1
			: this.#rows().findIndex((row) => this.#rowId(row) === this.openId)
	);
	readonly row: TRow | null = $derived.by(
		() => this.#rows()[this.index] ?? null
	);
	readonly previous: (() => void) | undefined = $derived.by(() =>
		this.#stepper(-1)
	);
	readonly next: (() => void) | undefined = $derived.by(() => this.#stepper(1));

	constructor(
		rows: () => readonly TRow[],
		rowId: (row: TRow) => string,
		{
			param = DEFAULT_OPEN_ROW_PARAM,
			pushOnSwitch = false,
			closeWithBack = false,
		}: OpenRowParamOptions = {}
	) {
		this.#rows = rows;
		this.#rowId = rowId;
		this.#param = param;
		this.#pushOnSwitch = pushOnSwitch;
		this.#closeWithBack = closeWithBack;
	}

	open = (id: string): void => {
		if (id === this.openId) return;
		const replace = this.openId !== null && !this.#pushOnSwitch;
		if (this.openId === null) this.#pushed = true;
		this.#navigate(id, replace);
	};

	close = (): void => {
		if (this.openId === null) return;
		if (this.#closeWithBack && this.#pushed) {
			this.#pushed = false;
			history.back();
			return;
		}
		this.#navigate(null, true);
	};

	#stepper(offset: number): (() => void) | undefined {
		const target = this.#rows()[this.index + offset];
		if (this.index < 0 || target === undefined) return undefined;
		const id = this.#rowId(target);
		return () => this.#navigate(id, true);
	}

	#navigate(id: string | null, replace: boolean): void {
		const url = new URL(page.url.href);
		if (id === null) url.searchParams.delete(this.#param);
		else url.searchParams.set(this.#param, id);
		void goto(url, { replace, reset: false });
	}
}

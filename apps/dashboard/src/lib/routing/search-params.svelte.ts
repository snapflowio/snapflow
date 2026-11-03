/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Debounced, watch } from 'runed';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import {
	parseSearchParams,
	type SearchParamsPatch,
	type SearchParamsSchema,
	type SearchParamsValues,
	withSearchParams,
} from './search-params.ts';

const SEARCH_DEBOUNCE_MILLISECONDS = 300;
const SEARCH_PARAMS_NAVIGATION = { replace: true, reset: false } as const;

type TextKey<TValues> = {
	[Key in keyof TValues]-?: TValues[Key] extends string | undefined
		? Key
		: never;
}[keyof TValues] &
	string;

export interface SearchParamTextOptions<TSchema extends SearchParamsSchema> {
	readonly clears?: readonly (keyof SearchParamsValues<TSchema> & string)[];
	readonly wait?: number;
}

export class SearchParamText {
	readonly #source: () => string;
	readonly #debounced: Debounced<string>;
	#draft = $state<string | null>(null);

	constructor(
		source: () => string,
		commit: (value: string) => Promise<void>,
		wait: number
	) {
		this.#source = source;
		this.#debounced = new Debounced(() => this.value, wait);
		watch(
			() => this.#debounced.current,
			(value) => {
				const settle = () => {
					if (this.#draft === value) this.#draft = null;
				};
				if (value === this.#source()) settle();
				else void commit(value).then(settle);
			},
			{ lazy: true }
		);
	}

	get value(): string {
		return this.#draft ?? this.#source();
	}

	set value(value: string) {
		this.#draft = value;
	}

	flush = (): Promise<void> => this.#debounced.updateImmediately();
}

export class SearchParams<TSchema extends SearchParamsSchema> {
	readonly #schema: TSchema;
	readonly current: SearchParamsValues<TSchema> = $derived.by(() =>
		parseSearchParams(this.#schema, page.url)
	);

	constructor(schema: TSchema) {
		this.#schema = schema;
	}

	update = (patch: SearchParamsPatch<TSchema>): Promise<void> =>
		this.#navigate(patch);

	text = (
		key: TextKey<SearchParamsValues<TSchema>>,
		{
			clears = [],
			wait = SEARCH_DEBOUNCE_MILLISECONDS,
		}: SearchParamTextOptions<TSchema> = {}
	): SearchParamText =>
		new SearchParamText(
			() => this.#text(key),
			(value) =>
				this.#navigate({
					...Object.fromEntries(clears.map((cleared) => [cleared, undefined])),
					[key]: value,
				}),
			wait
		);

	#text(key: string): string {
		const value: unknown = this.current[key];
		return typeof value === 'string' ? value : '';
	}

	#navigate(patch: Readonly<Record<string, unknown>>): Promise<void> {
		return goto(
			withSearchParams(this.#schema, page.url, patch),
			SEARCH_PARAMS_NAVIGATION
		);
	}
}

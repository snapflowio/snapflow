/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';

export type SearchParamsSchema = z.ZodType<Record<string, unknown>>;

export type SearchParamsValues<TSchema extends SearchParamsSchema> =
	z.output<TSchema>;

export type SearchParamsPatch<TSchema extends SearchParamsSchema> = {
	readonly [Key in keyof SearchParamsValues<TSchema>]?:
		| SearchParamsValues<TSchema>[Key]
		| undefined;
};

export interface SearchParamsUrl {
	readonly href: string;
	readonly searchParams: Pick<URLSearchParams, 'getAll' | 'keys'>;
}

type RawSearchParams = Record<string, string | string[]>;

function rawSearchParams(
	searchParams: SearchParamsUrl['searchParams']
): RawSearchParams {
	const raw: RawSearchParams = {};
	for (const key of new Set(searchParams.keys())) {
		const [first = '', ...rest] = searchParams.getAll(key);
		raw[key] = rest.length > 0 ? [first, ...rest] : first;
	}
	return raw;
}

function serializeSearchParam(value: unknown): string[] {
	if (value === undefined || value === null || value === '') return [];
	if (Array.isArray(value)) return value.flatMap(serializeSearchParam);
	if (value instanceof Date) return [value.toISOString()];
	return [String(value)];
}

function sameSerialization(left: unknown, right: unknown): boolean {
	const leftValues = serializeSearchParam(left);
	const rightValues = serializeSearchParam(right);
	return (
		leftValues.length === rightValues.length &&
		leftValues.every((value, index) => value === rightValues[index])
	);
}

export function parseSearchParams<TSchema extends SearchParamsSchema>(
	schema: TSchema,
	url: SearchParamsUrl
): SearchParamsValues<TSchema> {
	const parsed = schema.safeParse(rawSearchParams(url.searchParams));
	return parsed.success ? parsed.data : schema.parse({});
}

export function withSearchParams(
	schema: SearchParamsSchema,
	url: SearchParamsUrl,
	patch: Readonly<Record<string, unknown>>
): URL {
	const next = new URL(url.href);
	const defaults = schema.parse({});
	for (const [key, value] of Object.entries(patch)) {
		next.searchParams.delete(key);
		if (sameSerialization(value, defaults[key])) continue;
		for (const serialized of serializeSearchParam(value)) {
			next.searchParams.append(key, serialized);
		}
	}
	return next;
}

function toArray(value: unknown): unknown[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

export function searchParamArray<TItem extends z.ZodType>(item: TItem) {
	return z.preprocess(toArray, z.array(item));
}

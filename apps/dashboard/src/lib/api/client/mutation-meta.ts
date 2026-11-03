/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateMutationOptions,
	type DefaultError,
	type MutationMeta,
	mutationOptions,
	type QueryKey,
} from '@tanstack/svelte-query';

type MutationMessage<TValue, TVariables> =
	| string
	| ((value: TValue, variables: TVariables) => string);

type AppMutationMeta<
	TData = unknown,
	TError = unknown,
	TVariables = unknown,
> = {
	failure?: MutationMessage<TError, TVariables>;
	invalidates?: readonly QueryKey[];
	success?: MutationMessage<TData, TVariables>;
};

declare module '@tanstack/svelte-query' {
	interface Register {
		mutationMeta: AppMutationMeta;
	}
}

type AppMutationOptions<TData, TError, TVariables, TOnMutateResult> = Omit<
	CreateMutationOptions<TData, TError, TVariables, TOnMutateResult>,
	'meta' | 'mutationKey'
> & { meta?: AppMutationMeta<TData, TError, TVariables> };

export function appMutationOptions<
	TData = unknown,
	TError = DefaultError,
	TVariables = void,
	TOnMutateResult = unknown,
>({
	meta,
	...options
}: AppMutationOptions<TData, TError, TVariables, TOnMutateResult>) {
	return mutationOptions<TData, TError, TVariables, TOnMutateResult>({
		...options,
		meta: meta as MutationMeta | undefined,
	});
}

export function resolveMutationMessage<TValue>(
	message: MutationMessage<TValue, unknown> | undefined,
	value: TValue,
	variables: unknown
): string | undefined {
	return typeof message === 'function' ? message(value, variables) : message;
}

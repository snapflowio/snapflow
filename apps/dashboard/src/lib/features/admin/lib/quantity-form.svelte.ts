/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { revalidateLogic } from '@tanstack/svelte-form';
import * as z from 'zod';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { submitMutation } from '#lib/components/form/submit.ts';

export interface QuantityField<TName extends string> {
	label: string;
	name: TName;
	unit: string;
}

const WHOLE_NUMBER_PATTERN = /^\d+$/;
const NOT_A_WHOLE_NUMBER = 'Enter a whole number';
const requiredQuantity = z
	.string()
	.trim()
	.regex(WHOLE_NUMBER_PATTERN, NOT_A_WHOLE_NUMBER);
const optionalQuantity = z
	.string()
	.trim()
	.refine(
		(value) => value === '' || WHOLE_NUMBER_PATTERN.test(value),
		NOT_A_WHOLE_NUMBER
	);

type QuantityValues<
	TRequired extends string,
	TOptional extends string,
> = Record<TRequired, number> & Record<TOptional, number | null>;

interface QuantityFormOptions<
	TRequired extends string,
	TOptional extends string,
> {
	requiredFields: readonly QuantityField<TRequired>[];
	optionalFields?: readonly QuantityField<TOptional>[];
	initialValues: () => Partial<
		Record<NoInfer<TRequired | TOptional>, number | null>
	>;
	onSubmit: (values: QuantityValues<TRequired, TOptional>) => Promise<unknown>;
}

function hasEveryField<TName extends string, TValue>(
	values: Partial<Record<TName, TValue>>,
	fields: readonly QuantityField<TName>[]
): values is Record<TName, TValue> {
	return fields.every((field) => values[field.name] !== undefined);
}

function parseQuantities<TRequired extends string, TOptional extends string>(
	value: Record<string, string>,
	requiredFields: readonly QuantityField<TRequired>[],
	optionalFields: readonly QuantityField<TOptional>[]
): QuantityValues<TRequired, TOptional> | null {
	const entered = (name: string) => value[name]?.trim() ?? '';
	const required: Partial<Record<TRequired, number>> = {};
	for (const field of requiredFields) {
		const text = entered(field.name);
		if (text) required[field.name] = Number(text);
	}
	const optional: Partial<Record<TOptional, number | null>> = {};
	for (const field of optionalFields) {
		const text = entered(field.name);
		optional[field.name] = text ? Number(text) : null;
	}
	if (
		!(
			hasEveryField(required, requiredFields) &&
			hasEveryField(optional, optionalFields)
		)
	) {
		return null;
	}
	return { ...required, ...optional };
}

export function createQuantityForm<
	TRequired extends string,
	TOptional extends string = never,
>({
	requiredFields,
	optionalFields = [],
	initialValues,
	onSubmit,
}: QuantityFormOptions<TRequired, TOptional>) {
	const fields: readonly QuantityField<TRequired | TOptional>[] = [
		...requiredFields,
		...optionalFields,
	];
	const optionalNames = new Set<string>(
		optionalFields.map((field) => field.name)
	);
	const form = createAppForm(() => ({
		defaultValues: Object.fromEntries(
			fields.map((field) => [
				field.name,
				String(initialValues()[field.name] ?? ''),
			])
		),
		validationLogic: revalidateLogic(),
		validators: {
			onDynamic: z.object(
				Object.fromEntries(
					fields.map((field) => [
						field.name,
						optionalNames.has(field.name) ? optionalQuantity : requiredQuantity,
					])
				)
			),
		},
		onSubmit: async ({ value }) => {
			const values = parseQuantities(value, requiredFields, optionalFields);
			if (!values) return;
			if (await submitMutation(() => onSubmit(values))) {
				form.reset(value);
			}
		},
	}));
	return { form, fields, optionalNames };
}

export type QuantityForm = ReturnType<typeof createQuantityForm>;

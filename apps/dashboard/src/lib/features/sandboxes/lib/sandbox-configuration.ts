/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '@snapflow/api-client';
import * as z from 'zod';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

export type ConfigurationMode = 'labels' | 'lifecycle' | 'resources';

const AUTO_STOP_DEFAULT_MINUTES = 0;
const INTERVAL_DEFAULT_MINUTES = -1;
const LABEL_SEPARATOR = '=';
const LABEL_LINE_SEPARATOR = '\n';

const positiveNumberSchema = (label: string) =>
	z.string().refine((value) => {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed > 0;
	}, `${label} must be greater than zero`);
const integerSchema = (label: string) =>
	z
		.string()
		.refine(
			(value) => Number.isInteger(Number(value)),
			`${label} must be a whole number`
		);

export const configurationSchema = z
	.object({
		mode: z.enum(['labels', 'lifecycle', 'resources']),
		cpu: z.string(),
		memory: z.string(),
		disk: z.string(),
		autoStop: z.string(),
		autoArchive: z.string(),
		autoDelete: z.string(),
		labels: z.string(),
	})
	.superRefine((value, context) => {
		const validate = (
			field:
				| 'autoArchive'
				| 'autoDelete'
				| 'autoStop'
				| 'cpu'
				| 'disk'
				| 'memory',
			schema: z.ZodType<string>
		) => {
			const result = schema.safeParse(value[field]);
			if (!result.success) {
				context.addIssue({
					code: 'custom',
					message: result.error.issues[0]?.message ?? 'Invalid value',
					path: [field],
				});
			}
		};
		if (value.mode === 'resources') {
			validate('cpu', positiveNumberSchema('CPU'));
			validate('memory', positiveNumberSchema('Memory'));
			validate('disk', positiveNumberSchema('Disk'));
		}
		if (value.mode === 'lifecycle') {
			validate('autoStop', integerSchema('Auto-stop interval'));
			validate('autoArchive', integerSchema('Auto-archive interval'));
			validate('autoDelete', integerSchema('Auto-delete interval'));
		}
		if (value.mode === 'labels') {
			try {
				parseLabels(value.labels);
			} catch (error) {
				context.addIssue({
					code: 'custom',
					message:
						error instanceof Error
							? error.message
							: 'Labels must use key=value',
					path: ['labels'],
				});
			}
		}
	});
export type ConfigurationValues = z.infer<typeof configurationSchema>;

export function configurationValues(
	mode: ConfigurationMode,
	sandbox: Sandbox
): ConfigurationValues {
	return {
		mode,
		cpu: String(sandbox.cpu),
		memory: String(sandbox.memory),
		disk: String(sandbox.disk),
		autoStop: String(sandbox.autoStopInterval ?? AUTO_STOP_DEFAULT_MINUTES),
		autoArchive: String(
			sandbox.autoArchiveInterval ?? INTERVAL_DEFAULT_MINUTES
		),
		autoDelete: String(sandbox.autoDeleteInterval ?? INTERVAL_DEFAULT_MINUTES),
		labels: Object.entries(sandbox.labels)
			.map(([key, value]) => `${key}${LABEL_SEPARATOR}${value}`)
			.join(LABEL_LINE_SEPARATOR),
	};
}

export function positiveNumber(value: string, label: string): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new SnapflowError(`${label} must be greater than zero.`);
	}
	return parsed;
}

export function integer(value: string, label: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) {
		throw new SnapflowError(`${label} must be a whole number.`);
	}
	return parsed;
}

export function parseLabels(value: string): Record<string, string> {
	const entries = value
		.split(LABEL_LINE_SEPARATOR)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const separator = line.indexOf(LABEL_SEPARATOR);
			if (separator <= 0) {
				throw new SnapflowError(`Invalid label "${line}". Use key=value.`);
			}
			return [
				line.slice(0, separator).trim(),
				line.slice(separator + 1).trim(),
			];
		});
	return Object.fromEntries(entries);
}

export function configurationModalTitle(
	mode: ConfigurationMode | null
): string {
	if (mode === 'resources') return 'Resize resources';
	if (mode === 'lifecycle') return 'Edit lifecycle';
	return 'Edit labels';
}

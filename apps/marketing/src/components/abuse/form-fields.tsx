/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	InputHTMLAttributes,
	ReactNode,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { MONO_FONT } from '@/lib/marketing-styles';

const CONTROL =
	'w-full border border-snapflow-border bg-snapflow-card px-4 py-3 text-[15px] text-snapflow-paper placeholder:text-snapflow-paper-muted focus-visible:border-snapflow-purple focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-snapflow-purple';

const LABEL = `${MONO_FONT} text-xs uppercase tracking-widest text-snapflow-paper`;

type ControlAttributes = { id: string; 'aria-describedby'?: string };

function FieldShell({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: (control: ControlAttributes) => ReactNode;
}) {
	const id = useId();
	const hintId = `${id}-hint`;
	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={id} className={LABEL}>
				{label}
			</label>
			{children({ id, 'aria-describedby': hint ? hintId : undefined })}
			{hint ? (
				<p id={hintId} className="text-sm text-snapflow-paper-muted">
					{hint}
				</p>
			) : null}
		</div>
	);
}

export function TextField({
	label,
	hint,
	...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
	return (
		<FieldShell label={label} hint={hint}>
			{(control) => <input className={CONTROL} {...control} {...props} />}
		</FieldShell>
	);
}

export function TextAreaField({
	label,
	hint,
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
	label: string;
	hint?: string;
}) {
	return (
		<FieldShell label={label} hint={hint}>
			{(control) => (
				<textarea
					className={`${CONTROL} min-h-32 resize-y`}
					{...control}
					{...props}
				/>
			)}
		</FieldShell>
	);
}

export function SelectField({
	label,
	options,
	...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
	label: string;
	options: readonly { value: string; label: string }[];
}) {
	return (
		<FieldShell label={label}>
			{(control) => (
				<select className={CONTROL} {...control} {...props}>
					{options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			)}
		</FieldShell>
	);
}

export function CheckboxField({
	children,
	...props
}: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
	return (
		<label className="flex items-start gap-3 text-[15px] text-snapflow-paper-dim">
			<input
				type="checkbox"
				className="mt-1.5 size-4 shrink-0 accent-snapflow-purple"
				{...props}
			/>
			<span>{children}</span>
		</label>
	);
}

export function FieldGroup({
	legend,
	children,
}: {
	legend: string;
	children: ReactNode;
}) {
	return (
		<fieldset className="flex flex-col gap-6 border border-snapflow-border p-6 max-md:p-4">
			<legend className={`${LABEL} px-2`}>{legend}</legend>
			{children}
		</fieldset>
	);
}

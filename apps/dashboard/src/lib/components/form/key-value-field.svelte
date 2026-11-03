<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import Upload from '@lucide/svelte/icons/upload';
import Trash from '#lib/components/icons/trash.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Label from '#lib/components/ui/label.svelte';
import FieldError from './field-error.svelte';
import { firstFieldError } from './field-errors.ts';
import { FIELD_LABEL_CLASS, fieldClass } from './field-layout.ts';
import { useFieldContext } from './form-context.ts';
import {
	emptyRow,
	filledRows,
	type KeyValueRow,
	type KeyValueRowProperty,
	parseEnvRows,
	parseRows,
	serializeRows,
} from './key-value-rows.ts';

interface KeyValueFieldProps {
	allowEnvFileImport?: boolean;
	keyPlaceholder?: string;
	label: string;
	valuePlaceholder?: string;
}

let {
	allowEnvFileImport = false,
	keyPlaceholder = 'KEY',
	label,
	valuePlaceholder = 'value',
}: KeyValueFieldProps = $props();

const field = useFieldContext<string>();
const idPrefix = $props.id();
const errorId = `${idPrefix}-error`;
let fileInput: HTMLInputElement | null = $state(null);
let nextId = 0;
let fileError = $state<string | null>(null);
const createId = () => `${idPrefix}-${nextId++}`;
let rows = $state.raw<KeyValueRow[]>(parseRows(field.state.value, createId));
const hasError = $derived(Boolean(firstFieldError(field.state.meta.errors)));

function commit(nextRows: KeyValueRow[]) {
	rows = nextRows;
	field.handleChange(serializeRows(nextRows));
}

function updateRow(
	rowId: string,
	property: KeyValueRowProperty,
	value: string
) {
	commit(
		rows.map((row) => (row.id === rowId ? { ...row, [property]: value } : row))
	);
}

function removeRow(rowId: string) {
	const remainingRows = rows.filter((row) => row.id !== rowId);
	commit(remainingRows.length > 0 ? remainingRows : [emptyRow(createId)]);
}

function pasteRows(event: ClipboardEvent, rowId: string) {
	const text = event.clipboardData?.getData('text') ?? '';
	if (!text.includes('\n')) return;
	const pastedRows = filledRows(
		allowEnvFileImport
			? parseEnvRows(text, createId)
			: parseRows(text, createId)
	);
	if (pastedRows.length === 0) return;
	event.preventDefault();
	const rowIndex = rows.findIndex((row) => row.id === rowId);
	commit(rows.toSpliced(rowIndex, 1, ...pastedRows));
}

async function importEnvFile(input: HTMLInputElement) {
	const file = input.files?.[0];
	input.value = '';
	if (!file) return;

	try {
		const importedRows = parseEnvRows(await file.text(), createId);
		if (importedRows.length === 0) {
			fileError = 'The selected file does not contain any variables.';
			return;
		}
		fileError = null;
		commit([...filledRows(rows), ...importedRows]);
	} catch {
		fileError = 'The selected environment file could not be read.';
	}
}

const wrapperClass = fieldClass();
</script>

<div class={wrapperClass}>
	<div class="flex items-center justify-between gap-3">
		<Label class={FIELD_LABEL_CLASS}>{label}</Label>
		<Chip leftIcon={Plus} onclick={() => commit([...rows, emptyRow(createId)])}>
			Add
		</Chip>
	</div>
	<div class="flex flex-col gap-1.5">
		{#each rows as row, index (row.id)}
			<div class="grid grid-cols-[1fr_1fr_auto] gap-1.5">
				<ChipInput
					aria-label={`${label} key ${index + 1}`}
					aria-invalid={hasError || undefined}
					aria-describedby={hasError ? errorId : undefined}
					placeholder={keyPlaceholder}
					bind:value={() => row.key, (value) => updateRow(row.id, 'key', value)}
					onblur={field.handleBlur}
					onpaste={(event) => pasteRows(event, row.id)}
				/>
				<ChipInput
					aria-label={`${label} value ${index + 1}`}
					aria-invalid={hasError || undefined}
					aria-describedby={hasError ? errorId : undefined}
					placeholder={valuePlaceholder}
					bind:value={
						() => row.value,
						(value) => updateRow(row.id, 'value', value)
					}
					onblur={field.handleBlur}
				/>
				<IconButton
					variant="quiet"
					label={`Remove ${label.toLowerCase()} row ${index + 1}`}
					onclick={() => removeRow(row.id)}
				>
					<Trash class="size-3.5" />
				</IconButton>
			</div>
		{/each}
	</div>
	<p class="text-(--text-muted) text-caption">
		{#if allowEnvFileImport}
			<Chip leftIcon={Upload} class="mr-1" onclick={() => fileInput?.click()}>
				Import .env file
			</Chip>
			or paste .env contents into a key field.
			<input
				bind:this={fileInput}
				type="file"
				accept=".env,text/plain"
				class="sr-only"
				onchange={(event) => void importEnvFile(event.currentTarget)}
			>
		{:else}
			Paste multiple KEY=value lines into a key field to add them at once.
		{/if}
	</p>
	{#if fileError}
		<p role="alert" class="text-(--text-error) text-caption">{fileError}</p>
	{/if}
	<FieldError id={errorId} errors={field.state.meta.errors} />
</div>

<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';

interface EmailTag {
	value: string;
	valid: boolean;
	error?: string;
}

const TRIGGER_KEYS = new Set(['Enter', ',', ' ']);
const PASTE_SEPARATORS = /[\s,;]+/;
const emailSchema = z.email();

function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}
</script>

<script lang="ts">
import Plus from '@lucide/svelte/icons/plus';
import X from '@lucide/svelte/icons/x';
import { watch } from 'runed';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

interface EmailsInputProps {
	value: string[];
	onChange: (emails: string[]) => void;
	validate?: (email: string) => string | null;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
}

let {
	value,
	onChange,
	validate,
	placeholder = 'Enter emails',
	disabled = false,
	id,
}: EmailsInputProps = $props();

let tags = $state<EmailTag[]>([]);
let draft = $state('');
let inputRef = $state<HTMLInputElement | null>(null);

watch.pre(
	() => value,
	(accepted) => {
		const current = tags.filter((tag) => tag.valid).map((tag) => tag.value);
		if (
			accepted.length === current.length &&
			accepted.every((email, index) => email === current[index])
		) {
			return;
		}
		tags = accepted.map((email) => ({ value: email, valid: true }));
	}
);

const placeholderText = $derived(tags.length > 0 ? 'Add email' : placeholder);

function emit(next: EmailTag[]): void {
	onChange(next.filter((tag) => tag.valid).map((tag) => tag.value));
}

function addValues(rawValues: readonly string[]): void {
	const seen = new Set(tags.map((tag) => tag.value));
	const next = [...tags];
	let acceptedChanged = false;
	for (const raw of rawValues) {
		const email = normalizeEmail(raw);
		if (!email || seen.has(email)) continue;
		seen.add(email);
		if (!emailSchema.safeParse(email).success) {
			next.push({ value: email, valid: false, error: 'Invalid email format' });
			continue;
		}
		const reason = validate?.(email);
		if (reason) {
			next.push({ value: email, valid: false, error: reason });
			continue;
		}
		next.push({ value: email, valid: true });
		acceptedChanged = true;
	}
	if (next.length === tags.length) return;
	tags = next;
	if (acceptedChanged) emit(next);
}

function commitDraft(): void {
	const value = draft.trim();
	if (!value) return;
	addValues([value]);
	draft = '';
}

function removeAt(index: number): void {
	const removed = tags[index];
	const next = tags.filter((_, position) => position !== index);
	tags = next;
	if (removed?.valid) emit(next);
}

function handleKeydown(event: KeyboardEvent): void {
	if (TRIGGER_KEYS.has(event.key) && draft.trim()) {
		event.preventDefault();
		commitDraft();
		return;
	}
	if (event.key === 'Backspace' && !draft && tags.length > 0) {
		removeAt(tags.length - 1);
	}
}

function handlePaste(event: ClipboardEvent): void {
	event.preventDefault();
	const text = event.clipboardData?.getData('text') ?? '';
	addValues([
		...new Set(
			text
				.split(PASTE_SEPARATORS)
				.map((part) => part.trim())
				.filter(Boolean)
		),
	]);
}
</script>

{#snippet tagChip(
	tag: EmailTag,
	index: number,
	props: Record<string, unknown>
)}
	<span
		{...props}
		class={cn(
			'inline-flex h-5 min-w-0 max-w-full items-center gap-1.5 rounded-md border px-1 text-sm leading-5 transition-colors',
			tag.valid
				? 'border-border bg-surface-3 text-(--text-body)'
				: 'border-transparent bg-(--badge-error-bg) text-(--text-error)'
		)}
	>
		<span class="min-w-0 flex-1 translate-y-[0.5px] truncate text-sm leading-5">
			{tag.value}
		</span>
		{#if !tag.valid && tag.error}
			<span class="sr-only">{tag.error}</span>
		{/if}
		{#if !disabled}
			<button
				type="button"
				aria-label={`Remove ${tag.value}`}
				class="relative flex size-3 shrink-0 cursor-pointer items-center justify-center opacity-70 outline-none before:absolute before:-inset-2 before:content-[''] hover-hover:opacity-100 focus-visible:opacity-100"
				onclick={(event) => {
					event.stopPropagation();
					removeAt(index);
				}}
			>
				<X class="size-3" />
			</button>
		{/if}
	</span>
{/snippet}

<label
	for={id}
	class="relative flex max-h-48 min-h-28 w-full cursor-text flex-wrap content-start items-start gap-2 overflow-y-auto rounded-lg border border-border bg-surface-4 px-2 py-2 transition-colors"
>
	{#each tags as tag, index (tag.value)}
		{#if !tag.valid && tag.error}
			<Tooltip content={tag.error}>
				{#snippet child({
					props,
				})}
					{@render tagChip(tag, index, props)}
				{/snippet}
			</Tooltip>
		{:else}
			{@render tagChip(tag, index, {})}
		{/if}
	{/each}
	<div
		class={cn(
			'flex h-5 min-w-0 max-w-full items-center',
			draft.trim() &&
				'gap-1.5 rounded-md border border-border bg-surface-3 px-1 text-(--text-body)'
		)}
	>
		<div
			class="relative inline-flex h-5 min-w-0 max-w-full items-center overflow-hidden"
		>
			{#if draft.trim()}
				<span
					class="invisible whitespace-pre text-sm leading-5"
					aria-hidden="true"
				>
					{draft}
				</span>
			{/if}
			<input
				bind:this={inputRef}
				bind:value={draft}
				{id}
				type="text"
				data-enter-ignore
				aria-label="Emails"
				onkeydown={handleKeydown}
				onpaste={handlePaste}
				onblur={commitDraft}
				placeholder={placeholderText}
				size={placeholderText.length}
				{disabled}
				autocomplete="off"
				autocapitalize="off"
				spellcheck={false}
				class={cn(
					'appearance-none border-none bg-transparent align-middle outline-hidden placeholder:text-(--text-muted) disabled:cursor-not-allowed disabled:opacity-50',
					draft.trim()
						? 'absolute top-0 left-0 size-full p-0 text-inherit text-sm leading-5'
						: 'h-5 w-auto min-w-0 p-0 text-(--text-body) text-sm leading-5'
				)}
			>
		</div>
		{#if draft.trim()}
			<button
				type="button"
				aria-label="Add email"
				{disabled}
				class="relative flex shrink-0 items-center opacity-80 transition-opacity before:absolute before:-inset-2.5 before:content-[''] hover-hover:opacity-100 focus:outline-hidden"
				onmousedown={(event) => {
					event.preventDefault();
					commitDraft();
					inputRef?.focus();
				}}
			>
				<Plus class="size-3.5" />
			</button>
		{/if}
	</div>
</label>

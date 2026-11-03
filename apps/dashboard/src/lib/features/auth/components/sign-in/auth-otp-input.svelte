<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { PinInput, REGEXP_ONLY_DIGITS } from 'bits-ui';
import { AUTH_CODE_LENGTH } from '#lib/features/auth/lib/auth-security.ts';
import { cn } from '#lib/utils/utils.ts';

interface AuthOtpInputProps {
	id?: string;
	label: string;
	name?: string;
	invalid?: boolean;
	disabled?: boolean;
	value: string;
	onComplete?: (value: string) => void;
}

let {
	id,
	label,
	name,
	invalid = false,
	disabled = false,
	value = $bindable(),
	onComplete,
}: AuthOtpInputProps = $props();
</script>

<div class="flex justify-center">
	<PinInput.Root
		bind:value
		inputId={id}
		{name}
		{disabled}
		{onComplete}
		maxlength={AUTH_CODE_LENGTH}
		pattern={REGEXP_ONLY_DIGITS}
		aria-label={label}
		aria-invalid={invalid || undefined}
		class="flex items-center gap-2 has-disabled:opacity-50"
	>
		{#snippet children({
			cells,
		})}
			<div class="flex items-center gap-2">
				{#each cells as cell, index (index)}
					<PinInput.Cell
						{cell}
						class={cn(
							'relative flex size-12 items-center justify-center rounded-sm border border-border bg-surface-5 text-(--text-primary) text-lg transition-colors',
							cell.isActive &&
								'z-10 border-(--text-muted) ring-(--text-muted) ring-1',
							invalid && 'border-(--text-error)'
						)}
					>
						{cell.char ?? ''}
						{#if cell.hasFakeCaret}
							<div
								class="pointer-events-none absolute inset-0 flex items-center justify-center"
							>
								<div
									class="auth-otp-caret h-6 w-px bg-(--text-primary) motion-reduce:animate-none"
								></div>
							</div>
						{/if}
					</PinInput.Cell>
				{/each}
			</div>
		{/snippet}
	</PinInput.Root>
</div>

<style>
.auth-otp-caret {
	animation: auth-otp-caret-blink 1s ease-out infinite;
}

@keyframes auth-otp-caret-blink {
	0%,
	70%,
	100% {
		opacity: 1;
	}
	20%,
	50% {
		opacity: 0;
	}
}
</style>

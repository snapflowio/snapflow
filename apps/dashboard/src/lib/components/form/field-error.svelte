<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import { firstFieldError } from './field-errors.ts';

interface FieldErrorProps {
	class?: ClassValue;
	errors: readonly unknown[];
	id?: string;
}

let { class: className, errors, id }: FieldErrorProps = $props();

const message = $derived(firstFieldError(errors));
</script>

{#if message}
	<p {id} role="alert" class={['text-(--text-error) text-caption', className]}>
		{message}
	</p>
{/if}

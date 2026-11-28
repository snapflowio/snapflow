<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { Calendar } from 'bits-ui';
import ChevronLeft from '#lib/components/icons/chevron-left.svelte';
import ChevronRight from '#lib/components/icons/chevron-right.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
</script>

<Calendar.Header>
	{#snippet child({ props })}
		<div {...props} class="flex items-center justify-between pb-1">
			<Calendar.PrevButton>
				{#snippet child({ props: prevProps })}
					<Chip
						{...prevProps}
						size="compact"
						class="w-8 px-0"
						leftIcon={ChevronLeft}
						aria-label="Previous month"
					/>
				{/snippet}
			</Calendar.PrevButton>
			<Calendar.Heading>
				{#snippet child({ props: headingProps, headingValue })}
					<span
						{...headingProps}
						class="font-medium text-(--text-primary) text-sm"
					>
						{headingValue}
					</span>
				{/snippet}
			</Calendar.Heading>
			<Calendar.NextButton>
				{#snippet child({ props: nextProps })}
					<Chip
						{...nextProps}
						size="compact"
						class="w-8 px-0"
						rightIcon={ChevronRight}
						aria-label="Next month"
					/>
				{/snippet}
			</Calendar.NextButton>
		</div>
	{/snippet}
</Calendar.Header>

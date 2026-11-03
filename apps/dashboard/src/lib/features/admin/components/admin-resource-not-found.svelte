<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { IconComponent } from '#lib/components/icons/icon-component.ts';

interface AdminResourceNotFoundProps {
	icon: IconComponent;
	title: string;
	description: string;
}

let { icon: Icon, title, description }: AdminResourceNotFoundProps = $props();
</script>

<div
	role="status"
	class="flex h-full flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
>
	<Icon class="size-8 text-(--text-muted)" />
	<div class="flex flex-col items-center gap-1">
		<h2 class="text-(--text-secondary) text-[20px]">{title}</h2>
		<p class="text-(--text-muted) text-small">{description}</p>
	</div>
</div>

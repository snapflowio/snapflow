<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SandboxDetailView from '#lib/features/sandboxes/components/sandbox-detail-view.svelte';
import type { LayoutProps } from './$types';

let { children, params }: LayoutProps = $props();
</script>

<SandboxDetailView sandboxId={params.sandboxId}>
	{@render children()}
</SandboxDetailView>

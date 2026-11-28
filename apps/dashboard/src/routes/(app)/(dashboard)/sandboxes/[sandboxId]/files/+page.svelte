<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SandboxFilesView from '#lib/features/sandboxes/components/files/sandbox-files-view.svelte';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';

const detail = getSandboxDetail();
</script>

<svelte:head>
	<title>Files · {detail.sandbox.name} · Snapflow</title>
</svelte:head>

<SandboxFilesView />

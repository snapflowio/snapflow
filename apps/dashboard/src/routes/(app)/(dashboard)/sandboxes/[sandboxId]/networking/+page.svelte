<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import PageColumn from '#lib/components/page/page-column.svelte';
import SandboxOutboundPolicySection from '#lib/features/sandboxes/components/networking/sandbox-outbound-policy-section.svelte';
import SandboxPortPreviewSection from '#lib/features/sandboxes/components/networking/sandbox-port-preview-section.svelte';
import SandboxSshAccessSection from '#lib/features/sandboxes/components/networking/sandbox-ssh-access-section.svelte';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';

const detail = getSandboxDetail();
</script>

<svelte:head>
	<title>Networking · {detail.sandbox.name} · Snapflow</title>
</svelte:head>

<PageColumn>
	<SandboxPortPreviewSection />
	<SandboxOutboundPolicySection />
	<SandboxSshAccessSection />
</PageColumn>

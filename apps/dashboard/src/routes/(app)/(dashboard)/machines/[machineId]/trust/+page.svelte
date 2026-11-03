<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import MachineTrust from '#lib/features/machines/components/detail/machine-trust.svelte';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';

const machineDetail = getMachineDetail();
</script>

<svelte:head>
	<title>Trust · {machineDetail.machine.name} · Snapflow</title>
</svelte:head>

<MachineTrust />

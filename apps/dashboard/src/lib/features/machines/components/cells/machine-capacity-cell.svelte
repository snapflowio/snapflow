<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Machine } from '@snapflow/api-client';
import { machineCpuAllocation } from '#lib/features/machines/lib/machine-format.ts';

interface MachineCapacityCellProps {
	machine: Machine;
}

let { machine }: MachineCapacityCellProps = $props();

const allocation = $derived(machineCpuAllocation(machine));
</script>

<span class="truncate tabular-nums">{allocation.label}</span>

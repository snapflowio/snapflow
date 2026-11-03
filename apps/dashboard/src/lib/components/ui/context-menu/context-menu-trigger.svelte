<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import {
	ContextMenu as ContextMenuPrimitive,
	type ContextMenuTriggerProps,
} from 'bits-ui';

let { ref = $bindable(null), ...rest }: ContextMenuTriggerProps = $props();
</script>

<ContextMenuPrimitive.Trigger bind:ref {...rest} />

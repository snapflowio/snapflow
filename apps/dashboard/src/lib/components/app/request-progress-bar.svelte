<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { useIsFetching, useIsMutating } from '@tanstack/svelte-query';
import { navigationProgress } from './navigation-progress.svelte.ts';

const loading = useIsFetching({
	predicate: (query) => query.state.data === undefined,
});
const mutating = useIsMutating();

navigationProgress.track(() => loading.current > 0 || mutating.current > 0);
</script>

<div
	aria-hidden="true"
	class={[
		'pointer-events-none fixed inset-x-0 top-0 z-(--z-tooltip) h-0.5 origin-left bg-(--accent) transition-opacity duration-(--motion-quick)',
		navigationProgress.visible ? 'opacity-100' : 'opacity-0',
	]}
	style:transform={`scaleX(${navigationProgress.value})`}
></div>

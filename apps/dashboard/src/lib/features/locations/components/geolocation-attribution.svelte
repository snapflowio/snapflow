<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->
<script lang="ts">
import { GEOLOCATION_ATTRIBUTION } from '#lib/features/locations/lib/location-format.ts';

interface GeolocationAttributionProps {
	class?: string;
}

let { class: className }: GeolocationAttributionProps = $props();
</script>

<a
	class={[
		'text-(--text-muted) text-caption underline-offset-2 hover:underline',
		className,
	]}
	href={GEOLOCATION_ATTRIBUTION.href}
	target="_blank"
	rel="noopener noreferrer"
	>{GEOLOCATION_ATTRIBUTION.label}</a
>

<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const TICK_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const PAD_LENGTH = 2;
const PAD_CHARACTER = '0';

function pad(value: number): string {
	return String(value).padStart(PAD_LENGTH, PAD_CHARACTER);
}

function formatRemaining(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / TICK_MS));
	const seconds = totalSeconds % SECONDS_PER_MINUTE;
	const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
	const minutes = totalMinutes % MINUTES_PER_HOUR;
	const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${minutes}:${pad(seconds)}`;
}
</script>

<script lang="ts">
import { Clock } from '#lib/utils/clock.svelte.ts';
import type { PageBannerCountdown } from './page-banner-state.svelte.ts';

let { countdown }: { countdown: PageBannerCountdown } = $props();

const clock = new Clock(TICK_MS);
</script>

<span class="font-mono text-(--text-secondary) text-xs tabular-nums">
	{formatRemaining(countdown.endsAt - clock.now)}
	{countdown.suffix}
</span>

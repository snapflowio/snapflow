<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const EXAMPLES_INFO =
	'Per hour while each runs. Disk is charged on top at your disk rate.';
const EXAMPLES_EMPTY = 'Enter your rates to see example sandboxes.';
</script>

<script lang="ts">
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import { HOST_PRICE_SHARE_NOTE } from '#lib/features/host-pricing/lib/rate-fields.ts';
import { RateCalculator } from '#lib/features/host-pricing/state/rate-calculator.svelte.ts';
import RateCalculatorSection from './rate-calculator-section.svelte';
import RateExamplesList from './rate-examples-list.svelte';

const calculator = new RateCalculator();
</script>

<SettingsPage title="Pricing" description={HOST_PRICE_SHARE_NOTE}>
	<RateCalculatorSection {calculator} />
	<SettingsSection title="Examples" info={EXAMPLES_INFO}>
		<RateExamplesList examples={calculator.examples} empty={EXAMPLES_EMPTY} />
	</SettingsSection>
</SettingsPage>

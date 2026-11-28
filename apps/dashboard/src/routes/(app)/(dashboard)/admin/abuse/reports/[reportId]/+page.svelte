<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import AbuseReportDetailView from '#lib/features/admin/components/abuse/abuse-report-detail-view.svelte';
import type { PageProps } from './$types';

let { params }: PageProps = $props();
</script>

<AbuseReportDetailView reportId={params.reportId} />

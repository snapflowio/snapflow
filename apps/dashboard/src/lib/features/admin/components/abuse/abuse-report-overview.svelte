<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const NOT_YET = 'Not yet';
const YES = 'Yes';
const NO = 'No';
const DMCA_NOTICE_LABEL = 'DMCA takedown';
const ISP_NOTICE_LABEL = 'ISP complaint';
</script>

<script lang="ts">
import type { AbuseReport } from '@snapflow/api-client';
import { getPublicConfig } from '#lib/api/public-config.ts';
import DetailCell from '#lib/components/detail/detail-cell.svelte';
import DetailGrid from '#lib/components/detail/detail-grid.svelte';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import AdminDetailList from '#lib/features/admin/components/shared/admin-detail-list.svelte';
import {
	ABUSE_REPORT_CATEGORY_LABEL,
	ABUSE_REPORTER_TYPE_LABEL,
	COUNTER_NOTICE_STATE_LABEL,
	counterNoticeAlert,
	counterNoticeState,
	ISP_COMPLAINT_OUTCOME_LABEL,
	WITHHELD_DESCRIPTION,
	WITHHELD_LABEL,
} from '#lib/features/admin/lib/abuse-reports-list.ts';
import { formatDateTime, formatOptionalDateTime } from '#lib/utils/format.ts';

interface AbuseReportOverviewProps {
	report: AbuseReport;
}

let { report }: AbuseReportOverviewProps = $props();
const { legal } = getPublicConfig();
const counterNotice = $derived(counterNoticeState(report));
const alert = $derived(counterNoticeAlert(report, legal));
const restorationInfo = $derived(
	`Restored ${legal.dmcaRestoreAfterBusinessDays} business days after the complainant gets a copy and within ${legal.dmcaRestoreByBusinessDays} business days of receipt, unless the complainant files a court action first.`
);
</script>

{#snippet textBlock(text: string | null)}
	{#if text === null}
		<p class="text-(--text-muted) text-sm">{WITHHELD_DESCRIPTION}</p>
	{:else}
		<p
			class="wrap-break-word whitespace-pre-wrap text-(--text-body) text-sm leading-6"
		>
			{text}
		</p>
	{/if}
{/snippet}

{#if alert}
	<Notice tone={alert.tone} title={alert.title} info={alert.info} />
{/if}
<DetailGrid label="Report">
	<DetailCell
		label="Category"
		value={ABUSE_REPORT_CATEGORY_LABEL[report.category]}
	/>
	<DetailCell
		label="Source"
		value={ABUSE_REPORTER_TYPE_LABEL[report.reporterType]}
	/>
	<DetailCell label="Restricted" value={report.restricted ? YES : NO} />
	<DetailCell label="Reporter" value={report.reporterName} />
	<DetailCell label="Reporter email" value={report.reporterEmail} />
</DetailGrid>
<DetailSection title="Reported content">
	<AdminDetailList label="Reported content">
		<KeyValueRow
			label="URL"
			value={report.withheld ? WITHHELD_LABEL : report.url}
			mono={!report.withheld}
			copy={report.withheld ? null : report.url}
			align="end"
		/>
		<KeyValueRow
			label="Hostname"
			value={report.withheld ? WITHHELD_LABEL : report.hostname}
			mono={!report.withheld}
			copy={report.withheld ? null : report.hostname}
			align="end"
		/>
		{#if report.decisionNote}
			<KeyValueRow
				label="Decision note"
				value={report.decisionNote}
				align="end"
			/>
		{/if}
	</AdminDetailList>
</DetailSection>
<DetailSection title="Description">
	{@render textBlock(report.description)}
</DetailSection>
{#if report.appealedAt}
	<DetailSection
		title="Appeal"
		info={`Appealed ${formatDateTime(report.appealedAt)}`}
	>
		{@render textBlock(report.appealText)}
	</DetailSection>
{/if}
{#if report.dmca}
	<DetailSection title="Notice">
		<AdminDetailList label="Notice">
			<KeyValueRow label="Type" value={DMCA_NOTICE_LABEL} align="end" />
			<KeyValueRow
				label="Copyrighted work"
				value={report.dmca.copyrightedWork}
				align="end"
			/>
			<KeyValueRow
				label="Infringing material"
				value={report.dmca.infringingMaterial}
				align="end"
			/>
			<KeyValueRow label="Address" value={report.dmca.address} align="end" />
			<KeyValueRow label="Telephone" value={report.dmca.phone} align="end" />
			<KeyValueRow
				label="Good faith belief"
				value={report.dmca.goodFaithBelief ? YES : NO}
				align="end"
			/>
			<KeyValueRow
				label="Accurate and authorized"
				value={report.dmca.accurateAndAuthorized ? YES : NO}
				align="end"
			/>
			<KeyValueRow
				label="Signature"
				value={report.dmca.signature}
				align="end"
			/>
		</AdminDetailList>
	</DetailSection>
{:else if report.ispComplaint}
	<DetailSection title="Notice">
		<AdminDetailList label="Notice">
			<KeyValueRow label="Type" value={ISP_NOTICE_LABEL} align="end" />
			<KeyValueRow
				label="Outcome"
				value={report.ispOutcome
					? ISP_COMPLAINT_OUTCOME_LABEL[report.ispOutcome]
					: null}
				align="end"
			/>
			<KeyValueRow
				label="Source address"
				value={report.ispComplaint.sourceAddress}
				mono
				copy={report.ispComplaint.sourceAddress}
				align="end"
			/>
			<KeyValueRow
				label="Destination"
				value={report.ispComplaint.destinationPort
					? `${report.ispComplaint.destinationAddress}:${report.ispComplaint.destinationPort}`
					: report.ispComplaint.destinationAddress}
				mono
				align="end"
			/>
			<KeyValueRow
				label="Protocol"
				value={report.ispComplaint.protocol.toUpperCase()}
				align="end"
			/>
			<KeyValueRow
				label="Observed from"
				value={formatDateTime(report.ispComplaint.observedFrom)}
				align="end"
			/>
			<KeyValueRow
				label="Observed until"
				value={formatDateTime(report.ispComplaint.observedUntil)}
				align="end"
			/>
		</AdminDetailList>
	</DetailSection>
{/if}
{#if report.counterNotice}
	<DetailSection title="Counter-notice" info={restorationInfo}>
		<AdminDetailList label="Counter-notice">
			<KeyValueRow
				label="State"
				value={COUNTER_NOTICE_STATE_LABEL[counterNotice](legal)}
				align="end"
			/>
			<KeyValueRow
				label="Received"
				value={formatOptionalDateTime(report.counterNoticeReceivedAt, NOT_YET)}
				align="end"
			/>
			<KeyValueRow
				label="Complainant copy sent"
				value={formatOptionalDateTime(report.counterNoticeForwardedAt, NOT_YET)}
				align="end"
			/>
			<KeyValueRow
				label="Restore after"
				value={formatOptionalDateTime(report.restoreAfter, NOT_YET)}
				align="end"
			/>
			<KeyValueRow
				label="Restore by"
				value={formatOptionalDateTime(report.restoreBy, NOT_YET)}
				align="end"
			/>
			<KeyValueRow
				label="Court action filed"
				value={formatOptionalDateTime(report.courtActionFiledAt, NOT_YET)}
				align="end"
			/>
			<KeyValueRow
				label="Restored"
				value={formatOptionalDateTime(report.restoredAt, NOT_YET)}
				align="end"
			/>
			<KeyValueRow
				label="Removed material"
				value={report.counterNotice.removedMaterial}
				align="end"
			/>
			<KeyValueRow
				label="Address"
				value={report.counterNotice.address}
				align="end"
			/>
			<KeyValueRow
				label="Telephone"
				value={report.counterNotice.phone}
				align="end"
			/>
			<KeyValueRow
				label="Signature"
				value={report.counterNotice.signature}
				align="end"
			/>
		</AdminDetailList>
	</DetailSection>
{/if}

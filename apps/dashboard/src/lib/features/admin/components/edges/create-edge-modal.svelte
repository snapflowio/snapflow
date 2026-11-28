<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { CreateEdgeResponseDto } from '@snapflow/api-client';
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation } from '@tanstack/svelte-query';
import { createEdgeMutationOptions } from '#lib/api/admin/edges.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import {
	CREATE_EDGE_DEFAULT_VALUES,
	createEdgeBody,
	createEdgeSchema,
	EDGE_PROTOCOL_OPTIONS,
} from '#lib/features/admin/lib/edge-form.ts';

interface CreateEdgeModalProps {
	open?: boolean;
	onCreated: (edge: CreateEdgeResponseDto) => void;
}

let { open = $bindable(false), onCreated }: CreateEdgeModalProps = $props();

const create = createMutation(() => createEdgeMutationOptions());
const form = createAppForm(() => ({
	defaultValues: CREATE_EDGE_DEFAULT_VALUES,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: createEdgeSchema },
	onSubmit: async ({ value }) => {
		let edge: CreateEdgeResponseDto;
		try {
			edge = await create.mutateAsync(createEdgeBody(value));
		} catch {
			return;
		}
		close();
		onCreated(edge);
	},
}));

function close() {
	open = false;
	form.reset();
}
</script>

<ChipModal
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) form.reset();
	}}
	onsubmit={formSubmitHandler(form)}
	srTitle="New edge"
	variant="sheet"
>
	<form.AppForm>
		<ChipModalHeader onClose={close}> New edge </ChipModalHeader>
		<ChipModalBody>
			<form.AppField name="name">
				{#snippet children(field)}
					<field.TextField label="Name" placeholder="titan" />
				{/snippet}
			</form.AppField>
			<form.AppField name="publicHost">
				{#snippet children(field)}
					<field.TextField
						label="Public host"
						placeholder="edge.snapflow.run"
						hint="Serves sandbox traffic and machine tunnels."
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="publicAddress">
				{#snippet children(field)}
					<field.TextField
						label="Public IP address"
						placeholder="203.0.113.10"
						monospace
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="tunnelPort">
				{#snippet children(field)}
					<field.TextField label="Tunnel port" inputmode="numeric" />
				{/snippet}
			</form.AppField>
			<form.AppField name="protocols">
				{#snippet children(field)}
					<field.MultiSelectField
						label="Protocols"
						options={EDGE_PROTOCOL_OPTIONS}
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="tcpPorts">
				{#snippet children(field)}
					<field.TextField
						label="TCP ports"
						placeholder="Optional, such as 20000-20099"
						hint="Ports this edge can give TCP exposures."
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="udpPorts">
				{#snippet children(field)}
					<field.TextField
						label="UDP ports"
						placeholder="Optional, such as 20000-20099"
						hint="Ports this edge can give UDP exposures."
					/>
				{/snippet}
			</form.AppField>
		</ChipModalBody>
		<ChipModalFooter onCancel={close}>
			{#snippet primaryAction()}
				<form.SubmitButton> Create </form.SubmitButton>
			{/snippet}
		</ChipModalFooter>
	</form.AppForm>
</ChipModal>

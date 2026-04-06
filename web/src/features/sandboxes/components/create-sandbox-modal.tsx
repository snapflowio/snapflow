import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';
import {
	Button,
	Input,
	Label,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from '@/components/ui';

const schema = z.object({
	name: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface CreateSandboxModalProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onCreateSandbox: (name: string) => Promise<void>;
	loading?: boolean;
	disabled?: boolean;
}

export function CreateSandboxModal({
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	onCreateSandbox,
	loading = false,
	disabled = false,
}: CreateSandboxModalProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;
	const setOpen = controlledOnOpenChange ?? setInternalOpen;

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { name: '' },
	});

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) {
			reset();
		}
	};

	const onSubmit = async (values: FormValues) => {
		await onCreateSandbox(values.name);
		setOpen(false);
		reset();
	};

	return (
		<Modal open={open} onOpenChange={handleOpenChange}>
			<ModalContent size="md">
				<ModalHeader>Create New Sandbox</ModalHeader>
				<ModalBody>
					<form
						id="create-bucket-form"
						className="flex flex-col gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="bucket-name">Sandbox Name</Label>
							<Input
								id="bucket-name"
								placeholder="my-bucket"
								disabled={disabled}
								{...register('name')}
							/>
							{errors.name && (
								<p className="text-[12px] text-text-error">
									{errors.name.message}
								</p>
							)}
						</div>
					</form>
				</ModalBody>
				<ModalFooter>
					<Button
						variant="default"
						onClick={() => setOpen(false)}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="create-bucket-form"
						disabled={loading || disabled}
					>
						{loading ? 'Creating...' : 'Create'}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

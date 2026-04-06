/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type Image,
	ImageState,
	type PaginatedImages,
} from '@snapflow/api-client';
import { ImageIcon, MoreVertical, Power, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/api/api-client';
import { CreateImageModal } from '@/features/images/components/create-image-modal';
import { Resource } from '@/components/resource/resource';
import type {
	ResourceColumn,
	ResourceRow,
} from '@/components/resource/resource-table';
import { timeCell } from '@/components/resource/time-cell';
import {
	Badge,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	toast,
} from '@/components/ui';
import { MAX_PAGE_SIZE } from '@/constants/pagination';
import { useRealtime } from '@/hooks/use-realtime';
import { useSelectedOrganization } from '@/hooks/use-selected-organization';
import { handleApiError } from '@/lib/errors';

const COLUMNS: ResourceColumn[] = [
	{ id: 'id', header: 'ID', widthMultiplier: 1.4 },
	{ id: 'state', header: 'State', widthMultiplier: 0.6 },
	{ id: 'name', header: 'Name' },
	{ id: 'imageName', header: 'Image', widthMultiplier: 1.2 },
	{ id: 'resources', header: 'Resources', widthMultiplier: 0.8 },
	{ id: 'created', header: 'Created', widthMultiplier: 0.7 },
];

const IMAGE_STATE_BADGE: Record<
	string,
	{ label: string; variant: 'green' | 'gray' | 'red' | 'amber' }
> = {
	[ImageState.ACTIVE]: { label: 'Active', variant: 'green' },
	[ImageState.INACTIVE]: { label: 'Inactive', variant: 'gray' },
	[ImageState.ERROR]: { label: 'Error', variant: 'red' },
	[ImageState.BUILD_FAILED]: { label: 'Build Failed', variant: 'red' },
	[ImageState.BUILDING]: { label: 'Building', variant: 'amber' },
	[ImageState.PENDING]: { label: 'Pending', variant: 'amber' },
	[ImageState.BUILD_PENDING]: { label: 'Build Pending', variant: 'amber' },
	[ImageState.PULLING]: { label: 'Pulling', variant: 'amber' },
	[ImageState.PENDING_VALIDATION]: { label: 'Validating', variant: 'amber' },
	[ImageState.VALIDATING]: { label: 'Validating', variant: 'amber' },
	[ImageState.REMOVING]: { label: 'Removing', variant: 'amber' },
};

export default function ImagesPage() {
	const { realtimeSocket } = useRealtime();
	const imageApi = apiClient.imageApi;
	const { selectedOrganization } = useSelectedOrganization();

	const [imagesData, setImagesData] = useState<PaginatedImages>({
		items: [],
		total: 0,
		page: 1,
		totalPages: 0,
	});
	const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>(
		{}
	);
	const [loadingTable, setLoadingTable] = useState(true);
	const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
	const [loadingCreate, setLoadingCreate] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	const fetchImages = useCallback(
		async (showTableLoadingState = true) => {
			if (!selectedOrganization) {
				return;
			}
			if (showTableLoadingState) {
				setLoadingTable(true);
			}
			try {
				const response = (
					await imageApi.listImages(selectedOrganization.id, 1, MAX_PAGE_SIZE)
				).data;
				setImagesData(response);
			} catch (error) {
				handleApiError(error, 'Failed to fetch images');
			} finally {
				setLoadingTable(false);
			}
		},
		[selectedOrganization]
	);

	useEffect(() => {
		fetchImages();
	}, [fetchImages]);

	useEffect(() => {
		const handleImageCreatedEvent = (image: Image) => {
			setImagesData((prev) => {
				if (prev.items.some((i) => i.id === image.id)) {
					return prev;
				}
				const insertIndex =
					prev.items.findIndex(
						(i) => !i.lastUsedAt && i.createdAt <= image.createdAt
					) || prev.items.length;
				const newImages = [...prev.items];
				newImages.splice(insertIndex, 0, image);
				const newTotal = prev.total + 1;
				return {
					...prev,
					items: newImages,
					total: newTotal,
					totalPages: prev.totalPages,
				};
			});
		};

		const handleImageStateUpdatedEvent = (data: {
			image: Image;
			oldState: ImageState;
			newState: ImageState;
		}) => {
			setImagesData((prev) => ({
				...prev,
				items: prev.items.map((i) => (i.id === data.image.id ? data.image : i)),
			}));
		};

		const handleImageEnabledToggledEvent = (image: Image) => {
			setImagesData((prev) => ({
				...prev,
				items: prev.items.map((i) => (i.id === image.id ? image : i)),
			}));
		};

		const handleImageRemovedEvent = (imageId: string) => {
			setImagesData((prev) => {
				const newTotal = Math.max(0, prev.total - 1);
				const newItems = prev.items.filter((i) => i.id !== imageId);
				return {
					...prev,
					items: newItems,
					total: newTotal,
					totalPages: prev.totalPages,
				};
			});
		};

		if (!realtimeSocket) {
			return undefined;
		}

		realtimeSocket.on('image.created', handleImageCreatedEvent);
		realtimeSocket.on('image.state.updated', handleImageStateUpdatedEvent);
		realtimeSocket.on('image.enabled.toggled', handleImageEnabledToggledEvent);
		realtimeSocket.on('image.removed', handleImageRemovedEvent);

		return () => {
			realtimeSocket.off('image.created', handleImageCreatedEvent);
			realtimeSocket.off('image.state.updated', handleImageStateUpdatedEvent);
			realtimeSocket.off(
				'image.enabled.toggled',
				handleImageEnabledToggledEvent
			);
			realtimeSocket.off('image.removed', handleImageRemovedEvent);
		};
	}, [realtimeSocket]);

	const handleCreateImage = async (data: {
		name: string;
		imageName: string;
		entrypoint?: string[];
		cpu?: number;
		memory?: number;
		disk?: number;
	}) => {
		setLoadingCreate(true);
		try {
			await imageApi.createImage(
				{
					name: data.name,
					imageName: data.imageName,
					entrypoint: data.entrypoint,
					cpu: data.cpu,
					memory: data.memory,
					disk: data.disk,
				},
				selectedOrganization?.id
			);
			toast.success(`Creating image ${data.name}`);
		} catch (error) {
			handleApiError(error, 'Failed to create image');
		} finally {
			setLoadingCreate(false);
		}
	};

	const handleDelete = async (image: Image) => {
		setLoadingImages((prev) => ({ ...prev, [image.id]: true }));
		setImagesData((prev) => ({
			...prev,
			items: prev.items.map((i) =>
				i.id === image.id ? { ...i, state: ImageState.REMOVING } : i
			),
		}));
		try {
			await imageApi.deleteImage(image.id, selectedOrganization?.id);
			setImageToDelete(null);
			toast.success(`Deleting image ${image.name}`);
		} catch (error) {
			handleApiError(error, 'Failed to delete image');
			setImagesData((prev) => ({
				...prev,
				items: prev.items.map((i) =>
					i.id === image.id ? { ...i, state: image.state } : i
				),
			}));
		} finally {
			setLoadingImages((prev) => ({ ...prev, [image.id]: false }));
		}
	};

	const handleActivate = useCallback(
		async (image: Image) => {
			setLoadingImages((prev) => ({ ...prev, [image.id]: true }));
			setImagesData((prev) => ({
				...prev,
				items: prev.items.map((i) =>
					i.id === image.id ? { ...i, state: ImageState.ACTIVE } : i
				),
			}));
			try {
				await imageApi.activateImage(image.id, selectedOrganization?.id);
				toast.success(`Activating image ${image.name}`);
			} catch (error) {
				handleApiError(error, 'Failed to activate image');
				setImagesData((prev) => ({
					...prev,
					items: prev.items.map((i) =>
						i.id === image.id ? { ...i, state: image.state } : i
					),
				}));
			} finally {
				setLoadingImages((prev) => ({ ...prev, [image.id]: false }));
			}
		},
		[selectedOrganization]
	);

	const filtered = useMemo(() => {
		if (!searchQuery) {
			return imagesData.items;
		}
		const q = searchQuery.toLowerCase();
		return imagesData.items.filter(
			(i) =>
				i.id?.toLowerCase().includes(q) ||
				i.name?.toLowerCase().includes(q) ||
				i.imageName?.toLowerCase().includes(q)
		);
	}, [imagesData.items, searchQuery]);

	const rows: ResourceRow[] = useMemo(
		() =>
			filtered.map((img) => ({
				id: img.id,
				className: img.general ? 'opacity-60' : undefined,
				cells: {
					id: {
						icon: <ImageIcon className="h-3.5 w-3.5" />,
						label: img.id,
					},
					state: {
						content: (() => {
							const cfg = IMAGE_STATE_BADGE[img.state] ?? {
								label: img.state ?? 'Unknown',
								variant: 'gray' as const,
							};
							return (
								<span className="flex items-center gap-1.5">
									<Badge variant={cfg.variant} size="sm">
										{cfg.label}
									</Badge>
									{img.general && (
										<Badge variant="blue" size="sm">
											System
										</Badge>
									)}
								</span>
							);
						})(),
					},
					name: { label: img.name },
					imageName: {
						content: (
							<span
								className="block max-w-full truncate font-mono text-[12px] text-text-secondary"
								title={img.imageName ?? ''}
							>
								{img.imageName || '\u2014'}
							</span>
						),
					},
					resources: {
						content: (
							<span className="flex flex-wrap items-center gap-1">
								{img.cpu ? (
									<Badge variant="gray-secondary" size="sm">
										{img.cpu} vCPU
									</Badge>
								) : null}
								{img.mem ? (
									<Badge variant="gray-secondary" size="sm">
										{img.mem >= 1024 ? `${img.mem / 1024} GB` : `${img.mem} MB`}
									</Badge>
								) : null}
								{img.disk ? (
									<Badge variant="gray-secondary" size="sm">
										{img.disk} GB
									</Badge>
								) : null}
								{img.gpu ? (
									<Badge variant="purple" size="sm">
										{img.gpu} GPU
									</Badge>
								) : null}
							</span>
						),
					},
					created: timeCell(img.createdAt),
				},
				sortValues: {
					created:
						(img.general ? 1e15 : 0) + -new Date(img.createdAt ?? 0).getTime(),
				},
			})),
		[filtered]
	);

	const rowActions = useCallback(
		(id: string) => {
			const img = imagesData.items.find((x) => x.id === id);
			if (!img || img.general) {
				return <span />;
			}
			const isInactive = img.state === ImageState.INACTIVE;
			const isTransitioning = (
				[
					ImageState.BUILDING,
					ImageState.PENDING,
					ImageState.BUILD_PENDING,
					ImageState.PULLING,
					ImageState.PENDING_VALIDATION,
					ImageState.VALIDATING,
					ImageState.REMOVING,
				] as string[]
			).includes(img.state);

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild={true}>
						<button
							type="button"
							className="flex h-6 w-6 items-center justify-center rounded text-text-icon transition-colors hover:bg-surface-active"
							onClick={(e) => e.stopPropagation()}
						>
							<MoreVertical className="h-3.5 w-3.5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" sideOffset={4}>
						{isInactive && (
							<DropdownMenuItem
								onClick={() => handleActivate(img)}
								disabled={loadingImages[id]}
							>
								<Power className="mr-2 h-3.5 w-3.5" /> Activate
							</DropdownMenuItem>
						)}
						{isInactive && <DropdownMenuSeparator />}
						<DropdownMenuItem
							onClick={() => setImageToDelete(img)}
							disabled={isTransitioning || loadingImages[id]}
						>
							<Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
		[imagesData.items, loadingImages, handleActivate]
	);

	const rowsWithActions: ResourceRow[] = useMemo(
		() =>
			rows.map((row) => ({
				...row,
				cells: {
					...row.cells,
					actions: { content: rowActions(row.id) },
				},
			})),
		[rows, rowActions]
	);

	const columnsWithActions: ResourceColumn[] = [
		...COLUMNS,
		{ id: 'actions', header: '', widthMultiplier: 0.3 },
	];

	return (
		<>
			<Resource
				icon={ImageIcon}
				title="Images"
				search={{
					value: searchQuery,
					onChange: setSearchQuery,
					placeholder: 'Search images...',
				}}
				create={{
					label: 'New image',
					onClick: () => setShowCreateDialog(true),
				}}
				defaultSort="created"
				columns={columnsWithActions}
				rows={rowsWithActions}
				isLoading={loadingTable}
				emptyMessage="No images found"
			/>

			<CreateImageModal
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				onCreateImage={handleCreateImage}
				loading={loadingCreate}
			/>

			<Modal
				open={!!imageToDelete}
				onOpenChange={(open) => {
					if (!open) {
						setImageToDelete(null);
					}
				}}
			>
				<ModalContent size="sm">
					<ModalHeader>Delete Image</ModalHeader>
					<ModalBody>
						<p className="font-season text-[14px] text-text-secondary">
							Are you sure you want to delete this image? This action cannot be
							undone.
						</p>
					</ModalBody>
					<ModalFooter>
						<button
							type="button"
							onClick={() => setImageToDelete(null)}
							className="rounded-[5px] border border-border-1 px-3 py-1.5 font-season text-[13px] text-text-body transition-colors hover:bg-surface-active"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => imageToDelete && handleDelete(imageToDelete)}
							disabled={!!imageToDelete && loadingImages[imageToDelete.id]}
							className="rounded-[5px] bg-red-500 px-3 py-1.5 font-season text-[13px] text-white transition-colors hover:bg-red-600 disabled:opacity-50"
						>
							{imageToDelete && loadingImages[imageToDelete.id]
								? 'Deleting...'
								: 'Delete'}
						</button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
}

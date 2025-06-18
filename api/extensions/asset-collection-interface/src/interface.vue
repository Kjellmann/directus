<template>
	<div class="asset-collection-interface">
		<!-- Header -->
		<div class="interface-header">
			<div class="header-actions">
				<v-icon
					v-tooltip.bottom="'Card Size'"
					class="size-selector"
					:name="`grid_${cardSize}`"
					clickable
					@click="toggleCardSize"
				/>
				<v-button :disabled="selectedAssets.length === 0" @click="removeSelectedAssets" secondary rounded icon>
					<v-icon name="delete" />
				</v-button>
			</div>
		</div>

		<!-- Loading State -->
		<div v-if="loading" class="loading-state">
			<v-progress-circular indeterminate />
		</div>

		<!-- Asset Groups by Family -->
		<div v-else class="asset-families-container">
			<div v-for="family in assetFamilies" :key="family.id" class="asset-family-section">
				<div class="family-header">
					<div class="family-info">
						<h4>{{ family.name }}</h4>
						<span class="asset-count">{{ getAssetsForFamily(family.id).length }} assets</span>
					</div>
					<v-button @click="openAssetDialog(family.id)" icon small rounded>
						<v-icon name="add" />
					</v-button>
				</div>

				<!-- Assets for this family -->
				<draggable
					v-if="familyAssets[family.id] && familyAssets[family.id].length > 0"
					v-model="familyAssets[family.id]"
					tag="div"
					class="cards-grid"
					:class="`size-${cardSize}`"
					:disabled="selectedAssets.length > 0"
					item-key="id"
					:animation="200"
					ghost-class="ghost"
					handle=".drag-handle"
					@change="handleDragChange($event, family.id)"
				>
					<template #item="{ element: asset }">
						<div class="card-wrapper">
							<div
								class="card"
								:class="{
									selected: isAssetSelectedForRemoval(asset.id),
									'select-mode': selectedAssets.length > 0,
								}"
								@click="handleCardClick(asset)"
							>
								<v-icon v-if="selectedAssets.length === 0" name="drag_indicator" class="drag-handle" @click.stop />
								<v-icon
									class="selector"
									:name="isAssetSelectedForRemoval(asset.id) ? 'check_circle' : 'radio_button_unchecked'"
									@click.stop="toggleAssetSelectionForRemoval(asset)"
								/>
								<div class="header">
									<div class="selection-fade"></div>
									<v-image
										v-if="asset.media_url && asset.family_code === 'product_images'"
										:src="asset.media_url"
										:alt="asset.label"
										class="image"
									/>
									<v-icon-file v-else-if="asset.family_code === 'product_videos'" :ext="getVideoFileExtension(asset)" />
									<v-icon-file
										v-else-if="asset.family_code === 'product_documents'"
										:ext="getDocumentFileExtension(asset)"
									/>
									<v-icon v-else :name="getFamilyIcon(asset.family_code || family.code)" large />
								</div>
								<div class="title">{{ asset.label || asset.code }}</div>
								<div v-if="asset.external_url" class="subtitle">
									<v-icon name="link" x-small />
									{{ getSourceName(asset.source_type) }}
								</div>
							</div>
						</div>
					</template>
				</draggable>

				<!-- Empty state for family -->
				<div v-else class="family-empty-state">
					<p>No {{ family.name.toLowerCase() }} added yet</p>
				</div>
			</div>
		</div>

		<!-- Asset Selection Dialog -->
		<v-dialog v-model="showAssetDialog" max-width="600px">
			<v-card class="allow-drawer">
				<v-card-title>Add {{ selectedFamilyName }}</v-card-title>
				<v-card-text>
					<div class="asset-upload-section">
						<!-- Video Source Selection (for videos only) -->
						<div v-if="selectedFamilyCode === 'product_videos'" class="video-source-radio">
							<div class="radio-group">
								<v-radio v-model="videoSourceType" value="file" label="Upload Video File" />
								<v-radio v-model="videoSourceType" value="url" label="External Video URL" />
							</div>

							<!-- Upload Component (when file is selected) -->
							<v-upload
								v-if="videoSourceType === 'file'"
								multiple
								from-user
								from-library
								from-url
								:folder="selectedFamilyFolder"
								@input="handleUploadedFiles"
							/>

							<!-- External URL Input (when url is selected) -->
							<div v-else-if="videoSourceType === 'url'" class="external-url-section">
								<v-select
									v-model="externalVideoSource"
									:items="videoSourceOptions"
									placeholder="Select video provider"
								/>

								<v-input v-model="externalVideoUrl" :placeholder="getVideoUrlPlaceholder" @input="handleExternalUrl" />

								<v-button @click="addExternalVideo" :disabled="!externalVideoUrl || !externalVideoSource" block>
									<v-icon name="add" left />
									Add Video URL
								</v-button>
							</div>
						</div>

						<!-- Upload Component (for non-videos) -->
						<v-upload
							v-else
							multiple
							from-user
							from-library
							from-url
							:folder="selectedFamilyFolder"
							@input="handleUploadedFiles"
						/>

						<!-- Existing Assets Selection -->
						<div class="existing-assets-section">
							<v-divider />
							<h4>Or select from existing assets:</h4>
							<div v-if="availableAssets.length > 0" class="available-assets-grid">
								<div
									v-for="asset in availableAssets"
									:key="asset.id"
									class="available-asset-card"
									:class="{ selected: isAssetSelected(asset.id) }"
									@click="toggleAssetSelection(asset)"
								>
									<div class="asset-preview-small">
										<v-image
											v-if="asset.media_url && selectedFamilyCode === 'product_images'"
											:src="asset.media_url"
											:alt="asset.label"
										/>
										<v-icon v-else :name="getFamilyIcon(selectedFamilyCode)" />
									</div>
									<div class="asset-info-small">
										<div class="asset-label-small">{{ asset.label || asset.code }}</div>
									</div>
									<v-icon v-if="isAssetSelected(asset.id)" name="check_circle" class="selected-icon" />
								</div>
							</div>
							<div v-else class="no-available-assets">
								<p>No existing assets available for this family</p>
							</div>
						</div>

						<!-- Pending Files -->
						<div v-if="pendingFiles.length > 0" class="pending-files">
							<h4>Files to process:</h4>
							<div class="file-list">
								<div v-for="(file, index) in pendingFiles" :key="index" class="file-item">
									<div class="file-preview">
										<img
											v-if="getFilePreview(file)"
											:src="getFilePreview(file)"
											:alt="file.name || file.filename_download"
										/>
										<v-icon v-else :name="getFileIcon(file)" />
									</div>
									<span class="file-name">{{ file.name || file.filename_download || 'File' }}</span>
									<v-button @click="removePendingFile(index)" secondary rounded icon x-small>
										<v-icon name="close" />
									</v-button>
								</div>
							</div>
						</div>
					</div>
				</v-card-text>
				<v-card-actions>
					<v-button @click="closeAssetDialog" secondary>Cancel</v-button>
					<v-button
						@click="processUploadedFiles"
						:disabled="!selectedFamily || (pendingFiles.length === 0 && selectedExistingAssets.length === 0)"
						:loading="processing"
					>
						Add {{ pendingFiles.length + selectedExistingAssets.length }} Asset{{
							pendingFiles.length + selectedExistingAssets.length !== 1 ? 's' : ''
						}}
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Remove Confirmation Dialog -->
		<v-dialog v-model="showRemoveConfirm" max-width="400px">
			<v-card>
				<v-card-title>Remove Asset</v-card-title>
				<v-card-text>
					<p>Are you sure you want to remove this asset from the product?</p>
					<p v-if="assetToRemove" class="asset-details">
						<strong>{{ assetToRemove.label || assetToRemove.code }}</strong>
						<br />
						<small>{{ assetToRemove.family_name }}</small>
					</p>
				</v-card-text>
				<v-card-actions>
					<v-button @click="cancelRemoveAsset" secondary>Cancel</v-button>
					<v-button @click="confirmRemoveAsset" kind="danger">Remove Asset</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Bulk Remove Confirmation Dialog -->
		<v-dialog v-model="showBulkRemoveConfirm" max-width="400px">
			<v-card>
				<v-card-title>Remove Selected Assets</v-card-title>
				<v-card-text>
					<p>
						Are you sure you want to remove {{ selectedAssets.length }} selected asset{{
							selectedAssets.length > 1 ? 's' : ''
						}}?
					</p>
					<p class="asset-details">
						<small>This will remove the assets from this product but will not delete them from the system.</small>
					</p>
				</v-card-text>
				<v-card-actions>
					<v-button @click="cancelBulkRemoveAssets" secondary>Cancel</v-button>
					<v-button @click="confirmBulkRemoveAssets" kind="danger">
						Remove {{ selectedAssets.length }} Asset{{ selectedAssets.length > 1 ? 's' : '' }}
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Edit Asset Drawer -->
		<v-drawer
			v-model="showEditDrawer"
			:title="editingAsset ? `Edit: ${editingAsset.label || editingAsset.code}` : ''"
			icon="edit"
			@cancel="closeEditDrawer"
		>
			<template #actions>
				<v-button @click="saveAsset" :loading="saving">Save</v-button>
			</template>

			<div class="drawer-content" v-if="editingAsset">
				<div class="edit-form">
					<v-input v-model="editingAsset.label" label="Label" placeholder="Enter asset label" />

					<v-input v-model="editingAsset.code" label="Code" placeholder="Enter asset code" disabled />

					<!-- Video URL editing for video assets -->
					<template v-if="editingAsset.family_code === 'product_videos' && editingAsset.source_type !== 'directus'">
						<div class="field-wrapper">
							<div class="field-label">Video Source</div>
							<v-select
								v-model="editingAsset.source_type"
								:items="videoSourceOptions"
								placeholder="Select video source"
							/>
						</div>

						<v-input
							v-model="editingAsset.external_url"
							label="Video URL"
							:placeholder="getVideoUrlPlaceholderForEdit"
						/>
					</template>

					<div class="asset-preview-edit">
						<v-image
							v-if="editingAsset.media_url && editingAsset.family_code === 'product_images'"
							:src="editingAsset.media_url"
							:alt="editingAsset.label"
						/>
						<div v-else-if="editingAsset.family_code === 'product_videos'" class="video-preview">
							<v-icon name="videocam" large />
							<p v-if="editingAsset.external_url" class="video-url">{{ editingAsset.external_url }}</p>
						</div>
						<div v-else-if="editingAsset.family_code === 'product_documents'" class="document-preview">
							<v-icon :name="getDocumentIcon(editingAsset)" large />
							<p class="document-name">{{ editingAsset.label || editingAsset.code }}</p>
						</div>
						<div v-else class="generic-preview">
							<v-icon name="attach_file" large />
						</div>
					</div>

					<v-input
						:model-value="editingAsset.family_name || ''"
						label="Asset Family"
						placeholder="Asset Family"
						disabled
					/>
				</div>
			</div>
		</v-drawer>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import Draggable from 'vuedraggable';

export interface Asset {
	id: string;
	code: string;
	label: string;
	media_file?: string;
	external_url?: string;
	source_type?: string;
	media_url?: string;
	asset_family: string;
	family_name?: string;
	family_code?: string;
	_junction_id?: string;
	sort?: number;
}

export interface AssetFamily {
	id: string;
	code: string;
	name: string;
	folder?: string;
}

export default defineComponent({
	components: {
		Draggable,
	},
	props: {
		value: {
			type: Array,
			default: () => [],
		},
		primaryKey: {
			type: String,
			required: true,
		},
		collection: {
			type: String,
			required: true,
		},
	},
	emits: ['input'],
	setup(props) {
		const api = useApi();

		// State
		const loading = ref(false);
		const assets = ref<Asset[]>([]);
		const assetFamilies = ref<AssetFamily[]>([]);

		// Dialog state
		const showAssetDialog = ref(false);
		const selectedFamily = ref<string | null>(null);
		const pendingFiles = ref<any[]>([]);
		const processing = ref(false);
		const videoSourceType = ref<'file' | 'url'>('file');
		const externalVideoSource = ref<string>('');
		const externalVideoUrl = ref<string>('');
		const availableAssets = ref<Asset[]>([]);
		const selectedExistingAssets = ref<string[]>([]);

		// Edit state
		const showEditDrawer = ref(false);
		const editingAsset = ref<Asset | null>(null);
		const saving = ref(false);

		// Computed
		const existingAssetIds = computed(() => assets.value.map((a) => a.id));

		// Create reactive family assets for draggable
		const familyAssets = ref<Record<string, Asset[]>>({});

		const selectedFamilyName = computed(() => {
			if (!selectedFamily.value) return 'Assets';
			const family = assetFamilies.value.find((f) => f.id === selectedFamily.value);
			return family?.name || 'Assets';
		});

		const selectedFamilyCode = computed(() => {
			if (!selectedFamily.value) return '';
			const family = assetFamilies.value.find((f) => f.id === selectedFamily.value);
			return family?.code || '';
		});

		const selectedFamilyFolder = computed(() => {
			if (!selectedFamily.value) return undefined;
			const family = assetFamilies.value.find((f) => f.id === selectedFamily.value);
			return family?.folder || undefined;
		});

		const videoSourceOptions = [
			{ text: 'YouTube', value: 'youtube' },
			{ text: 'Vimeo', value: 'vimeo' },
			{ text: 'Bunny CDN', value: 'bunny' },
			{ text: 'Cloudinary', value: 'cloudinary' },
			{ text: 'Other URL', value: 'other' },
		];

		const getVideoUrlPlaceholder = computed(() => {
			switch (externalVideoSource.value) {
				case 'youtube':
					return 'https://www.youtube.com/watch?v=VIDEO_ID';
				case 'vimeo':
					return 'https://vimeo.com/VIDEO_ID';
				case 'bunny':
					return 'https://yourzone.b-cdn.net/video.mp4';
				case 'cloudinary':
					return 'https://res.cloudinary.com/CLOUD/video/upload/ID.mp4';
				default:
					return 'https://example.com/video.mp4';
			}
		});

		const getVideoUrlPlaceholderForEdit = computed(() => {
			if (!editingAsset.value) return '';
			switch (editingAsset.value.source_type) {
				case 'youtube':
					return 'https://www.youtube.com/watch?v=VIDEO_ID';
				case 'vimeo':
					return 'https://vimeo.com/VIDEO_ID';
				case 'bunny':
					return 'https://yourzone.b-cdn.net/video.mp4';
				case 'cloudinary':
					return 'https://res.cloudinary.com/CLOUD/video/upload/ID.mp4';
				default:
					return 'https://example.com/video.mp4';
			}
		});

		// Load asset families
		const loadAssetFamilies = async () => {
			try {
				const response = await api.get('/items/asset_families', {
					params: {
						fields: ['id', 'code', 'name', 'folder'],
						sort: ['name'],
					},
				});
				assetFamilies.value = response.data.data;
			} catch (error) {
				console.error('Error loading asset families:', error);
			}
		};

		// Update family assets when assets change
		watch(
			[assets, assetFamilies],
			([newAssets, families]) => {
				const grouped: Record<string, Asset[]> = {};
				families.forEach((family) => {
					grouped[family.id] = newAssets.filter((a) => a.asset_family === family.id);
				});
				familyAssets.value = grouped;
			},
			{ deep: true, immediate: true },
		);

		// Watch family assets for changes and update main assets array
		watch(
			familyAssets,
			(newFamilyAssets) => {
				const allAssets: Asset[] = [];
				Object.values(newFamilyAssets).forEach((familyAssetList) => {
					allAssets.push(...familyAssetList);
				});
				// Only update if actually different to prevent loops
				if (JSON.stringify(allAssets) !== JSON.stringify(assets.value)) {
					assets.value = allAssets;
				}
			},
			{ deep: true },
		);

		// Load assets for this item

		const loadAssets = async () => {
			if (!props.primaryKey || props.primaryKey === '+') return;

			loading.value = true;
			try {
				const response = await api.get('/items/product_assets', {
					params: {
						filter: {
							[`${props.collection}_id`]: props.primaryKey,
						},
						fields: [
							'id',
							'sort',
							'assets_id.id',
							'assets_id.code',
							'assets_id.label',
							'assets_id.media_file',
							'assets_id.external_url',
							'assets_id.source_type',
							'assets_id.asset_family.id',
							'assets_id.asset_family.name',
							'assets_id.asset_family.code',
						],
						sort: ['sort'],
					},
				});

				assets.value = response.data.data.map((pa: any) => {
					const asset = pa.assets_id;
					let mediaUrl = null;

					// Determine media URL based on source
					if (asset.external_url) {
						mediaUrl = asset.external_url;
					} else if (asset.media_file) {
						// For images, use thumbnail
						if (asset.asset_family?.code === 'product_images') {
							mediaUrl = `/assets/${asset.media_file}?width=300&height=300&fit=cover`;
						} else if (asset.asset_family?.code === 'product_videos') {
							// For videos, use direct link to play in HTML5 video element
							mediaUrl = `/assets/${asset.media_file}`;
						} else {
							// For other files, just link to the file
							mediaUrl = `/assets/${asset.media_file}`;
						}
					}

					const mappedAsset = {
						id: asset.id,
						code: asset.code || '',
						label: asset.label || '',
						media_file: asset.media_file,
						external_url: asset.external_url,
						source_type: asset.source_type || 'directus',
						media_url: mediaUrl,
						asset_family: asset.asset_family?.id,
						family_name: asset.asset_family?.name,
						family_code: asset.asset_family?.code,
						_junction_id: pa.id,
					};

					return mappedAsset;
				});
			} catch (error) {
				console.error('Error loading assets:', error);
			} finally {
				loading.value = false;
			}
		};

		// Helper methods
		const getAssetsForFamily = (familyId: string) => {
			return assets.value.filter((asset) => asset.asset_family === familyId);
		};

		const getFamilyIcon = (familyCode: string) => {
			switch (familyCode) {
				case 'product_images':
					return 'image';
				case 'product_videos':
					return 'videocam';
				case 'product_documents':
					return 'description';
				default:
					return 'attach_file';
			}
		};

		// Dialog methods
		const openAssetDialog = async (familyId: string) => {
			showAssetDialog.value = true;
			selectedFamily.value = familyId;
			pendingFiles.value = [];
			videoSourceType.value = 'file';
			externalVideoSource.value = '';
			externalVideoUrl.value = '';
			selectedExistingAssets.value = [];

			// Load available assets for this family
			await loadAvailableAssets(familyId);
		};

		// Load available assets for selection
		const loadAvailableAssets = async (familyId: string) => {
			try {
				const response = await api.get('/items/assets', {
					params: {
						filter: {
							asset_family: { _eq: familyId },
							id: { _nin: existingAssetIds.value },
						},
						fields: ['id', 'code', 'label', 'media_file', 'external_url'],
						sort: ['-date_created'],
						limit: 20,
					},
				});

				availableAssets.value = response.data.data.map((asset: any) => {
					let mediaUrl = null;
					if (asset.media_file) {
						mediaUrl = `/assets/${asset.media_file}?width=100&height=100&fit=cover`;
					}
					return {
						...asset,
						media_url: mediaUrl,
					};
				});
			} catch (error) {
				console.error('Error loading available assets:', error);
				availableAssets.value = [];
			}
		};

		const isAssetSelected = (assetId: string) => {
			return selectedExistingAssets.value.includes(assetId);
		};

		const toggleAssetSelection = (asset: Asset) => {
			const index = selectedExistingAssets.value.indexOf(asset.id);
			if (index > -1) {
				selectedExistingAssets.value.splice(index, 1);
			} else {
				selectedExistingAssets.value.push(asset.id);
			}
		};

		const closeAssetDialog = () => {
			showAssetDialog.value = false;
			selectedFamily.value = null;
			pendingFiles.value = [];
			availableAssets.value = [];
			selectedExistingAssets.value = [];
		};

		// Handle files from v-upload
		const handleUploadedFiles = (files: any) => {
			// v-upload can return various formats
			if (!files) return;

			const fileArray = Array.isArray(files) ? files : [files];

			fileArray.forEach((file: any) => {
				// Check if it's already in pending files
				const exists = pendingFiles.value.some(
					(f) => (f.id && f.id === file.id) || (f.name && file.name && f.name === file.name),
				);

				if (!exists) {
					pendingFiles.value.push(file);
				}
			});
		};

		const removePendingFile = (index: number) => {
			pendingFiles.value.splice(index, 1);
		};

		const handleExternalUrl = () => {
			// Optional: Add URL validation here
		};

		const addExternalVideo = () => {
			if (!externalVideoUrl.value || !externalVideoSource.value) return;

			// Add external video to pending files
			pendingFiles.value.push({
				external_url: externalVideoUrl.value,
				source_type: externalVideoSource.value,
				name: externalVideoUrl.value.split('/').pop() || 'External Video',
				type: 'video/external',
			});

			// Clear inputs
			externalVideoUrl.value = '';
		};

		const getFileIcon = (file: any) => {
			const type = file.type || file.mime_type || '';
			const name = file.name || file.filename_download || '';

			// Check by MIME type
			if (type.includes('image')) return 'image';
			if (type.includes('video')) return 'videocam';
			if (type.includes('pdf')) return 'picture_as_pdf';
			if (type.includes('word') || type.includes('document')) return 'description';
			if (type.includes('excel') || type.includes('spreadsheet')) return 'table_chart';
			if (type.includes('powerpoint') || type.includes('presentation')) return 'slideshow';
			if (type.includes('zip') || type.includes('compressed')) return 'folder_zip';
			if (type.includes('text')) return 'text_snippet';

			// Check by extension if no MIME type
			const ext = name.split('.').pop()?.toLowerCase();
			if (ext) {
				if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
				if (['mp4', 'avi', 'mov', 'wmv', 'webm'].includes(ext)) return 'videocam';
				if (ext === 'pdf') return 'picture_as_pdf';
				if (['doc', 'docx'].includes(ext)) return 'description';
				if (['xls', 'xlsx'].includes(ext)) return 'table_chart';
				if (['ppt', 'pptx'].includes(ext)) return 'slideshow';
				if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'folder_zip';
				if (['txt', 'md'].includes(ext)) return 'text_snippet';
			}

			return 'attach_file';
		};

		const getFilePreview = (file: any): string | undefined => {
			// For files from library (have an id)
			if (file.id) {
				const type = file.type || '';
				if (type.includes('image')) {
					return `/assets/${file.id}?width=40&height=40&fit=cover`;
				}
				return undefined;
			}

			// For raw File objects
			if (file instanceof File && file.type.startsWith('image/')) {
				// Create object URL for preview
				return URL.createObjectURL(file);
			}

			return undefined;
		};

		const getDocumentIcon = (asset: Asset) => {
			if (!asset.media_file) return 'description';

			// Get file extension from media_file path
			const ext = asset.media_file.split('.').pop()?.toLowerCase();

			switch (ext) {
				case 'pdf':
					return 'picture_as_pdf';
				case 'doc':
				case 'docx':
					return 'description';
				case 'xls':
				case 'xlsx':
					return 'table_chart';
				case 'ppt':
				case 'pptx':
					return 'slideshow';
				case 'zip':
				case 'rar':
					return 'folder_zip';
				default:
					return 'description';
			}
		};

		const getSourceName = (sourceType: string | undefined) => {
			switch (sourceType) {
				case 'youtube':
					return 'YouTube';
				case 'vimeo':
					return 'Vimeo';
				case 'bunny':
					return 'Bunny CDN';
				case 'cloudinary':
					return 'Cloudinary';
				case 'other':
					return 'External URL';
				default:
					return 'External';
			}
		};

		const getFileType = (asset: Asset) => {
			// Determine file type based on family code and file extension
			if (asset.family_code === 'product_images') {
				return 'image/jpeg'; // Default for images
			}

			if (asset.family_code === 'product_videos') {
				if (asset.external_url) {
					return 'video/mp4'; // Default for external videos
				}
				return 'video/mp4';
			}

			if (asset.family_code === 'product_documents') {
				if (asset.media_file) {
					const ext = asset.media_file.split('.').pop()?.toLowerCase();
					switch (ext) {
						case 'pdf':
							return 'application/pdf';
						case 'doc':
						case 'docx':
							return 'application/msword';
						case 'xls':
						case 'xlsx':
							return 'application/vnd.ms-excel';
						case 'ppt':
						case 'pptx':
							return 'application/vnd.ms-powerpoint';
						default:
							return 'application/octet-stream';
					}
				}
			}

			return 'application/octet-stream'; // Default fallback
		};

		const generateCode = (filename: string) => {
			return filename
				.replace(/\.[^/.]+$/, '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '_')
				.replace(/_+/g, '_')
				.replace(/^_|_$/g, '');
		};

		// Process uploaded files and create assets
		const processUploadedFiles = async () => {
			if (!props.primaryKey || props.primaryKey === '+') {
				console.warn('Cannot add assets to unsaved item');
				return;
			}

			if (!selectedFamily.value) {
				console.error('Please select an asset family');
				return;
			}

			processing.value = true;
			const newJunctionRecords = [];

			try {
				for (const file of pendingFiles.value) {
					let assetId: string;
					let assetData: any;

					// Check if it's an external URL
					if (file.external_url) {
						// First check if this URL already exists
						try {
							const existingCheck = await api.get('/items/assets', {
								params: {
									filter: {
										external_url: { _eq: file.external_url },
										asset_family: { _eq: selectedFamily.value },
									},
									limit: 1,
									fields: ['*', 'asset_family.*'],
								},
							});

							if (existingCheck.data.data.length > 0) {
								// Asset already exists, use it
								assetData = existingCheck.data.data[0];
								assetId = assetData.id;
							} else {
								// Create new asset with external URL
								const newAssetData: any = {
									code: generateCode(file.name || 'external-video') + '_' + Date.now(),
									label: file.name || 'External Video',
									external_url: file.external_url,
									source_type: file.source_type,
									asset_family: selectedFamily.value,
								};

								// Ensure media_file is not sent in the request
								delete newAssetData.media_file;

								const assetResponse = await api.post('/items/assets', newAssetData);
								assetId = assetResponse.data.data.id;

								// Fetch the full asset data
								const fullAssetResponse = await api.get(`/items/assets/${assetId}`, {
									params: {
										fields: ['*', 'asset_family.*'],
									},
								});
								assetData = fullAssetResponse.data.data;
							}
						} catch (error) {
							console.error('Error checking/creating external URL asset:', error);
							continue;
						}
					} else if (file.id) {
						// File from library - check if asset already exists
						try {
							const existingCheck = await api.get('/items/assets', {
								params: {
									filter: {
										media_file: { _eq: file.id },
										asset_family: { _eq: selectedFamily.value },
									},
									limit: 1,
									fields: ['*', 'asset_family.*'],
								},
							});

							if (existingCheck.data.data.length > 0) {
								// Asset already exists, use it
								assetData = existingCheck.data.data[0];
								assetId = assetData.id;
							} else {
								// Create new asset
								const newAssetData = {
									code: generateCode(file.filename_download || file.title || 'asset') + '_' + Date.now(),
									label: file.title || file.filename_download || 'Asset',
									media_file: file.id,
									asset_family: selectedFamily.value,
								};

								const assetResponse = await api.post('/items/assets', newAssetData);
								assetId = assetResponse.data.data.id;

								// Fetch the full asset data
								const fullAssetResponse = await api.get(`/items/assets/${assetId}`, {
									params: {
										fields: ['*', 'asset_family.*'],
									},
								});
								assetData = fullAssetResponse.data.data;
							}
						} catch (error) {
							console.error('Error checking/creating asset from library:', error);
							continue;
						}
					} else if (file instanceof File) {
						// Raw file - upload first
						const formData = new FormData();
						formData.append('file', file);

						// Add folder if the selected family has one
						const family = assetFamilies.value.find((f) => f.id === selectedFamily.value);
						if (family?.folder) {
							formData.append('folder', family.folder);
						}

						const fileResponse = await api.post('/files', formData);
						const fileId = fileResponse.data.data.id;

						// Create asset
						const newAssetData = {
							code: generateCode(file.name) + '_' + Date.now(),
							label: file.name.replace(/\.[^/.]+$/, ''),
							media_file: fileId,
							asset_family: selectedFamily.value,
						};

						const assetResponse = await api.post('/items/assets', newAssetData);
						assetId = assetResponse.data.data.id;

						// Fetch the full asset data
						const fullAssetResponse = await api.get(`/items/assets/${assetId}`, {
							params: {
								fields: ['*', 'asset_family.*'],
							},
						});
						assetData = fullAssetResponse.data.data;
					} else {
						console.error('Unknown file type:', file);
						continue;
					}

					// Create junction record
					const junctionResponse = await api.post('/items/product_assets', {
						[`${props.collection}_id`]: props.primaryKey,
						assets_id: assetId,
						sort: assets.value.length + newJunctionRecords.length,
					});

					// Create the asset object to add to local state
					const newAsset: Asset = {
						id: assetData.id,
						code: assetData.code || '',
						label: assetData.label || '',
						media_file: assetData.media_file,
						external_url: assetData.external_url,
						source_type: assetData.source_type || 'directus',
						media_url:
							assetData.external_url ||
							(assetData.media_file ? `/assets/${assetData.media_file}?width=300&height=300&fit=cover` : null),
						asset_family: assetData.asset_family?.id || assetData.asset_family,
						family_name: assetData.asset_family?.name,
						family_code: assetData.asset_family?.code,
						_junction_id: junctionResponse.data.data.id,
					};

					newJunctionRecords.push(newAsset);
				}

				// Process selected existing assets
				for (const assetId of selectedExistingAssets.value) {
					// Get the asset data
					const assetResponse = await api.get(`/items/assets/${assetId}`, {
						params: {
							fields: ['*', 'asset_family.*'],
						},
					});
					const assetData = assetResponse.data.data;

					// Create junction record
					const junctionResponse = await api.post('/items/product_assets', {
						[`${props.collection}_id`]: props.primaryKey,
						assets_id: assetId,
						sort: assets.value.length + newJunctionRecords.length,
					});

					// Create the asset object to add to local state
					const newAsset: Asset = {
						id: assetData.id,
						code: assetData.code || '',
						label: assetData.label || '',
						media_file: assetData.media_file,
						external_url: assetData.external_url,
						source_type: assetData.source_type || 'directus',
						media_url:
							assetData.external_url ||
							(assetData.media_file ? `/assets/${assetData.media_file}?width=300&height=300&fit=cover` : null),
						asset_family: assetData.asset_family?.id || assetData.asset_family,
						family_name: assetData.asset_family?.name,
						family_code: assetData.asset_family?.code,
						_junction_id: junctionResponse.data.data.id,
					};

					newJunctionRecords.push(newAsset);
				}

				// Update local state with new assets
				assets.value = [...assets.value, ...newJunctionRecords];

				// Close dialog
				closeAssetDialog();
			} catch (error) {
				console.error('Error processing files:', error);
			} finally {
				processing.value = false;
			}
		};

		// Edit asset
		const editAsset = (asset: Asset) => {
			editingAsset.value = { ...asset };
			showEditDrawer.value = true;
		};

		const closeEditDrawer = () => {
			showEditDrawer.value = false;
			editingAsset.value = null;
		};

		const saveAsset = async () => {
			if (!editingAsset.value) return;

			saving.value = true;
			try {
				// Prepare update data
				const updateData: any = {
					label: editingAsset.value.label,
				};

				// Include video URL fields if it's a video asset with external URL
				if (editingAsset.value.family_code === 'product_videos' && editingAsset.value.source_type !== 'directus') {
					updateData.source_type = editingAsset.value.source_type;
					updateData.external_url = editingAsset.value.external_url;
				}

				// Update asset
				await api.patch(`/items/assets/${editingAsset.value.id}`, updateData);

				// Update local state
				const index = assets.value.findIndex((a) => a.id === editingAsset.value!.id);
				if (index > -1) {
					assets.value[index] = { ...editingAsset.value };
				}

				closeEditDrawer();
			} catch (error) {
				console.error('Error saving asset:', error);
			} finally {
				saving.value = false;
			}
		};

		// Confirm removal state
		const showRemoveConfirm = ref(false);
		const assetToRemove = ref<Asset | null>(null);
		const showBulkRemoveConfirm = ref(false);

		// Multi-selection state
		const selectedAssets = ref<string[]>([]);

		// Card size state (2-5, where 2 is largest, 5 is smallest)
		let initialCardSize = 2;
		try {
			const saved = localStorage.getItem('asset-collection-card-size');
			if (saved && !isNaN(parseInt(saved))) {
				initialCardSize = parseInt(saved);
			}
		} catch (e) {
			// If localStorage fails, just use default
		}
		const cardSize = ref(initialCardSize);

		// Toggle card size
		const toggleCardSize = () => {
			if (cardSize.value >= 2 && cardSize.value < 5) {
				cardSize.value++;
			} else {
				cardSize.value = 2;
			}
			try {
				localStorage.setItem('asset-collection-card-size', cardSize.value.toString());
			} catch (e) {
				// If localStorage fails, continue without saving
			}
		};

		// Handle card click - either select, open file or edit
		const handleCardClick = (asset: Asset) => {
			if (selectedAssets.value.length > 0) {
				toggleAssetSelectionForRemoval(asset);
			} else if (asset.media_file && !asset.external_url) {
				// Open Directus file in new tab
				window.open(`/admin/files/${asset.media_file}`, '_blank');
			} else if (asset.external_url) {
				// Open external URL in new tab
				window.open(asset.external_url, '_blank');
			} else {
				editAsset(asset);
			}
		};

		// Check if asset is selected for removal
		const isAssetSelectedForRemoval = (assetId: string) => {
			return selectedAssets.value.includes(assetId);
		};

		// Toggle asset selection for removal (different from dialog selection)
		const toggleAssetSelectionForRemoval = (asset: Asset) => {
			const index = selectedAssets.value.indexOf(asset.id);
			if (index > -1) {
				selectedAssets.value.splice(index, 1);
			} else {
				selectedAssets.value.push(asset.id);
			}
		};

		// Remove selected assets - show confirmation dialog
		const removeSelectedAssets = () => {
			if (selectedAssets.value.length === 0) return;
			showBulkRemoveConfirm.value = true;
		};

		// Confirm bulk removal
		const confirmBulkRemoveAssets = async () => {
			if (selectedAssets.value.length === 0) return;

			try {
				// Find all junction records for selected assets
				const junctionIds = assets.value
					.filter((asset) => selectedAssets.value.includes(asset.id))
					.map((asset) => asset._junction_id)
					.filter((id) => id);

				// Delete all junction records
				for (const junctionId of junctionIds) {
					await api.delete(`/items/product_assets/${junctionId}`);
				}

				// Remove from local state
				assets.value = assets.value.filter((asset) => !selectedAssets.value.includes(asset.id));

				// Clear selection
				selectedAssets.value = [];
				showBulkRemoveConfirm.value = false;
			} catch (error) {
				console.error('Error removing selected assets:', error);
			}
		};

		// Cancel bulk removal
		const cancelBulkRemoveAssets = () => {
			showBulkRemoveConfirm.value = false;
		};

		// Remove asset
		const removeAsset = async (asset: Asset) => {
			assetToRemove.value = asset;
			showRemoveConfirm.value = true;
		};

		const confirmRemoveAsset = async () => {
			if (!assetToRemove.value || !assetToRemove.value._junction_id) return;

			try {
				await api.delete(`/items/product_assets/${assetToRemove.value._junction_id}`);
				const index = assets.value.findIndex((a) => a.id === assetToRemove.value!.id);
				if (index > -1) {
					assets.value.splice(index, 1);
				}
				showRemoveConfirm.value = false;
				assetToRemove.value = null;
			} catch (error) {
				console.error('Error removing asset:', error);
			}
		};

		const cancelRemoveAsset = () => {
			showRemoveConfirm.value = false;
			assetToRemove.value = null;
		};

		// Helper function to get video file extension
		const getVideoFileExtension = (asset: Asset): string => {
			if (asset.media_file) {
				// Extract just the extension from the filename
				const parts = asset.media_file.split('.');
				if (parts.length > 1) {
					const ext = parts[parts.length - 1].toLowerCase();
					return ext;
				}
			}
			// For external URLs, try to detect from URL or default to mp4
			if (asset.external_url) {
				if (asset.source_type === 'youtube' || asset.source_type === 'vimeo') {
					return 'stream';
				}
				const urlExt = asset.external_url.split('.').pop()?.toLowerCase()?.split('?')[0];
				if (urlExt && ['mp4', 'webm', 'mov', 'avi'].includes(urlExt)) {
					return urlExt;
				}
			}
			return 'mp4';
		};

		// Helper function to get document file extension
		const getDocumentFileExtension = (asset: Asset): string => {
			if (asset.media_file) {
				// Extract just the extension from the filename
				const parts = asset.media_file.split('.');
				if (parts.length > 1) {
					const ext = parts[parts.length - 1].toLowerCase();
					return ext;
				}
			}
			return 'doc';
		};

		// Handle drag and drop changes
		const handleDragChange = (event: any, familyId: string) => {
			if (event.moved) {
				// Save the new order after drag
				saveOrder(familyId);
			}
		};

		// Save order to database
		const saveOrder = (familyId: string) => {
			const reorderedFamilyAssets = familyAssets.value[familyId] || [];

			// Mark that we have local changes to prevent reload
			hasLocalChanges.value = true;

			// Update sort values in background
			const updates = reorderedFamilyAssets.map((asset, i) => {
				if (asset._junction_id) {
					return api.patch(`/items/product_assets/${asset._junction_id}`, {
						sort: i,
					});
				}
				return Promise.resolve();
			});

			Promise.all(updates)
				.then(() => {
					// Reset the flag after a delay
					setTimeout(() => {
						hasLocalChanges.value = false;
					}, 1000);
				})
				.catch((error) => {
					console.error('Error updating sort order:', error);
					hasLocalChanges.value = false;
				});
		};

		// Track if we've made local changes to prevent reload
		const hasLocalChanges = ref(false);

		// Lifecycle
		onMounted(async () => {
			await loadAssetFamilies();
			await loadAssets();
		});

		onUnmounted(() => {
			// Cleanup if needed
		});

		// Only reload when primaryKey actually changes (not on every render)
		watch(
			() => props.primaryKey,
			(newKey, oldKey) => {
				if (newKey !== oldKey && !hasLocalChanges.value) {
					loadAssets();
				}
				// Reset local changes flag when switching items
				if (newKey !== oldKey) {
					hasLocalChanges.value = false;
				}
			},
		);

		return {
			loading,
			assets,
			assetFamilies,
			showAssetDialog,
			selectedFamily,
			selectedFamilyName,
			selectedFamilyCode,
			pendingFiles,
			processing,
			selectedFamilyFolder,
			videoSourceType,
			externalVideoSource,
			externalVideoUrl,
			videoSourceOptions,
			getVideoUrlPlaceholder,
			getVideoUrlPlaceholderForEdit,
			showEditDrawer,
			editingAsset,
			saving,
			existingAssetIds,
			showRemoveConfirm,
			assetToRemove,
			showBulkRemoveConfirm,
			availableAssets,
			selectedExistingAssets,
			selectedAssets,
			getAssetsForFamily,
			getFamilyIcon,
			openAssetDialog,
			closeAssetDialog,
			handleUploadedFiles,
			removePendingFile,
			handleExternalUrl,
			addExternalVideo,
			getFileIcon,
			getFilePreview,
			getDocumentIcon,
			getSourceName,
			getFileType,
			processUploadedFiles,
			editAsset,
			closeEditDrawer,
			saveAsset,
			removeAsset,
			confirmRemoveAsset,
			cancelRemoveAsset,
			loadAvailableAssets,
			isAssetSelected,
			toggleAssetSelection,
			isAssetSelectedForRemoval,
			toggleAssetSelectionForRemoval,
			removeSelectedAssets,
			confirmBulkRemoveAssets,
			cancelBulkRemoveAssets,
			handleCardClick,
			getVideoFileExtension,
			getDocumentFileExtension,
			handleDragChange,
			familyAssets,
			cardSize,
			toggleCardSize,
		};
	},
});
</script>

<style lang="scss" scoped>
.interface-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;

	.header-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		color: var(--theme--foreground);
	}

	.header-actions {
		margin-left: auto;
		display: flex;
		gap: 8px;
		align-items: center;

		.size-selector {
			--v-icon-color: var(--theme--foreground-subdued);
			transition: color var(--fast) var(--transition);

			&:hover {
				--v-icon-color: var(--theme--foreground);
			}
		}
	}
}

.loading-state {
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 48px;
	color: var(--theme--foreground-subdued);
}

:deep(.cards-grid) {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(var(--size), 1fr));
	gap: 32px 24px;
	max-width: calc(var(--size) * 4 + 24px * 3);

	&.size-2 {
		--size: 200px;
		
		.card {
			.header {
				.v-icon-file {
					--v-icon-file-size: 120px;
				}
			}
		}
	}

	&.size-3 {
		--size: 160px;
	}

	&.size-4 {
		--size: 120px;
		gap: 24px 16px;
		max-width: calc(var(--size) * 4 + 16px * 3);
		
		.card {
			.header {
				.v-icon-file {
					--v-icon-file-size: 60px;
				}
			}
		}
	}

	&.size-5 {
		--size: 80px;
		gap: 16px 12px;
		max-width: calc(var(--size) * 4 + 12px * 3);
		
		.card {
			.header {
				.v-icon-file {
					--v-icon-file-size: 50px;
				}
			}
			
			.title {
				font-size: 12px;
			}
			
			.subtitle {
				font-size: 11px;
			}
		}
	}
}

.card-wrapper {
	position: relative;
	transition: transform 0.2s ease;
}

.ghost {
	opacity: 0.5;
	background: var(--theme--background-accent);
	border-radius: var(--theme--border-radius);

	.card {
		visibility: hidden;
	}
}

.card {
	position: relative;
	cursor: pointer;
	transition:
		transform 0.2s ease,
		opacity 0.2s ease,
		box-shadow 0.2s ease;
	user-select: none;

	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

		.drag-handle {
			opacity: 1;
		}
	}

	.header {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		overflow: hidden;
		background-color: var(--theme--background-normal);
		border-color: var(--theme--primary-subdued);
		border-style: solid;
		border-width: 0px;
		border-radius: var(--theme--border-radius);
		transition: border-width var(--fast) var(--transition);

		&::after {
			display: block;
			padding-bottom: 100%;
			content: '';
		}

		.image {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			object-fit: contain;
		}

		.v-icon {
			--v-icon-color: var(--theme--foreground-subdued);
		}

		:deep(.v-icon-file) {
			--v-icon-file-size: 80px;
			--v-icon-file-color: var(--theme--foreground-subdued);
			--v-icon-file-color-accent: var(--theme--primary);
		}

		.selection-fade {
			position: absolute;
			top: 0;
			left: 0;
			z-index: 1;
			width: 100%;
			height: 48px;
			opacity: 0;
			transition: opacity var(--fast) var(--transition);

			&::before {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background-image: linear-gradient(-180deg, rgb(38 50 56 / 0.1) 10%, rgb(38 50 56 / 0));
				content: '';
			}
		}

		.video-overlay {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: rgba(0, 0, 0, 0.4);
			pointer-events: none;

			.v-icon {
				--v-icon-size: 48px;
				color: white;
				filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
			}
		}
	}

	&::before {
		position: absolute;
		top: 7px;
		left: 7px;
		z-index: 2;
		width: 18px;
		height: 18px;
		background-color: var(--theme--background);
		border-radius: 24px;
		opacity: 0;
		transition: opacity var(--fast) var(--transition);
		content: '';
	}

	.drag-handle {
		--v-icon-color: var(--theme--foreground-subdued);
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 3;
		cursor: grab;
		opacity: 0;
		transition: opacity var(--fast) var(--transition);

		&:active {
			cursor: grabbing;
		}
	}

	.selector {
		--v-icon-color: var(--white);
		--v-icon-color-hover: var(--white);

		position: absolute;
		top: 0px;
		left: 0px;
		z-index: 3;
		margin: 4px;
		opacity: 0;
		transition:
			opacity var(--fast) var(--transition),
			color var(--fast) var(--transition);

		&:hover {
			opacity: 1 !important;
		}
	}

	&.select-mode {
		.selector {
			opacity: 0.5;
		}

		.header {
			.selection-fade {
				opacity: 1;
			}
		}
	}

	&.selected {
		&::before {
			opacity: 1;
		}

		.selector {
			--v-icon-color: var(--theme--primary);
			--v-icon-color-hover: var(--theme--primary);

			opacity: 1;
		}

		.header {
			border-width: 12px;

			.selection-fade {
				opacity: 1;
			}
		}
	}

	&:hover {
		.selector {
			opacity: 0.5;
		}

		.header {
			.selection-fade {
				opacity: 1;
			}
		}
	}
}

.title,
.subtitle {
	position: relative;
	display: flex;
	align-items: center;
	width: 100%;
	height: 26px;
	margin-top: 2px;
	overflow: hidden;
	line-height: 1.3em;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.subtitle {
	margin-top: 0px;
	color: var(--theme--foreground-subdued);

	.v-icon {
		--v-icon-size: 12px;
		margin-right: 4px;
	}
}

.card {
	position: relative;
	display: flex;
	flex-direction: column;
	background-color: var(--theme--background);
	overflow: hidden;
	cursor: pointer;
	transition: all var(--slow) var(--transition);

	&:hover {
		.card-actions {
			opacity: 1;
		}
	}

	.card-image {
		position: relative;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--theme--form--field--input--background);
		margin: 0;
		overflow: hidden;

		img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: cover;
			border-radius: 0;
		}

		.card-icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			height: 100%;
			background-color: var(--theme--background-accent);

			.v-icon {
				--v-icon-size: 64px;
				color: var(--theme--foreground-subdued);
			}
		}

		&.is-video {
			background-color: var(--theme--background-normal);
		}

		.video-overlay {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: rgba(0, 0, 0, 0.4);
			pointer-events: none;

			.v-icon {
				--v-icon-size: 64px;
				color: white;
				filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
			}
		}

		.card-actions {
			position: absolute;
			top: 8px;
			right: 8px;
			display: flex;
			gap: 4px;
			opacity: 0;
			transition: opacity var(--fast) var(--transition);

			.action-button {
				background-color: var(--theme--background);
				border: var(--theme--border-width) solid var(--theme--form--field--input--border-color);
				box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);

				&:hover {
					background-color: var(--theme--danger);
					border-color: var(--theme--danger);

					.v-icon {
						color: white;
					}
				}
			}
		}
	}

	.card-content {
		padding: 12px;
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;

		.card-title {
			margin: 0;
			font-size: 14px;
			font-weight: 600;
			line-height: 1.4;
			color: var(--theme--foreground);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.card-subtitle {
			margin: 0;
			line-height: 1.4;
			color: var(--theme--foreground-subdued);
			display: flex;
			align-items: center;
			gap: 4px;

			.v-icon {
				--v-icon-size: 12px;
			}
		}
	}
}

.asset-families-container {
	display: flex;
	flex-direction: column;
	gap: 32px;
}

.asset-family-section {
	.family-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--theme--border-color-subdued);

		.family-info {
			h4 {
				margin: 0;
				font-size: 16px;
				font-weight: 600;
				color: var(--theme--foreground);
			}

			.asset-count {
				color: var(--theme--foreground-subdued);
			}
		}
	}

	.family-empty-state {
		text-align: center;
		padding: 24px;
		background: var(--theme--background-subdued);
		border-radius: var(--theme--border-radius);
		color: var(--theme--foreground-subdued);

		p {
			margin: 0;
			font-size: 14px;
		}
	}
}

.drawer-content {
	padding: 20px;

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.field-wrapper {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--theme--foreground);
	}

	.asset-preview-edit {
		max-width: 300px;
		margin: 0 auto;

		img {
			width: 100%;
			height: auto;
			border-radius: var(--theme--border-radius);
		}

		.video-preview,
		.document-preview,
		.generic-preview {
			aspect-ratio: 16/9;
			background: var(--theme--background-subdued);
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			border-radius: var(--theme--border-radius);
			padding: 24px;
			text-align: center;

			.v-icon {
				--v-icon-size: 64px;
				color: var(--theme--foreground-subdued);
				margin-bottom: 12px;
			}

			p {
				margin: 0;
				font-size: 14px;
				color: var(--theme--foreground-subdued);
				word-break: break-all;
			}

			.video-url {
				max-width: 100%;
			}

			.document-name {
				font-weight: 500;
				color: var(--theme--foreground);
			}
		}
	}
}

.asset-upload-section {
	display: flex;
	flex-direction: column;
	gap: 20px;

	.video-source-radio {
		.radio-group {
			display: flex;
			gap: 24px;
			margin-bottom: 20px;
			padding: 16px;
			background: var(--theme--background-subdued);
			border-radius: var(--theme--border-radius);
		}
	}

	.external-url-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.existing-assets-section {
		margin-top: 20px;
		h4 {
			margin: 16px 0 12px 0;
			font-size: 14px;
			color: var(--theme--foreground-subdued);
		}
	}

	.available-assets-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 8px;
		max-height: 200px;
		overflow-y: auto;
		padding: 8px;
		background: var(--theme--background-subdued);
		border-radius: var(--theme--border-radius);
	}

	.available-asset-card {
		position: relative;
		border: 2px solid var(--theme--border-color);
		border-radius: var(--theme--border-radius);
		overflow: hidden;
		cursor: pointer;
		transition: all 0.2s;

		&:hover {
			border-color: var(--theme--primary);
			transform: scale(1.05);
		}

		&.selected {
			border-color: var(--theme--primary);
			background: var(--theme--primary-background);
		}

		.asset-preview-small {
			aspect-ratio: 1;
			background: var(--theme--background-normal);
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;

			img {
				width: 100%;
				height: 100%;
				object-fit: cover;
			}

			.v-icon {
				color: var(--theme--foreground-subdued);
				--v-icon-size: 24px;
			}
		}

		.asset-info-small {
			padding: 4px;

			.asset-label-small {
				font-size: 11px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		}

		.selected-icon {
			position: absolute;
			top: 4px;
			right: 4px;
			color: var(--theme--primary);
			background: white;
			border-radius: 50%;
			--v-icon-size: 20px;
		}
	}

	.no-available-assets {
		text-align: center;
		padding: 24px;
		color: var(--theme--foreground-subdued);
		font-size: 13px;
	}

	.pending-files {
		border: 1px solid var(--theme--border-color);
		border-radius: var(--theme--border-radius);
		padding: 16px;

		h4 {
			margin: 0 0 12px 0;
			font-size: 14px;
			color: var(--theme--foreground-subdued);
		}

		.file-list {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.file-item {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 8px;
			background: var(--theme--background-subdued);
			border-radius: var(--theme--border-radius);

			.file-preview {
				width: 40px;
				height: 40px;
				border-radius: 50%;
				background: var(--theme--background-normal);
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				overflow: hidden;
				border: 1px solid var(--theme--border-color-subdued);

				img {
					width: 100%;
					height: 100%;
					object-fit: cover;
				}

				.v-icon {
					color: var(--theme--foreground-subdued);
					--v-icon-size: 20px;
				}
			}

			.file-name {
				flex: 1;
				font-size: 13px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		}
	}
}

.asset-details {
	margin-top: 16px;
	color: var(--theme--foreground-subdued);

	strong {
		color: var(--theme--foreground);
	}
}
</style>

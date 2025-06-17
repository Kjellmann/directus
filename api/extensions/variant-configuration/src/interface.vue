<template>
	<div class="variant-configuration">
		<div v-if="loading" class="loading">
			<v-progress-circular />
		</div>

		<div v-else-if="!familyVariant" class="no-family-variant">
			<v-notice type="info">Select a family variant to configure variant options</v-notice>
			<div style="margin-top: 10px; font-size: 12px; color: #666">
				Debug: familyVariant={{ familyVariant }}
				<br />
				Props values={{ JSON.stringify(values) }}
				<br />
				Injected values={{ JSON.stringify(formValues) }}
			</div>
		</div>

		<v-detail v-else v-model="configurationDetailOpen" :start-open="true" class="configuration-container">
			<template #activator="{ toggle, active }">
				<v-divider :class="{ active }" :inline-title="false" large @click="toggle">
					<span class="title">{{ t('Variant Configuration') }}</span>
					<v-icon class="expand-icon" name="expand_more" />
				</v-divider>
			</template>

			<div class="configuration-content">
				<!-- Show notice if product is not saved -->
				<v-notice v-if="primaryKey === '+'" type="info" icon="info">
					{{ t('Save the product before generating variants') }}
				</v-notice>

				<!-- Axis configurations -->
				<div v-for="axis in variantAxes" :key="axis.id" class="configuration-section">
					<div class="axis-header">
						<div class="axis-info">
							<h3>{{ axis.attribute.label }}</h3>
							<span class="option-count">({{ getOptionStats(axis.id) }})</span>
						</div>
						<div class="axis-actions">
							<div v-if="enableBulkActions" class="bulk-actions">
								<v-menu placement="bottom-start" show-arrow>
									<template #activator="{ toggle }">
										<v-icon clickable class="options" name="more_vert" @click="toggle" />
									</template>
									<v-list>
										<v-list-item clickable @click="addNewOption(axis.id)">
											<v-list-item-icon>
												<v-icon name="add" />
											</v-list-item-icon>
											<v-list-item-content>{{ t('Add New Option') }}</v-list-item-content>
										</v-list-item>
										<v-list-item clickable @click="selectAll(axis.id)">
											<v-list-item-icon>
												<v-icon name="check_box" />
											</v-list-item-icon>
											<v-list-item-content>{{ t('Select All') }}</v-list-item-content>
										</v-list-item>
										<v-list-item clickable @click="deselectAll(axis.id)">
											<v-list-item-icon>
												<v-icon name="check_box_outline_blank" />
											</v-list-item-icon>
											<v-list-item-content>{{ t('Deselect All') }}</v-list-item-content>
										</v-list-item>
									</v-list>
								</v-menu>
							</div>
						</div>
					</div>

					<!-- Search input -->
					<div class="search-container">
						<v-input
							:model-value="searchTerms[axis.id] || ''"
							:placeholder="t('Search options...')"
							@update:model-value="(value: string) => searchOptions(axis.id, value)"
						>
							<template #prepend>
								<v-icon name="search" />
							</template>
						</v-input>
					</div>

					<div class="options-grid">
						<div
							v-for="option in axis.availableOptions"
							:key="option.id"
							class="option-item"
							:class="{
								selected: isSelected(axis.id, option.id),
								'partially-used': isOptionPartiallyUsed(axis.id, option.id),
								'fully-used': isOptionFullyUsed(axis.id, option.id),
							}"
							@click="toggleOption(axis.id, option.id)"
						>
							<div class="option-content">
								<div class="option-label-container">
									<div class="option-label">
										{{ option.label }}
									</div>
									<div v-if="option.code" class="option-code">{{ option.code }}</div>
								</div>

								<v-avatar v-if="option.image" :xSmall="true" class="option-image">
									<v-image :src="getImageUrl(option.image)" :alt="option.label" />
								</v-avatar>
								<v-icon
									v-if="isOptionFullyUsed(axis.id, option.id)"
									name="check_circle"
									class="used-indicator"
									:title="t('All combinations with this option already exist')"
								/>
								<v-icon
									v-else-if="isOptionPartiallyUsed(axis.id, option.id)"
									name="radio_button_checked"
									class="partial-indicator"
									:title="t('Some combinations with this option already exist')"
								/>
							</div>
						</div>
					</div>

					<!-- Pagination -->
					<div v-if="getTotalPages(axis.id) > 1" class="pagination-container">
						<v-pagination
							:model-value="currentPages[axis.id] || 1"
							:length="getTotalPages(axis.id)"
							:total-visible="5"
							:show-first-last="true"
							:disabled="loadingMoreOptions[axis.id]"
							@update:model-value="(page) => changePage(axis.id, page)"
						/>
					</div>
				</div>

				<!-- No new variants notice -->
				<div v-if="hasValidConfiguration" class="configuration-section">
					<v-notice
						v-if="hasValidConfiguration && variantPreparations.length === 0 && totalCombinations > 0"
						type="warning"
						icon="warning"
					>
						{{
							t(
								'All {total} possible combinations already exist as variants. No new variants will be created.',
							).replace('{total}', totalCombinations.toString())
						}}
					</v-notice>
					<v-notice
						v-if="variantPreparations.length > 0 && existingVariants.length > 0 && totalCombinations > newCombinations"
						type="info"
						icon="info"
					>
						{{
							t('{existing} variants already exist. {new} new variants will be created.')
								.replace('{existing}', existingVariants.length.toString())
								.replace('{new}', newCombinations.toString())
						}}
					</v-notice>
				</div>

				<!-- Variant Preparation -->
				<div v-if="hasValidConfiguration && variantPreparations.length > 0" class="configuration-section">
					<div class="variants-header">
						<h3>{{ t('Prepare {variants} new variants').replace('{variants}', newCombinations) }}</h3>
						<div class="variants-actions">
							<div class="bulk-actions">
								<v-menu placement="bottom-start" show-arrow>
									<template #activator="{ toggle }">
										<v-icon clickable class="options" name="more_vert" @click="toggle" />
									</template>
									<v-list>
										<v-list-item clickable @click="regenerateAllNames">
											<v-list-item-icon>
												<v-icon name="refresh" />
											</v-list-item-icon>
											<v-list-item-content>{{ t('Regenerate All Names') }}</v-list-item-content>
										</v-list-item>
										<v-list-item clickable @click="clearAllPrices">
											<v-list-item-icon>
												<v-icon name="clear" />
											</v-list-item-icon>
											<v-list-item-content>{{ t('Clear All Prices') }}</v-list-item-content>
										</v-list-item>
										<v-list-item v-if="baseProduct?.price" clickable @click="applyBasePriceToAll">
											<v-list-item-icon>
												<v-icon name="attach_money" />
											</v-list-item-icon>
											<v-list-item-content>
												{{ t('Apply Base Price ({price}) to All', { price: baseProduct.price }) }}
											</v-list-item-content>
										</v-list-item>
									</v-list>
								</v-menu>
							</div>
						</div>
					</div>

					<div class="variants-table">
						<table>
							<thead>
								<tr>
									<th class="variant-image-header">{{ t('Image') }}</th>
									<th class="variant-attributes-header">{{ t('Attributes') }}</th>
									<th class="variant-name-header">{{ t('Name') }}</th>
									<th class="variant-price-header">{{ t('Price') }}</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="(variant, index) in paginatedVariantPreparations" :key="index" class="variant-row">
									<td class="variant-image-cell">
										<v-avatar class="variant-image" @click="selectImage(variant)">
											<v-image v-if="variant.image" :src="getImageUrl(variant.image)" class="variant-image" />
											<v-icon v-else name="add_photo_alternate" />
										</v-avatar>
									</td>
									<td class="variant-attributes-cell">
										<div class="variant-attributes">
											<v-chip v-for="attr in variant.attributes" :key="attr.code" :label="attr.label" :xSmall="true">
												{{ attr.label }}
											</v-chip>
										</div>
									</td>
									<td class="variant-name-cell">
										<v-input v-model="variant.name" :placeholder="t('Enter variant name')" />
									</td>
									<td class="variant-price-cell">
										<v-input v-model.number="variant.price" type="number" step="1" />
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<!-- Variants Pagination -->
					<div v-if="variantPreparationsTotalPages > 1" class="variants-pagination-container">
						<v-pagination
							:model-value="variantPreparationsPage"
							:length="variantPreparationsTotalPages"
							:total-visible="5"
							:show-first-last="true"
							@update:model-value="(page) => (variantPreparationsPage = page)"
						/>
					</div>
				</div>

				<!-- Generation actions -->
				<div class="generation-actions">
					<v-button
						:loading="generating"
						:disabled="!hasValidConfiguration || primaryKey === '+' || newCombinations === 0"
						@click="generateVariants"
						:title="newCombinations === 0 ? t('No new variants to generate - all combinations already exist') : ''"
					>
						<v-icon name="auto_awesome" left />
						{{
							newCombinations === 0
								? t('No new variants to generate')
								: t('Generate {variants} new variants').replace('{variants}', newCombinations)
						}}
					</v-button>

					<v-button v-if="hasExistingVariants" secondary :loading="regenerating" @click="regenerateVariants">
						<v-icon name="refresh" left />
						{{ t('Regenerate Variants') }}
					</v-button>
				</div>
			</div>
		</v-detail>

		<!-- Existing Variants -->
		<v-detail
			v-if="existingVariants.length > 0"
			v-model="existingVariantsDetailOpen"
			:start-open="true"
			class="group-detail"
		>
			<template #activator="{ toggle, active }">
				<v-divider :class="{ active }" :inline-title="false" large @click="toggle">
					<span class="title">{{ t('Existing Variants') }} ({{ existingVariants.length }})</span>
					<v-icon class="expand-icon" name="expand_more" />
				</v-divider>
			</template>

			<div class="linked-products-content">
				<div class="linked-products-section">
					<div class="variants-header">
						<h3>{{ t('Existing Variants') }} ({{ existingVariants.length }})</h3>
						<div class="variants-actions">
							<div class="bulk-actions">
								<v-menu placement="bottom-start" show-arrow>
									<template #activator="{ toggle }">
										<v-icon clickable class="options" name="more_vert" @click="toggle" />
									</template>
									<v-list>
										<v-list-item clickable @click="enableAllVariants">
											<v-list-item-icon>
												<v-icon name="visibility" />
											</v-list-item-icon>
											<v-list-item-content>{{ t('Enable All') }}</v-list-item-content>
										</v-list-item>
										<v-list-item clickable @click="disableAllVariants">
											<v-list-item-icon>
												<v-icon name="visibility_off" />
											</v-list-item-icon>
											<v-list-item-content>{{ t('Disable All') }}</v-list-item-content>
										</v-list-item>
										<v-list-item clickable @click="deleteAllVariants">
											<v-list-item-icon>
												<v-icon name="delete" />
											</v-list-item-icon>
											<v-list-item-content>{{ t('Delete All') }}</v-list-item-content>
										</v-list-item>
									</v-list>
								</v-menu>
							</div>
						</div>
					</div>

					<div class="existing-variants-list">
						<div
							v-for="variant in paginatedExistingVariants"
							:key="variant.id"
							class="variant-row"
							:class="{ disabled: !variant.enabled }"
						>
							<div class="variant-image">
								<v-avatar :small="true">
									<v-image v-if="variant.image" :src="getImageUrl(variant.image)" :alt="variant.name || 'Variant image'" />
									<v-icon v-else name="inventory_2" />
								</v-avatar>
							</div>
							<div class="variant-info">
								<div class="variant-header">
									<div class="variant-name-price">
										<div v-if="variant.name" class="variant-name">{{ variant.name }}</div>
										<div v-if="variant.price" class="variant-price">{{ formatPrice(variant.price) }}</div>
									</div>
									<div class="variant-actions">
										<v-menu placement="bottom-start" show-arrow>
											<template #activator="{ toggle }">
												<v-icon clickable name="more_vert" @click="toggle" />
											</template>
											<v-list>
												<v-list-item clickable @click="toggleVariantStatus(variant)">
													<v-list-item-icon>
														<v-icon :name="variant.enabled ? 'visibility_off' : 'visibility'" />
													</v-list-item-icon>
													<v-list-item-content>{{ variant.enabled ? t('Disable') : t('Enable') }}</v-list-item-content>
												</v-list-item>
												<v-list-item clickable @click="editVariant(variant)">
													<v-list-item-icon>
														<v-icon name="edit" />
													</v-list-item-icon>
													<v-list-item-content>{{ t('Edit') }}</v-list-item-content>
												</v-list-item>
												<v-list-item clickable @click="deleteVariant(variant)">
													<v-list-item-icon>
														<v-icon name="delete" />
													</v-list-item-icon>
													<v-list-item-content>{{ t('Delete') }}</v-list-item-content>
												</v-list-item>
											</v-list>
										</v-menu>
									</div>
								</div>
								<div class="variant-attributes">
									<v-chip
										v-for="attr in variant.displayAttributes"
										:key="attr.code"
										:x-small="true"
									>
										{{ attr.label }}
									</v-chip>
								</div>
							</div>
						</div>
					</div>

					<!-- Existing Variants Pagination -->
					<div v-if="existingVariantsTotalPages > 1" class="variants-pagination-container">
						<v-pagination
							:model-value="existingVariantsPage"
							:length="existingVariantsTotalPages"
							:total-visible="5"
							:show-first-last="true"
							@update:model-value="(page) => (existingVariantsPage = page)"
						/>
					</div>
				</div>
			</div>
		</v-detail>

		<!-- Dialog for notifications -->
		<v-dialog v-model="dialogActive" @esc="dialogActive = false">
			<v-card>
				<v-card-title>{{ dialogTitle }}</v-card-title>
				<v-card-text>{{ dialogMessage }}</v-card-text>
				<v-card-actions>
					<v-button v-if="dialogType === 'confirm'" secondary @click="dialogResolve(false)">
						{{ t('Cancel') }}
					</v-button>
					<v-button @click="dialogResolve(true)">
						{{ dialogType === 'confirm' ? t('Confirm') : t('OK') }}
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- File picker dialog -->
		<v-dialog v-model="filePickerActive" persistent>
			<v-card style="min-width: 800px; min-height: 600px;">
				<v-card-title>
					{{ t('Select Image') }}
					<v-button secondary icon @click="filePickerActive = false">
						<v-icon name="close" />
					</v-button>
				</v-card-title>
				<v-card-text>
					<div class="file-picker-content">
						<!-- Simple file browser interface -->
						<div class="file-upload-area">
							<v-button @click="triggerFileUpload">
								<v-icon name="cloud_upload" />
								{{ t('Upload New Image') }}
							</v-button>
							<input
								ref="fileInput"
								type="file"
								accept="image/*"
								style="display: none"
								@change="handleFileUpload"
							/>
						</div>
						
						<!-- Recent files list (simplified) -->
						<div v-if="recentFiles.length > 0" class="recent-files">
							<h3>{{ t('Recent Images') }}</h3>
							<div class="files-grid">
								<div
									v-for="file in recentFiles"
									:key="file.id"
									class="file-item"
									:class="{ selected: selectedFileId === file.id }"
									@click="selectFile(file.id)"
								>
									<img :src="getFileUrl(file.id)" :alt="file.title" />
									<span>{{ file.title }}</span>
								</div>
							</div>
						</div>
					</div>
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="filePickerActive = false">
						{{ t('Cancel') }}
					</v-button>
					<v-button :disabled="!selectedFileId" @click="confirmFileSelection">
						{{ t('Select') }}
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, inject } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import { useI18n } from 'vue-i18n';

interface AttributeDefinition {
	id: number;
	code: string;
	label: string;
}

interface VariantAxis {
	id: number;
	attribute: {
		id: number;
		code: string;
		label: string;
		icon?: string;
		type?: string;
		reference_collection?: string;
	};
	availableOptions: AttributeOption[];
	sort: number;
	axisData?: any; // Store original axis data for search/pagination
}

interface AttributeOption {
	id: number;
	code: string;
	label: string;
	value?: any;
	image?: string;
}

interface SelectedOptions {
	[axisId: number]: number[];
}

interface VariantPreparation {
	name: string;
	price: number | null;
	image: string | null;
	enabled: boolean;
	attributes: Array<{
		code: string;
		label: string;
		value: any;
		attribute_id: number;
	}>;
	combination: Record<number, number>; // axisId -> optionId mapping
}

export default defineComponent({
	props: {
		value: {
			type: Object,
			default: () => ({}),
		},
		primaryKey: {
			type: [String, Number],
			default: null,
		},
		collection: {
			type: String,
			default: null,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		values: {
			type: Object,
			default: () => ({}),
		},
		familyVariantValue: {
			type: [String, Number],
			default: null,
		},
		enableBulkActions: {
			type: Boolean,
			default: true,
		},
		showPreview: {
			type: Boolean,
			default: true,
		},
	},
	emits: ['input'],
	setup(props, { emit }) {
		const api = useApi();
		const { t } = useI18n();

		// Inject form values from parent form context
		const formValues = inject('values', ref({}));

		const loading = ref(false);
		const generating = ref(false);
		const regenerating = ref(false);
		const variantAxes = ref<VariantAxis[]>([]);
		const selectedOptions = ref<SelectedOptions>({});
		const hasExistingVariants = ref(false);

		// Detail open states
		const configurationDetailOpen = ref(true);
		const existingVariantsDetailOpen = ref(true);

		// Search and pagination state
		const searchTerms = ref<Record<number, string>>({});
		const currentPages = ref<Record<number, number>>({});
		const totalOptionCounts = ref<Record<number, number>>({});
		const loadingMoreOptions = ref<Record<number, boolean>>({});

		// Dialog state
		const dialogActive = ref(false);
		const dialogTitle = ref('');
		const dialogMessage = ref('');
		const dialogType = ref<'alert' | 'confirm'>('alert');
		const dialogResolve = ref<(value: boolean) => void>(() => {});

		// File picker state
		const filePickerActive = ref(false);
		const selectedFileId = ref<string | null>(null);
		const recentFiles = ref<any[]>([]);
		const currentVariant = ref<VariantPreparation | null>(null);
		const fileInput = ref<HTMLInputElement | null>(null);

		// Base product data for name and price generation
		const baseProduct = ref<{ name?: string; price?: number } | null>(null);

		const ITEMS_PER_PAGE = 27;

		// Load options for a specific axis with search and pagination support
		async function loadOptionsForAxis(axisData: any, axisId: number) {
			const attributeType = axisData.attributes_id.type.code;
			const referenceCollection = axisData.attributes_id.reference_collection;
			const searchTerm = searchTerms.value[axisId] || '';
			const currentPage = currentPages.value[axisId] || 1;
			const offset = (currentPage - 1) * ITEMS_PER_PAGE;

			let optionsData = [];
			let totalCount = 0;

			try {
				if (attributeType.includes('reference_entity') && referenceCollection) {
					// Load options from reference collection
					const params: any = {
						fields: ['*'],
						sort: ['sort', 'label'],
						limit: ITEMS_PER_PAGE,
						offset: offset,
					};

					// Add search filter if provided
					if (searchTerm) {
						params.filter = {
							_or: [{ label: { _icontains: searchTerm } }, { code: { _icontains: searchTerm } }],
						};
					}

					// Get total count for pagination (separate query without offset)
					const countParams: any = {
						aggregate: { count: '*' },
						limit: -1,
					};

					// Add search filter to count query if provided
					if (searchTerm) {
						countParams.filter = {
							_or: [{ label: { _icontains: searchTerm } }, { code: { _icontains: searchTerm } }],
						};
					}

					const countResponse = await api.get(`/items/${referenceCollection}`, {
						params: countParams,
					});
					totalCount = countResponse.data.data[0].count;

					// Get actual data
					const referenceResponse = await api.get(`/items/${referenceCollection}`, {
						params,
					});

					optionsData = referenceResponse.data.data;
					console.log(`Loaded ${optionsData.length}/${totalCount} options from ${referenceCollection}`);
				} else {
					// Load options from attribute_options table
					const params: any = {
						filter: {
							attribute_id: axisData.attributes_id.id,
						},
						fields: ['id', 'code', 'label', 'sort'],
						sort: ['sort', 'label'],
						limit: ITEMS_PER_PAGE,
						offset: offset,
					};

					// Add search filter if provided
					if (searchTerm) {
						params.filter._or = [{ label: { _icontains: searchTerm } }, { code: { _icontains: searchTerm } }];
					}

					// Get total count (separate query without offset)
					const countParams: any = {
						filter: {
							attribute_id: axisData.attributes_id.id,
						},
						aggregate: { count: '*' },
						limit: -1,
					};

					// Add search filter to count query if provided
					if (searchTerm) {
						countParams.filter._or = [{ label: { _icontains: searchTerm } }, { code: { _icontains: searchTerm } }];
					}

					const countResponse = await api.get('/items/attribute_options', {
						params: countParams,
					});
					totalCount = countResponse.data.data[0].count;

					// Get actual data
					const optionsResponse = await api.get('/items/attribute_options', {
						params,
					});

					optionsData = optionsResponse.data.data;
					console.log(`Loaded ${optionsData.length}/${totalCount} options from attribute_options`);
				}

				// Update state
				totalOptionCounts.value[axisId] = totalCount;

				return optionsData;
			} catch (error) {
				console.error('Failed to load options:', error);
				return [];
			}
		}

		// Get the family variant value from form values
		const familyVariant = computed(() => {
			console.log('familyVariant computed:', {
				familyVariantValue: props.familyVariantValue,
				propsValues: props.values,
				injectedFormValues: formValues.value,
				valueFromProps: props.values?.['family_variant'],
				valueFromInjected: formValues.value?.['family_variant'],
			});

			// 1. First try explicit prop (but check for empty string)
			if (props.familyVariantValue && props.familyVariantValue !== '') {
				console.log('Using familyVariantValue prop:', props.familyVariantValue);
				return props.familyVariantValue;
			}

			// 2. Try from injected form values (current form data) - check for empty string
			if (formValues.value && formValues.value['family_variant'] && formValues.value['family_variant'] !== '') {
				console.log('Using injected form value:', formValues.value['family_variant']);
				return formValues.value['family_variant'];
			}

			// 3. Try from props values (fallback) - check for empty string
			if (props.values && props.values['family_variant'] && props.values['family_variant'] !== '') {
				console.log('Using props value:', props.values['family_variant']);
				return props.values['family_variant'];
			}

			// 4. Fallback to null
			console.log('No family variant found, returning null');
			return null;
		});

		// Watch for changes in the family variant field through the form context (fallback)
		const updateFamilyVariant = async () => {
			// This is now mainly for debugging - the computed property should handle most cases
			try {
				if (!props.collection || !props.primaryKey || props.familyVariantValue || props.primaryKey === '+') {
					return; // Skip if we have a prop value, no item yet, or it's a new item
				}

				// Get the current item to check family variant (fallback only)
				const response = await api.get(`/items/${props.collection}/${props.primaryKey}`, {
					params: {
						fields: ['family_variant'],
					},
				});

				console.log('Fallback family variant check:', response.data.data?.['family_variant']);
			} catch (error) {
				// Silently fail - this is just a fallback check
				console.log('Could not fetch family variant (this is normal for new items)');
			}
		};

		// Load variant axes and available options
		async function loadVariantConfiguration() {
			if (!familyVariant.value || familyVariant.value === '') return;

			loading.value = true;
			try {
				// Get family variant axes
				const axesResponse = await api.get('/items/family_variants_axes', {
					params: {
						filter: {
							family_variants_id: familyVariant.value,
						},
						fields: [
							'id',
							'sort',
							'attributes_id.id',
							'attributes_id.code',
							'attributes_id.label',
							'attributes_id.type',
							'attributes_id.type.*',
							'attributes_id.reference_collection',
						],
						sort: ['sort'],
					},
				});

				// Load available options for each axis
				const axes: VariantAxis[] = [];
				for (const axisData of axesResponse.data.data) {
					// Initialize pagination state for this axis
					currentPages.value[axisData.id] = 1;

					// Load options using the new function with search and pagination support
					const optionsData = await loadOptionsForAxis(axisData, axisData.id);

					axes.push({
						id: axisData.id,
						attribute: {
							id: axisData.attributes_id.id,
							code: axisData.attributes_id.code,
							label: axisData.attributes_id.label,
							type: axisData.attributes_id.type,
							reference_collection: axisData.attributes_id.reference_collection,
						},
						availableOptions: optionsData,
						sort: axisData.sort,
						axisData: axisData, // Store for search/pagination
					});
				}

				variantAxes.value = axes;

				// Load existing configuration from field value
				if (props.value && typeof props.value === 'object') {
					selectedOptions.value = { ...props.value };
				}

				// Check for existing variants
				if (props.primaryKey) {
					try {
						const variantsResponse = await api.get('/items/products', {
							params: {
								filter: {
									parent_product_id: props.primaryKey,
									product_type: 'simple',
								},
								limit: 1,
							},
						});
						hasExistingVariants.value = variantsResponse.data.data.length > 0;
					} catch (error) {
						console.error('Failed to check for existing variants:', error);
					}
				}
			} catch (error) {
				console.error('Failed to load variant configuration:', error);
			} finally {
				loading.value = false;
				// Analyze used options after variant axes are loaded
				if (existingVariants.value.length > 0) {
					analyzeUsedOptions();
				}
			}
		}

		// Load base product data for name and price generation
		async function loadBaseProduct() {
			if (!props.primaryKey || props.primaryKey === '+') return;

			try {
				// First, get all attribute definitions
				const attributesResponse = await api.get('/items/attributes', {
					params: {
						fields: ['id', 'code', 'label'],
					},
				});
				const attributeDefinitions = attributesResponse.data.data as AttributeDefinition[];
				console.log('Attribute definitions:', attributeDefinitions);

				// Create a map of attribute id to attribute definition
				const attributeMap = new Map<number, AttributeDefinition>(
					attributeDefinitions.map((attr: AttributeDefinition) => [attr.id, attr]),
				);

				// Get the product with its attributes
				const response = await api.get(`/items/products/${props.primaryKey}`, {
					params: {
						fields: ['*', 'attributes.*'],
					},
				});

				console.log('Product response:', response.data.data);

				// Extract name and price from attributes
				const productData = response.data.data;
				const productAttributes = productData.attributes || [];

				// Map product attributes with their definitions
				let name: any = null;
				let price: any = null;

				for (const productAttr of productAttributes) {
					const attrDefinition = attributeMap.get(productAttr.attribute_id);
					if (!attrDefinition) continue;

					if (attrDefinition.code === 'name') {
						name = productAttr.value;
					} else if (attrDefinition.code === 'price') {
						price = productAttr.value;
					}
				}

				// Parse JSON values if they're strings
				if (name && typeof name === 'string') {
					try {
						name = JSON.parse(name);
					} catch {
						// Keep as string if not valid JSON
					}
				}

				if (price && typeof price === 'string') {
					try {
						price = JSON.parse(price);
					} catch {
						// Keep as string if not valid JSON
					}
				}

				console.log('Extracted base product data:', { name, price });
				baseProduct.value = { name, price };
			} catch (error) {
				console.error('Failed to load base product:', error);
				baseProduct.value = null;
			}
		}

		// Selection management
		function isSelected(axisId: number, optionId: number): boolean {
			return selectedOptions.value[axisId]?.includes(optionId) || false;
		}

		function toggleOption(axisId: number, optionId: number) {
			if (props.disabled) return;

			if (!selectedOptions.value[axisId]) {
				selectedOptions.value[axisId] = [];
			}

			const index = selectedOptions.value[axisId].indexOf(optionId);
			if (index > -1) {
				selectedOptions.value[axisId].splice(index, 1);
			} else {
				selectedOptions.value[axisId].push(optionId);
			}

			emitValue();
		}

		function selectAll(axisId: number) {
			const axis = variantAxes.value.find((a) => a.id === axisId);
			if (!axis) return;

			// Select all available options
			selectedOptions.value[axisId] = axis.availableOptions.map((o) => o.id);
			emitValue();
		}

		function deselectAll(axisId: number) {
			selectedOptions.value[axisId] = [];
			emitValue();
		}

		function getSelectedCount(axisId: number): number {
			return selectedOptions.value[axisId]?.length || 0;
		}

		// Search and pagination functions
		async function searchOptions(axisId: number, searchTerm: string) {
			searchTerms.value[axisId] = searchTerm;
			currentPages.value[axisId] = 1; // Reset to first page on search

			// Find the axis data
			const axis = variantAxes.value.find((a) => a.id === axisId);
			if (!axis) return;

			// Find the original axis data from the API response (we need to store this)
			const axisData = axis.axisData;
			if (!axisData) return;

			// Reload options with search term
			const optionsData = await loadOptionsForAxis(axisData, axisId);

			// Update the axis with new options
			axis.availableOptions = optionsData;
		}

		async function changePage(axisId: number, page: number) {
			if (loadingMoreOptions.value[axisId]) return;

			loadingMoreOptions.value[axisId] = true;

			try {
				// Update current page
				currentPages.value[axisId] = page;

				// Find the axis data
				const axis = variantAxes.value.find((a) => a.id === axisId);
				if (!axis) return;

				const axisData = axis.axisData;
				if (!axisData) return;

				// Reload options for the new page
				const optionsData = await loadOptionsForAxis(axisData, axisId);

				// Update the axis with new options
				axis.availableOptions = optionsData;
			} finally {
				loadingMoreOptions.value[axisId] = false;
			}
		}

		function getTotalPages(axisId: number): number {
			const totalCount = totalOptionCounts.value[axisId] || 0;
			return Math.ceil(totalCount / ITEMS_PER_PAGE);
		}

		function getOptionStats(axisId: number): string {
			const totalCount = totalOptionCounts.value[axisId] || 0;
			const selectedCount = getSelectedCount(axisId);
			return `${selectedCount}/${totalCount} selected`;
		}

		async function addNewOption(axisId: number) {
			const axis = variantAxes.value.find((a) => a.id === axisId);
			if (!axis) return;

			const attributeType = axis.attribute.type;
			const referenceCollection = axis.attribute.reference_collection;

			if (
				(attributeType === 'reference_entity_single' || attributeType === 'reference_entity_multiple') &&
				referenceCollection
			) {
				// For reference entities, navigate to the reference collection
				const collectionPath = `/admin/content/${referenceCollection}`;
				const message = t('To add new {attribute} options, please go to the {collection} collection.', {
					attribute: axis.attribute.label,
					collection: referenceCollection,
				});

				const shouldOpen = await showConfirm(
					t('Information'),
					`${message}\n\n${t('Would you like to open the {collection} collection now?', { collection: referenceCollection })}`
				);
				if (shouldOpen) {
					window.open(collectionPath, '_blank');
				}
			} else {
				// For attribute_options, navigate to attribute_options collection
				const collectionPath = '/admin/content/attribute_options';
				const message = t('To add new {attribute} options, please go to the Attribute Options collection.', {
					attribute: axis.attribute.label,
				});

				const shouldOpen = await showConfirm(
					t('Information'),
					`${message}\n\n${t('Would you like to open the Attribute Options collection now?')}`
				);
				if (shouldOpen) {
					window.open(collectionPath, '_blank');
				}
			}
		}

		// Variant generation
		async function generateVariants() {
			if (!props.primaryKey || props.primaryKey === '+') {
				await showAlert(t('Information'), t('Please save the product before generating variants'));
				return;
			}

			generating.value = true;
			try {
				// Prepare variant data with user inputs
				const variantData = variantPreparations.value.map((prep) => ({
					combination: prep.combination,
					attributes: prep.attributes,
					name: prep.name || null,
					price: prep.price || null,
					image: prep.image || null,
					enabled: prep.enabled,
				}));

				// Call the variant generator endpoint with prepared data
				const response = await api.post('/variant-generator/trigger/variant-generator', {
					mode: 'product',
					productId: props.primaryKey,
					preparedVariants: variantData,
				});

				if (response.data.success) {
					// Variants have been generated successfully
					hasExistingVariants.value = true;
					// Clear the configuration to reset the form since variants are created
					selectedOptions.value = {};
					// Emit the cleared value
					emitValue();
					// Reload existing variants to update the used combinations
					await loadExistingVariants();
					// Analyze used options after reloading variants
					analyzeUsedOptions();
					// Show success notification
					showNotification(
						'success',
						t('Generated {count} variants successfully!', { count: response.data.created || 0 }),
					);
				} else {
					// Show error notification
					showNotification('error', response.data.message || t('Failed to generate variants'));
				}
			} catch (error) {
				console.error('Failed to generate variants:', error);
				showNotification(
					'error',
					t('Failed to generate variants: {error}', { error: error instanceof Error ? error.message : String(error) }),
				);
			} finally {
				generating.value = false;
			}
		}

		async function regenerateVariants() {
			const shouldRegenerate = await showConfirm(
				t('Confirm'),
				t('This will delete existing variants and create new ones. Continue?')
			);
			if (shouldRegenerate) {
				regenerating.value = true;
				try {
					// First delete all existing variants
					if (existingVariants.value.length > 0) {
						const variantIds = existingVariants.value.map((v) => v.id);
						await Promise.all(variantIds.map((id) => api.delete(`/items/products/${id}`)));

						// Reload existing variants to update the state
						await loadExistingVariants();
						analyzeUsedOptions();
					}

					// Then generate new variants based on current selections
					await generateVariants();
				} catch (error) {
					showNotification(
						'error',
						t('Failed to regenerate variants: {error}', {
							error: error instanceof Error ? error.message : String(error),
						}),
					);
				} finally {
					regenerating.value = false;
				}
			}
		}

		// Select image for variant preparation
		async function selectImage(variant: VariantPreparation) {
			try {
				currentVariant.value = variant;
				selectedFileId.value = variant.image || null;
				
				// Load recent image files
				await loadRecentFiles();
				
				// Open the file picker dialog
				filePickerActive.value = true;
			} catch (error) {
				console.error('Error opening file picker:', error);
				showNotification('error', t('Failed to open file picker'));
			}
		}

		// Load recent image files
		async function loadRecentFiles() {
			try {
				const response = await api.get('/files', {
					params: {
						filter: {
							type: { _starts_with: 'image/' }
						},
						sort: ['-uploaded_on'],
						limit: 20
					}
				});
				
				recentFiles.value = response.data?.data || [];
			} catch (error) {
				console.error('Error loading recent files:', error);
				recentFiles.value = [];
			}
		}

		// Trigger file upload input
		function triggerFileUpload() {
			fileInput.value?.click();
		}

		// Handle file upload
		async function handleFileUpload(event: Event) {
			const target = event.target as HTMLInputElement;
			const file = target.files?.[0];
			
			if (!file) return;
			
			try {
				// Upload the file to Directus
				const formData = new FormData();
				formData.append('file', file);
				
				const uploadResponse = await api.post('/files', formData, {
					headers: {
						'Content-Type': 'multipart/form-data',
					},
				});

				if (uploadResponse.data?.data?.id) {
					const newFileId = uploadResponse.data.data.id;
					selectedFileId.value = newFileId;
					
					// Add to recent files
					recentFiles.value.unshift({
						id: newFileId,
						title: file.name,
						type: file.type
					});
					
					showNotification('success', t('Image uploaded successfully'));
				} else {
					throw new Error('No file ID returned from upload');
				}
			} catch (error) {
				console.error('Upload error:', error);
				showNotification('error', t('Failed to upload image'));
			}
			
			// Reset input
			if (target) target.value = '';
		}

		// Select a file from the grid
		function selectFile(fileId: string) {
			selectedFileId.value = fileId;
		}

		// Confirm file selection
		function confirmFileSelection() {
			if (selectedFileId.value && currentVariant.value) {
				currentVariant.value.image = selectedFileId.value;
				showNotification('success', t('Image selected for variant'));
			}
			
			filePickerActive.value = false;
			selectedFileId.value = null;
			currentVariant.value = null;
		}

		// Get file URL for preview
		function getFileUrl(fileId: string): string {
			return `/assets/${fileId}?width=200&height=200&fit=cover`;
		}

		// Generate variant name from base product name + attributes
		function generateVariantName(attributes: any[]): string {
			const baseName = baseProduct.value?.name || 'Product';

			if (attributes.length === 0) return baseName;

			const attributeParts = attributes.map((attr) => `${attr.label}`);
			return `${baseName} - ${attributeParts.join(' / ')}`;
		}

		// Bulk action functions (work on all variants, not just visible page)
		function applyBasePriceToAll() {
			const basePrice = baseProduct.value?.price;
			if (!basePrice) return;

			variantPreparations.value.forEach((variant) => {
				variant.price = basePrice;
			});
		}

		function clearAllPrices() {
			variantPreparations.value.forEach((variant) => {
				variant.price = null;
			});
		}

		function regenerateAllNames() {
			variantPreparations.value.forEach((variant) => {
				variant.name = generateVariantName(variant.attributes);
			});
		}

		// Existing variants state
		const existingVariants = ref<any[]>([]);
		const existingVariantsPage = ref(1);
		const EXISTING_VARIANTS_PER_PAGE = 12;

		// Track existing variant combinations to prevent duplicates
		const existingVariantCombinations = ref<Set<string>>(new Set());
		const usedOptions = ref<Record<number, Set<number>>>({});

		// Analyze existing variants to track combinations and mark used options
		function analyzeUsedOptions() {
			usedOptions.value = {};
			existingVariantCombinations.value = new Set();

			for (const variant of existingVariants.value) {
				if (!variant.attributes) continue;

				// Build combination for this variant
				const combination: Record<number, number> = {};
				let hasValidCombination = true;

				for (const attr of variant.attributes) {
					const attributeId = attr.attribute_id?.id;
					if (!attributeId) continue;

					// Find the axis for this attribute
					const axis = variantAxes.value.find((a) => a.attribute.id === attributeId);
					if (!axis) continue;

					// Parse the attribute value to get the option ID
					let optionId = null;
					try {
						const value = typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value;
						if (value && typeof value === 'object' && value.id) {
							optionId = value.id;
						} else if (typeof value === 'number' || typeof value === 'string') {
							// Handle direct option IDs
							optionId = parseInt(String(value));
						}
					} catch (e) {
						// If parsing fails, skip this attribute
						continue;
					}

					if (optionId) {
						// Track individual used options
						if (!usedOptions.value[axis.id]) {
							usedOptions.value[axis.id] = new Set();
						}
						usedOptions.value[axis.id].add(optionId);

						// Track combination
						combination[axis.id] = optionId;
					} else {
						hasValidCombination = false;
					}
				}

				// Store the combination if valid
				if (hasValidCombination && Object.keys(combination).length > 0) {
					const combinationKey = generateCombinationKey(combination);
					existingVariantCombinations.value.add(combinationKey);
				}
			}

			console.log('Analyzed used options:', usedOptions.value);
			console.log('Existing variant combinations:', Array.from(existingVariantCombinations.value));
		}

		// Generate a consistent key for a variant combination
		function generateCombinationKey(combination: Record<number, number>): string {
			return Object.keys(combination)
				.sort((a, b) => Number(a) - Number(b))
				.map((axisId) => `${axisId}:${combination[Number(axisId)]}`)
				.join('|');
		}

		// Check if ALL possible combinations with this option already exist
		function isOptionFullyUsed(axisId: number, optionId: number): boolean {
			if (existingVariants.value.length === 0) return false;
			if (isSelected(axisId, optionId)) return false; // Selected options are never "fully used"

			// Count how many axes have at least one option selected
			const otherAxesWithSelections = variantAxes.value.filter(
				(axis) => axis.id !== axisId && (selectedOptions.value[axis.id]?.length || 0) > 0,
			);

			// If no other axes have selections, this option can't be fully used
			if (otherAxesWithSelections.length === 0) return false;

			// Generate all possible combinations that would include this option
			const testSelections = { ...selectedOptions.value };
			testSelections[axisId] = [optionId];

			const possibleCombinations = generatePossibleCombinations(testSelections);

			// Check if ALL possible combinations with this option already exist
			for (const combination of possibleCombinations) {
				const combinationKey = generateCombinationKey(combination);
				if (!existingVariantCombinations.value.has(combinationKey)) {
					return false; // Found at least one new combination
				}
			}

			return possibleCombinations.length > 0; // All combinations exist
		}

		// Check if SOME combinations with this option already exist
		function isOptionPartiallyUsed(axisId: number, optionId: number): boolean {
			if (existingVariants.value.length === 0) return false;
			if (isSelected(axisId, optionId)) return false;
			if (isOptionFullyUsed(axisId, optionId)) return false;

			// Generate all possible combinations that would include this option
			const testSelections = { ...selectedOptions.value };
			testSelections[axisId] = [optionId];

			const possibleCombinations = generatePossibleCombinations(testSelections);

			// Check if ANY combinations with this option already exist
			for (const combination of possibleCombinations) {
				const combinationKey = generateCombinationKey(combination);
				if (existingVariantCombinations.value.has(combinationKey)) {
					return true; // Found at least one existing combination
				}
			}

			return false;
		}

		// Generate all possible combinations from current selections
		function generatePossibleCombinations(selections: Record<number, number[]>): Array<Record<number, number>> {
			const combinations: Array<Record<number, number>> = [];
			const axes = variantAxes.value.filter((axis) => selections[axis.id]?.length > 0);

			if (axes.length === 0) return combinations;

			function generateCombination(axisIndex: number, currentCombination: Record<number, number>): void {
				if (axisIndex === axes.length) {
					// Check if this is a complete combination (has all axes)
					if (Object.keys(currentCombination).length === variantAxes.value.length) {
						combinations.push({ ...currentCombination });
					}
					return;
				}

				const axis = axes[axisIndex];
				const options = selections[axis.id] || [];

				for (const optionId of options) {
					currentCombination[axis.id] = optionId;
					generateCombination(axisIndex + 1, currentCombination);
				}
			}

			generateCombination(0, {});
			return combinations;
		}

		// Dialog helper functions
		function showDialog(title: string, message: string, type: 'alert' | 'confirm' = 'alert'): Promise<boolean> {
			return new Promise((resolve) => {
				dialogTitle.value = title;
				dialogMessage.value = message;
				dialogType.value = type;
				dialogActive.value = true;
				dialogResolve.value = (value: boolean) => {
					dialogActive.value = false;
					resolve(value);
				};
			});
		}

		function showAlert(title: string, message: string): Promise<void> {
			return showDialog(title, message, 'alert').then(() => {});
		}

		function showConfirm(title: string, message: string): Promise<boolean> {
			return showDialog(title, message, 'confirm');
		}

		// Simple notification system
		const showNotification = (type: 'success' | 'error', message: string) => {
			// Try to use Directus's built-in notification system
			if ((window as any).$notify) {
				(window as any).$notify({
					type,
					title: type === 'success' ? t('Success') : t('Error'),
					text: message,
				});
			} else {
				// Fallback to dialog
				const title = type === 'success' ? t('Success') : t('Error');
				showAlert(title, message);
			}
		};

		// Variant preparations state
		const variantPreparations = ref<VariantPreparation[]>([]);
		const variantPreparationsPage = ref(1);
		const VARIANTS_PER_PAGE = 10;

		// Generate variant preparations based on selected options
		function generateVariantPreparations() {
			const preparations: VariantPreparation[] = [];
			const axes = variantAxes.value.filter((axis) => selectedOptions.value[axis.id]?.length > 0);

			if (axes.length === 0) {
				variantPreparations.value = [];
				return;
			}

			// Generate all combinations
			const generateCombinations = (axisIndex: number, current: Record<number, number>, attrs: any[]) => {
				if (axisIndex === axes.length) {
					// Check if this combination already exists
					const combinationKey = generateCombinationKey(current);
					if (existingVariantCombinations.value.has(combinationKey)) {
						return; // Skip this combination as it already exists
					}

					// Create a preparation for this NEW combination
					const generatedName = generateVariantName(attrs);
					const basePrice = baseProduct.value?.price || null;

					preparations.push({
						name: generatedName,
						price: basePrice,
						image: null,
						enabled: true,
						attributes: attrs,
						combination: { ...current },
					});
					return;
				}

				const axis = axes[axisIndex];
				const selectedIds = selectedOptions.value[axis.id] || [];

				for (const optionId of selectedIds) {
					const option = axis.availableOptions.find((o) => o.id === optionId);
					if (option) {
						current[axis.id] = optionId;
						const newAttrs = [
							...attrs,
							{
								code: axis.attribute.code,
								label: option.label,
								value: option.value || { id: option.id, label: option.label, code: option.code },
								attribute_id: axis.attribute.id,
							},
						];
						generateCombinations(axisIndex + 1, current, newAttrs);
					}
				}
			};

			generateCombinations(0, {}, []);
			variantPreparations.value = preparations;
		}

		// Calculate total combinations
		const totalCombinations = computed(() => {
			let total = 1;
			let hasMultipleAxes = 0;

			for (const axis of variantAxes.value) {
				const selectedCount = selectedOptions.value[axis.id]?.length || 0;
				if (selectedCount > 0) {
					total *= selectedCount;
					hasMultipleAxes++;
				}
			}

			return total > 0 && hasMultipleAxes > 0 ? total : 0;
		});

		// Calculate NEW combinations that would be created (excluding existing ones)
		const newCombinations = computed(() => {
			return variantPreparations.value.length;
		});

		const hasValidConfiguration = computed(() => {
			return variantAxes.value.every((axis) => selectedOptions.value[axis.id]?.length > 0);
		});

		// Compute paginated variant preparations
		const paginatedVariantPreparations = computed(() => {
			const start = (variantPreparationsPage.value - 1) * VARIANTS_PER_PAGE;
			const end = start + VARIANTS_PER_PAGE;
			return variantPreparations.value.slice(start, end);
		});

		const variantPreparationsTotalPages = computed(() => {
			return Math.ceil(variantPreparations.value.length / VARIANTS_PER_PAGE);
		});

		// Compute paginated existing variants
		const paginatedExistingVariants = computed(() => {
			const start = (existingVariantsPage.value - 1) * EXISTING_VARIANTS_PER_PAGE;
			const end = start + EXISTING_VARIANTS_PER_PAGE;
			return existingVariants.value.slice(start, end);
		});

		const existingVariantsTotalPages = computed(() => {
			return Math.ceil(existingVariants.value.length / EXISTING_VARIANTS_PER_PAGE);
		});

		// Generate preview combinations
		const previewCombinations = computed(() => {
			const combinations: Record<string, string>[] = [];
			const axes = variantAxes.value.filter((axis) => selectedOptions.value[axis.id]?.length > 0);

			if (axes.length === 0) return combinations;

			// Generate first 10 combinations for preview
			const generatePreview = (axisIndex: number, current: Record<string, string>) => {
				if (combinations.length >= 10) return;

				if (axisIndex === axes.length) {
					combinations.push({ ...current });
					return;
				}

				const axis = axes[axisIndex];
				const selectedIds = selectedOptions.value[axis.id] || [];

				for (const optionId of selectedIds.slice(0, 3)) {
					// Limit to 3 per axis for preview
					const option = axis.availableOptions.find((o) => o.id === optionId);
					if (option) {
						current[axis.attribute.code] = option.label;
						generatePreview(axisIndex + 1, current);
						if (combinations.length >= 10) break;
					}
				}
			};

			generatePreview(0, {});
			return combinations;
		});

		// Load existing variants for the product
		async function loadExistingVariants() {
			if (!props.primaryKey || props.primaryKey === '+') {
				existingVariants.value = [];
				return;
			}

			try {
				const response = await api.get('/items/products', {
					params: {
						filter: {
							parent_product_id: props.primaryKey,
							product_type: 'simple',
						},
						fields: ['*', 'attributes.*', 'attributes.attribute_id.*', 'products_product_images.*', 'products_product_images.product_images_id.*'],
						sort: ['-date_created'],
					},
				});

				console.log('Existing variants:', response.data.data);
				console.log('First variant full structure:', JSON.stringify(response.data.data[0], null, 2));

				// Process variants and add display attributes
				const variants = response.data.data.map((variant: any) => {
					// Get name and price from attributes
					const nameAttr = variant.attributes?.find((attr: any) => {
						const code = attr.attribute_id?.code;
						return code === 'name';
					});
					const priceAttr = variant.attributes?.find((attr: any) => {
						const code = attr.attribute_id?.code;
						return code === 'price';
					});

					// Parse attribute values
					let name = null;
					let price = null;

					if (nameAttr?.value) {
						try {
							name = typeof nameAttr.value === 'string' ? JSON.parse(nameAttr.value) : nameAttr.value;
						} catch {
							name = nameAttr.value;
						}
					}

					if (priceAttr?.value) {
						try {
							price = typeof priceAttr.value === 'string' ? JSON.parse(priceAttr.value) : priceAttr.value;
						} catch {
							price = priceAttr.value;
						}
					}

					// Get variant attributes (excluding name and price)
					const displayAttributes =
						variant.attributes
							?.filter((attr: any) => {
								const code = attr.attribute_id?.code;
								return code !== 'name' && code !== 'price';
							})
							.map((attr: any) => {
								let value = attr.value;
								if (typeof value === 'string') {
									try {
										value = JSON.parse(value);
									} catch {
										// Keep as string if not JSON
									}
								}

								return {
									code: attr.attribute_id?.code || '',
									label: value?.label || value || attr.attribute_id?.label || '',
								};
							}) || [];

					// Get the first image from the product images if available
					let image = null;
					if (variant.products_product_images && variant.products_product_images.length > 0) {
						const firstImageRelation = variant.products_product_images[0];
						if (firstImageRelation.product_images_id && firstImageRelation.product_images_id.media) {
							image = firstImageRelation.product_images_id.media;
						}
					}

					const processedVariant = {
						...variant,
						name,
						price,
						displayAttributes,
						image,
					};
					return processedVariant;
				});

				existingVariants.value = variants;
				hasExistingVariants.value = variants.length > 0;
			} catch (error) {
				console.error('Failed to load existing variants:', error);
				existingVariants.value = [];
				usedOptions.value = {};
			}
		}

		// Variant management functions
		async function toggleVariantStatus(variant: any) {
			try {
				await api.patch(`/items/products/${variant.id}`, {
					enabled: !variant.enabled,
				});
				variant.enabled = !variant.enabled;
				showNotification('success', t('Variant status updated'));
			} catch (error) {
				showNotification('error', t('Failed to update variant status'));
			}
		}

		function editVariant(variant: any) {
			window.location.href = `/admin/content/products/${variant.id}`;
		}

		async function deleteVariant(variant: any) {
			const shouldDelete = await showConfirm(
				t('Confirm Delete'),
				t('Are you sure you want to delete this variant?')
			);
			if (shouldDelete) {
				try {
					await api.delete(`/items/products/${variant.id}`);
					await loadExistingVariants();
					analyzeUsedOptions();
					showNotification('success', t('Variant deleted successfully'));
				} catch (error) {
					showNotification('error', t('Failed to delete variant'));
				}
			}
		}

		async function enableAllVariants() {
			try {
				const variantIds = existingVariants.value.map((v) => v.id);
				await Promise.all(variantIds.map((id) => api.patch(`/items/products/${id}`, { enabled: true })));
				await loadExistingVariants();
				analyzeUsedOptions();
				showNotification('success', t('All variants enabled'));
			} catch (error) {
				showNotification('error', t('Failed to enable variants'));
			}
		}

		async function disableAllVariants() {
			try {
				const variantIds = existingVariants.value.map((v) => v.id);
				await Promise.all(variantIds.map((id) => api.patch(`/items/products/${id}`, { enabled: false })));
				await loadExistingVariants();
				analyzeUsedOptions();
				showNotification('success', t('All variants disabled'));
			} catch (error) {
				showNotification('error', t('Failed to disable variants'));
			}
		}

		async function deleteAllVariants() {
			const shouldDeleteAll = await showConfirm(
				t('Confirm Delete All'),
				t('Are you sure you want to delete all variants? This action cannot be undone.')
			);
			if (shouldDeleteAll) {
				try {
					const variantIds = existingVariants.value.map((v) => v.id);
					await Promise.all(variantIds.map((id) => api.delete(`/items/products/${id}`)));
					await loadExistingVariants();
					analyzeUsedOptions();
					showNotification('success', t('All variants deleted'));
				} catch (error) {
					showNotification('error', t('Failed to delete variants'));
				}
			}
		}

		function formatPrice(price: number | string): string {
			if (typeof price === 'number') {
				return new Intl.NumberFormat('nb-NO', {
					minimumSignificantDigits: 1,
					style: 'currency',
					currency: 'NOK',
				}).format(price);
			}
			return String(price);
		}

		// Helper functions
		function getImageUrl(imageId: string): string {
			return `/assets/${imageId}?width=32&height=32&fit=cover`;
		}

		function emitValue() {
			// Clean up empty arrays
			const cleaned = Object.entries(selectedOptions.value)
				.filter(([_, options]) => options.length > 0)
				.reduce((acc, [axisId, options]) => {
					acc[Number(axisId)] = options;
					return acc;
				}, {} as SelectedOptions);

			emit('input', cleaned);
		}

		// Lifecycle
		watch(
			() => props.familyVariantValue,
			() => {
				loadVariantConfiguration();
			},
		);

		watch(
			() => props.values?.['family_variant'],
			() => {
				loadVariantConfiguration();
			},
		);

		watch(
			() => formValues.value?.['family_variant'],
			() => {
				loadVariantConfiguration();
			},
		);

		watch(
			() => props.primaryKey,
			() => {
				updateFamilyVariant();
				loadBaseProduct();
			},
		);

		watch(familyVariant, () => {
			loadVariantConfiguration();
		});

		// Watch for changes in selected options to regenerate preparations
		watch(
			selectedOptions,
			() => {
				generateVariantPreparations();
				variantPreparationsPage.value = 1; // Reset to first page
			},
			{ deep: true },
		);

		// Watch for changes in base product to update names/prices
		watch(
			baseProduct,
			() => {
				if (variantPreparations.value.length > 0) {
					generateVariantPreparations();
				}
			},
			{ deep: true },
		);

		onMounted(() => {
			loadVariantConfiguration();
			updateFamilyVariant();
			loadBaseProduct();
			loadExistingVariants();
		});

		return {
			t,
			loading,
			generating,
			regenerating,
			familyVariant,
			variantAxes,
			selectedOptions,
			hasExistingVariants,
			totalCombinations,
			newCombinations,
			hasValidConfiguration,
			previewCombinations,
			showPreview: props.showPreview,
			enableBulkActions: props.enableBulkActions,
			isSelected,
			toggleOption,
			selectAll,
			deselectAll,
			getSelectedCount,
			getOptionStats,
			searchOptions,
			changePage,
			getTotalPages,
			currentPages,
			addNewOption,
			generateVariants,
			regenerateVariants,
			getImageUrl,
			searchTerms,
			loadingMoreOptions,
			totalOptionCounts,
			variantPreparations,
			paginatedVariantPreparations,
			variantPreparationsPage,
			variantPreparationsTotalPages,
			existingVariants,
			paginatedExistingVariants,
			existingVariantsPage,
			existingVariantsTotalPages,
			loadExistingVariants,
			toggleVariantStatus,
			editVariant,
			deleteVariant,
			enableAllVariants,
			disableAllVariants,
			deleteAllVariants,
			formatPrice,
			selectImage,
			baseProduct,
			generateVariantName,
			applyBasePriceToAll,
			clearAllPrices,
			regenerateAllNames,
			isOptionFullyUsed,
			isOptionPartiallyUsed,
			analyzeUsedOptions,
			configurationDetailOpen,
			existingVariantsDetailOpen,
			dialogActive,
			dialogTitle,
			dialogMessage,
			dialogType,
			dialogResolve,
			filePickerActive,
			selectedFileId,
			recentFiles,
			fileInput,
			triggerFileUpload,
			handleFileUpload,
			selectFile,
			confirmFileSelection,
			getFileUrl,
		};
	},
});
</script>

<style lang="scss" scoped>
.variant-configuration {
	position: relative;
	display: grid;
	gap: var(--theme--form--row-gap) var(--theme--form--column-gap);
}

.loading {
	display: flex;
	justify-content: center;
	align-items: center;
}

.no-family-variant {
	padding: 20px 0;
}

.configuration-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}

.configuration-header h3 {
	margin: 0;
}

.configuration-section,
.linked-products-section {
	padding: 20px;
	background: var(--theme--background-subdued);
	border-radius: var(--theme--border-radius);
}

.axis-header,
.variants-header {
	font-size: 16px;
	font-weight: 700;
	color: var(--theme--foreground-accent);
}

.axis-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
}

.axis-info {
	display: flex;
	align-items: center;
	gap: 8px;
}

.axis-info h3 {
	margin: 0;
}

.option-count {
	color: var(--theme--foreground-subdued);
}

.axis-actions {
	display: flex;
	gap: 8px;
}

.options-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 12px;
	margin-bottom: 16px;
}

.option-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px;
	background: var(--theme--background-normal);
	border: 2px solid var(--theme--border-color-subdued);
	border-radius: var(--theme--border-radius);
	cursor: pointer;
	transition: all 0.2s;
}

.option-item:hover {
	border-color: var(--theme--primary);
	background: var(--theme--primary-subdued);
}

.option-item.selected {
	border-color: var(--theme--primary);
	background: var(--theme--primary-background);
}

.option-content {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 4px;
	flex: 1;
}

.option-image {
	flex-shrink: 0;
}

.option-label {
	font-weight: 500;
	line-height: 1.5;
}

.option-code {
	color: var(--theme--foreground-subdued);
	font-size: 12px;
	line-height: 1.2;
}

.option-item.fully-used {
	background: var(--theme--background-subdued);
	border-color: var(--theme--border-color);
	opacity: 0.7;
}

.option-item.fully-used.selected {
	background: var(--theme--primary-background);
	border-color: var(--theme--primary);
	opacity: 1;
}

.option-item.partially-used {
	background: var(--theme--background-accent);
	border-color: var(--theme--border-color-accent);
}

.option-item.partially-used.selected {
	background: var(--theme--primary-background);
	border-color: var(--theme--primary);
}

.used-indicator {
	color: var(--theme--foreground-subdued);
	font-size: 14px;
	margin-left: 4px;
}

.partial-indicator {
	color: var(--theme--warning);
	font-size: 14px;
	margin-left: 4px;
}

.bulk-actions {
	display: flex;
	gap: 8px;
}

.generation-actions {
	display: flex;
	gap: 12px;
	padding-top: var(--theme--form--row-gap);
	border-top: var(--theme--border-width) solid var(--theme--border-color-subdued);
}

.variant-preview h3 {
	margin: 0 0 16px 0;
}

.preview-grid {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.preview-item {
	display: flex;
	gap: 8px;
	padding: 8px 12px;
	background: var(--theme--background-normal);
	border-radius: var(--theme--border-radius);
	font-size: 14px;
}

.preview-attribute {
	padding: 2px 8px;
	background: var(--theme--background-normal-alt);
	border-radius: var(--theme--border-radius);
}

.preview-note {
	margin-top: 12px;
	color: var(--foreground-subdued);
	font-size: 14px;
	font-style: italic;
}

.variants-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 24px;
}

.variants-header h3 {
	margin: 0;
}

.variant-prep-info {
	display: flex;
	align-items: center;
	gap: 8px;
	color: var(--foreground-subdued);
	font-size: 14px;
}

.bulk-actions-toolbar {
	display: flex;
	flex-wrap: wrap;
	gap: 24px;
	padding: 16px;
	background: var(--background-subdued);
	border-radius: var(--theme--border-radius);
	margin-bottom: 16px;
	border: var(--theme--border-width) solid var(--theme--border-color-subdued);
}

.bulk-actions-section {
	display: flex;
	align-items: center;
	gap: 12px;
}

.bulk-actions-label {
	font-weight: 600;
	color: var(--foreground-normal);
	font-size: 14px;
	white-space: nowrap;
}

.variants-table {
	overflow-x: auto;
}

.variants-table table {
	display: grid;
	grid-template-columns: 80px 1fr 3fr 1fr;
	gap: 16px 8px;
}

.variants-table th {
	text-align: left;
	font-weight: 700;
	font-size: 14px;
	color: var(--theme--foreground-accent);
}

.variants-table thead,
.variants-table tbody,
.variants-table tr {
	display: contents;
}

.variant-attributes {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}

.variant-image {
	cursor: pointer;
	transition: var(--medium) var(--transition);

	&:hover {
		background: var(--theme--background-accent);
	}
}

/* Search and pagination styles */
.search-container {
	margin-bottom: 16px;
}

.pagination-container {
	display: flex;
	justify-content: center;
	padding-top: 16px;
	border-top: 2px solid var(--theme--border-color-subdued);
}

.variants-pagination-container {
	display: flex;
	justify-content: center;
	padding-top: 16px;
	margin-top: 16px;
	border-top: 2px solid var(--theme--border-color-subdued);
}

/* Existing variants styles */
.existing-variants-list {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-bottom: 16px;
}

.variant-row {
	display: flex;
	align-items: center;
	gap: 16px;
	background: var(--theme--background-normal);
	border: 2px solid var(--theme--border-color-subdued);
	border-radius: var(--theme--border-radius);
	padding: 16px;
	transition: all 0.2s;
}

.variant-row:hover {
	border-color: var(--theme--primary);
	background: var(--theme--background-accent);
}

.variant-row.disabled {
	opacity: 0.6;
	background: var(--theme--background-subdued);
}

.variant-image {
	flex-shrink: 0;
}

.variant-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
}

.variant-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16px;
}

.variant-name-price {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.variant-name {
	font-weight: 600;
	color: var(--theme--foreground-accent);
	line-height: 1.4;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.variant-price {
	font-weight: 500;
	color: var(--theme--success);
	font-size: 14px;
}

.variant-actions {
	flex-shrink: 0;
}

.variant-attributes {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}

.variant-attributes .variant-configured {
	background: var(--theme--primary-background);
	color: var(--theme--primary);
	border: 1px solid var(--theme--primary);
}


.configuration-content,
.linked-products-content {
	display: grid;
	gap: var(--theme--form--row-gap) var(--theme--form--column-gap);
}

.v-divider {
	cursor: pointer;
}

.v-divider .expand-icon {
	float: right;
	transform: rotate(90deg) !important;
	transition: transform var(--fast) var(--transition);
}

.v-divider.active .expand-icon {
	transform: rotate(0) !important;
}

.v-divider :deep(.type-text) {
	position: relative;
}

.variant-info {
	margin-bottom: 16px;
}

.file-picker-content {
	padding: 20px 0;

	.file-upload-area {
		margin-bottom: 30px;
		padding: 20px;
		border: 2px dashed var(--border-normal);
		border-radius: 8px;
		text-align: center;
	}

	.recent-files {
		h3 {
			margin-bottom: 16px;
			font-size: 16px;
			font-weight: 600;
		}

		.files-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
			gap: 16px;

			.file-item {
				padding: 8px;
				border: 2px solid transparent;
				border-radius: 8px;
				cursor: pointer;
				text-align: center;
				transition: border-color 0.2s;

				&:hover {
					border-color: var(--border-normal);
				}

				&.selected {
					border-color: var(--primary);
					background-color: var(--primary-alt);
				}

				img {
					width: 100%;
					height: 80px;
					object-fit: cover;
					border-radius: 4px;
					margin-bottom: 4px;
				}

				span {
					display: block;
					font-size: 12px;
					color: var(--foreground-subdued);
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}
			}
		}
	}
}
</style>

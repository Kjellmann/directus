import { defineInterface } from '@directus/extensions';
import ProductAttributes from './components/ProductAttributes.vue';

export default defineInterface({
	id: 'product-attributes',
	name: 'Product Attributes',
	description: 'Dynamic product attribute management with batch operations and revision support',
	icon: 'widgets',
	component: ProductAttributes,
	types: ['alias'],
	localTypes: ['o2m'],
	relational: true,
	options: () => {
		return [
			{
				field: 'showFooterActions',
				name: 'Show Footer Actions',
				type: 'boolean',
				meta: {
					interface: 'boolean',
					options: {
						label: 'Display save/reset buttons at the bottom',
					},
				},
				schema: {
					default_value: true,
				},
			},
			{
				field: 'enableBatchMode',
				name: 'Enable Batch Mode',
				type: 'boolean',
				meta: {
					interface: 'boolean',
					options: {
						label: 'Allow batch updates in list view',
					},
				},
				schema: {
					default_value: true,
				},
			},
			{
				field: 'autoSave',
				name: 'Auto Save',
				type: 'boolean',
				meta: {
					interface: 'boolean',
					options: {
						label: 'Automatically save changes (requires debounce)',
					},
				},
				schema: {
					default_value: false,
				},
			},
			{
				field: 'autoSaveDelay',
				name: 'Auto Save Delay',
				type: 'integer',
				meta: {
					interface: 'input',
					options: {
						placeholder: '1000',
						min: 100,
						max: 10000,
						step: 100,
					},
					conditions: [
						{
							rule: {
								autoSave: {
									_eq: true,
								},
							},
							hidden: false,
							required: true,
						},
					],
				},
				schema: {
					default_value: 1000,
				},
			},
			{
				field: 'showRevisions',
				name: 'Show Revisions',
				type: 'boolean',
				meta: {
					interface: 'boolean',
					options: {
						label: 'Display revision history',
					},
				},
				schema: {
					default_value: false,
				},
			},
		];
	},
});

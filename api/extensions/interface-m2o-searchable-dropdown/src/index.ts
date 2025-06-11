import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'm2o-searchable-dropdown',
	name: 'M2O Searchable Dropdown',
	icon: 'arrow_drop_down_circle',
	description: 'Select a related item from a searchable dropdown',
	component: InterfaceComponent,
	types: ['uuid', 'string', 'text', 'integer', 'bigInteger'],
	localTypes: ['m2o'],
	group: 'relational',
	relational: true,
	options: ({ relations }) => {
		const collection = relations.o2m?.collection;
		return [
			{
				field: 'template',
				name: '$t:display_template',
				meta: {
					interface: 'system-display-template',
					options: {
						collectionName: collection,
					},
					width: 'half',
				},
			},
			{
				field: 'placeholder',
				name: 'Placeholder',
				type: 'string',
				meta: {
					interface: 'input',
					width: 'half',
					options: {
						placeholder: 'Enter a placeholder',
					},
				},
			},
			{
				field: 'filter',
				name: '$t:filter',
				type: 'json',
				meta: {
					interface: 'system-filter',
					options: {
						collectionName: collection,
					},
				},
			},
		];
	},
	recommendedDisplays: ['related-values'],
});

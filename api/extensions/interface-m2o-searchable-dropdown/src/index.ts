import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'm2o-searchable-dropdown',
	name: '$t:interfaces.m2o_searchable_dropdown.name',
	icon: 'arrow_drop_down_circle',
	description: '$t:interfaces.m2o_searchable_dropdown.description',
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
				name: '$t:placeholder',
				type: 'string',
				meta: {
					interface: 'input',
					width: 'half',
					options: {
						placeholder: '$t:enter_a_placeholder',
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

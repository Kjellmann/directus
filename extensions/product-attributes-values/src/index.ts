import { defineInterface } from '@directus/extensions';
import ProductAttributes from './interface.vue';

export default defineInterface({
	id: 'product-attributes',
	name: 'Product Attributes',
	description: 'A custom interface for managing product attributes via a one-to-many relation',
	icon: 'widgets',
	component: ProductAttributes,
	types: ['alias'],
	localTypes: ['o2m'],
	relational: true,
	options: ({ relations, field: { meta } }) => {
		return [
			{
				field: 'showRequired',
				name: 'Show Required',
				type: 'boolean',
				meta: {
					interface: 'boolean',
					options: {
						label: 'Display required attributes',
					},
				},
			},
		];
	},
});

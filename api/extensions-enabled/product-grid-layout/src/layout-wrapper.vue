<template>
  <layout-tabular-enhanced v-bind="layoutProps" />
</template>

<script setup lang="ts">
import { inject } from 'vue';
import LayoutTabularEnhanced from './layout-tabular-enhanced.vue';

const layoutProps = inject('layoutProps');
</script>
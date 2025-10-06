import { createRouter, createWebHistory } from 'vue-router';
import EmbedView from './EmbedView.vue';

const routes = [
  { path: '/', component: EmbedView },           // optional
  { path: '/embed', component: EmbedView },      // Seite, die das iframe rendert
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
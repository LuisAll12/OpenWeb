import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

const routes = [
  { path: '/', App },           // optional  // Seite, die das iframe rendert
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
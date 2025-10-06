<template>
  <div class="w-full h-screen">
    <iframe v-if="src" :src="src" class="w-full h-full block" frameborder="0"></iframe>
    <div v-else class="p-4">Lade…</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { skleraSDK } from '@sklera/sdk'

// Proxy Basis. Für Produktion via Vite-Env konfigurierbar
const PROXY_BASE = (import.meta.env.VITE_PROXY_BASE || 'http://localhost:3000').replace(/\/$/, '')

const url = ref('')
const selector = ref('')
const offset = ref(0)
const src = ref('')

function buildSrc() {
  if (!url.value) return ''
  const p = new URLSearchParams()
  p.set('url', url.value)
  if (selector.value) p.set('selector', selector.value)
  if (offset.value) p.set('offset', String(offset.value))
  return `${PROXY_BASE}/proxy?${p.toString()}`
}

function applyPayload(payload) {
  try {
    if (!payload) return
    if (typeof payload === 'string') payload = JSON.parse(payload)
  } catch {}
  if (payload?.url) url.value = payload.url
  if (payload?.selector) selector.value = payload.selector
  if (payload?.offset != null) offset.value = Number(payload.offset) || 0
  src.value = buildSrc()
}

function loadFromQuery() {
  const q = new URLSearchParams(window.location.search)
  const u = q.get('url')
  const s = q.get('selector')
  const o = q.get('offset')
  if (u) url.value = u
  if (s) selector.value = s
  if (o) offset.value = Number(o) || 0
}

function loadFromLocalStorage() {
  const key = 'sklera:last-open-link'
  const raw = localStorage.getItem(key)
  if (!raw) return
  try {
    const data = JSON.parse(raw)
    applyPayload(data)
    localStorage.removeItem(key)
  } catch {}
}

onMounted(() => {
  // Fallback für lokale Tests ohne Sklera
  loadFromQuery()

  skleraSDK.loaded(() => {
    const cfg = skleraSDK.getAppConfig?.() || {}
    if (!url.value && cfg.url) url.value = cfg.url
    if (!selector.value && cfg.selector) selector.value = cfg.selector
    if (!offset.value && cfg.offset) offset.value = Number(cfg.offset) || 0

    // Initiale URL bauen
    src.value = buildSrc()

    // Custom App Event Kanal
    skleraSDK.onCustomAppEvent((event) => {
      const { cmd, data } = event
      if (cmd === 'openLink' || cmd === 'setURL') applyPayload(data)
    })

    // Übergabe über LocalStorage als Fallback zwischen Layouts
    if (!url.value) {
      loadFromLocalStorage()
      if (!src.value && url.value) src.value = buildSrc()
    }
  })
})
</script>

<style scoped>
iframe { width: 100%; height: 100vh; border: none; }
</style>

<template>
  <div class="w-full h-screen">
    <iframe :src="iframeSrc" class="w-full h-full block" frameborder="0"></iframe>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { skleraSDK } from '@sklera/sdk'
import { ref, onMounted, onBeforeUnmount } from 'vue'

const route = useRoute()
const rawUrl   = route.query.url ?? 'https://expovina.ch/weinschiffe'
const selector = route.query.selector ?? ''
const offset   = route.query.offset ?? '0'

function buildProxyUrl({ url, selector, offset, scrollX, scrollY } = {}) {
  const p = new URLSearchParams()
  p.set('url', url || rawUrl)
  if (selector) p.set('selector', selector)
  if (offset !== undefined && offset !== null && String(offset) !== '') p.set('offset', String(offset))
  if (scrollX !== undefined) p.set('scrollX', String(scrollX))
  if (scrollY !== undefined) p.set('scrollY', String(scrollY))
  const finalUrl = `https://open-web-sigma.vercel.app/proxy?${p.toString()}`
  console.log('[EmbedView] buildProxyUrl ->', finalUrl)
  return finalUrl
}

const iframeSrc = ref(buildProxyUrl({ url: rawUrl, selector, offset }))

function toJsonMaybe(val) {
  if (val == null) return null
  if (typeof val === 'string') {
    try { return JSON.parse(val) } catch { return null }
  }
  if (typeof val === 'object') return val
  return null
}

function sanitizePayload(data) {
  if (!data || typeof data !== 'object') return null
  const payload = {}
  if (typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) payload.url = data.url
  if (typeof data.selector === 'string') payload.selector = data.selector
  if (data.offset !== undefined) {
    const n = Number(data.offset)
    if (!Number.isNaN(n)) payload.offset = n
  }
  // position -> scrollX/scrollY
  const pos = data.position || data.scroll || null
  if (pos && typeof pos === 'object') {
    const sx = Number(pos.x)
    const sy = Number(pos.y)
    if (!Number.isNaN(sx)) payload.scrollX = sx
    if (!Number.isNaN(sy)) payload.scrollY = sy
  }
  return Object.keys(payload).length ? payload : null
}

let debounceTimer = null
function applyCommandDebounced(payload) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const next = buildProxyUrl(payload)
    if (next !== iframeSrc.value) {
      console.log('[EmbedView] applying payload ->', payload)
      iframeSrc.value = next
    } else {
      console.log('[EmbedView] payload identical, skipping reload')
    }
  }, 80)
}

/**
 * Akzeptiert alle bekannten Varianten:
 * - onCustomAppEvent((cmd, data) => ...)
 * - onCustomAppEvent(({cmd, data}) => ...)
 * - onCustomAppEvent((dataOnly) => ...)  (weil cmdFilter gesetzt ist)
 */
function handleCustomEvent(a, b) {
  // Normalisieren
  let cmd = null
  let data = null

  if (typeof a === 'string') {       // (cmd, data)
    cmd = a
    data = toJsonMaybe(b) ?? b
  } else if (a && typeof a === 'object' && ('cmd' in a || 'data' in a)) { // ({cmd, data})
    cmd = a.cmd ?? null
    data = toJsonMaybe(a.data) ?? a.data
  } else {                           // (dataOnly)
    data = toJsonMaybe(a) ?? a
  }

  console.log('[EmbedView] custom event raw ->', { a, b, normCmd: cmd, normData: data })

  // Zusätzlich absichern, falls cmdFilter aus irgendeinem Grund nicht greift
  if (cmd && cmd !== 'open-url') {
    console.log('[EmbedView] ignored because cmd != open-url')
    return
  }

  const payload = sanitizePayload(data)
  if (!payload) {
    console.warn('[EmbedView] invalid payload ->', data)
    return
  }
  applyCommandDebounced(payload)
}

function onWindowMessage(e) {
  const d = e?.data
  if (d?.channel !== 'sklera-app-command') return
  console.log('[EmbedView] postMessage received ->', d)
  handleCustomEvent(d.command) // command kann String oder Objekt sein
}

let listenerRef = null

// Registrierung SOFORT, damit kein Event verloren geht
if (typeof skleraSDK?.onCustomAppEvent === 'function') {
  try {
    listenerRef = skleraSDK.onCustomAppEvent((...args) => handleCustomEvent(...args), 'open-url')
    console.log('[EmbedView] onCustomAppEvent listener attached (filter=open-url)')
  } catch (e) {
    console.warn('[EmbedView] onCustomAppEvent attach failed', e)
  }
}

onMounted(() => {
  console.log('[EmbedView] mounted')
  skleraSDK.loaded?.(() => {
    console.log('[EmbedView] Sklera SDK loaded')
    const appConfig = skleraSDK.getConfig?.() || {}
    const u = appConfig.url || rawUrl
    const s = appConfig.selector ?? selector
    const o = appConfig.offset ?? offset
    iframeSrc.value = buildProxyUrl({ url: u, selector: s, offset: o })
  })

  window.addEventListener('message', onWindowMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onWindowMessage)
  clearTimeout(debounceTimer)
  try { listenerRef?.remove?.() } catch {}
  try { listenerRef?.off?.() } catch {}
})
</script>

<style scoped>
iframe { width: 100%; height: 100vh; border: none; }
</style>

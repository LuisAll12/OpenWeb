<template>
  <div class="w-full h-screen">
    <iframe :src="iframeSrc" class="w-full h-full block" frameborder="0"></iframe>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { skleraSDK } from '@sklera/sdk'
import { ref, onMounted } from 'vue'

const route = useRoute()
const rawUrl   = (route.query.url ?? 'https://expovina.ch/weinschiffe')
const selector = (route.query.selector ?? '')
const offset   = (route.query.offset ?? '0')

// MACHT ES REAKTIV:
const iframeSrc = ref(`https://open-web-sigma.vercel.app/proxy?${new URLSearchParams({
  url: rawUrl,
  ...(selector ? { selector } : {}),
  ...(offset ? { offset } : {}),
}).toString()}`)

onMounted(() => {
  console.log('onMounted EmbedView')
  skleraSDK.loaded(() => {
    console.log('Sklera SDK loaded in EmbedView')

    // KORREKTER NAME UND KEINE REASSIGNMENTS VON const:
    const appConfig = skleraSDK.getConfig?.() || {}

    // Fallbacks nur verwenden, wenn Config leer ist
    const u = appConfig.url || rawUrl
    const s = (appConfig.selector ?? selector)
    const o = (appConfig.offset ?? offset)

    const p = new URLSearchParams()
    p.set('url', u)
    if (s) p.set('selector', s)
    if (o !== undefined && o !== null && o !== '') p.set('offset', String(o))

    // REAKTIV SETZEN → iFrame lädt neu
    iframeSrc.value = `https://open-web-sigma.vercel.app/proxy?${p.toString()}`
  })
})
</script>


<style scoped>
iframe {
  width: 100%;
  height: 100vh;
  border: none;
}
</style>

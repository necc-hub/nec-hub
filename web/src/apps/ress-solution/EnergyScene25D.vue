<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Scenario } from './data'

const props = defineProps<{ scenario: Scenario }>()
const rotateX = ref(58)
const rotateZ = ref(-34)
const zoom = ref(1)
const autoRotate = ref(false)
const selected = ref('vesta')
const dragging = ref(false)
let lastX = 0
let lastY = 0
let rotationTimer: ReturnType<typeof setInterval> | undefined

const products = {
  pv: { name: '屋顶光伏', en: 'PV ARRAY', spec: '按屋顶深化设计', text: '光伏是家庭绿色能源的起点，容量与组件需结合现场设计。' },
  vesta: { name: 'Vesta 混合逆变器', en: '4-IN-1 ENERGY HUB', spec: 'PV · Battery · Grid · Charger', text: '统一连接光伏、储能、电网和充电端口，是整套系统的能源中枢。' },
  battery: { name: 'vBox 储能系统', en: 'MODULAR LFP STORAGE', spec: '3.46 kWh / 模块 · IP55', text: '模块化 LFP 电池，支持容量扩展，并集成 FCS 安全能力。' },
  mid: { name: 'MID 微网互联', en: 'MICROGRID INTERCONNECTION', spec: '63 A · 20 ms · RS485', text: '在并网与离网状态间自动切换，20 ms 为产品规格页参数。' },
  ev: { name: 'AC Charger', en: 'GREEN EV CHARGING', spec: '预约充电 · 负载均衡', text: '利用光伏、储能和电网协同充电，实际端口能力按机型确认。' },
} as const

type ProductKey = keyof typeof products
const detail = computed(() => products[selected.value as ProductKey])
const worldStyle = computed(() => ({
  '--rx': `${rotateX.value}deg`,
  '--rz': `${rotateZ.value}deg`,
  '--zoom': zoom.value,
}))
const modeLabel = computed(() => ({ self: '光伏自洽', tou: '峰谷优化', backup: '无忧备电', ev: '绿色充电' }[props.scenario.id]))

function selectProduct(key: ProductKey) {
  selected.value = key
}

function setView(view: 'iso' | 'top' | 'front') {
  if (view === 'top') {
    rotateX.value = 76
    rotateZ.value = -18
  } else if (view === 'front') {
    rotateX.value = 34
    rotateZ.value = -8
  } else {
    rotateX.value = 58
    rotateZ.value = -34
  }
}

function changeZoom(delta: number) {
  zoom.value = Math.min(1.35, Math.max(.72, Number((zoom.value + delta).toFixed(2))))
}

function resetView() {
  setView('iso')
  zoom.value = 1
  autoRotate.value = false
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0) return
  dragging.value = true
  lastX = event.clientX
  lastY = event.clientY
  autoRotate.value = false
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function drag(event: PointerEvent) {
  if (!dragging.value) return
  const dx = event.clientX - lastX
  const dy = event.clientY - lastY
  lastX = event.clientX
  lastY = event.clientY
  rotateZ.value = Math.max(-75, Math.min(25, rotateZ.value + dx * .16))
  rotateX.value = Math.max(28, Math.min(78, rotateX.value - dy * .12))
}

function stopDrag() {
  dragging.value = false
}

function keyboard(event: KeyboardEvent) {
  const actions: Record<string, () => void> = {
    ArrowLeft: () => { rotateZ.value = Math.max(-75, rotateZ.value - 4) },
    ArrowRight: () => { rotateZ.value = Math.min(25, rotateZ.value + 4) },
    ArrowUp: () => { rotateX.value = Math.min(78, rotateX.value + 4) },
    ArrowDown: () => { rotateX.value = Math.max(28, rotateX.value - 4) },
    '+': () => changeZoom(.08),
    '=': () => changeZoom(.08),
    '-': () => changeZoom(-.08),
    '0': resetView,
  }
  const action = actions[event.key]
  if (action) {
    event.preventDefault()
    autoRotate.value = false
    action()
  }
}

watch(autoRotate, enabled => {
  if (rotationTimer) clearInterval(rotationTimer)
  rotationTimer = undefined
  if (enabled) {
    rotationTimer = setInterval(() => {
      rotateZ.value += .12
      if (rotateZ.value > 25) rotateZ.value = -75
    }, 32)
  }
})

watch(() => props.scenario.id, () => {
  selected.value = 'vesta'
  resetView()
})

onBeforeUnmount(() => {
  if (rotationTimer) clearInterval(rotationTimer)
})
</script>

<template>
  <div class="iso-experience" :class="[`mode-${scenario.id}`, { dragging }]">
    <div class="iso-topbar">
      <div>
        <span class="live-dot"></span>
        <span>2.5D INTERACTIVE</span>
        <strong>{{ modeLabel }}</strong>
      </div>
      <div class="view-presets" aria-label="场景视角">
        <button type="button" @click="setView('iso')">鸟瞰</button>
        <button type="button" @click="setView('front')">低角度</button>
        <button type="button" @click="setView('top')">俯视</button>
      </div>
    </div>

    <div
      class="iso-viewport"
      tabindex="0"
      role="application"
      aria-label="可交互能源系统场景，拖拽或使用方向键调整视角，加减键缩放，数字 0 重置"
      @pointerdown="startDrag"
      @pointermove="drag"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
      @wheel.prevent="changeZoom($event.deltaY > 0 ? -.06 : .06)"
      @keydown="keyboard"
    >
      <div class="depth-haze haze-one"></div>
      <div class="depth-haze haze-two"></div>
      <div class="iso-world" :style="worldStyle">
        <div class="ground-plane">
          <div class="ground-grid"></div>
          <div class="ground-ring ring-one"></div>
          <div class="ground-ring ring-two"></div>
        </div>

        <svg class="energy-network" viewBox="0 0 660 430" aria-hidden="true">
          <path class="link link-pv" d="M185 155 L325 188" />
          <path class="link link-home" d="M205 205 L326 203" />
          <path class="link link-battery" d="M360 205 L468 205" />
          <path class="link link-mid" d="M318 230 L274 314" />
          <path class="link link-ev" d="M372 230 L528 320" />
          <path class="link link-battery-ev" d="M472 230 L526 308" />
        </svg>

        <button class="scene-object object-pv" type="button" aria-label="查看屋顶光伏" @pointerdown.stop @click="selectProduct('pv')">
          <span class="object-shadow"></span>
          <span class="billboard house-billboard">
            <span class="house-roof"><i v-for="n in 8" :key="n"></i></span>
            <span class="house-front"><i></i><b></b><b></b></span>
            <span class="object-label">PV / HOME</span>
          </span>
        </button>

        <button class="scene-object object-vesta" type="button" aria-label="查看 Vesta 逆变器" @pointerdown.stop @click="selectProduct('vesta')">
          <span class="object-shadow"></span>
          <span class="billboard device-billboard vesta-device">
            <span class="device-face"><i>ϟ</i><small>VESTA</small></span>
            <span class="device-side"></span>
            <span class="object-label">ENERGY HUB</span>
          </span>
        </button>

        <button class="scene-object object-battery" type="button" aria-label="查看 vBox 储能" @pointerdown.stop @click="selectProduct('battery')">
          <span class="object-shadow"></span>
          <span class="billboard device-billboard battery-device">
            <span class="device-face"><i v-for="n in 4" :key="n"></i><small>vBox</small></span>
            <span class="device-side"></span>
            <span class="object-label">ENERGY STORAGE</span>
          </span>
        </button>

        <button class="scene-object object-mid" type="button" aria-label="查看 MID 微网互联装置" @pointerdown.stop @click="selectProduct('mid')">
          <span class="object-shadow"></span>
          <span class="billboard device-billboard mid-device">
            <span class="device-face"><i>⇄</i><small>MID</small></span>
            <span class="device-side"></span>
            <span class="object-label">GRID LINK</span>
          </span>
        </button>

        <button class="scene-object object-ev" type="button" aria-label="查看电动车充电" @pointerdown.stop @click="selectProduct('ev')">
          <span class="object-shadow"></span>
          <span class="billboard car-billboard">
            <span class="car-roof"></span>
            <span class="car-body"><i></i><i></i></span>
            <span class="charge-port">ϟ</span>
            <span class="object-label">EV CHARGING</span>
          </span>
        </button>
      </div>

      <div class="scene-watermark">LOCAL 2.5D PREVIEW · NOT LIBTV</div>
      <div class="drag-hint"><span>↔</span> 拖拽环绕 · 滚轮缩放 · 点击设备</div>
    </div>

    <div class="iso-bottom">
      <div class="product-detail" :key="selected">
        <div class="detail-index">{{ selected.toUpperCase() }}</div>
        <div>
          <span>{{ detail.en }}</span>
          <h3>{{ detail.name }}</h3>
          <strong>{{ detail.spec }}</strong>
          <p>{{ detail.text }}</p>
        </div>
      </div>
      <div class="scene-tools" aria-label="场景控制">
        <button type="button" aria-label="缩小" @click="changeZoom(-.08)">−</button>
        <span>{{ Math.round(zoom * 100) }}%</span>
        <button type="button" aria-label="放大" @click="changeZoom(.08)">＋</button>
        <button type="button" :class="{ active: autoRotate }" @click="autoRotate = !autoRotate">{{ autoRotate ? '停止环绕' : '自动环绕' }}</button>
        <button type="button" @click="resetView">重置</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.iso-experience { --scene-accent: #ddb266; color: #edf1e9; background: #0b211a; }
.iso-experience.mode-tou { --scene-accent: #82c7a5; }
.iso-experience.mode-backup { --scene-accent: #e8dbc0; }
.iso-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; padding: 0 20px; border-bottom: 1px solid rgba(205,225,211,.13); font: 500 10px/1 "Avenir Next", sans-serif; letter-spacing: .12em; }
.iso-topbar > div:first-child { display: flex; align-items: center; gap: 9px; color: #91a79a; }
.iso-topbar strong { margin-left: 6px; color: var(--scene-accent); font-family: "Hiragino Sans GB", sans-serif; letter-spacing: .04em; }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--scene-accent); box-shadow: 0 0 12px var(--scene-accent); }
.view-presets { display: flex; gap: 4px; }
.view-presets button, .scene-tools button { min-height: 30px; padding: 0 10px; border: 1px solid rgba(205,225,211,.14); background: rgba(15,47,35,.72); color: #b7c5bb; font-size: 11px; }
.view-presets button:hover, .scene-tools button:hover, .scene-tools button.active { border-color: var(--scene-accent); color: var(--scene-accent); }
.iso-viewport { position: relative; height: 440px; overflow: hidden; perspective: 1050px; perspective-origin: 50% 45%; cursor: grab; touch-action: pan-y; background: radial-gradient(ellipse at 52% 48%, #1c4b39 0%, #102e24 43%, #091c16 82%); }
.dragging .iso-viewport { cursor: grabbing; }
.iso-viewport:focus-visible { outline: 1px solid var(--scene-accent); outline-offset: -3px; }
.depth-haze { position: absolute; border-radius: 50%; filter: blur(30px); pointer-events: none; }
.haze-one { width: 280px; height: 180px; left: 4%; top: 10%; background: rgba(107,170,132,.09); }
.haze-two { width: 240px; height: 160px; right: 0; bottom: 2%; background: rgba(221,178,102,.06); }
.iso-world { position: absolute; width: 660px; height: 430px; left: 50%; top: 50%; margin: -215px 0 0 -330px; transform-style: preserve-3d; transform: rotateX(var(--rx)) rotateZ(var(--rz)) scale(var(--zoom)); transition: transform .12s ease-out; }
.dragging .iso-world { transition: none; }
.ground-plane { position: absolute; inset: 28px; border: 1px solid rgba(157,197,170,.22); border-radius: 46%; background: linear-gradient(135deg, rgba(62,119,86,.22), rgba(11,33,25,.12)); box-shadow: 0 40px 80px rgba(0,0,0,.28), inset 0 0 60px rgba(117,172,136,.05); transform: translateZ(-8px); }
.ground-grid { position: absolute; inset: 0; border-radius: inherit; opacity: .3; background-image: linear-gradient(rgba(158,191,169,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(158,191,169,.18) 1px, transparent 1px); background-size: 42px 42px; }
.ground-ring { position: absolute; border: 1px solid rgba(221,178,102,.16); border-radius: 50%; }
.ring-one { inset: 48px 80px; }
.ring-two { inset: 94px 150px; border-style: dashed; }
.energy-network { position: absolute; inset: 0; overflow: visible; transform: translateZ(2px); pointer-events: none; }
.link { fill: none; stroke: rgba(132,169,146,.22); stroke-width: 2; stroke-dasharray: 5 10; }
.mode-self .link-pv, .mode-self .link-home, .mode-self .link-battery,
.mode-tou .link-battery, .mode-tou .link-mid, .mode-tou .link-home,
.mode-backup .link-battery, .mode-backup .link-home,
.mode-ev .link { stroke: var(--scene-accent); stroke-width: 3; stroke-dasharray: 4 13; animation: energy-flow 1.2s linear infinite; filter: drop-shadow(0 0 4px var(--scene-accent)); }
@keyframes energy-flow { to { stroke-dashoffset: -34; } }
.scene-object { position: absolute; width: 100px; height: 80px; padding: 0; border: 0; background: transparent; transform-style: preserve-3d; cursor: pointer; }
.scene-object:focus-visible { outline: 1px solid var(--scene-accent); outline-offset: 8px; }
.object-pv { left: 105px; top: 92px; width: 210px; height: 160px; transform: translateZ(14px); }
.object-vesta { left: 310px; top: 142px; transform: translateZ(18px); }
.object-battery { left: 442px; top: 145px; transform: translateZ(16px); }
.object-mid { left: 205px; top: 302px; transform: translateZ(12px); }
.object-ev { left: 477px; top: 290px; width: 145px; transform: translateZ(12px); }
.object-shadow { position: absolute; left: 12%; right: 12%; bottom: 0; height: 24px; border-radius: 50%; background: rgba(0,0,0,.35); filter: blur(9px); transform: translateZ(-5px); }
.billboard { position: absolute; left: 50%; bottom: 8px; display: block; transform: translateX(-50%) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) translateZ(45px); transform-style: preserve-3d; transition: filter .2s, translate .2s; }
.scene-object:hover .billboard, .scene-object:focus-visible .billboard { filter: brightness(1.12); translate: 0 -6px; }
.object-label { position: absolute; left: 50%; bottom: -30px; transform: translateX(-50%); white-space: nowrap; color: #c2d0c5; font: 500 9px/1 "Avenir Next", sans-serif; letter-spacing: .12em; text-shadow: 0 2px 8px #07130f; }
.house-billboard { width: 185px; height: 150px; }
.house-front { position: absolute; left: 24px; bottom: 0; width: 142px; height: 82px; background: linear-gradient(110deg,#d9dfd5,#9fb3a6); clip-path: polygon(0 13%,65% 0,100% 20%,100% 100%,0 100%); box-shadow: 20px 20px 30px rgba(0,0,0,.2); }
.house-front i { position: absolute; left: 18px; bottom: 0; width: 32px; height: 52px; background: #203b31; }
.house-front b { position: relative; display: inline-block; left: 66px; top: 30px; width: 23px; height: 27px; margin-right: 6px; background: #e6b65c; box-shadow: 0 0 15px rgba(230,182,92,.22); }
.house-roof { position: absolute; z-index: 2; left: 8px; top: 4px; display: grid; grid-template-columns: repeat(4,1fr); gap: 5px; width: 164px; height: 85px; padding: 15px 20px; background: #6c8174; clip-path: polygon(44% 0,100% 40%,62% 100%,0 58%); }
.house-roof i { background: #28594b; border: 1px solid #6d9b85; transform: skewY(14deg); }
.device-billboard { width: 78px; height: 118px; }
.device-face { position: absolute; inset: 0 14px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; border-radius: 10px 4px 4px 10px; background: linear-gradient(120deg,#f0eee4,#b9c8bc); box-shadow: 8px 15px 25px rgba(0,0,0,.24); }
.device-face > i { color: #288362; font: 700 30px/1 "Avenir Next", sans-serif; }
.device-face small { color: #2c4539; font: 600 10px/1 "Avenir Next", sans-serif; letter-spacing: .08em; }
.device-side { position: absolute; top: 5px; right: 0; width: 14px; height: calc(100% - 7px); background: #859b8d; clip-path: polygon(0 4%,100% 0,100% 96%,0 100%); }
.battery-device { height: 148px; }
.battery-device .device-face { gap: 5px; padding: 12px 10px 20px; }
.battery-device .device-face i { width: 100%; height: 22px; border-radius: 4px; background: #b7c6ba; border-right: 8px solid #3a956d; }
.battery-device .device-face small { margin-top: 3px; }
.mid-device { width: 66px; height: 74px; }
.mid-device .device-face > i { font-size: 24px; }
.car-billboard { width: 145px; height: 82px; }
.car-body { position: absolute; left: 0; bottom: 4px; width: 140px; height: 48px; border-radius: 30px 40px 15px 15px; background: linear-gradient(120deg,#e7e9df,#9bafa2); }
.car-roof { position: absolute; z-index: 1; left: 32px; top: 0; width: 80px; height: 46px; background: #b6c6ba; clip-path: polygon(25% 0,75% 0,100% 100%,0 100%); }
.car-roof::after { content: ""; position: absolute; inset: 7px 13px 3px; background: #23483b; clip-path: inherit; }
.car-body i { position: absolute; bottom: -8px; width: 25px; height: 25px; border: 6px solid #172c24; border-radius: 50%; background: #788e80; }
.car-body i:first-child { left: 20px; }
.car-body i:last-child { right: 17px; }
.charge-port { position: absolute; right: -5px; top: 2px; color: var(--scene-accent); font-size: 26px; text-shadow: 0 0 12px var(--scene-accent); }
.scene-watermark { position: absolute; right: 16px; top: 16px; color: rgba(191,208,196,.5); font: 500 9px/1 "Avenir Next", sans-serif; letter-spacing: .1em; pointer-events: none; }
.drag-hint { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); padding: 8px 12px; border: 1px solid rgba(196,218,202,.12); border-radius: 99px; background: rgba(6,22,16,.65); color: #8fa598; font-size: 10px; white-space: nowrap; pointer-events: none; }
.drag-hint span { margin-right: 6px; color: var(--scene-accent); }
.iso-bottom { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; min-height: 142px; padding: 18px 20px; border-top: 1px solid rgba(205,225,211,.13); }
.product-detail { display: grid; grid-template-columns: auto 1fr; gap: 16px; animation: detail-in .3s ease-out; }
@keyframes detail-in { from { transform: translateY(5px); } }
.detail-index { color: rgba(221,178,102,.28); font: 500 24px/1 "Avenir Next", sans-serif; }
.product-detail span { display: block; margin-bottom: 7px; color: #82998b; font: 500 9px/1 "Avenir Next", sans-serif; letter-spacing: .12em; }
.product-detail h3 { display: inline; margin: 0 10px 0 0; font-size: 17px; font-weight: 500; }
.product-detail strong { color: var(--scene-accent); font-size: 10px; font-weight: 500; }
.product-detail p { max-width: 430px; margin: 8px 0 0; color: #8da194; font-size: 11px; line-height: 1.6; }
.scene-tools { display: flex; align-items: center; gap: 5px; }
.scene-tools > span { min-width: 40px; color: #8da194; font: 500 10px/1 "Avenir Next", sans-serif; text-align: center; }
@media (max-width: 720px) {
  .iso-viewport { height: 360px; }
  .iso-world { transform: rotateX(var(--rx)) rotateZ(var(--rz)) scale(calc(var(--zoom) * .56)); }
  .iso-topbar { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px; }
  .iso-topbar > div:first-child strong { display: none; }
  .view-presets { width: 100%; }
  .view-presets button { flex: 1; min-height: 34px; }
  .iso-bottom { grid-template-columns: 1fr; }
  .scene-tools { justify-content: flex-start; flex-wrap: wrap; }
  .scene-tools button { min-height: 36px; }
  .scene-watermark { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .link { animation: none !important; }
  .iso-world, .billboard { transition: none; }
}
</style>

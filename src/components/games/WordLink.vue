<template>
  <div class="word-match-viewport" :class="`phase-round-${currentRound}`">
    <div id="game-container">
      <!-- Header：极简流光气泡 -->
      <div class="game-header">
        <div class="header-pill title-pill">
          <span class="icon">{{ roundIcons[currentRound - 1] }}</span>
          <span class="text">{{ roundTitles[currentRound - 1] }}</span>
        </div>

        <div class="header-pill progress-pill">
          <div class="progress-bar" :style="{ width: `${(roundMatchedCount / (currentWordsCount || 1)) * 100}%` }"></div>
          <span class="text">{{ roundMatchedCount }} / {{ currentWordsCount }} CLEAR</span>
        </div>

        <div class="header-pill combo-pill" :class="{ 'active': combo > 0 }">
          <span class="text">✨ {{ combo }} COMBO</span>
        </div>

        <div class="header-actions">
          <button class="icon-btn" @click="startRound(currentRound)" title="重新洗牌">↺</button>
        </div>
      </div>

      <!-- 🌌 极简天地灵动场域 -->
      <div 
        class="forest-field" 
        ref="boardRef" 
        v-if="gameStore.wordList.length > 0 && !isGameFinished"
        @mousemove="handlePointerMove"
      >
        <!-- 💧 浇灌灵动粒子 Canvas 层 -->
        <canvas ref="particleCanvasRef" class="particle-layer"></canvas>

        <!-- 灵动连线 SVG -->
        <svg class="energy-layer">
          <defs>
            <linearGradient id="rainLine" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#38bdf8" />
              <stop offset="100%" stop-color="#22c55e" />
            </linearGradient>
            <linearGradient id="earthLine" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#4ade80" />
              <stop offset="100%" stop-color="#38bdf8" />
            </linearGradient>
          </defs>

          <g v-if="selectedCard && selectedCardPos && pointerPos">
            <!-- 底层柔和发光轨道 -->
            <path
              :d="getTetherPath(selectedCardPos.x, selectedCardPos.y, pointerPos.x, pointerPos.y)"
              fill="none"
              :stroke="selectedCard.type === 'cn' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(74, 222, 128, 0.25)'"
              :stroke-width="4 + currentRound"
              stroke-linecap="round"
            />
            <!-- 动态流向粒子线 -->
            <path
              :d="getTetherPath(selectedCardPos.x, selectedCardPos.y, pointerPos.x, pointerPos.y)"
              fill="none"
              :stroke="selectedCard.type === 'cn' ? 'url(#rainLine)' : 'url(#earthLine)'"
              :stroke-width="2 + currentRound * 0.5"
              stroke-linecap="round"
              :class="[
                'active-tether',
                selectedCard.type === 'cn' ? 'rain-drop-flow' : 'earth-glow-flow'
              ]"
            />
          </g>
        </svg>

        <!-- 极简节点 -->
        <div
          v-for="card in activeNodes"
          :key="card.id"
          :ref="(el) => setCardRef(el, card.id)"
          class="word-node"
          :class="[
            `level-${currentRound}`,
            {
              'is-en': card.type === 'en',
              'is-cn': card.type === 'cn',
              'is-selected': selectedCard?.id === card.id,
              'is-matched': card.isMatched,
              'is-error': errorCardIds.includes(card.id)
            }
          ]"
          :style="getNodeStyle(card)"
          @click="handleNodeClick($event, card)"
        >
          <!-- 💧 中文：水滴形态 -->
          <div v-if="card.type === 'cn'" class="node-content pure-drop">
            <span class="drop-icon">💧</span>
            <span class="drop-light"></span>
            <span class="node-text">{{ card.text }}</span>
          </div>

          <!-- 🌱 英文：树苗胶囊形态 -->
          <div v-else class="node-content pure-leaf">
            <div class="sprout-icon">
              <svg v-if="currentRound === 1" viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M12 20V11" stroke="#16a34a" stroke-width="2" stroke-linecap="round" />
                <path d="M12 12C12 12 8 11 7 7C11 7 12 10 12 10Z" fill="#bbf7d0" stroke="#16a34a" />
              </svg>
              <svg v-else-if="currentRound === 2" viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M12 22V9" stroke="#15803d" stroke-width="2" stroke-linecap="round" />
                <path d="M12 14C12 14 6 12 5 7C11 7 12 12 12 12Z" fill="#4ade80" stroke="#15803d" />
                <circle cx="12" cy="6" r="2.5" fill="#fef08a" stroke="#ca8a04" />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path d="M12 22V7" stroke="#14532d" stroke-width="2.5" stroke-linecap="round" />
                <path d="M12 15C12 15 3 13 2 6C10 6 12 13 12 13Z" fill="#86efac" stroke="#15803d" />
                <path d="M12 11C12 11 21 9 22 3C14 3 12 9 12 9Z" fill="#eab308" stroke="#ca8a04" />
              </svg>
            </div>

            <span class="node-text">{{ card.text }}</span>
            <!-- <button 
              class="audio-btn" 
              @click.stop.prevent="speak(card.text)" 
              title="朗读"
            >
              🔊
            </button> -->
          </div>
        </div>
      </div>

      <!-- 空灵结算界面 -->
      <div v-else-if="isGameFinished" class="finish-zone">
        <div class="finish-icon">🌳</div>
        <h2> 万物蔚然</h2>
        <p>最高连击 <strong>{{ maxCombo }}</strong> 次</p>
        <button class="btn main-action-btn" @click="initGame">再次开启共鸣</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '../../stores/gameStore'

const gameStore = useGameStore()
const WORDS_PER_ROUND = 5
const currentRound = ref(1)
const activeNodes = ref([])
const selectedCard = ref(null)
const errorCardIds = ref([])
const combo = ref(0)
const maxCombo = ref(0)
const isGameFinished = ref(false)

// 简短干练的二字文案
const roundTitles = ['晨露', '甘霖', '蔚然']
const roundIcons = ['💧', '🌿', '✨']

const pointerPos = ref(null)
const boardRef = ref(null)
const particleCanvasRef = ref(null)
const nodeRefs = new Map()

let audioCtx = null
let particles = []
let animationFrameId = null

const setCardRef = (el, id) => { if (el) nodeRefs.set(id, el) }

const currentWordsCount = computed(() => activeNodes.value.length / 2)
const roundMatchedCount = computed(() => activeNodes.value.filter(c => c.isMatched && c.type === 'cn').length)

const selectedCardPos = computed(() => {
  if (!selectedCard.value || !boardRef.value) return null
  const el = nodeRefs.get(selectedCard.value.id)
  if (!el) return null
  const bRect = boardRef.value.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  return {
    x: r.left + r.width / 2 - bRect.left,
    y: r.top + r.height / 2 - bRect.top
  }
})

/* ================= 🍃 Web Audio API 沉稳自然声音合成器 ================= */
const initAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
}

/**
 * 💧 1. 匹配成功：沉稳水滴与深潭回响
 * 降低了基频，使用正弦波与三角波混合，营造饱满、润泽的低频甘霖感。
 */
const playWaterDropSound = () => {
  initAudioContext()
  if (!audioCtx) return

  const now = audioCtx.currentTime
  
  // 主水滴（正弦波，低频，厚重）
  const osc1 = audioCtx.createOscillator()
  const gain1 = audioCtx.createGain()
  // 基频从 1200Hz 降至 600Hz，显得更沉稳饱满
  const baseFreq = 600 + combo.value * 50 
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(baseFreq * 0.8, now)
  osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.05)
  osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.15)
  
  gain1.gain.setValueAtTime(0.01, now)
  gain1.gain.linearRampToValueAtTime(0.18, now + 0.03) // 增加音量
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3) // 延长余音

  // 深潭共鸣（三角波，极低频，增加厚度）
  const osc2 = audioCtx.createOscillator()
  const gain2 = audioCtx.createGain()
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(baseFreq * 0.3, now)
  
  gain2.gain.setValueAtTime(0.01, now)
  gain2.gain.linearRampToValueAtTime(0.06, now + 0.08)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5) // 更长的低频衰减

  osc1.connect(gain1); gain1.connect(audioCtx.destination)
  osc2.connect(gain2); gain2.connect(audioCtx.destination)

  osc1.start(now); osc1.stop(now + 0.3)
  osc2.start(now); osc2.stop(now + 0.5)
}

/**
 * 🍃 2. 匹配错误：大地地气震动声
 * 替换了高频白噪声，使用棕色噪声（Brown Noise，低频更多）并经过低通滤波，模拟深沉的土石摩擦或地气震动。
 */
const playWindRustleSound = () => {
  initAudioContext()
  if (!audioCtx) return

  const bufferSize = audioCtx.sampleRate * 0.3 // 增加时长
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  
  // 生成棕色噪声 ( Brown Noise: 低频能量远高于高频 )
  let lastOut = 0.0
  for (let i = 0; i < bufferSize; i++) {
    let white = Math.random() * 2 - 1
    data[i] = (lastOut + (0.02 * white)) / 1.02
    lastOut = data[i]
    data[i] *= 3.5 // 补偿棕色噪声较低的音量
  }

  const noise = audioCtx.createBufferSource()
  noise.buffer = buffer

  // 低通滤波器：彻底切除高频，留下沉稳的低频地气感
  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(300, audioCtx.currentTime) // 极低截止频率
  filter.Q.setValueAtTime(1.0, audioCtx.currentTime)

  const gain = audioCtx.createGain()
  const now = audioCtx.currentTime
  gain.gain.setValueAtTime(0.01, now)
  gain.gain.linearRampToValueAtTime(0.1, now + 0.08) // 稍微增大音量
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3) // 延长时长

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(audioCtx.destination)

  noise.start(now)
  noise.stop(now + 0.3)
}

/**
 * 🐦 3. 关卡开启/切换：空谷幽琴（降调鸟鸣，模拟悠扬木琴）
 * 将鸟鸣音效降调、放慢攻击速度，模拟空谷中悠扬、沉稳的木琴或石磬声。
 */
const playBirdChirpSound = () => {
  initAudioContext()
  if (!audioCtx) return

  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()

  osc.type = 'sine'
  // 将频率从 2400Hz 左右降至 500Hz 左右，模拟木质共鸣
  osc.frequency.setValueAtTime(450, now)
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.08)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.18)
  osc.frequency.exponentialRampToValueAtTime(550, now + 0.28)

  // 柔和的攻击（Attack）曲线
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.1, now + 0.06) // 较慢的淡入
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4) // 较长的衰减

  osc.connect(gain)
  gain.connect(audioCtx.destination)

  osc.start(now)
  osc.stop(now + 0.4)
}

/* ================= 🌊 Canvas 粒子系统 ================= */
class WaterLeafParticle {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.type = Math.random() > 0.4 ? 'water' : 'leaf'
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 5

    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed - (this.type === 'leaf' ? 1.5 : 0.5)
    this.radius = this.type === 'water' ? 2 + Math.random() * 3.5 : 3 + Math.random() * 2
    this.alpha = 1
    this.decay = 0.015 + Math.random() * 0.02
    this.gravity = this.type === 'water' ? 0.15 : 0.04
    this.rotation = Math.random() * Math.PI * 2
    this.rotSpeed = (Math.random() - 0.5) * 0.1
    this.color = this.type === 'water' 
      ? `rgba(${56 + Math.floor(Math.random() * 50)}, ${189 + Math.floor(Math.random() * 50)}, 248,`
      : `rgba(${74 + Math.floor(Math.random() * 50)}, ${222 + Math.floor(Math.random() * 30)}, 128,`
  }

  update() {
    this.x += this.vx
    this.y += this.vy
    this.vy += this.gravity
    this.vx *= 0.98
    this.rotation += this.rotSpeed
    this.alpha -= this.decay
  }

  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, this.alpha)
    ctx.translate(this.x, this.y)
    ctx.rotate(this.rotation)

    if (this.type === 'water') {
      ctx.beginPath()
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2)
      ctx.fillStyle = `${this.color} ${this.alpha})`
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.ellipse(0, 0, this.radius * 1.8, this.radius * 0.8, 0, 0, Math.PI * 2)
      ctx.fillStyle = `${this.color} ${this.alpha})`
      ctx.fill()
    }
    ctx.restore()
  }
}

const triggerWaterSplash = (x, y) => {
  if (!boardRef.value) return
  const rect = boardRef.value.getBoundingClientRect()
  const localX = x - rect.left
  const localY = y - rect.top

  const particleCount = 28 + currentRound.value * 8
  for (let i = 0; i < particleCount; i++) {
    particles.push(new WaterLeafParticle(localX, localY))
  }
}

const renderParticles = () => {
  if (!particleCanvasRef.value) return
  const canvas = particleCanvasRef.value
  const ctx = canvas.getContext('2d')

  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.update()
    p.draw(ctx)
    if (p.alpha <= 0) particles.splice(i, 1)
  }

  animationFrameId = requestAnimationFrame(renderParticles)
}

/* ================= 游戏交互逻辑 ================= */
const initGame = () => {
  currentRound.value = 1
  combo.value = 0
  maxCombo.value = 0
  isGameFinished.value = false
  startRound(1)
}

const startRound = (roundNum) => {
  if (!gameStore.wordList || gameStore.wordList.length === 0) return
  selectedCard.value = null
  pointerPos.value = null
  errorCardIds.value = []

  playBirdChirpSound() // 播放悠扬空谷琴音

  const shuffled = [...gameStore.wordList].sort(() => Math.random() - 0.5)
  const activeWords = shuffled.slice(0, WORDS_PER_ROUND)

  const cnSlots = [{ x: 18, y: 18 }, { x: 38, y: 32 }, { x: 52, y: 16 }, { x: 70, y: 35 }, { x: 85, y: 20 }].sort(() => Math.random() - 0.5)
  const enSlots = [{ x: 15, y: 68 }, { x: 34, y: 82 }, { x: 50, y: 65 }, { x: 68, y: 84 }, { x: 85, y: 70 }].sort(() => Math.random() - 0.5)

  let pool = []
  activeWords.forEach((item, i) => {
    const pairId = item.id || item.en || i
    const cnSlot = cnSlots.pop()
    pool.push({
      id: `cn-${roundNum}-${i}-${Math.random()}`,
      pairId, type: 'cn', text: item.cn, isMatched: false,
      seedX: cnSlot.x, seedY: cnSlot.y,
      duration: 4 + Math.random() * 2, delay: Math.random() * -4
    })

    const enSlot = enSlots.pop()
    pool.push({
      id: `en-${roundNum}-${i}-${Math.random()}`,
      pairId, type: 'en', text: item.en, isMatched: false,
      seedX: enSlot.x, seedY: enSlot.y,
      duration: 4 + Math.random() * 2, delay: Math.random() * -4
    })
  })

  activeNodes.value = pool
}

const getNodeStyle = (card) => ({
  left: `${card.seedX}%`, top: `${card.seedY}%`,
  animationDuration: `${card.duration}s`, animationDelay: `${card.delay}s`
})

const handlePointerMove = (e) => {
  if (!selectedCard.value || !boardRef.value) return
  const bRect = boardRef.value.getBoundingClientRect()
  pointerPos.value = { x: e.clientX - bRect.left, y: e.clientY - bRect.top }
}

const handleNodeClick = (event, card) => {
  initAudioContext()
  if (card.isMatched || errorCardIds.value.length > 0) return

  if (card.type === 'en') speak(card.text)

  if (!selectedCard.value) { selectedCard.value = card; return }
  if (selectedCard.value.id === card.id) { selectedCard.value = null; pointerPos.value = null; return }
  if (selectedCard.value.type === card.type) { selectedCard.value = card; return }

  const c1 = selectedCard.value
  const c2 = card

  if (c1.pairId === c2.pairId) {
    c1.isMatched = true
    c2.isMatched = true
    combo.value++
    if (combo.value > maxCombo.value) maxCombo.value = combo.value

    playWaterDropSound() // 播放沉稳润泽的水滴音效
    triggerWaterSplash(event.clientX, event.clientY)
    selectedCard.value = null
    pointerPos.value = null

    if (roundMatchedCount.value === currentWordsCount.value) {
      setTimeout(handleRoundComplete, 600)
    }
  } else {
    combo.value = 0
    errorCardIds.value = [c1.id, c2.id]
    playWindRustleSound() // 播放沉闷大地地气震动声
    setTimeout(() => {
      errorCardIds.value = []
      selectedCard.value = null
      pointerPos.value = null
    }, 450)
  }
}

const getTetherPath = (x1, y1, x2, y2) => {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`
}

const handleRoundComplete = () => {
  if (currentRound.value < 3) {
    currentRound.value++
    startRound(currentRound.value)
  } else {
    isGameFinished.value = true
    playBirdChirpSound()
  }
}

const speak = (text) => {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = 'en-US'
  msg.rate = 0.9
  msg.pitch = 1.0

  setTimeout(() => {
    window.speechSynthesis.speak(msg)
  }, 10)
}

onMounted(() => {
  animationFrameId = requestAnimationFrame(renderParticles)
})

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})

watch(() => gameStore.wordList, (nl) => { if (nl?.length > 0) initGame() }, { immediate: true })
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');

.word-match-viewport {
  width: 100%; height: 100%; min-height: 100%;
  background: #f8fafc;
  display: flex; justify-content: center; align-items: center;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #0f172a; position: relative; overflow: hidden; box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

#game-container {
  width: 100%; height: 100%;
  background: radial-gradient(circle at 50% 30%, #f0f9ff 0%, #f0fdf4 100%);
  border-radius: 28px; padding: 20px 28px;
  display: flex; flex-direction: column; position: relative; box-sizing: border-box;
}

.game-header { display: flex; align-items: center; gap: 12px; z-index: 10; flex-shrink: 0; }

.header-pill {
  background: rgba(255, 255, 255, 0.85);
  padding: 8px 18px; border-radius: 99px; font-size: 13px; font-weight: 600; color: #334155;
  display: flex; align-items: center; gap: 8px; backdrop-filter: blur(16px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  letter-spacing: 0.02em;
}

.title-pill {
  font-family: 'Noto Serif SC', serif;
  font-weight: 700; color: #0284c7; letter-spacing: 0.05em;
}

.progress-pill {
  flex: 1; position: relative; overflow: hidden; justify-content: center; background: rgba(241, 245, 249, 0.6);
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.progress-bar { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #38bdf8, #4ade80); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); }

.combo-pill {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 800;
  letter-spacing: 0.04em;
  transition: all 0.3s ease;
}

.combo-pill.active { background: #f0fdf4; color: #166534; box-shadow: 0 0 12px rgba(74, 222, 128, 0.3); }

.icon-btn { background: rgba(255, 255, 255, 0.8); border: none; color: #64748b; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; transition: transform 0.2s; }
.icon-btn:hover { transform: rotate(180deg); }

.forest-field { flex: 1; position: relative; width: 100%; margin-top: 10px; overflow: hidden; }

/* 💧 Canvas 粒子层 */
.particle-layer {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 4;
}

.energy-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2; }

/* 🌧️ 1. 雨滴流向 */
.active-tether.rain-drop-flow {
  stroke-dasharray: 6 12;
  animation: rainDropFlow 0.7s linear infinite;
  filter: drop-shadow(0 2px 6px rgba(2, 132, 199, 0.4));
}

/* 🌱 2. 绿光流向 */
.active-tether.earth-glow-flow {
  stroke-dasharray: 4 10;
  animation: earthGlowFlow 0.7s linear infinite;
  filter: drop-shadow(0 -2px 6px rgba(22, 163, 74, 0.4));
}

@keyframes rainDropFlow { from { stroke-dashoffset: 36; } to { stroke-dashoffset: 0; } }
@keyframes earthGlowFlow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 28; } }

/* ================= 节点及形态 ================= */
.word-node {
  position: absolute; z-index: 3; cursor: pointer; transform: translate(-50%, -50%);
  animation: floatBreathing 4s ease-in-out infinite alternate;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 💧 中文：水滴形态 */
.pure-drop {
  background: rgba(255, 255, 255, 0.92);
  padding: 10px 22px; border-radius: 28px 28px 28px 6px;
  box-shadow: 0 10px 25px -5px rgba(186, 230, 253, 0.5);
  backdrop-filter: blur(12px); display: flex; align-items: center; gap: 6px; position: relative;
  transition: all 0.3s ease;
}

.drop-icon { font-size: 13px; opacity: 0.85; }

.drop-light {
  position: absolute; top: 5px; left: 10px; width: 8px; height: 4px;
  background: rgba(255, 255, 255, 0.95); border-radius: 10px; transform: rotate(-25deg);
}

/* 🌱 英文：树苗胶囊形态 */
.pure-leaf {
  background: rgba(255, 255, 255, 0.92);
  padding: 10px 20px; border-radius: 99px;
  box-shadow: 0 10px 25px -5px rgba(187, 247, 208, 0.5);
  backdrop-filter: blur(12px); display: flex; align-items: center; gap: 8px;
  transition: all 0.3s ease;
}

.sprout-icon { display: flex; align-items: center; justify-content: center; }

/* 🌸 中文字体：思源宋体 (Noto Serif SC) */
.pure-drop .node-text { 
  font-family: 'Noto Serif SC', "Songti SC", "STSong", serif;
  font-size: 16px;
  font-weight: 700; 
  color: #0369a1; 
  letter-spacing: 0.08em;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

/* 🌿 英文字体：Plus Jakarta Sans */
.pure-leaf .node-text { 
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  font-size: 15px; 
  font-weight: 700; 
  color: #15803d; 
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.audio-btn {
  background: transparent; border: none; cursor: pointer;
  font-size: 13px; opacity: 0.65; padding: 4px; margin-left: 2px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease; user-select: none;
}
.audio-btn:hover { opacity: 1; transform: scale(1.18); }
.audio-btn:active { transform: scale(0.92); }

/* ================= 阶梯样式 ================= */
.level-1.is-cn .pure-drop { border: 1.5px solid rgba(186, 230, 253, 0.8); }
.level-1.is-en .pure-leaf { border: 1.5px solid rgba(187, 247, 208, 0.8); }

.level-2.is-cn .pure-drop { border: 2px solid #38bdf8; box-shadow: 0 10px 22px -2px rgba(56, 189, 248, 0.35); }
.level-2.is-en .pure-leaf { border: 2px solid #4ade80; box-shadow: 0 10px 22px -2px rgba(74, 222, 128, 0.35); }

.level-3.is-cn .pure-drop { border: 2.5px solid #0284c7; box-shadow: 0 0 22px rgba(56, 189, 248, 0.45); }
.level-3.is-en .pure-leaf { border: 2.5px solid #eab308; box-shadow: 0 0 22px rgba(234, 179, 8, 0.4); }

.word-node.is-cn.is-selected .pure-drop {
  background: #0284c7 !important; transform: scale(1.1);
  box-shadow: 0 14px 30px rgba(2, 132, 199, 0.45) !important;
}
.word-node.is-cn.is-selected .node-text { color: #ffffff !important; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); }

.word-node.is-en.is-selected .pure-leaf {
  background: #16a34a !important; transform: scale(1.1);
  box-shadow: 0 14px 30px rgba(22, 163, 74, 0.45) !important;
}
.word-node.is-en.is-selected .node-text { color: #ffffff !important; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); }

.word-node:hover { transform: translate(-50%, -50%) scale(1.08); z-index: 10; }
.word-node.is-matched { opacity: 0; transform: translate(-50%, -50%) scale(0.1); pointer-events: none; }
.word-node.is-error { animation: shake 0.35s ease-in-out; }

@keyframes floatBreathing {
  0% { transform: translate(-50%, -50%) translateY(0px); }
  100% { transform: translate(-50%, -50%) translateY(-7px); }
}
@keyframes shake {
  0%, 100% { transform: translate(-50%, -50%); }
  25% { transform: translate(-53%, -50%); }
  75% { transform: translate(-47%, -50%); }
}

.finish-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
.finish-icon { font-size: 3.5rem; margin-bottom: 12px; }
.finish-zone h2 { font-family: 'Noto Serif SC', serif; font-weight: 700; color: #0f172a; margin-bottom: 8px; letter-spacing: 0.05em; }
.finish-zone p { color: #64748b; font-size: 14px; margin-bottom: 24px; letter-spacing: 0.02em; }
.main-action-btn { 
  padding: 12px 32px; background: #0284c7; border: none; border-radius: 99px; color: #ffffff; 
  font-family: 'Noto Serif SC', serif; font-weight: 700; cursor: pointer; 
  box-shadow: 0 8px 20px rgba(2, 132, 199, 0.3); letter-spacing: 0.08em; transition: transform 0.2s, box-shadow 0.2s;
}
.main-action-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(2, 132, 199, 0.4); }
</style>
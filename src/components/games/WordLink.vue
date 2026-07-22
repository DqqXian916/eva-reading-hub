<template>
  <div class="word-match-viewport">
    <!-- Admin 遮罩与配置弹窗 -->
    <div v-if="showAdmin" class="overlay" @click="showAdmin = false"></div>
    <div v-if="showAdmin" class="admin-panel">
      <h3>词库配置</h3>
      <textarea v-model="configText" placeholder="请输入JSON格式词库"></textarea>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="btn main-action-btn" @click="handleSaveConfig">保存配置</button>
      </div>
    </div>

    <div id="game-container">
      <!-- 顶部 Header 状态栏 -->
      <div class="game-header">
        <div class="status-item">
          <span class="label">🏁 关卡轮次</span>
          <span class="value round-tag">ROUND {{ currentRound }} / 3</span>
        </div>
        <div class="status-item">
          <span class="label">🎯 消除进度</span>
          <span class="value">{{ roundMatchedCount }} <span class="slash">/</span> {{ currentWordsCount }}</span>
        </div>
        <div class="status-item">
          <span class="label">🔥 COMBO</span>
          <span 
            class="value combo-value" 
            :class="{ 'has-combo': combo > 0 }" 
            :style="{ '--combo-scale': 1 + Math.min(combo * 0.05, 0.4) }"
          >
            {{ combo }}
          </span>
        </div>
        <button class="reset-btn" @click="startRound(currentRound)">🔄 重摆本轮</button>
        <button v-if="canEdit" class="admin-toggle-btn" @click="showAdmin = true">⚙️</button>
      </div>

      <!-- 游戏主区域（5 组单词精简版 +  Sunset Ocean 色系） -->
      <div class="board-viewport" ref="boardRef" v-if="gameStore.wordList.length > 0 && !isGameFinished">
        <!-- SVG 连线图层 -->
        <svg class="svg-layer">
          <defs>
            <!-- 连线成功：海盐渐变光彩 -->
            <linearGradient id="lineGlowSuccess" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ff7e5f" />
              <stop offset="100%" stop-color="#3b82f6" />
            </linearGradient>
            <!-- 连线失败：炽热警示红 -->
            <linearGradient id="lineGlowError" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#f43f5e" />
              <stop offset="100%" stop-color="#e11d48" />
            </linearGradient>
          </defs>

          <!-- 1. 已配对的连线 -->
          <path
            v-for="link in matchedLinks"
            :key="link.id"
            :d="getSymmetricCurve(link.x1, link.y1, link.x2, link.y2)"
            fill="none"
            stroke="url(#lineGlowSuccess)"
            stroke-width="4.5"
            stroke-linecap="round"
            class="matched-path"
          />

          <!-- 2. 配对失败抖动的红线 -->
          <path
            v-if="errorLine"
            :d="getSymmetricCurve(errorLine.x1, errorLine.y1, errorLine.x2, errorLine.y2)"
            fill="none"
            stroke="url(#lineGlowError)"
            stroke-width="4.5"
            stroke-linecap="round"
            class="error-path"
          />
        </svg>

        <!-- 左右两列排版 -->
        <div class="dual-columns">
          <!-- 左侧：中文列表 -->
          <div class="col-section">
            <div class="col-header title-cn">🇨🇳 中文</div>
            <div class="card-list">
              <div
                v-for="card in cnCards"
                :key="card.id"
                :ref="(el) => setCardRef(el, card.id)"
                class="match-card card-cn"
                :class="{
                  'is-selected': selectedCard?.id === card.id,
                  'is-matched': card.isMatched,
                  'match-error': errorCardIds.includes(card.id)
                }"
                @click="handleCardClick($event, card)"
              >
                <span>{{ card.text }}</span>
              </div>
            </div>
          </div>

          <!-- 右侧：英文列表 -->
          <div class="col-section">
            <div class="col-header title-en">🇺🇸 英文</div>
            <div class="card-list">
              <div
                v-for="card in enCards"
                :key="card.id"
                :ref="(el) => setCardRef(el, card.id)"
                class="match-card card-en"
                :class="{
                  'is-selected': selectedCard?.id === card.id,
                  'is-matched': card.isMatched,
                  'match-error': errorCardIds.includes(card.id)
                }"
                @click="handleCardClick($event, card)"
              >
                <span>{{ card.text }}</span>
                <button class="speak-icon" @click.stop="speak(card.text)" title="朗读">🔊</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空词库提示 -->
      <div v-else-if="gameStore.wordList.length === 0" class="empty-words">
        <p style="margin: 20px 0; color: #94a3b8;">🐱：还没有准备连连看卡牌哦...</p>
        <button v-if="canEdit" class="btn main-action-btn" @click="showAdmin = true">立即配置</button>
      </div>

      <!-- 通关结算面板 -->
      <div v-else class="finish-zone">
        <div class="trophy">🏆</div>
        <h2>通关成功！</h2>
        <p class="summary-text">你完美通过了 3 轮单词挑战，最高连击 <strong>{{ maxCombo }}</strong> 次！</p>
        <div class="button-zone">
          <button class="btn main-action-btn next-mode" @click="initGame">再玩一轮</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import confetti from 'canvas-confetti'

const props = defineProps({
  canEdit: Boolean
})

const emit = defineEmits(['updateConfig', 'saveConfig'])
const gameStore = useGameStore()

// 💡 【精简设置】每轮单词数设置为 5 组 (可根据需要微调)
const WORDS_PER_ROUND = 5

// 游戏状态
const currentRound = ref(1)
const cnCards = ref([])
const enCards = ref([])
const selectedCard = ref(null)
const errorCardIds = ref([])
const combo = ref(0)
const maxCombo = ref(0)
const isGameFinished = ref(false)

const matchedLinks = ref([]) 
const errorLine = ref(null)

const showAdmin = ref(false)
const configText = ref('')

const boardRef = ref(null)
const cardRefs = new Map()

let audioCtx = null

const setCardRef = (el, id) => {
  if (el) cardRefs.set(id, el)
}

const currentWordsCount = computed(() => cnCards.value.length)

const roundMatchedCount = computed(() => {
  return cnCards.value.filter(c => c.isMatched).length
})

const initGame = () => {
  currentRound.value = 1
  combo.value = 0
  maxCombo.value = 0
  isGameFinished.value = false
  startRound(1)
}

const startRound = (roundNum) => {
  if (!gameStore.wordList || gameStore.wordList.length === 0) {
    cnCards.value = []
    enCards.value = []
    return
  }

  matchedLinks.value = []
  errorLine.value = null
  selectedCard.value = null
  errorCardIds.value = []

  // 从 Store 中随机打乱抽取 5 个词
  const shuffledTotalWords = [...gameStore.wordList].sort(() => Math.random() - 0.5)
  const activeWords = shuffledTotalWords.slice(0, WORDS_PER_ROUND)

  const cnPool = []
  const enPool = []

  activeWords.forEach((item, index) => {
    const pairId = item.id || item.en || index

    cnPool.push({
      id: `cn-${roundNum}-${index}-${Math.random()}`,
      pairId,
      type: 'cn',
      text: item.cn,
      isMatched: false
    })

    enPool.push({
      id: `en-${roundNum}-${index}-${Math.random()}`,
      pairId,
      type: 'en',
      text: item.en,
      isMatched: false
    })
  })

  cnCards.value = cnPool.sort(() => Math.random() - 0.5)
  enCards.value = enPool.sort(() => Math.random() - 0.5)
}

const handleCardClick = (event, card) => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }

  if (card.isMatched || errorCardIds.value.length > 0) return

  if (card.type === 'en') speak(card.text)

  if (!selectedCard.value) {
    selectedCard.value = card
    return
  }

  if (selectedCard.value.id === card.id) {
    selectedCard.value = null
    return
  }

  if (selectedCard.value.type === card.type) {
    selectedCard.value = card
    return
  }

  const card1 = selectedCard.value
  const card2 = card

  if (card1.pairId === card2.pairId) {
    card1.isMatched = true
    card2.isMatched = true

    const enText = card1.type === 'en' ? card1.text : card2.text
    speak(enText)

    const pos = getLineCoords(card1.id, card2.id)
    matchedLinks.value.push({
      id: `${card1.id}-${card2.id}`,
      ...pos
    })

    combo.value++
    if (combo.value > maxCombo.value) maxCombo.value = combo.value

    playSuccessSound()
    triggerCelebrationEffect(event.clientX, event.clientY)

    selectedCard.value = null

    if (roundMatchedCount.value === currentWordsCount.value) {
      setTimeout(() => {
        handleRoundComplete()
      }, 500)
    }
  } else {
    combo.value = 0
    errorCardIds.value = [card1.id, card2.id]

    const pos = getLineCoords(card1.id, card2.id)
    errorLine.value = pos

    setTimeout(() => {
      errorCardIds.value = []
      errorLine.value = null
      selectedCard.value = null
    }, 450)
  }
}

const getSymmetricCurve = (x1, y1, x2, y2) => {
  const dx = Math.abs(x2 - x1) * 0.5
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}

const getLineCoords = (id1, id2) => {
  if (!boardRef.value) return { x1: 0, y1: 0, x2: 0, y2: 0 }
  const bRect = boardRef.value.getBoundingClientRect()
  const el1 = cardRefs.get(id1)
  const el2 = cardRefs.get(id2)

  const r1 = el1.getBoundingClientRect()
  const r2 = el2.getBoundingClientRect()

  const is1Left = r1.left < r2.left
  const leftRect = is1Left ? r1 : r2
  const rightRect = is1Left ? r2 : r1

  return {
    x1: leftRect.right - bRect.left,
    y1: leftRect.top + leftRect.height / 2 - bRect.top,
    x2: rightRect.left - bRect.left,
    y2: rightRect.top + rightRect.height / 2 - bRect.top
  }
}

const playSuccessSound = () => {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const now = audioCtx.currentTime
  const comboBonus = Math.min(combo.value * 35, 300)

  const popOsc = audioCtx.createOscillator()
  const popGain = audioCtx.createGain()
  popOsc.connect(popGain)
  popGain.connect(audioCtx.destination)
  popOsc.type = 'sine'
  popOsc.frequency.setValueAtTime(1054 + comboBonus, now)
  popOsc.frequency.exponentialRampToValueAtTime(1800 + comboBonus, now + 0.05)
  popGain.gain.setValueAtTime(0, now)
  popGain.gain.linearRampToValueAtTime(0.25, now + 0.01)
  popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  popOsc.start(now)
  popOsc.stop(now + 0.12)

  const crystalNotes = [1046.50, 1318.51, 1567.98, 2093.00]
  crystalNotes.forEach((freq, index) => {
    const sparkOsc = audioCtx.createOscillator()
    const sparkGain = audioCtx.createGain()
    sparkOsc.connect(sparkGain)
    sparkGain.connect(audioCtx.destination)
    sparkOsc.type = 'triangle'
    sparkOsc.frequency.setValueAtTime(freq + comboBonus, now)
    const startTime = now + (index * 0.03)
    sparkGain.gain.setValueAtTime(0, startTime)
    sparkGain.gain.linearRampToValueAtTime(0.12, startTime + 0.02)
    sparkGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4)
    sparkOsc.start(startTime)
    sparkOsc.stop(startTime + 0.4)
  })
}

const playRoundCompleteSound = () => {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const now = audioCtx.currentTime

  const bassOsc = audioCtx.createOscillator()
  const bassGain = audioCtx.createGain()
  bassOsc.type = 'triangle'
  bassOsc.frequency.setValueAtTime(130.81, now)
  bassOsc.frequency.exponentialRampToValueAtTime(261.63, now + 0.15)
  bassGain.gain.setValueAtTime(0.3, now)
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
  bassOsc.connect(bassGain)
  bassGain.connect(audioCtx.destination)
  bassOsc.start(now)
  bassOsc.stop(now + 0.8)

  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00]
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + i * 0.06)
    gainNode.gain.setValueAtTime(0, now + i * 0.06)
    gainNode.gain.linearRampToValueAtTime(0.15, now + i * 0.06 + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5)
    osc.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    osc.start(now + i * 0.06)
    osc.stop(now + i * 0.06 + 0.5)
  })
}

const triggerCelebrationEffect = (clientX, clientY) => {
  const originX = clientX / window.innerWidth
  const originY = clientY / window.innerHeight

  confetti({
    particleCount: 12,
    angle: 90,
    spread: 60,
    origin: { x: originX, y: originY },
    colors: ['#ff7e5f', '#feb47b', '#3b82f6'],
    shapes: ['circle'],
    scalar: 1.2,
    gravity: 1.1,
    ticks: 70
  })

  confetti({
    particleCount: 15,
    angle: 90,
    spread: 80,
    origin: { x: originX, y: originY },
    colors: ['#ffffff', '#dbeafe', '#fef3c7'],
    shapes: ['star'],
    scalar: 1.0,
    ticks: 80
  })
}

const triggerGlobalRoundCelebration = () => {
  confetti({
    particleCount: 140,
    spread: 120,
    origin: { x: 0.5, y: 0.4 },
    colors: ['#ff7e5f', '#3b82f6', '#f59e0b', '#10b981', '#6366f1'],
    shapes: ['star', 'circle', 'square'],
    scalar: 1.2,
    ticks: 150
  })
}

const handleRoundComplete = () => {
  triggerGlobalRoundCelebration()
  playRoundCompleteSound()

  if (currentRound.value < 3) {
    setTimeout(() => {
      currentRound.value++
      startRound(currentRound.value)
    }, 1500)
  } else {
    isGameFinished.value = true
  }
}

const handleSaveConfig = () => {
  try {
    const newWords = JSON.parse(configText.value)
    gameStore.updateConfig(newWords, gameStore.goal)
    emit('updateConfig', newWords)
    showAdmin.value = false
    initGame()
  } catch (e) {
    alert('JSON格式错误: ' + e.message)
  }
}

const speak = (text) => {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = 'en-US'
  msg.rate = 0.9
  window.speechSynthesis.speak(msg)
}

watch(
  () => gameStore.wordList,
  (newList) => {
    if (newList && newList.length > 0) {
      configText.value = JSON.stringify(newList, null, 2)
      initGame()
    }
  },
  { immediate: true, deep: true }
)
</script>

<style scoped>
/* 🌅 🎨 全新「落日海盐（Sunset Ocean）」主题色 */
.word-match-viewport {
  --theme-bg: #f8fafc;
  --theme-card-bg: #ffffff;
  --theme-orange-main: #ff7e5f;
  --theme-orange-sub: #fff7ed;
  --theme-blue-main: #3b82f6;
  --theme-blue-sub: #eff6ff;
  --theme-text-main: #1e293b;
  --theme-text-sub: #64748b;

  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 520px;
  width: 100%;
  background: white;
  position: relative;
}

#game-container {
  background: var(--theme-bg);
  width: 100%;
  max-width: 820px;
  padding: 28px;
  border-radius: 36px;
  box-shadow: 0 20px 50px rgba(30, 41, 59, 0.04);
  text-align: center;
  display: flex;
  flex-direction: column;
  z-index: 2;
  border: 1px solid #f1f5f9;
}

/* 顶部状态栏 */
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  padding: 12px 24px;
  border-radius: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
  border: 1px solid #f1f5f9;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.status-item .label {
  font-size: 11px;
  color: var(--theme-text-sub);
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 3px;
}

.status-item .value {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--theme-text-main);
}

.round-tag { color: var(--theme-blue-main) !important; }

.combo-value {
  transition: transform 0.15s ease;
  transform: scale(var(--combo-scale, 1));
}
.combo-value.has-combo { color: #f43f5e !important; }

.reset-btn {
  padding: 8px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: #475569;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.reset-btn:hover {
  background: #ffffff;
  border-color: var(--theme-blue-main);
  color: var(--theme-blue-main);
}

.admin-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.3;
  font-size: 16px;
}

/* 盘面与 SVG 图层 */
.board-viewport {
  position: relative;
  width: 100%;
  min-height: 380px;
}

.svg-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.matched-path {
  filter: drop-shadow(0 3px 8px rgba(59, 130, 246, 0.35));
}

.error-path {
  animation: shake 0.3s ease-in-out;
}

.dual-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 100px; /* 间距加宽，更有呼吸感 */
  position: relative;
  z-index: 2;
}

.col-header {
  font-size: 14px;
  font-weight: 800;
  padding: 10px 18px;
  border-radius: 14px;
  margin-bottom: 16px;
}

.title-cn { 
  background: var(--theme-orange-sub); 
  color: #ea580c; 
  border: 1px solid #ffedd5;
}

.title-en { 
  background: var(--theme-blue-sub); 
  color: #2563eb; 
  border: 1px solid #dbeafe;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 16px; /* 5 个词，间距拉大更显清晰 */
}

/* 🌟 卡牌高级微悬浮 UI */
.match-card {
  background: #ffffff;
  border: 2px solid #f1f5f9;
  border-radius: 18px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.05);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  user-select: none;
}

.match-card:hover {
  transform: translateY(-3px);
  border-color: #cbd5e1;
  box-shadow: 0 10px 20px rgba(0,0,0,0.04);
}

/* 高亮选中 (落日渐变) */
.match-card.is-selected {
  background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%) !important;
  border-color: transparent !important;
  color: white !important;
  transform: scale(0.97);
  box-shadow: 0 8px 20px rgba(255, 126, 95, 0.35);
}

/* 匹配成功锁定 (海盐蓝色系) */
.match-card.is-matched {
  background: #eff6ff !important;
  border-color: #3b82f6 !important;
  color: #1d4ed8 !important;
  cursor: default;
  opacity: 0.85;
}

/* 配对错误 */
.match-card.match-error {
  background: #fff1f2 !important;
  border-color: #f43f5e !important;
  color: #e11d48 !important;
  animation: cardShake 0.45s ease-in-out;
}

.speak-icon {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.2s;
  font-size: 15px;
}
.speak-icon:hover { opacity: 1; }

@keyframes cardShake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

/* 后台与通关 */
.finish-zone { padding: 40px 20px; }
.trophy { font-size: 4.5rem; }

.overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.3); z-index: 100; backdrop-filter: blur(4px); }
.admin-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 25px; border-radius: 24px; z-index: 110; width: 330px; box-shadow: 0 25px 60px rgba(0,0,0,0.12); }
.admin-panel textarea { width: 100%; height: 160px; margin-bottom: 12px; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 12px; }

.btn { font-weight: 700; cursor: pointer; }
.main-action-btn { 
  padding: 12px 45px; 
  border-radius: 20px; 
  background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%); 
  color: white; 
  border: none; 
  box-shadow: 0 8px 20px rgba(255, 126, 95, 0.3);
}
.main-action-btn.next-mode { background: var(--theme-text-main); box-shadow: none; }
</style>
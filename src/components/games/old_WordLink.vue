<template>
  <div class="word-match-viewport">
    <!-- 后台配置弹窗 -->
    <div v-if="showAdmin" class="overlay" @click="showAdmin = false"></div>
    <div v-if="showAdmin" class="admin-panel">
      <h3>词库配置</h3>
      <textarea v-model="configText" placeholder="请输入 JSON 格式词库"></textarea>
      <button class="btn main-action-btn" @click="handleSaveConfig">保存并重启</button>
    </div>

    <div id="game-container">
      <!-- 森林晨露风格 Header -->
      <div class="game-header">
        <div class="header-pill">
          <span class="leaf-icon">🍃</span>
          <span class="text">ROUND {{ currentRound }} / 3</span>
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
          <button v-if="canEdit" class="icon-btn" @click="showAdmin = true">⚙️</button>
        </div>
      </div>

      <!-- 🌿 森系卡牌场域 (Forest Floating Zone) -->
      <div 
        class="forest-field" 
        ref="boardRef" 
        v-if="gameStore.wordList.length > 0 && !isGameFinished"
        @mousemove="handlePointerMove"
      >
        <!-- 藤蔓/微光能量牵引线 (SVG) -->
        <svg class="energy-layer">
          <defs>
            <linearGradient id="forestBeam" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#10b981" />
              <stop offset="100%" stop-color="#84cc16" />
            </linearGradient>
          </defs>

          <!-- 静态已配对链接痕迹 -->
          <line
            v-for="link in matchedLinks"
            :key="link.id"
            :x1="link.x1" :y1="link.y1"
            :x2="link.x2" :y2="link.y2"
            stroke="rgba(16, 185, 129, 0.3)"
            stroke-width="2"
            stroke-dasharray="4,6"
          />

          <!-- 鼠标实时牵引绿色藤蔓线 -->
          <path
            v-if="selectedCardPos && pointerPos"
            :d="getTetherPath(selectedCardPos.x, selectedCardPos.y, pointerPos.x, pointerPos.y)"
            fill="none"
            stroke="url(#forestBeam)"
            stroke-width="2.5"
            stroke-linecap="round"
            class="active-tether"
          />
        </svg>

        <!-- 悬浮单词卡片节点 -->
        <div
          v-for="card in activeNodes"
          :key="card.id"
          :ref="(el) => setCardRef(el, card.id)"
          class="word-node"
          :class="{
            'is-en': card.type === 'en',
            'is-cn': card.type === 'cn',
            'is-selected': selectedCard?.id === card.id,
            'is-matched': card.isMatched,
            'is-error': errorCardIds.includes(card.id)
          }"
          :style="getNodeStyle(card)"
          @click="handleNodeClick($event, card)"
        >
          <div class="node-content">
            <span class="node-type-tag">{{ card.type === 'en' ? 'EN' : 'CN' }}</span>
            <span class="node-text">{{ card.text }}</span>
            <button v-if="card.type === 'en'" class="audio-pulse" @click.stop="speak(card.text)">
              🔊
            </button>
          </div>
        </div>
      </div>

      <!-- 结算界面 -->
      <div v-else-if="isGameFinished" class="finish-zone">
        <div class="forest-trophy">🌱</div>
        <h2>自然共鸣完成</h2>
        <p>你以敏捷的记忆净化了所有卡牌，最高连击 <strong>{{ maxCombo }}</strong> 次</p>
        <button class="btn main-action-btn" @click="initGame">再次探索森林</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import confetti from 'canvas-confetti'

const props = defineProps({ canEdit: Boolean })
const emit = defineEmits(['updateConfig', 'saveConfig'])
const gameStore = useGameStore()

const WORDS_PER_ROUND = 5
const currentRound = ref(1)
const activeNodes = ref([])
const selectedCard = ref(null)
const errorCardIds = ref([])
const combo = ref(0)
const maxCombo = ref(0)
const isGameFinished = ref(false)

const matchedLinks = ref([])
const pointerPos = ref(null)
const showAdmin = ref(false)
const configText = ref('')

const boardRef = ref(null)
const nodeRefs = new Map()
let audioCtx = null

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

const initGame = () => {
  currentRound.value = 1
  combo.value = 0
  maxCombo.value = 0
  isGameFinished.value = false
  startRound(1)
}

// 严格受控的网格+微抖动分布算法，避免超界与卡牌重叠
const startRound = (roundNum) => {
  if (!gameStore.wordList || gameStore.wordList.length === 0) return
  matchedLinks.value = []
  selectedCard.value = null
  errorCardIds.value = []

  const shuffled = [...gameStore.wordList].sort(() => Math.random() - 0.5)
  const activeWords = shuffled.slice(0, WORDS_PER_ROUND)

  // 10 个卡牌的受控预设坐标网格 (X: 12%~82%, Y: 18%~78%)
  const gridPositions = [
    { x: 14, y: 20 }, { x: 50, y: 18 }, { x: 82, y: 22 },
    { x: 26, y: 48 }, { x: 72, y: 46 },
    { x: 12, y: 76 }, { x: 48, y: 78 }, { x: 84, y: 74 },
    { x: 38, y: 28 }, { x: 62, y: 68 }
  ].sort(() => Math.random() - 0.5)

  let pool = []
  activeWords.forEach((item, i) => {
    const pairId = item.id || item.en || i
    
    // 中文节点
    const pos1 = gridPositions.pop()
    pool.push({
      id: `cn-${roundNum}-${i}-${Math.random()}`,
      pairId, type: 'cn', text: item.cn, isMatched: false,
      seedX: pos1.x, seedY: pos1.y,
      duration: 3.5 + Math.random() * 2,
      delay: Math.random() * -4
    })

    // 英文节点
    const pos2 = gridPositions.pop()
    pool.push({
      id: `en-${roundNum}-${i}-${Math.random()}`,
      pairId, type: 'en', text: item.en, isMatched: false,
      seedX: pos2.x, seedY: pos2.y,
      duration: 3.5 + Math.random() * 2,
      delay: Math.random() * -4
    })
  })

  activeNodes.value = pool
}

const getNodeStyle = (card) => {
  return {
    left: `${card.seedX}%`,
    top: `${card.seedY}%`,
    animationDuration: `${card.duration}s`,
    animationDelay: `${card.delay}s`
  }
}

const handlePointerMove = (e) => {
  if (!selectedCard.value || !boardRef.value) return
  const bRect = boardRef.value.getBoundingClientRect()
  pointerPos.value = {
    x: e.clientX - bRect.left,
    y: e.clientY - bRect.top
  }
}

const handleNodeClick = (event, card) => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
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

  const c1 = selectedCard.value
  const c2 = card

  if (c1.pairId === c2.pairId) {
    c1.isMatched = true
    c2.isMatched = true
    combo.value++
    if (combo.value > maxCombo.value) maxCombo.value = combo.value

    playSuccessSound()
    triggerConfetti(event.clientX, event.clientY)
    selectedCard.value = null

    if (roundMatchedCount.value === currentWordsCount.value) {
      setTimeout(handleRoundComplete, 600)
    }
  } else {
    combo.value = 0
    errorCardIds.value = [c1.id, c2.id]
    setTimeout(() => {
      errorCardIds.value = []
      selectedCard.value = null
    }, 450)
  }
}

const getTetherPath = (x1, y1, x2, y2) => {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 - 15
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`
}

const playSuccessSound = () => {
  if (!audioCtx) return
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(523.25 + combo.value * 40, now)
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.15)
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.2)
}

const triggerConfetti = (x, y) => {
  confetti({
    particleCount: 12,
    spread: 50,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    colors: ['#10b981', '#84cc16', '#a7f3d0'],
    scalar: 0.7
  })
}

const handleRoundComplete = () => {
  if (currentRound.value < 3) {
    currentRound.value++
    startRound(currentRound.value)
  } else {
    isGameFinished.value = true
  }
}

const speak = (text) => {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = 'en-US'
  window.speechSynthesis.speak(msg)
}

const handleSaveConfig = () => {
  try {
    const newWords = JSON.parse(configText.value)
    gameStore.updateConfig(newWords, gameStore.goal)
    emit('updateConfig', newWords)
    showAdmin.value = false
    initGame()
  } catch (e) { alert('JSON 格式不正确') }
}

watch(() => gameStore.wordList, (nl) => {
  if (nl?.length > 0) {
    configText.value = JSON.stringify(nl, null, 2)
    initGame()
  }
}, { immediate: true, deep: true })
</script>

<style scoped>
/* 🌿 莫兰迪森林晨露主配色方案 */
.word-match-viewport {
  width: 100%;
  min-height: 560px;
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 50%, #e0f2fe 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #2d3748;
  position: relative;
  overflow: hidden;
}

#game-container {
  width: 100%;
  max-width: 860px;
  height: 520px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 32px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.03), 0 2px 6px rgba(16, 185, 129, 0.05);
}

/* 顶部清爽状态栏 */
.game-header {
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

.header-pill {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 6px 16px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 6px;
}

.leaf-icon { font-size: 13px; }

.progress-pill {
  flex: 1;
  position: relative;
  overflow: hidden;
  justify-content: center;
  background: rgba(241, 245, 249, 0.6);
}

.progress-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, #a7f3d0, #6ee7b7);
  transition: width 0.3s ease;
}

.combo-pill { opacity: 0.6; transition: all 0.3s; }
.combo-pill.active { opacity: 1; background: #dcfce7; border-color: #86efac; color: #166534; }

.header-actions { display: flex; gap: 8px; margin-left: auto; }
.icon-btn {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.8);
  color: #64748b;
  width: 32px; height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.icon-btn:hover { background: #ffffff; color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

/* 🌿 森林卡牌场域 */
.forest-field {
  flex: 1;
  position: relative;
  width: 100%;
  margin-top: 12px;
  overflow: hidden; /* 保证内部绝对不溢出 */
}

.energy-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.active-tether {
  filter: drop-shadow(0 2px 4px rgba(16, 185, 129, 0.3));
}

/* 🍃 卡牌样式与受控微浮动 */
.word-node {
  position: absolute;
  z-index: 3;
  cursor: pointer;
  transform: translate(-50%, -50%);
  animation: gentleFloat 4s ease-in-out infinite alternate;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s, opacity 0.4s;
}

.node-content {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 1);
  backdrop-filter: blur(8px);
  padding: 8px 16px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.08);
  white-space: nowrap;
}

.node-type-tag {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.is-en .node-type-tag { background: #e0f2fe; color: #0284c7; }
.is-cn .node-type-tag { background: #dcfce7; color: #15803d; }

.node-text {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.word-node:hover {
  transform: translate(-50%, -50%) scale(1.05);
  z-index: 10;
}

.word-node:hover .node-content {
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.12);
}

/* 抹茶绿选中高亮 */
.word-node.is-selected {
  transform: translate(-50%, -50%) scale(1.08);
  z-index: 20;
}

.word-node.is-selected .node-content {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.25);
}

.word-node.is-selected .node-text { color: #ffffff; }
.word-node.is-selected .node-type-tag { background: rgba(255, 255, 255, 0.2); color: #ffffff; }

/* 消除淡出 */
.word-node.is-matched {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.2);
  pointer-events: none;
}

/* 配对错误红框震动 */
.word-node.is-error {
  animation: gentleShake 0.4s ease-in-out;
}
.word-node.is-error .node-content {
  border-color: #fca5a5;
  background: #fef2f2;
}

.audio-pulse {
  background: none; border: none; cursor: pointer; font-size: 11px; opacity: 0.5; transition: opacity 0.2s;
}
.audio-pulse:hover { opacity: 1; }

/* 限制极小幅度的悬浮浮动 (±4px)，确保绝不溢出容器 */
@keyframes gentleFloat {
  0% { transform: translate(-50%, -50%) translateY(0px); }
  100% { transform: translate(-50%, -50%) translateY(-5px); }
}

@keyframes gentleShake {
  0%, 100% { transform: translate(-50%, -50%); }
  25% { transform: translate(-54%, -50%); }
  75% { transform: translate(-46%, -50%); }
}

/* 后台与结算 */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.2); backdrop-filter: blur(4px); z-index: 100; }
.admin-panel {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: #ffffff; padding: 24px; border-radius: 20px; z-index: 110; width: 320px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.08);
}
.admin-panel textarea { width: 100%; height: 140px; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; border-radius: 8px; padding: 8px; margin: 12px 0; font-family: monospace; }
.main-action-btn { width: 100%; padding: 10px; background: #10b981; border: none; border-radius: 12px; color: #ffffff; font-weight: 700; cursor: pointer; }

.finish-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #334155; }
.forest-trophy { font-size: 3.5rem; margin-bottom: 12px; }
.finish-zone h2 { font-weight: 700; margin-bottom: 6px; }
.finish-zone p { color: #64748b; font-size: 14px; margin-bottom: 20px; }
</style>
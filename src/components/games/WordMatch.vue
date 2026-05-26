<template>
  <div class="word-match-viewport">
    <div v-if="showAdmin" class="overlay" @click="showAdmin = false"></div>
    <div v-if="showAdmin" class="admin-panel">
      <h3>词库配置</h3>
      <textarea v-model="configText" placeholder="请输入JSON格式词库"></textarea>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="btn main-action-btn" @click="handleSaveConfig">保存配置</button>
      </div>
    </div>

    <div id="game-container">
      <div class="game-header">
        <div class="status-item">
          <span class="label">🏁 关卡轮次</span>
          <span class="value round-tag">ROUND {{ currentRound }} / 3</span>
        </div>
        <div class="status-item">
          <span class="label">🎯 消除进度</span>
          <span class="value">{{ roundMatchedCount }} <span class="slash">/</span> {{ cards.length / 2 }}</span>
        </div>
        <div class="status-item">
          <span class="label">🔥 COMBO</span>
          <span class="value combo-value" :class="{ 'has-combo': combo > 0 }" :style="{ '--combo-scale': 1 + Math.min(combo * 0.05, 0.4) }">
            {{ combo }}
          </span>
        </div>
        <button class="reset-btn" @click="startRound(currentRound)">🔄 重摆本轮</button>
        <button v-if="canEdit" class="admin-toggle-btn" @click="showAdmin = true">⚙️</button>
      </div>

      <div class="grid-container" v-if="gameStore.wordList.length > 0 && !isGameFinished">
        <TransitionGroup name="card-list" tag="div" class="game-grid">
          <div 
            v-for="card in cards" 
            :key="card.id"
            v-show="!card.isMatched"
            class="card-item"
            :class="[
              `type-${card.type}`,
              { 
                'is-selected': selectedCard?.id === card.id, 
                'match-error': errorCardIds.includes(card.id)
              }
            ]"
            @click="handleCardClick($event, card)"
          >
            <p class="card-text" :class="{ 'is-cn': card.type === 'cn' }">{{ card.text }}</p>
          </div>
        </TransitionGroup>
      </div>

      <div v-else-if="gameStore.wordList.length === 0" class="empty-words">
        <p style="margin: 20px 0; color: #999;">🐱：还没有准备连连看卡牌哦...</p>
        <button v-if="canEdit" class="btn main-action-btn" @click="showAdmin = true">立即配置</button>
      </div>

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
});

const emit = defineEmits(['updateConfig', 'saveConfig'])
const gameStore = useGameStore()

// 游戏状态
const currentRound = ref(1)
const cards = ref([])
const selectedCard = ref(null)
const errorCardIds = ref([]) 
const combo = ref(0)
const maxCombo = ref(0)
const isGameFinished = ref(false)

const showAdmin = ref(false)
const configText = ref('')

// 用于原生合成音效的 AudioContext
let audioCtx = null

const roundMatchedCount = computed(() => {
  return cards.value.filter(c => c.isMatched).length / 2
})

// 初始化
const initGame = () => {
  currentRound.value = 1
  combo.value = 0
  maxCombo.value = 0
  isGameFinished.value = false
  startRound(1)
}

// 开启指定轮次
const startRound = (roundNum) => {
  if (!gameStore.wordList || gameStore.wordList.length === 0) {
    cards.value = []
    return
  }

  const wordsPerRound = 10
  const startIndex = (roundNum - 1) * wordsPerRound
  let activeWords = gameStore.wordList.slice(startIndex, startIndex + wordsPerRound)
  
  if (activeWords.length === 0) {
    activeWords = gameStore.wordList.slice(0, wordsPerRound)
  }

  let pool = []
  activeWords.forEach((item, index) => {
    pool.push({ id: `en-${index}`, pairId: index, type: 'en', text: item.en, isMatched: false })
    pool.push({ id: `cn-${index}`, pairId: index, type: 'cn', text: item.cn, isMatched: false })
  })

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }

  cards.value = pool
  selectedCard.value = null
  errorCardIds.value = []
}

// 核心点击与消除逻辑
const handleCardClick = (event, card) => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }

  if (card.isMatched || errorCardIds.value.length > 0) return

  if (!selectedCard.value) {
    selectedCard.value = card
    if (card.type === 'en') speak(card.text)
    return
  }

  if (selectedCard.value.id === card.id) {
    selectedCard.value = null
    return
  }

  const card1 = selectedCard.value
  const card2 = card

  if (card1.pairId === card2.pairId && card1.type !== card2.type) {
    // 成功配对
    card1.isMatched = true
    card2.isMatched = true
    
    combo.value++
    if (combo.value > maxCombo.value) maxCombo.value = combo.value
    
    // 播放欢快清脆音效
    playSuccessSound()

    if (card2.type === 'en') speak(card2.text)

    // 触发【全新升级】金币 + 星星 + 撒花 特效（保留你原有的单体题特效不变）
    triggerCelebrationEffect(event.clientX, event.clientY)

    selectedCard.value = null

    if (roundMatchedCount.value === cards.value.length / 2) {
      setTimeout(() => {
        handleRoundComplete()
      }, 500)
    }
  } else {
    // 配对失败
    combo.value = 0 
    errorCardIds.value = [card1.id, card2.id]
    
    setTimeout(() => {
      errorCardIds.value = []
      selectedCard.value = null
    }, 450)
  }
}

// 清脆、欢快的水晶风铃琶音音效（单题选对音效不动）
const playSuccessSound = () => {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const now = audioCtx.currentTime
  const comboBonus = Math.min(combo.value * 35, 300) 

  // 1. 清脆的“啵”泡泡破裂主击音
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

  // 2. 水晶风铃琶音
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

// 🎵 【新增】每一轮全部匹配干净后的进阶庆祝大音效
const playRoundCompleteSound = () => {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const now = audioCtx.currentTime

  // 1. 低音奠定史诗震撼感（BASS 轰鸣）
  const bassOsc = audioCtx.createOscillator()
  const bassGain = audioCtx.createGain()
  bassOsc.type = 'triangle'
  bassOsc.frequency.setValueAtTime(130.81, now) // C3 低音
  bassOsc.frequency.exponentialRampToValueAtTime(261.63, now + 0.15) // 快速滑音到 C4
  bassGain.gain.setValueAtTime(0.3, now)
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
  bassOsc.connect(bassGain)
  bassGain.connect(audioCtx.destination)
  bassOsc.start(now)
  bassOsc.stop(now + 0.8)

  // 2. 密集高亢的水晶琶音急速上升（向上扫频，模拟通关飞跃）
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00] // C5-E5-G5-C6-E6-G6-C7 大三和弦完美进阶
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + i * 0.06) // 阶梯式延时触发，营造流利琶音效果
    
    gainNode.gain.setValueAtTime(0, now + i * 0.06)
    gainNode.gain.linearRampToValueAtTime(0.15, now + i * 0.06 + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5)
    
    osc.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    osc.start(now + i * 0.06)
    osc.stop(now + i * 0.06 + 0.5)
  })

  // 3. 终极大奖音效（在琶音结束时，撞击一个清透悠长的正弦胜利尾音）
  const winOsc = audioCtx.createOscillator()
  const winGain = audioCtx.createGain()
  winOsc.type = 'sine'
  winOsc.frequency.setValueAtTime(2093.00, now + 0.4) // 高音 C7 撞击
  winGain.gain.setValueAtTime(0, now + 0.4)
  winGain.gain.linearRampToValueAtTime(0.25, now + 0.4 + 0.05)
  winGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4 + 1.2) // 超长优雅回响
  winOsc.connect(winGain)
  winGain.connect(audioCtx.destination)
  winOsc.start(now + 0.4)
  winOsc.stop(now + 1.6)
}

// 👑 你的原有特效：点击位置爆开金币星星 + 屏幕两侧喷洒梦幻礼花（保持原封不动）
const triggerCelebrationEffect = (clientX, clientY) => {
  const originX = clientX / window.innerWidth
  const originY = clientY / window.innerHeight

  confetti({
    particleCount: 12,
    angle: 90,
    spread: 60,
    origin: { x: originX, y: originY },
    colors: ['#ffd700', '#ffb703', '#f4a261'], 
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
    colors: ['#ffffff', '#e0f2fe', '#fffbeb', '#ffd166'], 
    shapes: ['star'],  
    scalar: 1.0,
    ticks: 80
  })

  const duration = 0.35 * 1000
  const end = Date.now() + duration

  ;(function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      colors: ['#52b788', '#ffd166', '#ff4d4d', '#2563eb', '#ffd700'],
      shapes: ['square', 'circle'] 
    })
    
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      colors: ['#52b788', '#ffd166', '#ff4d4d', '#2563eb', '#ffd700'],
      shapes: ['square', 'circle']
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }())
}

// 全局全屏庆祝震撼礼花特效（不动）
const triggerGlobalRoundCelebration = () => {
  confetti({
    particleCount: 140,
    spread: 120,
    origin: { x: 0.5, y: 0.4 },
    colors: ['#ff4d4d', '#ffb703', '#52b788', '#2563eb', '#9b5de5', '#ffd700'],
    shapes: ['star', 'circle', 'square'],
    scalar: 1.2,
    gravity: 0.85,
    ticks: 150
  })

  const duration = 1.5 * 1000
  const end = Date.now() + duration

  ;(function frame() {
    confetti({
      particleCount: 6,
      angle: 50,
      spread: 70,
      origin: { x: 0, y: 0.75 },
      colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ffd700'],
      scalar: 1.1
    })
    
    confetti({
      particleCount: 6,
      angle: 130,
      spread: 70,
      origin: { x: 1, y: 0.75 },
      colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ffd700'],
      scalar: 1.1
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }())
}

const handleRoundComplete = () => {
  // ⚡ 触发全屏漫天撒花特效
  triggerGlobalRoundCelebration()
  
  // 🎵 瞬间鸣响——全屏进阶通关庆祝音效
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
  if (!text) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = 'en-US'
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
/* 样式完美保持原样 */
.word-match-viewport { 
  --mint-primary: #52b788; 
  --mint-light: #e8f5e9; 
  --mint-dark: #1b5e20; 
  --mint-bg: #f8fafc;
  --text-main: #1e293b;
  --card-shadow: 0 4px 12px rgba(148, 163, 184, 0.08), 0 1px 3px rgba(148, 163, 184, 0.04);
  --card-hover-shadow: 0 12px 24px rgba(82, 183, 136, 0.15), 0 4px 8px rgba(82, 183, 136, 0.05);

  display: flex; 
  justify-content: center; 
  align-items: center; 
  min-height: 520px; 
  width: 100%; 
  background: white; 
  position: relative;
}

#game-container { 
  background: white; 
  width: 100%;
  max-width: 820px;
  padding: 28px; 
  border-radius: 36px; 
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.04); 
  text-align: center; 
  display: flex;
  flex-direction: column;
  z-index: 2;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--mint-bg);
  padding: 12px 24px;
  border-radius: 20px;
  margin-bottom: 24px;
  border: 1px solid #f1f5f9;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.status-item .label {
  font-size: 11px;
  color: #64748b;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
}

.status-item .value {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--text-main);
}

.status-item .value .slash {
  color: #cbd5e1;
  margin: 0 3px;
}

.round-tag {
  color: var(--mint-primary) !important;
}

.combo-value {
  transition: transform 0.15s ease;
  transform: scale(var(--combo-scale, 1));
  display: inline-block;
}
.combo-value.has-combo {
  color: #ef4444 !important;
}

.reset-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: #475569;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  transition: all 0.2s;
}
.reset-btn:hover { 
  border-color: var(--mint-primary);
  color: var(--mint-dark);
  background: var(--mint-light);
}

.admin-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.3;
  font-size: 16px;
  transition: 0.2s;
}
.admin-toggle-btn:hover { opacity: 1; }

.grid-container {
  width: 100%;
  min-height: 350px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  width: 100%;
}

.card-item {
  background: white;
  border-radius: 18px;
  padding: 14px 10px;
  cursor: pointer;
  box-shadow: var(--card-shadow);
  transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
  box-sizing: border-box;
  position: relative;
  border: 1.5px solid #f1f5f9;
}

.card-item.type-en {
  background: linear-gradient(180deg, #ffffff 0%, #f7fdfa 100%);
  border-bottom: 3px solid #e2f4ec;
}

.card-item.type-cn {
  background: linear-gradient(180deg, #ffffff 0%, #fffdf9 100%);
  border-bottom: 3px solid #fdf5e6;
}

.card-item:hover {
  box-shadow: var(--card-hover-shadow);
  transform: translateY(-4px);
  border-color: var(--mint-primary);
}

.card-item.is-selected {
  background: var(--mint-primary) !important;
  border-color: var(--mint-primary) !important;
  transform: scale(0.95);
}
.card-item.is-selected .card-text {
  color: white !important;
}

.card-item.match-error {
  background: #fef2f2 !important;
  border-color: #fca5a5 !important;
  animation: cardShake 0.45s ease-in-out;
}
.card-item.match-error .card-text {
  color: #b91c1c !important;
}

.card-text {
  font-size: 1.05rem;
  font-weight: 700;
  color: #334155;
  word-break: break-word;
  margin: 0;
  transition: color 0.2s;
}

.card-text.is-cn {
  font-size: 0.95rem;
  font-weight: 600;
  color: #475569;
}

.card-list-enter-from { opacity: 0; transform: scale(0.8); }
.card-list-leave-to { opacity: 0; transform: scale(0.6) translateY(-12px); }
.card-list-leave-active { position: absolute; z-index: 0; }
.card-list-move { transition: transform 0.45s cubic-bezier(0.165, 0.84, 0.44, 1); }

.finish-zone {
  padding: 40px 20px;
}
.finish-zone h2 { color: #0f172a; font-weight: 800; font-size: 1.6rem; margin: 12px 0 6px; }
.summary-text { color: #64748b; font-size: 0.95rem; margin-bottom: 24px; }
.trophy { font-size: 4.5rem; animation: trophyFloat 2s ease-in-out infinite alternate; }

@keyframes trophyFloat {
  from { transform: translateY(0); }
  to { transform: translateY(-10px); }
}

.overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.3); z-index: 100; backdrop-filter: blur(4px); }
.admin-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 25px; border-radius: 24px; z-index: 110; width: 330px; box-shadow: 0 25px 60px rgba(0,0,0,0.12); border: 1px solid #f1f5f9; }
.admin-panel textarea { width: 100%; height: 160px; margin-bottom: 12px; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; outline: none; font-family: monospace; font-size: 12px; }

.btn { display: inline-block; font-weight: 700; cursor: pointer; transition: 0.2s; }
.main-action-btn { padding: 12px 45px; border-radius: 20px; background: var(--mint-primary); color: white; border: none; box-shadow: 0 4px 12px rgba(82,183,136,0.25); }
.main-action-btn:hover { background: #43a073; transform: translateY(-1px); }
.main-action-btn.next-mode { background: var(--text-main); box-shadow: none; }

@keyframes cardShake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
</style>
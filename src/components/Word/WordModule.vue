<template>
  <div class="word-module-container">
    <!-- 模式 1：测试卡片网格模式 -->
    <div v-if="currentView === 'test'" class="word-card-test-wrapper">
      <!-- 顶部导航与词库切换栏 -->
      <div class="test-header">
        <div class="bank-selector">
          <span class="label">当前词库：</span>
          <div class="bank-tabs">
            <button 
              v-for="bank in banks" 
              :key="bank.key"
              class="bank-btn"
              :class="{ active: currentBankKey === bank.key }"
              @click="switchBank(bank.key)"
            >
              {{ bank.name }}
            </button>
          </div>
        </div>

        <button class="reset-btn" @click="resetTest">🔄 重新测试</button>
      </div>

      <!-- 3x3 单词卡片网格区域 -->
      <div class="card-grid">
        <div 
          v-for="(word, index) in currentGridWords" 
          :key="word.en + index"
          class="word-card"
          :class="{
            'status-known': wordState[word.en] === 'known',
            'status-unknown': wordState[word.en] === 'unknown'
          }"
        >
          <div class="card-top">
            <h3 class="word-title">{{ word.en }}</h3>
            <button class="sound-btn" @click="speak(word.en)" title="朗读">🔊</button>
          </div>
          
          <div class="word-ps" v-if="word.ps">/ {{ word.ps }} /</div>

          <!-- 认识 / 不会 操作按钮 -->
          <div class="action-btns">
            <button 
              class="act-btn btn-know" 
              :class="{ active: wordState[word.en] === 'known' }"
              @click="markWord(word.en, 'known')"
            >
              认识
            </button>
            <button 
              class="act-btn btn-unknown" 
              :class="{ active: wordState[word.en] === 'unknown' }"
              @click="markWord(word.en, 'unknown')"
            >
              不会
            </button>
          </div>
        </div>
      </div>

      <!-- 底部测试进度统计卡片 -->
      <div class="progress-panel">
        <div class="progress-title">
          测试进度：<span class="highlight-num">{{ totalTested }}</span> / {{ activeBankWords.length }}
        </div>
        <div class="progress-detail">
          <span>认识：<b class="text-green">{{ knownCount }}</b> 个</span>
          <span class="divider">|</span>
          <span>不会：<b class="text-orange">{{ unknownCount }}</b> 个</span>
        </div>
      </div>

      <!-- 底部全局控制按钮 -->
      <div class="test-actions">
        <button 
          class="start-learn-btn" 
          :disabled="unknownCount === 0"
          @click="startLearnUnknown"
        >
          开始学习不会的单词 ({{ unknownCount }}个)
        </button>
        <button class="outline-btn" @click="resetTest">重新测试</button>
      </div>
    </div>

    <!-- 模式 2：单词学习详情页模式（绿色主视觉系统） -->
    <div v-else-if="currentView === 'learn'" class="word-learn-container">
      <!-- 左侧 sidebar：单词导航与控制 -->
      <aside class="learn-sidebar">
        <div class="sidebar-header">
          <span class="header-icon">📚</span>
          <h2>单词学习</h2>
        </div>

        <!-- 待学习单词列表 -->
        <div class="word-menu-list">
          <div
            v-for="(word, index) in learningList"
            :key="word.en + index"
            class="word-menu-item"
            :class="{ active: currentLearnIndex === index }"
            @click="currentLearnIndex = index"
          >
            <span class="word-index">{{ index + 1 }}</span>
            <span class="word-text">{{ word.en }}</span>
          </div>
        </div>

        <!-- 操作与翻页按钮 -->
        <div class="sidebar-actions">
          <button class="action-btn primary-btn" @click="isTestMode = !isTestMode">
            {{ isTestMode ? '👁️ 查看释义' : '🧠 记忆检测' }}
          </button>

          <div class="page-nav-btns">
            <button 
              class="nav-btn" 
              :disabled="currentLearnIndex === 0" 
              @click="currentLearnIndex--"
            >
              上一页
            </button>
            <button 
              class="nav-btn" 
              :disabled="currentLearnIndex === learningList.length - 1" 
              @click="currentLearnIndex++"
            >
              下一页
            </button>
          </div>

          <div class="page-indicator">
            第 {{ currentLearnIndex + 1 }} 页，共 {{ learningList.length }} 页
          </div>

          <button class="back-btn" @click="currentView = 'test'">返回测试</button>
        </div>
      </aside>

      <!-- 右侧 main：单词详情展示区 -->
      <main class="learn-content" v-if="currentLearnWord">
        <!-- 顶部大单词标题 -->
        <div class="word-header-title">
          <h1>{{ currentLearnWord.en }}</h1>
        </div>

        <!-- 发音面板 (美式/英式) -->
        <div class="detail-card phonetic-card">
          <div class="phonetic-item" @click="speak(currentLearnWord.en, 'us')">
            <span class="sound-icon">🔊</span>
            <span class="label">美式发音：</span>
            <span class="phonetic-text">/{{ currentLearnWord.usPhonetic || currentLearnWord.ps || 'nuː' }}/</span>
          </div>
          <div class="phonetic-item" @click="speak(currentLearnWord.en, 'uk')">
            <span class="sound-icon">🔊</span>
            <span class="label">英式发音：</span>
            <span class="phonetic-text">/{{ currentLearnWord.ukPhonetic || currentLearnWord.ps || 'njuː' }}/</span>
          </div>
        </div>

        <!-- 拼读拆解面板 -->
        <div class="detail-card spelling-card">
          <div class="tab-header">
            <button 
              class="tab-btn" 
              :class="{ active: spellTab === 'split' }"
              @click="spellTab = 'split'"
            >
              拆分发音
            </button>
            <button 
              class="tab-btn" 
              :class="{ active: spellTab === 'phonics' }"
              @click="spellTab = 'phonics'"
            >
              自然拼读
            </button>
          </div>

          <div class="spelling-content">
            <!-- 拆分发音块 -->
            <div v-if="spellTab === 'split'" class="split-syllable-box" @click="speak(currentLearnWord.en)">
              <div class="syllable-text">{{ currentLearnWord.en }}</div>
              <div class="syllable-ps">/{{ currentLearnWord.ps || 'nuː' }}/</div>
            </div>

            <!-- 自然拼读内容 -->
            <div v-else class="phonics-box">
              <span 
                v-for="(part, i) in (currentLearnWord.phonicsParts || [currentLearnWord.en])" 
                :key="i"
                class="phonics-chip"
              >
                {{ part }}
              </span>
            </div>

            <button class="play-full-btn" @click="speak(currentLearnWord.en)">
              ► 播放完整发音
            </button>
          </div>
        </div>

        <!-- 释义与例句面板 -->
        <div class="detail-card meaning-card">
          <div class="card-section-title">
            <span class="icon">📖</span> 释义
          </div>

          <!-- 记忆检测遮罩模式 -->
          <div v-if="isTestMode" class="test-mask" @click="isTestMode = false">
            <span>🙈 点击取消遮罩或再次点击“记忆检测”查看释义</span>
          </div>

          <div v-else class="meaning-body">
            <div class="pos-tag" v-if="currentLearnWord.pos || 'adj.'">
              {{ currentLearnWord.pos || 'adj.' }}
            </div>
            <div class="cn-text">{{ currentLearnWord.cn }}</div>

            <!-- 例句区域 -->
            <div class="example-box">
              <div class="example-en">
                {{ currentLearnWord.exampleEn || `She has a ${currentLearnWord.en} item.` }}
                <button class="sound-mini-btn" @click="speak(currentLearnWord.exampleEn || currentLearnWord.en)">🔊</button>
              </div>
              <div class="example-cn">
                {{ currentLearnWord.exampleCn || `她有一个新的物品。` }}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  // 支持外部传入词库，若未传则默认使用内置词库
  customBanks: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['start-learning'])

// 视图模式: 'test' | 'learn'
const currentView = ref('test')

// 词库定义
const banks = [
  { key: 'primary', name: '小学考纲' },
  { key: 'junior', name: '初中考纲' },
  { key: 'senior', name: '高中考纲' }
]

const currentBankKey = ref('primary')

// 内置基础示例词库
const defaultBankData = {
  primary: [
    { en: 'new', ps: 'njuː', pos: 'adj.', cn: '新的', exampleEn: 'She has a new schoolbag.', exampleCn: '她有一个新书包。' },
    { en: 'short', ps: 'ʃɔːt', pos: 'adj.', cn: '短的；矮的', exampleEn: 'He is short and thin.', exampleCn: '他又矮又瘦。' },
    { en: 'year', ps: 'jɪə', pos: 'n.', cn: '年份', exampleEn: 'Happy New Year!', exampleCn: '新年快乐！' },
    { en: 'nice', ps: 'naɪs', pos: 'adj.', cn: '美好的', exampleEn: 'Nice to meet you.', exampleCn: '很高兴见到你。' },
    { en: 'long', ps: 'lɒŋ', pos: 'adj.', cn: '长的', exampleEn: 'It has a long tail.', exampleCn: '它有一条长尾巴。' },
    { en: 'kind', ps: 'kaɪnd', pos: 'adj.', cn: '友善的；种类', exampleEn: 'She is very kind.', exampleCn: '她非常友善。' },
    { en: 'round', ps: 'raʊnd', pos: 'adj.', cn: '圆的', exampleEn: 'The ball is round.', exampleCn: '球是圆的。' },
    { en: 'old', ps: 'əʊld', pos: 'adj.', cn: '老的；旧的', exampleEn: 'This is an old house.', exampleCn: '这是一栋旧房子。' },
    { en: 'think', ps: 'θɪŋk', pos: 'v.', cn: '思考', exampleEn: 'Let me think.', exampleCn: '让我想想。' }
  ],
  junior: [
    { en: 'achieve', ps: 'əˈtʃiːv', pos: 'v.', cn: '实现；达到', exampleEn: 'Achieve your dreams.', exampleCn: '实现你的梦想。' },
    { en: 'benefit', ps: 'ˈbenɪfɪt', pos: 'n.', cn: '利益；好处', exampleEn: 'Exercise has many benefits.', exampleCn: '运动有很多好处。' },
    { en: 'culture', ps: 'ˈkʌltʃə', pos: 'n.', cn: '文化', exampleEn: 'Chinese culture.', exampleCn: '中国文化。' },
    { en: 'decision', ps: 'dɪˈsɪʒn', pos: 'n.', cn: '决定', exampleEn: 'Make a good decision.', exampleCn: '做一个好决定。' },
    { en: 'effort', ps: 'ˈefət', pos: 'n.', cn: '努力', exampleEn: 'Put in more effort.', exampleCn: '付出更多努力。' },
    { en: 'future', ps: 'ˈfjuːtʃə', pos: 'n.', cn: '未来', exampleEn: 'In the near future.', exampleCn: '在不久的将来。' },
    { en: 'growth', ps: 'ɡrəʊθ', pos: 'n.', cn: '增长', exampleEn: 'Personal growth.', exampleCn: '个人成长。' },
    { en: 'habit', ps: 'ˈhæbɪt', pos: 'n.', cn: '习惯', exampleEn: 'Develop a good habit.', exampleCn: '养成好习惯。' },
    { en: 'impact', ps: 'ˈɪmpækt', pos: 'n.', cn: '影响', exampleEn: 'Environmental impact.', exampleCn: '环境影响。' }
  ],
  senior: [
    { en: 'abundant', ps: 'əˈbʌndənt', pos: 'adj.', cn: '丰富的' },
    { en: 'brilliant', ps: 'ˈbrɪliənt', pos: 'adj.', cn: '杰出的' },
    { en: 'capacity', ps: 'kəˈpæsəti', pos: 'n.', cn: '能力；容量' },
    { en: 'deliberate', ps: 'dɪˈlɪbərət', pos: 'adj.', cn: '深思熟虑的' },
    { en: 'emphasis', ps: 'ˈemfəsɪs', pos: 'n.', cn: '强调' },
    { en: 'frequent', ps: 'ˈfriːkwənt', pos: 'adj.', cn: '频繁的' },
    { en: 'genuine', ps: 'ˈdʒenjuɪn', pos: 'adj.', cn: '真诚的' },
    { en: 'horizon', ps: 'həˈraɪzn', pos: 'n.', cn: '地平线；视野' },
    { en: 'inevitable', ps: 'ɪnˈevɪtəbl', pos: 'adj.', cn: '不可避免的' }
  ]
}

// 单词状态记录: { 'new': 'known' | 'unknown' }
const wordState = ref({})

// 学习模式下的内部状态
const learningList = ref([])
const currentLearnIndex = ref(0)
const spellTab = ref('split')
const isTestMode = ref(false)

// 获取当前选择词库的列表
const activeBankWords = computed(() => {
  if (props.customBanks && props.customBanks[currentBankKey.value]) {
    return props.customBanks[currentBankKey.value]
  }
  return defaultBankData[currentBankKey.value] || []
})

// 展示当前前 9 个或整页单词
const currentGridWords = computed(() => {
  return activeBankWords.value.slice(0, 9)
})

// 统计数据
const knownCount = computed(() => {
  return Object.values(wordState.value).filter(s => s === 'known').length
})

const unknownCount = computed(() => {
  return Object.values(wordState.value).filter(s => s === 'unknown').length
})

const totalTested = computed(() => {
  return knownCount.value + unknownCount.value
})

// 当前正在学习的单个单词对象
const currentLearnWord = computed(() => {
  return learningList.value[currentLearnIndex.value] || null
})

// 操作逻辑
const markWord = (en, status) => {
  if (wordState.value[en] === status) {
    delete wordState.value[en] // 再次点击取消勾选
  } else {
    wordState.value[en] = status
  }
}

const switchBank = (key) => {
  currentBankKey.value = key
  resetTest()
}

const resetTest = () => {
  wordState.value = {}
}

const speak = (text, langType = 'us') => {
  if (!text) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = langType === 'uk' ? 'en-GB' : 'en-US'
  msg.rate = 0.85
  window.speechSynthesis.speak(msg)
}

// 点击进入详情学习
const startLearnUnknown = () => {
  const unknownList = activeBankWords.value.filter(item => wordState.value[item.en] === 'unknown')
  if (unknownList.length === 0) return

  learningList.value = unknownList
  currentLearnIndex.value = 0
  isTestMode.value = false
  currentView.value = 'learn'

  emit('start-learning', unknownList)
}
</script>

<style scoped>
.word-module-container {
  width: 100%;
}

/* ================= 测试卡片视图 ================= */
.word-card-test-wrapper {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.test-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.bank-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bank-selector .label {
  font-size: 13px;
  font-weight: 700;
  color: #475569;
}

.bank-tabs {
  display: flex;
  gap: 6px;
  background: #e2e8f0;
  padding: 3px;
  border-radius: 8px;
}

.bank-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bank-btn.active {
  background: #ffffff;
  color: #27ae60;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.reset-btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.word-card {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.word-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

.word-card.status-known {
  border-color: #86efac;
  background: #f0fdf4;
}

.word-card.status-unknown {
  border-color: #fca5a5;
  background: #fef2f2;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.word-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #27ae60;
}

.sound-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.sound-btn:hover {
  opacity: 1;
}

.word-ps {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
  margin-bottom: 16px;
  font-family: sans-serif;
}

.action-btns {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.act-btn {
  flex: 1;
  border: none;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-know {
  background: #e8f5e9;
  color: #27ae60;
}

.btn-know:hover, .btn-know.active {
  background: #27ae60;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(39, 174, 96, 0.3);
}

.btn-unknown {
  background: #fff3e0;
  color: #ff9800;
}

.btn-unknown:hover, .btn-unknown.active {
  background: #ff9800;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(255, 152, 0, 0.3);
}

.progress-panel {
  background: #f0fdf4;
  border: 1px solid #dcfce7;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-title {
  font-size: 14px;
  font-weight: 700;
  color: #166534;
}

.highlight-num {
  color: #27ae60;
  font-size: 16px;
}

.progress-detail {
  font-size: 13px;
  color: #475569;
}

.divider {
  margin: 0 10px;
  color: #cbd5e1;
}

.text-green { color: #27ae60; }
.text-orange { color: #ff9800; }

.test-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 10px;
}

.start-learn-btn {
  background: #27ae60;
  color: #ffffff;
  border: none;
  padding: 12px 28px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.2);
}

.start-learn-btn:hover:not(:disabled) {
  background: #219150;
  transform: translateY(-1px);
}

.start-learn-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

.outline-btn {
  background: #ffffff;
  border: 1px solid #27ae60;
  color: #27ae60;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.outline-btn:hover {
  background: #f0fdf4;
}

/* ================= 单词学习详情视图 (绿色主视觉) ================= */
.word-learn-container {
  display: flex;
  max-width: 1000px;
  min-height: 680px;
  margin: 0 auto;
  background: #f4fbf7;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(39, 174, 96, 0.08);
  border: 1px solid #e1f5fe;
}

.learn-sidebar {
  width: 280px;
  background: #fbfdfe;
  border-right: 1px solid #e8f5e9;
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  color: #27ae60;
  font-weight: 800;
}

.word-menu-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.word-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e8f5e9;
  cursor: pointer;
  transition: all 0.2s ease;
}

.word-menu-item:hover {
  background: #f0fdf4;
  border-color: #86efac;
}

.word-menu-item.active {
  background: #e8f5e9;
  border-color: #27ae60;
  box-shadow: 0 2px 8px rgba(39, 174, 96, 0.15);
}

.word-index {
  width: 24px;
  height: 24px;
  background: #27ae60;
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.word-menu-item.active .word-index {
  background: #1e7e43;
}

.word-text {
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
}

.sidebar-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  border: none;
  padding: 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn {
  background: #27ae60;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.25);
}

.primary-btn:hover {
  background: #219150;
}

.page-nav-btns {
  display: flex;
  gap: 10px;
}

.nav-btn {
  flex: 1;
  background: #e2e8f0;
  border: none;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
}

.nav-btn:hover:not(:disabled) {
  background: #cbd5e1;
  color: #1e293b;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-indicator {
  text-align: center;
  font-size: 12px;
  color: #27ae60;
  font-weight: 600;
  background: #f0fdf4;
  padding: 6px;
  border-radius: 20px;
  border: 1px dashed #a7f3d0;
}

.back-btn {
  background: transparent;
  border: 1px solid #cbd5e1;
  color: #64748b;
  padding: 8px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.back-btn:hover {
  background: #f1f5f9;
}

.learn-content {
  flex: 1;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
}

.word-header-title h1 {
  margin: 0;
  font-size: 40px;
  font-weight: 900;
  color: #27ae60;
  letter-spacing: 0.5px;
}

.detail-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.phonetic-card {
  display: flex;
  gap: 24px;
  background: #f0fdf4;
  border-color: #dcfce7;
}

.phonetic-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.phonetic-item:hover {
  background: #dcfce7;
}

.phonetic-item .label {
  font-size: 13px;
  color: #27ae60;
  font-weight: 600;
}

.phonetic-item .phonetic-text {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.spelling-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-header {
  display: flex;
  gap: 8px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 10px;
  width: fit-content;
}

.tab-btn {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #27ae60;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(39, 174, 96, 0.2);
}

.spelling-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding-top: 4px;
}

.split-syllable-box {
  background: #27ae60;
  color: #ffffff;
  padding: 10px 20px;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(39, 174, 96, 0.2);
}

.syllable-text {
  font-size: 18px;
  font-weight: 800;
}

.syllable-ps {
  font-size: 12px;
  opacity: 0.9;
}

.phonics-box {
  display: flex;
  gap: 8px;
}

.phonics-chip {
  background: #e8f5e9;
  color: #27ae60;
  border: 1px solid #a7f3d0;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 16px;
}

.play-full-btn {
  background: #e8f5e9;
  color: #27ae60;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.play-full-btn:hover {
  background: #27ae60;
  color: #ffffff;
}

.meaning-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-section-title {
  font-size: 15px;
  font-weight: 800;
  color: #27ae60;
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 2px solid #f0fdf4;
  padding-bottom: 8px;
}

.meaning-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pos-tag {
  display: inline-block;
  background: #27ae60;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  width: fit-content;
}

.cn-text {
  font-size: 18px;
  font-weight: 800;
  color: #1e293b;
}

.example-box {
  background: #f8fafc;
  border-left: 4px solid #27ae60;
  padding: 12px 16px;
  border-radius: 0 12px 12px 0;
  margin-top: 6px;
}

.example-en {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sound-mini-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.6;
}

.sound-mini-btn:hover {
  opacity: 1;
}

.example-cn {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

.test-mask {
  background: #f1f5f9;
  border: 2px dashed #cbd5e1;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.test-mask:hover {
  background: #e2e8f0;
  color: #1e293b;
}
</style>
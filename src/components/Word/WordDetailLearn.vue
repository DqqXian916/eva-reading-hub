<template>
  <div class="word-learn-container">
    <!-- 左侧 sidebar：单词导航与控制 -->
    <aside class="learn-sidebar">
      <div class="sidebar-header">
        <span class="header-icon">📚</span>
        <h2>单词学习</h2>
      </div>

      <!-- 单词列表 -->
      <div class="word-menu-list">
        <div
          v-for="(word, index) in learnList"
          :key="word.en + index"
          class="word-menu-item"
          :class="{ active: currentIndex === index }"
          @click="selectWord(index)"
        >
          <span class="word-index">{{ index + 1 }}</span>
          <span class="word-text">{{ word.en }}</span>
        </div>
      </div>

      <!-- 操作与翻页按钮 -->
      <div class="sidebar-actions">
        <button class="action-btn primary-btn" @click="toggleTestMode">
          {{ isTestMode ? '👁️ 查看释义' : '🧠 记忆检测' }}
        </button>

        <div class="page-nav-btns">
          <button 
            class="nav-btn" 
            :disabled="currentIndex === 0" 
            @click="prevWord"
          >
            上一页
          </button>
          <button 
            class="nav-btn" 
            :disabled="currentIndex === learnList.length - 1" 
            @click="nextWord"
          >
            下一页
          </button>
        </div>

        <div class="page-indicator">
          第 {{ currentIndex + 1 }} 页，共 {{ learnList.length }} 页
        </div>

        <button class="back-btn" @click="goBack">返回测试</button>
      </div>
    </aside>

    <!-- 右侧 main：单词详情展示区 -->
    <main class="learn-content" v-if="currentWord">
      <!-- 顶部大单词 -->
      <div class="word-header-title">
        <h1>{{ currentWord.en }}</h1>
      </div>

      <!-- 发音面板 (美式/英式) -->
      <div class="detail-card phonetic-card">
        <div class="phonetic-item" @click="speak(currentWord.en, 'us')">
          <span class="sound-icon">🔊</span>
          <span class="label">美式发音：</span>
          <span class="phonetic-text">/{{ currentWord.usPhonetic || currentWord.ps || 'nuː' }}/</span>
        </div>
        <div class="phonetic-item" @click="speak(currentWord.en, 'uk')">
          <span class="sound-icon">🔊</span>
          <span class="label">英式发音：</span>
          <span class="phonetic-text">/{{ currentWord.ukPhonetic || currentWord.ps || 'njuː' }}/</span>
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
          <div v-if="spellTab === 'split'" class="split-syllable-box" @click="speak(currentWord.en)">
            <div class="syllable-text">{{ currentWord.en }}</div>
            <div class="syllable-ps">/{{ currentWord.ps || 'nuː' }}/</div>
          </div>

          <!-- 自然拼读内容 -->
          <div v-else class="phonics-box">
            <span 
              v-for="(part, i) in (currentWord.phonicsParts || [currentWord.en])" 
              :key="i"
              class="phonics-chip"
            >
              {{ part }}
            </span>
          </div>

          <button class="play-full-btn" @click="speak(currentWord.en)">
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
          <div class="pos-tag" v-if="currentWord.pos">{{ currentWord.pos }}</div>
          <div class="cn-text">{{ currentWord.cn }}</div>

          <!-- 例句区域 -->
          <div class="example-box" v-if="currentWord.exampleEn || defaultExample.en">
            <div class="example-en">
              {{ currentWord.exampleEn || defaultExample.en }}
              <button class="sound-mini-btn" @click="speak(currentWord.exampleEn || defaultExample.en)">🔊</button>
            </div>
            <div class="example-cn">
              {{ currentWord.exampleCn || defaultExample.cn }}
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  // 传入需要学习的单词数组（如测试页面挑选出的 unknownList）
  words: {
    type: Array,
    default: () => [
      {
        en: 'new',
        ps: 'njuː',
        usPhonetic: 'nuː',
        ukPhonetic: 'njuː',
        pos: 'adj.',
        cn: '新的',
        exampleEn: 'She has a new schoolbag.',
        exampleCn: '她有一个新书包。'
      }
    ]
  }
})

const emit = defineEmits(['back'])

// 响应式状态
const currentIndex = ref(0)
const spellTab = ref('split') // 'split' | 'phonics'
const isTestMode = ref(false)

const learnList = computed(() => {
  return props.words && props.words.length > 0 ? props.words : [
    { en: 'new', ps: 'njuː', pos: 'adj.', cn: '新的' }
  ]
})

const currentWord = computed(() => learnList.value[currentIndex.value] || null)

// 兜底默认例句
const defaultExample = computed(() => {
  if (!currentWord.value) return { en: '', cn: '' }
  return {
    en: `She has a ${currentWord.value.en} item.`,
    cn: `她有一个${currentWord.value.cn || '新的'}物品。`
  }
})

// 页面操作方法
const selectWord = (index) => {
  currentIndex.value = index
}

const prevWord = () => {
  if (currentIndex.value > 0) currentIndex.value--
}

const nextWord = () => {
  if (currentIndex.value < learnList.value.length - 1) currentIndex.value++
}

const toggleTestMode = () => {
  isTestMode.value = !isTestMode.value
}

const goBack = () => {
  emit('back')
}

// 语音朗读
const speak = (text, langType = 'us') => {
  if (!text) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = langType === 'uk' ? 'en-GB' : 'en-US'
  msg.rate = 0.85
  window.speechSynthesis.speak(msg)
}
</script>

<style scoped>
/* 全局容器：柔和浅绿背景 */
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* ================= 左侧导航 Sidebar ================= */
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

/* 底部操作与翻页 */
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

/* ================= 右侧详情 Main ================= */
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

/* 统一卡片基础样式 */
.detail-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

/* 发音卡片 */
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

/* 拼读拆解卡片 */
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

/* 释义卡片 */
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

/* 记忆检测遮罩 */
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
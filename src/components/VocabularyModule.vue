<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  student: Object,
  initialWords: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update-progress'])

const currentIndex = ref(0)
const isRevealed = ref(false)

// 1. 键盘监听逻辑
const handleKeyDown = (e) => {
  if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault() 
  }

  if (e.key === 'Enter') {
    if (!isRevealed.value) {
      isRevealed.value = true
    } else {
      if (currentIndex.value < props.initialWords.length - 1) {
        selectWord(currentIndex.value + 1)
      }
    }
  } else if (e.key === 'ArrowDown') {
    if (currentIndex.value < props.initialWords.length - 1) {
      selectWord(currentIndex.value + 1)
    }
  } else if (e.key === 'ArrowUp') {
    if (currentIndex.value > 0) {
      selectWord(currentIndex.value - 1)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// 自动滚动随动
watch(currentIndex, () => {
  setTimeout(() => {
    const activeEl = document.querySelector('.mini-card.is-active')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, 50)
})

watch(() => props.initialWords, (newVal) => {
  if (currentIndex.value >= newVal.length) {
    currentIndex.value = 0
  }
}, { deep: true, immediate: true })

const currentWord = computed(() => props.initialWords[currentIndex.value] || {})

const masteredCount = computed(() => {
  return props.initialWords.filter(word => word.m).length
})

const selectWord = (index) => {
  currentIndex.value = index
  isRevealed.value = false
  speak(props.initialWords[index].en)
}

const toggleMastery = (index) => {
  const words = [...props.initialWords]
  words[index].m = !words[index].m
  emit('update-progress', words)
}

const speak = (text) => {
  if (!text) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = 'en-US'
  msg.rate = 0.85
  window.speechSynthesis.speak(msg)
}

const formatSentence = (s, word) => {
  if (!s || !word) return s
  const regex = new RegExp(`(${word})`, 'gi')
  return s.replace(regex, '<b class="highlight">$1</b>')
}
</script>

<template>
  <div class="eva-study-wrapper">
    <nav class="word-side-list">
      <div class="list-header">
        <span class="header-tag">STUDY PLAN</span>
        <div class="progress-info">
          <strong>{{ masteredCount }}/{{ initialWords.length }}</strong> 词汇达成
        </div>
      </div>

      <div class="scroll-area">
        <div 
          v-for="(item, index) in initialWords" 
          :key="index"
          class="mini-card"
          :class="{ 'is-active': currentIndex === index, 'is-done': item.m }"
          @click="selectWord(index)"
        >
          <div class="check-box" @click.stop="toggleMastery(index)">
            <span class="check-mark" v-if="item.m">✓</span>
          </div>
          <span class="en-text">{{ item.en }}</span>
        </div>
      </div>
    </nav>

    <main class="detail-stage">
      <div class="stage-content" v-if="currentWord.en">
        
        <section class="word-hero">
          <div class="hero-top">
            <h1>{{ currentWord.en }}</h1>
            <button class="voice-btn" @click="speak(currentWord.en)">🔊</button>
          </div>
          <div class="phonetic-tag" v-if="currentWord.ps">
            / {{ currentWord.ps }} /
          </div>
        </section>

        <section class="meaning-box" :class="{ 'revealed': isRevealed }" @click="isRevealed = true">
          <div class="section-label">中文释义</div>
          <div class="meaning-content">
            <p class="cn-text">{{ currentWord.cn }}</p>
            <div class="mask-layer" v-if="!isRevealed">
              <span class="eye-icon">👁️</span> 点击或回车显示释义
            </div>
          </div>
        </section>

        <section class="sentence-box" v-if="currentWord.s">
          <div class="section-label">情境例句</div>
          <div class="sentence-card">
            <p class="s-en" v-html="formatSentence(currentWord.s, currentWord.en)"></p>
            <button class="s-voice" @click="speak(currentWord.s)">点击朗读全句</button>
          </div>
        </section>

        <div class="stage-footer">
          <button class="nav-prev" :disabled="currentIndex === 0" @click="selectWord(currentIndex - 1)">上一个 (↑)</button>
          <button class="nav-next" :disabled="currentIndex === initialWords.length - 1" @click="selectWord(currentIndex + 1)">下一个 (Enter / ↓)</button>
        </div>

      </div>
    </main>
  </div>
</template>

<style scoped>
/* 核心：wrapper 不再写死高度，而是占满父容器剩余空间 */
.eva-study-wrapper { 
  display: flex; 
  flex: 1; /* 自动撑开 */
  height: 100%; /* 继承父级剩余高度 */
  background: #ffffff; 
  overflow: hidden; /* 防止组件本身溢出导致系统滚动条 */
}

/* 左侧列表：独立滚动 */
.word-side-list { 
  width: 240px; 
  height: 100%;
  border-right: 1px solid #f1f5f9; 
  display: flex; 
  flex-direction: column; 
  background: #ffffff;
  flex-shrink: 0;
}
.list-header { padding: 25px 20px 15px; }
.header-tag { font-size: 10px; font-weight: 800; color: #27ae60; letter-spacing: 1px; }
.progress-info { font-size: 13px; color: #64748b; margin-top: 4px; }

.scroll-area { 
  flex: 1; 
  overflow-y: auto; 
  padding: 0 10px 20px; 
}

/* 单词列表项 */
.mini-card { 
  display: flex; 
  align-items: center; 
  padding: 10px 14px; 
  border-radius: 8px; 
  cursor: pointer; 
  margin-bottom: 2px; 
  transition: 0.2s; 
}
.mini-card.is-active { background: #f1f5f9; }
.en-text { font-size: 14px; color: #334155; font-weight: 500; }
.is-done .en-text { color: #cbd5e1; text-decoration: line-through; }
.check-box { width: 16px; height: 16px; border: 2px solid #e2e8f0; border-radius: 4px; margin-right: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; }
.is-done .check-box { background: #27ae60; border-color: #27ae60; }
.check-mark { color: white; font-size: 10px; }

/* 右侧详情区：独立滚动且背景干净 */
.detail-stage { 
  flex: 1; 
  height: 100%;
  overflow-y: auto; 
  background: #ffffff; 
  scrollbar-gutter: stable;
}

.stage-content { 
  width: 100%; 
  max-width: 800px; 
  margin: 0 auto;
  padding: 40px 60px;
}

/* 单词标题 */
.word-hero { margin-bottom: 25px; }
.hero-top { display: flex; align-items: center; gap: 15px; }
.word-hero h1 { font-size: 52px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; }

.phonetic-tag {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 12px;
  background: #f8fafc;
  color: #64748b;
  border-radius: 6px;
  font-size: 18px;
}

/* 释义框 */
.meaning-box { 
  position: relative; 
  background: #fdfdfd; 
  border: 1px dashed #e2e8f0;
  padding: 25px 35px; 
  border-radius: 16px; 
  cursor: pointer; 
  margin-bottom: 25px; 
  min-height: 90px;
  display: flex;
  align-items: center;
}
.cn-text { font-size: 28px; font-weight: 700; color: #27ae60; margin: 0; }
.mask-layer { position: absolute; inset: -1px; background: #f1f5f9; border-radius: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; color: #94a3b8; font-size: 16px; }

/* 例句区 */
.sentence-card { border-left: 4px solid #27ae60; padding: 5px 25px; margin-bottom: 10px; }
.s-en { font-size: 22px; line-height: 1.5; color: #334155; font-family: 'Georgia', serif; }
:deep(.highlight) { color: #27ae60; border-bottom: 2px solid #27ae6033; }

/* 底部操作 */
.stage-footer { 
  margin-top: 40px; 
  display: flex; 
  gap: 15px; 
  padding-bottom: 60px; 
}
.nav-prev, .nav-next { flex: 1; padding: 16px; border-radius: 12px; font-weight: 700; cursor: pointer; border: 1px solid #e2e8f0; }
.nav-next { background: #1e293b; color: white; border-color: #1e293b; }
.nav-prev { background: white; color: #64748b; }

/* 细滚动条 */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
/* 1. 基础容器：确保占据剩余空间 */
.eva-study-wrapper { 
  display: flex; 
  flex: 1;
  height: 100%;
  background: #ffffff; 
  overflow: hidden;
}

/* 2. 详情区滚动容器 */
.detail-stage { 
  flex: 1; 
  height: 100%;
  overflow-y: auto; 
  background: #ffffff; 
  scrollbar-gutter: stable;
}

.stage-content { 
  width: 100%; 
  max-width: 800px; 
  margin: 0 auto;
  padding: 40px 60px;
}

/* 3. 中文释义区：重新设计揭开后的样式 */
.meaning-box { 
  position: relative; 
  background: #f8fafc; /* 默认浅灰色背景 */
  border: 1px dashed #e2e8f0;
  padding: 30px 40px; 
  border-radius: 20px; 
  cursor: pointer; 
  margin-bottom: 30px; 
  min-height: 110px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 揭开后的状态：背景变白，边框变实线 */
.meaning-box.revealed {
  background: #ffffff;
  border: 1px solid #27ae60;
  box-shadow: 0 10px 25px -5px rgba(39, 174, 96, 0.1);
}

.section-label { 
  font-size: 11px; 
  font-weight: 700; 
  color: #94a3b8; 
  letter-spacing: 1.5px; 
  margin-bottom: 12px; 
  text-transform: uppercase; 
}

.cn-text { 
  font-size: 32px; 
  font-weight: 700; 
  color: #27ae60; 
  margin: 0; 
  line-height: 1.2;
}

/* 遮罩层：保持优雅的模糊感 */
.mask-layer { 
  position: absolute; 
  inset: 0; 
  background: #f1f5f9; 
  border-radius: 18px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  gap: 12px; 
  color: #64748b; 
  font-weight: 600; 
  font-size: 17px; 
  z-index: 10;
}

/* 4. 底部按钮：修复丢失的样式 */
.stage-footer { 
  margin-top: 50px; 
  display: flex; 
  gap: 20px; 
  padding-bottom: 60px; 
}

.nav-prev, .nav-next { 
  flex: 1; 
  padding: 18px; 
  border-radius: 16px; 
  font-weight: 700; 
  cursor: pointer; 
  transition: all 0.2s; 
  border: 1px solid #e2e8f0; 
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-next { 
  background: #1e293b; 
  color: #ffffff; 
  border-color: #1e293b;
  box-shadow: 0 4px 12px rgba(30, 41, 59, 0.15);
}

.nav-next:hover {
  transform: translateY(-2px);
  background: #334155;
}

.nav-prev { 
  background: #ffffff; 
  color: #64748b; 
}

.nav-prev:hover:not(:disabled) {
  background: #f8fafc;
  color: #0f172a;
}

.nav-prev:disabled { 
  opacity: 0.3; 
  cursor: not-allowed; 
}

/* 5. 语音按钮美化 */
.voice-btn, .s-voice {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: 0.2s;
}

.s-voice {
  margin-top: 15px; 
  background: #f8fafc; 
  border: 1px solid #e2e8f0; 
  padding: 10px 20px; 
  border-radius: 10px; 
  font-size: 14px; 
  color: #64748b; 
  font-weight: 500;
}

.s-voice:hover {
  background: #f1f5f9;
  color: #27ae60;
  border-color: #27ae60;
}
/* --- 喇叭按钮样式修复 --- */
.voice-btn {
  /* 基础复位 */
  background: #f1f5f9; /* 浅灰色背景 */
  border: none;
  outline: none;
  cursor: pointer;
  
  /* 尺寸与圆角 */
  width: 44px;
  height: 44px;
  border-radius: 50%; /* 圆形按钮 */
  
  /* 居中喇叭图标 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  /* 交互动画 */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 20px;
  color: #64748b;
  
  /* 调整间距 */
  margin-left: 12px;
  vertical-align: middle;
}

.voice-btn:hover {
  background: #27ae60; /* 悬停变绿色 */
  color: white; /* 图标变白 */
  transform: scale(1.1); /* 轻轻放大 */
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.2);
}

.voice-btn:active {
  transform: scale(0.95); /* 点击缩回效果 */
}

/* 如果你用的是图片或 emoji 喇叭，可以微调位置 */
.voice-btn span, .voice-btn i {
  line-height: 1;
}

/* --- 顺便统一例句朗读按钮的样式 --- */
.s-voice {
  margin-top: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.s-voice:hover {
  border-color: #27ae60;
  color: #27ae60;
  background: #f0fdf4;
}

/* --- 单词 Hero 区域的微调，确保对齐 --- */
.hero-top {
  display: flex;
  align-items: center; /* 确保单词和喇叭在一条水平线上 */
  flex-wrap: wrap;
  gap: 10px;
}

.word-hero h1 {
  font-size: 64px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  line-height: 1;
}
</style>
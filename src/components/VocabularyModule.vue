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
        <span class="header-tag">TODAY'S PICK 🍔 </span>
        <div class="progress-info">
  <span class="progress-num">{{ masteredCount }}/{{ initialWords.length }}</span>
  <div class="plankton-warning">
    <span class="warning-text">窃取中：痞老板警告</span>
    <span class="plankton-eye">
        <svg class="plankton-icon" width="13" height="16" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 6C7 6 6 2 4 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M17 6C17 6 18 2 20 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 28C6.47715 28 2 23.5228 2 18V9C2 6.23858 4.23858 4 7 4H17C19.7614 4 22 6.23858 22 9V18C22 23.5228 17.5228 28 12 28Z" fill="currentColor"/>
          <circle cx="12" cy="14" r="5" fill="white"/>
          <circle cx="12" cy="14" r="2.5" fill="#0f172a"/>
          <path d="M8 21.5C8.82843 23.2386 10.6046 24.5 12.5 24.5C14.3954 24.5 16.1716 23.2386 17 21.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </span>
  </div>
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
/* 进度条外层容器 */
.progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

/* 数字部分：加粗，颜色更有质感 */
.progress-num {
  font-family: 'Monaco', 'Consolas', monospace; /* 程序员等宽字体 */
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

/* 痞老板警告标签：做成类似“胶囊标签”的精致感 */
.plankton-warning {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #f0fdf4; /* 极浅的绿 */
  border: 1px solid #dcfce7;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

/* 警告文字：更小巧、更有间距感 */
.warning-text {
  font-size: 10px;
  font-weight: 700;
  color: #166534; /* 深绿色 */
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

/* 灵魂黄瓜：加一个微弱的呼吸动画，像在监视 */
.plankton-eye {
  font-size: 12px;
  animation: watch-blink 3s infinite ease-in-out;
}

/* 呼吸动画：模拟痞老板在暗中观察 */
@keyframes watch-blink {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

/* 装饰性的小点：模拟黑客终端感 */
.plankton-warning::before {
  content: '';
  width: 4px;
  height: 4px;
  background: #22c55e;
  border-radius: 50%;
  margin-right: 2px;
  box-shadow: 0 0 5px #22c55e;
}
/* 修改之前的呼吸动画容器 */
.plankton-eye {
  display: flex; /* 确保居中 */
  align-items: center;
  /* 去掉原来的字体动画，加一个微小的旋转和呼吸 */
  animation: watch-sway 3s infinite ease-in-out; 
}

/* 如果你的 UI 是绿色的，图标也会自动变绿 */
.plankton-icon {
  color: #27ae60; /* 默认使用主厨绿 */
}

/* 当达到 100% 进度时，可以给这个图标加个红色警告效果 */
.is-complete .plankton-icon {
  color: #ef4444; /* 红色警告 */
}

/* 呼吸动画：模拟痞老板在观察和轻轻摇晃 */
@keyframes watch-sway {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
  50% { transform: scale(1.05) rotate(2deg); opacity: 0.9; }
}
/* 1. 修改容器样式，确保它是动画的承载点 */
.plankton-eye {
  display: inline-flex; 
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  /* 统一使用一个更生动的动画：结合了缩放和轻微晃动 */
  animation: plankton-life 3s infinite ease-in-out;
  transform-origin: center bottom; /* 以底部为基准晃动，更像个生物 */
}

/* 2. 确保图标颜色跟随父级 */
.plankton-icon {
  display: block;
  color: #27ae60; 
  transition: color 0.3s ease;
}

/* 3. 定义合体动画：呼吸 + 观察 */
@keyframes plankton-life {
  0%, 100% { 
    transform: scale(1) rotate(0deg); 
    filter: drop-shadow(0 0 0px rgba(39, 174, 96, 0));
  }
  50% { 
    transform: scale(1.1) rotate(3deg); 
    /* 呼吸时带一点点绿色的荧光效果，更有实验室感 */
    filter: drop-shadow(0 0 3px rgba(39, 174, 96, 0.4));
  }
}

/* 4. 装饰小点的闪烁动画（可选，增加黑客感） */
.plankton-warning::before {
  content: '';
  width: 4px;
  height: 4px;
  background: #22c55e;
  border-radius: 50%;
  margin-right: 4px;
  box-shadow: 0 0 5px #22c55e;
  animation: led-blink 1s infinite;
}

@keyframes led-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
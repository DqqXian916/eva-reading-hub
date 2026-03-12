<template>
  <div class="vocab-test-container">
    <div v-if="!testFinished" class="full-panel-card animate-in">
      <div class="test-header">
        <div class="progress-section">
          <div class="progress-text">当前进度: <strong>{{ selectedWords.length }}</strong> / {{ words.length }}</div>
          <div class="progress-track-bg">
            <div class="progress-fill-bar" :style="{ width: `${(selectedWords.length / words.length) * 100}%` }"></div>
          </div>
        </div>
        <div class="header-content">
          <h3>⚡ 英语词汇深度评估</h3>
          <p class="subtitle">勾选你【确定认识】的单词。</p>
        </div>
      </div>

      <div class="word-scroll-area">
        <div class="word-selection-grid">
          <label v-for="(word, index) in words" :key="word" 
                 :class="['word-card-item', { 'is-checked': selectedWords.includes(word) }]">
            <input type="checkbox" :value="word" v-model="selectedWords" class="native-checkbox-hidden">
            <div class="word-info-group">
              <span class="word-index">{{ (index + 1).toString().padStart(2, '0') }}</span>
              <span class="word-string">{{ word }}</span>
            </div>
            <div class="status-icon">✓</div>
          </label>
        </div>
      </div>

      <div class="test-action-area">
        <button class="submit-full-btn" @click="calculateResult" :disabled="isLoading">
          <span v-if="!isLoading">提交评估报告</span>
          <span v-else>正在分析词汇深度...</span>
        </button>
      </div>
    </div>

    <div v-else class="full-panel-card result-mode animate-in">
      <div class="report-flex-layout">
        <div class="sidebar-visual">
          <div class="score-circle-wrapper">
            <svg viewBox="0 0 100 100" class="score-svg">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#2ecc71" />
                  <stop offset="100%" stop-color="#00b894" />
                </linearGradient>
              </defs>
              <circle class="ring-track" cx="50" cy="50" r="42" />
              <circle class="ring-data" 
                      cx="50" cy="50" r="42"
                      :style="{ strokeDasharray: `${(score/20)*263.8}, 263.8` }"
                      stroke="url(#grad)" />
              <text x="50" y="52" class="score-val">{{ score }}</text>
              <text x="50" y="72" class="score-cap">/ 20 SCORE</text>
            </svg>
          </div>
          <div class="level-identity">
            <span class="level-badge">{{ levelData.tag }}</span>
            <h2 class="level-title-large">{{ levelData.title }}</h2>
            <p class="level-summary">{{ levelData.desc }}</p>
          </div>
        </div>

        <div class="main-report-content">
  <div class="report-top-bar">
    <div class="title-meta">
      <div class="icon-bg"><span class="emoji">📊</span></div>
      <div class="text-group">
        <h4>词汇量参照体系</h4>
        <p class="sub-label">Vocabulary Benchmark System</p>
      </div>
    </div>
    <button class="action-btn-retry-modern" @click="resetTest">
      <span class="retry-icon">↺</span> 重新测试
    </button>
  </div>
  
  <div class="bench-comparison-list">
    <div v-for="item in benchmarks" :key="item.stage" 
     :class="['bench-row-card', { 'active-highlight': levelData.stage === item.stage }]">
  
  <div class="bench-info-meta">
    <div class="stage-dot" :class="{ 'active-dot': levelData.stage === item.stage }"></div>
    <div class="text-content">
      <span class="label-name">{{ item.stage }}</span>
      <span class="label-count">词汇储备量 {{ item.range }}</span>
    </div>
  </div>

  <div class="bench-progress-wrapper">
    <div class="track-hollow">
      <div class="fill-gradient" :style="{ width: item.percent + '%' }">
        <div v-if="levelData.stage === item.stage" class="shimmer-effect"></div>
      </div>
    </div>
  </div>

  <div class="bench-status-tag">
    <transition name="pop-label">
      <div v-if="levelData.stage === item.stage" class="current-level-pill">
        <span class="pulse-icon"></span>
        YOU
      </div>
      <div v-else class="status-locked">
        <span class="lock-icon">🔒</span>
      </div>
    </transition>
  </div>
</div>
  </div>

  <div class="pedagogy-glass-card">
    <div class="pedagogy-head">
      <span class="head-icon">💡</span> 
      <span>教学建议</span>
    </div>
    <p class="pedagogy-body">{{ levelData.advice }}</p>
  </div>
</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps(['student'])
const emit = defineEmits(['save'])

const words = ['apple', 'happy', 'because', 'important', 'environment', 'convenient', 'vocabulary', 'significant', 'consequently', 'approximately', 'comprehensive', 'fundamental', 'ambiguous', 'inevitable', 'empirical', 'paradox', 'quintessential', 'ephemeral', 'ubiquitous', 'facetious']

const benchmarks = [
  { stage: '初阶/中考', range: '约 2000词', percent: 20 },
  { stage: '高阶/四六级', range: '约 5000词', percent: 40 },
  { stage: '雅思 6.5-7.0', range: '约 8000词', percent: 60 },
  { stage: '雅思 7.5-8.0', range: '约 12000词', percent: 80 },
  { stage: '母语/C2级', range: '15000+', percent: 100 }
]

const selectedWords = ref([])
const testFinished = ref(false)
const score = ref(0)
const isLoading = ref(false)

const calculateResult = () => {
  isLoading.value = true
  score.value = selectedWords.value.length
  setTimeout(() => {
    testFinished.value = true
    isLoading.value = false
    emit('save', { score: score.value, level: levelData.value.title })
  }, 800)
}

const levelData = computed(() => {
  const s = score.value
  if (s <= 5) return { title: '基础进阶水平', stage: '初阶/中考', tag: 'A2/B1 Level', desc: '掌握日常高频核心词汇。', advice: '建议增加短文阅读，训练语境识词能力。' }
  if (s <= 10) return { title: '中高级水平', stage: '高阶/四六级', tag: 'B2 Level', desc: '能处理一般学术话题，具备基本逻辑链。', advice: '建议积累同义替换表达，开始接触学术长难句。' }
  if (s <= 14) return { title: '良好学术水平', stage: '雅思 6.5-7.0', tag: 'C1 Standard', desc: '能流畅阅读英文报刊，具备留学及职场沟通能力。', advice: '重点关注学术搭配和词汇的正式度（Register）。' }
  if (s <= 17) return { title: '优秀学术水平', stage: '雅思 7.5-8.0', tag: 'C1+ Expert', desc: '词汇极具深度，能理解探讨复杂的科研与社会议题。', advice: '建议精读原刊论文，注意微妙的语体色彩辨析。' }
  return { title: '专家/母语水平', stage: '母语/C2级', tag: 'C2 Native', desc: '掌握极高阶修辞，语义辨析精准，接近母语人士。', advice: '尝试地道的创意写作，挑战经典文学原著评论。' }
})

const resetTest = () => { selectedWords.value = []; testFinished.value = false; }
</script>

<style scoped>
/* 核心布局修复 */
.vocab-test-container { 
  width: 100%; height: calc(100%-2vh); background: #f8fafc;
  display: flex; flex-direction: column; align-items: stretch; padding: 12px;
  box-sizing: border-box; overflow: hidden;
}

.full-panel-card { 
  background: #ffffff; border-radius: 24px; width: 100%; height: 100%;
  box-shadow: 0 10px 40px rgba(0,0,0,0.04); overflow: hidden; display: flex; flex-direction: column;
}

/* 单词网格区 (修复图 8) */
.test-header { padding: 20px 40px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
.word-scroll-area { flex: 1; overflow-y: auto; padding: 20px 40px; }
.word-selection-grid { 
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
}
.word-card-item { 
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border: 1.5px solid #f1f5f9; border-radius: 12px; 
  cursor: pointer; transition: 0.2s;
}
.word-card-item.is-checked { background: #f0fdf4; border-color: #2ecc71; }
.native-checkbox-hidden { display: none; }
.status-icon { color: #2ecc71; opacity: 0; }
.is-checked .status-icon { opacity: 1; }
.word-index { font-family: monospace; color: #cbd5e1; margin-right: 8px; }
.word-string { font-weight: 700; color: #1e293b; }

.test-action-area { padding: 100px 40px; flex-shrink: 0; border-top: 1px solid #f1f5f9; }
.submit-full-btn { 
  width: 100%; padding: 16px; background: #1e293b; color: white; border-radius: 12px;
  font-weight: 800; cursor: pointer; border: none;
}

/* 结果页分栏 (修复图 3/图 6) */
.report-flex-layout { display: flex; height: 100%; overflow: hidden; }
.sidebar-visual { 
  width: 350px; background: #1e293b; color: white; padding: 40px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;
}
.score-circle-wrapper { width: 160px; height: 160px; margin-bottom: 25px; }
.score-svg { width: 100%; height: 100%; }
.ring-track { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 6; }
.ring-data { fill: none; stroke-width: 7; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; }
.score-val { fill: white; font-size: 32px; font-weight: 900; text-anchor: middle; }
.score-cap { fill: rgba(255,255,255,0.3); font-size: 8px; text-anchor: middle; }

/* 右侧内容区整体美化 */
.main-report-content {
  flex: 1;
  padding: 50px 70px;
  background: linear-gradient(135deg, #ffffff 0%, #fcfdfe 100%);
  overflow-y: auto;
}

/* 顶部栏优化 */
.report-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 25px;
}

.icon-bg {
  width: 44px;
  height: 44px;
  background: #f1f5f9;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 15px;
}

.title-meta { display: flex; align-items: center; }
.title-meta h4 { margin: 0; font-size: 22px; color: #0f172a; letter-spacing: -0.5px; }
.sub-label { margin: 2px 0 0; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }

/* 现代按钮样式 */
.action-btn-retry-modern {
  padding: 10px 20px;
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 30px;
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn-retry-modern:hover {
  background: #0f172a;
  color: #fff;
  border-color: #0f172a;
  box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.1);
  transform: translateY(-2px);
}

/* 列表项卡片化 */
.bench-row-card {
  display: flex;
  align-items: center;
  padding: 15px 18px;
  border-radius: 20px;
  margin-bottom: 12px;
  border: 1px solid transparent;
  transition: all 0.4s;
}

/* 激活状态：提升层级感 */
.active-highlight {
  background: #ffffff;
  border-color: rgba(46, 204, 113, 0.3);
  box-shadow: 0 12px 24px -6px rgba(46, 204, 113, 0.12);
  transform: scale(1.01) translateX(8px);
}

/* 左侧文字区：主次分明 */
.bench-info-meta {
  width: 160px;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 进度条优化 */
.track-line-premium {
  height: 10px;
  background: #f1f5f9;
  border-radius: 20px;
  overflow: hidden;
}

.fill-line-premium {
  height: 100%;
  background: #cbd5e1; /* 默认灰色 */
  border-radius: 20px;
  position: relative;
  transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.active-highlight .fill-line-premium {
  background: linear-gradient(90deg, #2ecc71, #00b894);
}

.fill-gradient {
  height: 100%;
  background: #cbd5e1; /* 默认未达成颜色 */
  border-radius: 10px;
  position: relative;
}

.active-highlight .fill-gradient {
  background: linear-gradient(90deg, #2ecc71 0%, #00b894 100%);
}

/* 进度条：空心轨道效果 */
.bench-progress-wrapper { flex: 1; margin: 0 30px; }
.track-hollow {
  height: 8px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  overflow: hidden;
}

/* 模拟流动光效 */
.shimmer-sweep {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    90deg, 
    transparent, 
    rgba(255,255,255,0.4), 
    transparent
  );
  animation: sweep 2.5s infinite linear;
}

@keyframes sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

/* 状态标签美化 */
.user-status-pill {
  background: #0f172a;
  color: white;
  padding: 6px 14px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.live-dot {
  width: 8px;
  height: 8px;
  background: #2ecc71;
  border-radius: 50%;
  box-shadow: 0 0 10px #2ecc71;
  animation: pulse 2s infinite;
}

.stage-dot {
  width: 6px; height: 6px;
  background: #e2e8f0;
  border-radius: 50%;
}
.active-dot { background: #2ecc71; box-shadow: 0 0 8px #2ecc71; }

.pedagogy-glass-card {
  margin-top: 25px;
  padding: 30px;
  background: rgba(248, 250, 252, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid #e2e8f0;
  border-radius: 24px;
}

/* 状态标签：胶囊设计 */
.current-level-pill {
  background: #1e293b;
  color: #fff;
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-locked { opacity: 0.3; font-size: 12px; }

.label-name { display: block; font-size: 15px; font-weight: 800; color: #334155; }

.label-count { font-size: 11px; color: #94a3b8; font-weight: 500; }

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

@keyframes pulse-glow {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(46, 204, 113, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); }
}

</style>
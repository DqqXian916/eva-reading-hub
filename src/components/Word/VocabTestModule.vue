<template>
  <div class="vocab-test-container">
    <!-- 测试界面 -->
    <div v-if="!testFinished" class="full-panel-card animate-in">
      <div class="test-header">
        <div class="progress-section">
          <div class="progress-text">当前进度: <strong>{{ selectedWords.length }}</strong> / {{ words.length }}</div>
          <div class="progress-track-bg">
            <div class="progress-fill-bar" :style="{ width: `${(selectedWords.length / words.length) * 100}%` }"></div>
          </div>
        </div>
        <div class="header-content">
          <h3>⚡ 词汇深度评估</h3>
          <p class="subtitle">勾选你【确定认识】的单词。</p>
        </div>
      </div>

      <div class="word-scroll-area">
        <div class="word-selection-grid">
          <label v-for="(wordObj, index) in words" :key="wordObj.word" 
                 :class="['word-card-item', { 'is-checked': selectedWords.includes(wordObj.word) }]">
            <input type="checkbox" :value="wordObj.word" v-model="selectedWords" class="native-checkbox-hidden">
            <div class="word-info-group">
              <span class="word-index">{{ (index + 1).toString().padStart(2, '0') }}</span>
              <span class="word-string">{{ wordObj.word }}</span>
            </div>
            <div class="status-icon">✓</div>
          </label>
        </div>
      </div>

      <div class="test-action-area">
        <button class="submit-full-btn" @click="calculateResult" :disabled="isLoading">
          <span v-if="!isLoading">确认提交</span>
          <span v-else>正在分析词汇深度...</span>
        </button>
      </div>
    </div>

    <!-- 结果界面 -->
    <div v-else class="full-panel-card result-mode animate-in">
      <div class="report-flex-layout">
        <!-- 左侧分数与等级展示 -->
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
                      :style="{ strokeDasharray: `${(score / 20) * 263.8}, 263.8` }"
                      stroke="url(#grad)" />
              <text x="50" y="52" class="score-val">{{ score }}</text>
              <text x="50" y="72" class="score-cap">/ 20 SCORE</text>
            </svg>
          </div>
          <div class="level-identity">
            <span class="level-badge">{{ levelData.tag }}</span>
            <h2 class="level-title-large">{{ levelData.title }}</h2>
            <p class="est-vocab">预估词汇量: <strong>{{ levelData.estVocab }}</strong></p>
            <p class="level-summary">{{ levelData.desc }}</p>
          </div>
        </div>

        <!-- 右侧详细报告 -->
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
                  <span class="label-count">{{ item.range }}</span>
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

          <!-- 双轨专业教学建议（课内补弱 + 体系化培优） -->
          <div class="pedagogy-dual-grid">
            <div class="pedagogy-glass-card fix-card">
              <div class="pedagogy-head">
                <span class="head-icon">🛠️</span> 
                <span>课内补弱 / 基础巩固</span>
              </div>
              <p class="pedagogy-body">{{ levelData.remedialAdvice }}</p>
            </div>

            <div class="pedagogy-glass-card advance-card">
              <div class="pedagogy-head">
                <span class="head-icon">🚀</span> 
                <span>体系化超前 / 培优规划</span>
              </div>
              <p class="pedagogy-body">{{ levelData.advanceAdvice }}</p>
            </div>
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

// 1. 20词严格梯队化（涵盖 A1 -> C2 完整阶梯）
const words = [
  { word: 'apple', level: 'A1' },          // 01. 小学/新概念1册
  { word: 'because', level: 'A1+' },       // 02. 初中基础
  { word: 'convenient', level: 'A2' },    // 03. 中考核心/新概念2册前
  { word: 'environment', level: 'B1' },   // 04. 高中必修/PET
  { word: 'vocabulary', level: 'B1+' },   // 05. 高考高频/四级
  { word: 'significant', level: 'B2' },   // 06. 六级/雅思5.5
  { word: 'consequently', level: 'B2' },  // 07. 高考提优/雅思6.0/FCE
  { word: 'fundamental', level: 'B2+' },  // 08. 雅思6.5
  { word: 'approximately', level: 'B2+' },// 09. 雅思6.5-7.0
  { word: 'comprehensive', level: 'C1' }, // 10. 雅思7.0/CAE
  { word: 'ambiguous', level: 'C1' },     // 11. 雅思7.5
  { word: 'inevitable', level: 'C1' },    // 12. 雅思7.5
  { word: 'empirical', level: 'C1+' },    // 13. 雅思8.0
  { word: 'paradox', level: 'C1+' },      // 14. 雅思8.0/GRE基础
  { word: 'quintessential', level: 'C2' },// 15. 雅思8.5/CPE
  { word: 'ubiquitous', level: 'C2' },    // 16. 高阶学术/专八
  { word: 'ephemeral', level: 'C2' },     // 17. GRE高阶/文学
  { word: 'facetious', level: 'C2' },     // 18. 母语者高阶修辞
  { word: 'synecdoche', level: 'C2+' },   // 19. 专业修辞学
  { word: 'obfuscate', level: 'C2+' }     // 20. 顶尖学术/文学
]

// 2. 参照体系表：结合国内课内教材、新概念英语、剑桥 MSE 及雅思体系
const benchmarks = [
  { stage: '小学/新概念1册', range: '500 - 1500词 (KET/A1-A2)', percent: 15 },
  { stage: '初中/中考/新概念2册', range: '2000 - 3500词 (PET/中考/B1)', percent: 35 },
  { stage: '高中/高考/新概念3册', range: '4000 - 6500词 (高考/FCE/四六级)', percent: 55 },
  { stage: '高阶/新概念4册', range: '7000 - 10000词 (CAE/雅思7.0-8.0/C1)', percent: 78 },
  { stage: '专家/母语水平', range: '12000 - 15000+词 (CPE/GRE/C2)', percent: 100 }
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
    emit('save', { 
      score: score.value, 
      level: levelData.value.title,
      estVocab: levelData.value.estVocab 
    })
  }, 800)
}

// 3. 全面专业化的教学路线映射（包含 Power Up, Oxford Discover, Think, Unlock, EiM, 雅思等）
const levelData = computed(() => {
  const s = score.value

  // 0分：零基础
  if (s === 0) {
    return {
      title: '零基础起步',
      stage: '小学/新概念1册',
      tag: 'A0 Starter',
      estVocab: '< 100词',
      desc: '尚未建立起基础的词汇与语音觉知。',
      remedialAdvice: '巩固路线：补齐小学 1 年级课内前 4 单元高频词，完成 26 个字母自然拼读发音入门。',
      advanceAdvice: '培优路线：学习《Power Up》Starter 册，或《Oxford Discover》Foundation 级别；搭配《牛津树》(ORT Level 1-2) 进行听音认词。'
    }
  }

  // 1分：萌芽阶段（如仅认识 apple）
  if (s === 1) {
    return {
      title: '词汇萌芽阶段',
      stage: '小学/新概念1册',
      tag: 'A1 Early',
      estVocab: '约 100 - 300词',
      desc: '具备极基础的单字识别能力（对应小学低年级水平）。',
      remedialAdvice: '巩固路线：梳理小学 1-3 年级课内教材（全册约 300 词），重点突破数字、颜色、家庭成员及高频动词。',
      advanceAdvice: '培优路线：学习《Power Up》Level 1 或《Oxford Discover》Book 1；搭配《新概念英语1册》第 1-30 课与 RAZ B-D 级绘本。'
    }
  }

  // 2分：小学中段
  if (s === 2) {
    return {
      title: '小学基础水平',
      stage: '小学/新概念1册',
      tag: 'A1 Mid',
      estVocab: '约 400 - 700词',
      desc: '掌握部分高频基础词，对应小学中高年级水平。',
      remedialAdvice: '巩固路线：清理小学 4-5 年级课内必背词汇（约 500 词），攻克名词复数变体及简单动词过去式。',
      advanceAdvice: '培优路线：进阶《Power Up》Level 2-3 或《Oxford Discover》Book 2；同步精学《新概念1册》第 31-72 课，衔接《剑桥少儿 Flyers》。'
    }
  }

  // 3分：小学高段 / 小升初
  if (s === 3) {
    return {
      title: '小升初衔接水平',
      stage: '小学/新概念1册',
      tag: 'A1 High (KET)',
      estVocab: '约 800 - 1200词',
      desc: '达到小学毕业及初一课内入门水平。',
      remedialAdvice: '巩固路线：盘点小学毕业 1000 必背词，重点突破初一上册（Unit 1-8）课内预习词汇与听写。',
      advanceAdvice: '培优路线：学习《Power Up》Level 4 或《Oxford Discover》Book 3-4；冲刺《新概念1册》全册、《THINK》Starter 或《Unlock》Level 1，锁定 KET 卓越（Pass with Distinction）。'
    }
  }

  // 4-6分：初中/中考/PET
  if (s <= 6) {
    return {
      title: '初中/中考水平',
      stage: '初中/中考/新概念2册',
      tag: 'A2-B1 (PET / 雅思4.0-4.5)',
      estVocab: '约 1600 - 3000词',
      desc: '覆盖中考核心词汇，达到初二至初三课内水平。',
      remedialAdvice: '巩固路线：锁定中考 1600 必考核心词，突破初二/初三课内模块词汇与完形填空高频近义词。',
      advanceAdvice: '培优路线：学习《THINK》Level 1-2、《English in Mind》(EiM) Book 1 或《Unlock》Level 2；进阶《新概念2册》第 1-48 课，储备雅思 4.5 分及 PET 核心词汇。'
    }
  }

  // 7-10分：高中/高考/FCE
  if (s <= 10) {
    return {
      title: '高中/高考水平',
      stage: '高中/高考/新概念3册',
      tag: 'B2 Level (FCE / 雅思5.5-6.5)',
      estVocab: '约 3500 - 5500词',
      desc: '达高考 3500 词标杆及四六级/雅思 5.5-6.5 门槛。',
      remedialAdvice: '巩固路线：地毯式排查高考 3500 词表，重点攻克必修 1-5 熟词生义（熟词辟义）及长难句语法填空。',
      advanceAdvice: '培优路线：精读《THINK》Level 3-4、《English in Mind》(EiM) Book 2-3 或《Unlock》Level 3；主攻《新概念3册》第 1-30 课与《雅思红宝书/核心词汇》5.5-6.5 分标段。'
    }
  }

  // 11-14分：高阶学术/CAE/雅思7.0
  if (s <= 14) {
    return {
      title: '高级学术水平',
      stage: '高阶/新概念4册',
      tag: 'C1 Standard (CAE / 雅思7.0-7.5)',
      estVocab: '约 6500 - 9000词',
      desc: '远超高考课内要求，具备优秀的高阶学术词汇量。',
      remedialAdvice: '巩固路线：保持高考/四六级作文高分表达的精准度，消除学术写作中的固定搭配与语体色彩误用。',
      advanceAdvice: '培优路线：研读《THINK》Level 5、《English in Mind》Book 4-5 或《Unlock》Level 4；研习《新概念4册》第 1-24 课，冲刺《雅思 7.5+ 专项学术词汇》与 CAE 考级。'
    }
  }

  // 15-17分：精通学术/雅思8.0
  if (s <= 17) {
    return {
      title: '精通学术水平',
      stage: '高阶/新概念4册',
      tag: 'C1+ Expert (雅思8.0-8.5)',
      estVocab: '约 10000 - 13000词',
      desc: '词汇储备极深，可胜任高难度学术研究与原版阅读。',
      remedialAdvice: '巩固路线：课内与常规考试完全碾压，注意雅思/SAT 写作中避免生硬堆砌难词，注重句式自然度。',
      advanceAdvice: '培优路线：精读《新概念4册》全册、雅思 8.5 分写作高级同义替换词库，攻克 SAT/GRE 核心词汇，研读牛津/剑桥原版学术著作。'
    }
  }

  // 18-20分：专家/母语
  return {
    title: '专家/接近母语',
    stage: '专家/母语水平',
    tag: 'C2 Master (CPE/GRE/雅思9.0)',
    estVocab: '14000+ 词',
    desc: '接近母语人士或顶级学术专家水平。',
    remedialAdvice: '巩固路线：无需任何课内词汇补弱，保持日常英文原版阅读与高级写作规范即可。',
    advanceAdvice: '培优路线：精读牛津/剑桥顶刊学术论文，挑战 CPE (C2 Proficiency) 顶级修辞词汇、经典文学原著评论及高级创意写作。'
  }
})

const resetTest = () => {
  selectedWords.value = []
  testFinished.value = false
}
</script>

<style scoped>
/* 核心布局 */
.vocab-test-container { 
  width: 100%; 
  height: calc(100% - 2vh); 
  background: #f8fafc;
  display: flex; 
  flex-direction: column; 
  align-items: stretch; 
  padding: 12px;
  box-sizing: border-box; 
  overflow: hidden;
}

.full-panel-card { 
  background: #ffffff; 
  border-radius: 24px; 
  width: 100%; 
  height: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04); 
  overflow: hidden; 
  display: flex; 
  flex-direction: column;
}

/* 进度条与头部 */
.test-header { 
  padding: 20px 40px; 
  border-bottom: 1px solid #f1f5f9; 
  flex-shrink: 0; 
}

.progress-section {
  margin-bottom: 12px;
}

.progress-text {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 6px;
}

.progress-track-bg {
  width: 100%;
  height: 6px;
  background: #f1f5f9;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill-bar {
  height: 100%;
  background: linear-gradient(90deg, #2ecc71, #00b894);
  transition: width 0.3s ease;
}

.header-content h3 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
}

.header-content .subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #94a3b8;
}

/* 单词网格区 */
.word-scroll-area { 
  flex: 1; 
  overflow-y: auto; 
  padding: 20px 40px; 
}

.word-selection-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); 
  gap: 12px;
}

.word-card-item { 
  display: flex; 
  align-items: center; 
  justify-content: space-between;
  padding: 16px 20px; 
  border: 1.5px solid #f1f5f9; 
  border-radius: 12px; 
  cursor: pointer; 
  transition: 0.2s;
}

.word-card-item:hover {
  border-color: #cbd5e1;
}

.word-card-item.is-checked { 
  background: #f0fdf4; 
  border-color: #2ecc71; 
}

.native-checkbox-hidden { 
  display: none; 
}

.status-icon { 
  color: #2ecc71; 
  opacity: 0; 
  font-weight: bold;
}

.is-checked .status-icon { 
  opacity: 1; 
}

.word-index { 
  font-family: monospace; 
  color: #cbd5e1; 
  margin-right: 8px; 
}

.word-string { 
  font-weight: 700; 
  color: #1e293b; 
}

.test-action-area { 
  padding: 20px 40px; 
  flex-shrink: 0; 
  border-top: 1px solid #f1f5f9; 
}

.submit-full-btn { 
  width: 100%; 
  padding: 16px; 
  background: #1e293b; 
  color: white; 
  border-radius: 12px;
  font-weight: 800; 
  cursor: pointer; 
  border: none;
  transition: background 0.2s;
}

.submit-full-btn:hover:not(:disabled) {
  background: #0f172a;
}

.submit-full-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 结果页分栏 */
.report-flex-layout { 
  display: flex; 
  height: 100%; 
  overflow: hidden; 
}

.sidebar-visual { 
  width: 320px; 
  background: #1e293b; 
  color: white; 
  padding: 40px 30px;
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  flex-shrink: 0;
  text-align: center;
}

.score-circle-wrapper { 
  width: 160px; 
  height: 160px; 
  margin-bottom: 25px; 
}

.score-svg { 
  width: 100%; 
  height: 100%; 
}

.ring-track { 
  fill: none; 
  stroke: rgba(255, 255, 255, 0.08); 
  stroke-width: 6; 
}

.ring-data { 
  fill: none; 
  stroke-width: 7; 
  stroke-linecap: round; 
  transform: rotate(-90deg); 
  transform-origin: 50% 50%; 
  transition: stroke-dasharray 1s ease-out;
}

.score-val { 
  fill: white; 
  font-size: 32px; 
  font-weight: 900; 
  text-anchor: middle; 
}

.score-cap { 
  fill: rgba(255, 255, 255, 0.3); 
  font-size: 8px; 
  text-anchor: middle; 
}

.level-badge {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.1);
  color: #2ecc71;
  padding: 4px 12px;
  border-radius: 12px;
  letter-spacing: 0.5px;
  font-weight: 700;
}

.level-title-large {
  font-size: 22px;
  margin: 12px 0 6px;
  font-weight: 800;
}

.est-vocab {
  margin: 6px 0 14px;
  font-size: 13px;
  color: #2ecc71;
  background: rgba(46, 204, 113, 0.12);
  padding: 4px 14px;
  border-radius: 20px;
  display: inline-block;
}

.est-vocab strong {
  font-size: 15px;
  color: #00b894;
}

.level-summary {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

/* 右侧内容区 */
.main-report-content {
  flex: 1;
  padding: 40px 50px;
  background: linear-gradient(135deg, #ffffff 0%, #fcfdfe 100%);
  overflow-y: auto;
}

.report-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.title-meta { 
  display: flex; 
  align-items: center; 
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

.title-meta h4 { 
  margin: 0; 
  font-size: 20px; 
  color: #0f172a; 
  letter-spacing: -0.5px; 
}

.sub-label { 
  margin: 2px 0 0; 
  font-size: 12px; 
  color: #94a3b8; 
  font-weight: 600; 
  text-transform: uppercase; 
}

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

.bench-comparison-list {
  margin-bottom: 20px;
}

.bench-row-card {
  display: flex;
  align-items: center;
  padding: 15px 18px;
  border-radius: 20px;
  margin-bottom: 10px;
  border: 1px solid transparent;
  transition: all 0.4s;
  background: #f8fafc;
}

.active-highlight {
  background: #ffffff;
  border-color: rgba(46, 204, 113, 0.3);
  box-shadow: 0 12px 24px -6px rgba(46, 204, 113, 0.12);
  transform: scale(1.01) translateX(4px);
}

.bench-info-meta {
  width: 240px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.stage-dot {
  width: 8px; 
  height: 8px;
  background: #cbd5e1;
  border-radius: 50%;
  flex-shrink: 0;
}

.active-dot { 
  background: #2ecc71; 
  box-shadow: 0 0 10px #2ecc71; 
}

.label-name { 
  display: block; 
  font-size: 14px; 
  font-weight: 800; 
  color: #334155; 
}

.label-count { 
  font-size: 11px; 
  color: #94a3b8; 
  font-weight: 500; 
}

.bench-progress-wrapper { 
  flex: 1; 
  margin: 0 20px; 
}

.track-hollow {
  height: 8px;
  background: #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.fill-gradient {
  height: 100%;
  background: #cbd5e1;
  border-radius: 10px;
  position: relative;
  transition: width 1s ease-in-out;
}

.active-highlight .fill-gradient {
  background: linear-gradient(90deg, #2ecc71 0%, #00b894 100%);
}

.bench-status-tag {
  width: 60px;
  display: flex;
  justify-content: flex-end;
}

.current-level-pill {
  background: #1e293b;
  color: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pulse-icon {
  width: 6px;
  height: 6px;
  background: #2ecc71;
  border-radius: 50%;
  box-shadow: 0 0 6px #2ecc71;
  animation: pulse 1.8s infinite;
}

.status-locked { 
  opacity: 0.3; 
  font-size: 12px; 
}

/* 双轨教学建议布局 */
.pedagogy-dual-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}

.pedagogy-glass-card {
  padding: 20px 24px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
}

.fix-card {
  background: rgba(254, 242, 242, 0.6);
  border-color: #fecaca;
}

.advance-card {
  background: rgba(240, 253, 244, 0.6);
  border-color: #bbf7d0;
}

.pedagogy-head {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pedagogy-body {
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}
</style>
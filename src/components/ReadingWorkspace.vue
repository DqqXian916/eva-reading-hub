<script setup>
/**
 * Props 说明：
 * activeReading: 当前正在阅读的文章对象
 * isFullScreen: 是否处于全屏沉浸模式
 * userSelections: 学生的选项记录数组
 * isSubmitted: 是否已提交核对
 * scoreInfo: 得分汇总文字
 */
defineProps({
  activeReading: Object,
  isFullScreen: Boolean,
  userSelections: Array,
  isSubmitted: Boolean,
  scoreInfo: String
})

defineEmits(['toggleFull', 'close', 'submit', 'updateSelection'])
</script>

<template>
  <div :class="['reading-view', { 'is-full-screen': isFullScreen }]">
    <div class="reading-toolbar">
      <div class="exclusive-badge">✨ Eva老师 爱徒专用 ❤️</div>
      <div class="tool-group">
        <button class="btn-tool" @click="$emit('toggleFull')">
          {{ isFullScreen ? '退出全屏 ↙' : '全屏模式 ↗' }}
        </button>
        <button class="btn-tool close" @click="$emit('close')">返回列表</button>
      </div>
    </div>

    <div class="content-container">
      <article class="article-col">
        <div class="article-header">
          <div class="student-tag">READING MATERIAL（阅读文章） 🌟</div>
          <h1 class="article-title">{{ activeReading.title }}</h1>
        </div>
        <div class="article-text">
          {{ activeReading.body }}
        </div>
      </article>

      <aside class="quiz-col">
        <div class="quiz-header">
          <h3>Reading Check</h3>
          <p v-if="!isSubmitted">请阅读文章并选择正确答案</p>
          <p v-else class="done-tag">✅ 测试已完成</p>
        </div>

        <div class="questions-list">
          <div v-for="(q, qIdx) in activeReading.quiz" :key="qIdx" class="question-card">
            <div class="q-row">
              <span class="q-num">{{ qIdx + 1 }}</span>
              <span class="q-title">{{ q.q }}</span>
            </div>
            
            <div class="options-group">
              <div 
                v-for="(opt, oIdx) in q.options" 
                :key="oIdx"
                :class="['option', 
                  { selected: userSelections[qIdx] === oIdx },
                  { correct: isSubmitted && oIdx === q.answer },
                  { wrong: isSubmitted && userSelections[qIdx] === oIdx && oIdx !== q.answer }
                ]"
                @click="!isSubmitted && $emit('updateSelection', { qIdx, oIdx })"
              >
                <span class="option-content">{{ opt }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="quiz-footer">
          <div v-if="scoreInfo" class="score-box">
            <div class="score-text">{{ scoreInfo }}</div>
            <button class="btn-retry" @click="$emit('close')">查看其他文章</button>
          </div>
          <button 
            v-else 
            class="btn-primary submit-btn" 
            :disabled="userSelections.includes(null)"
            @click="$emit('submit')"
          >
            提交答案
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.reading-view { display: flex; flex-direction: column; height: 100%; width: 100%; background: white; }
.reading-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 25px; border-bottom: 1px solid #f1f5f9; }
.tool-group { display: flex; gap: 10px; }
.btn-tool { padding: 6px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 13px; color: #64748b; }

.content-container { display: flex; flex: 1; overflow: hidden; }

/* 文章栏：根据要求取消留白 */
.article-col { flex: 1; padding: 40px 30px; overflow-y: auto; border-right: 1px solid #f1f5f9; }
.article-title { font-size: 28px; color: #1e293b; margin: 10px 0 25px 0; }
.article-text { font-size: 18px; line-height: 1.8; color: #334155; white-space: pre-wrap; }

/* 答题栏 */
.quiz-col { width: 380px; background: #fcfcfd; display: flex; flex-direction: column; }
.quiz-header { padding: 20px; border-bottom: 1px solid #f1f5f9; }
.questions-list { flex: 1; overflow-y: auto; padding: 20px; }

/* 修复错位：Q-Row 样式 */
.question-card { background: white; border-radius: 12px; padding: 15px; margin-bottom: 20px; border: 1px solid #eef2f6; }
.q-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
.q-num { background: #f1f5f9; color: #64748b; min-width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 12px; font-weight: bold; margin-top: 2px; }
.q-title { font-weight: 600; color: #1e293b; line-height: 1.5; font-size: 15px; flex: 1; }

/* 选项样式：取消自带字母前缀 */
.options-group { display: flex; flex-direction: column; gap: 8px; }
.option { padding: 10px 12px; border: 1px solid #f1f5f9; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
.option:hover { background: #f8fafc; }
.option.selected { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; }
.option.correct { background: #dcfce7 !important; border-color: #22c55e !important; color: #166534; font-weight: bold; }
.option.wrong { background: #fee2e2 !important; border-color: #ef4444 !important; color: #991b1b; }

.quiz-footer { padding: 20px; border-top: 1px solid #f1f5f9; background: #fff; }
.submit-btn { width: 100%; height: 45px; background: #1e293b; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
.submit-btn:disabled { background: #e2e8f0; cursor: not-allowed; }

.exclusive-badge { padding: 4px 12px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 15px; color: #e11d48; font-size: 12px; font-weight: 600; }

/* 全屏模式无留白 */
.is-full-screen { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2000; }
.is-full-screen .article-col { padding: 40px 30px; font-size: 20px; }
</style>
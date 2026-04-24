<script setup>
import { ref, computed, nextTick } from 'vue'
import BlankEditForm from './BlankEditForm.vue'

const props = defineProps({
  student: Object,
  quizzes: { type: Array, default: () => [] },
  canEdit: Boolean,
  isLoading: Boolean,
  scoreInfo: String,
  isFullScreen: Boolean
})

const emit = defineEmits(['toggleFull', 'close', 'save', 'delete', 'submit'])

// --- 状态控制 ---
const viewMode = ref('list') 
const collapsed = ref(false) 
const activeQuiz = ref(null)
const activeQIdx = ref(0)
const userSelections = ref([])
const isSubmitted = ref(false)
const showChinese = ref(false)

// --- 计算属性：解析文章 ---
const parsedSegments = computed(() => {
  if (!activeQuiz.value?.body) return []
  const regex = /\[(\d+)\]/g
  const parts = []
  let lastIndex = 0
  let match
  while ((match = regex.exec(activeQuiz.value.body)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: activeQuiz.value.body.slice(lastIndex, match.index) })
    parts.push({ type: 'slot', qIdx: parseInt(match[1]) - 1 })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < activeQuiz.value.body.length) parts.push({ type: 'text', content: activeQuiz.value.body.slice(lastIndex) })
  return parts
})

// --- 交互逻辑 ---
const selectQuiz = (quiz) => {
  activeQuiz.value = quiz
  userSelections.value = new Array(quiz.quiz?.length || 0).fill(null)
  isSubmitted.value = false
  showChinese.value = false
  activeQIdx.value = 0
}

const openEdit = (quiz = null) => {
  activeQuiz.value = quiz
  viewMode.value = 'edit'
}

const handleSelect = (qIdx, oIdx) => {
  if (isSubmitted.value) return
  userSelections.value[qIdx] = oIdx
  if (activeQuiz.value?.quiz && qIdx < activeQuiz.value.quiz.length - 1) {
    setTimeout(() => scrollToQuestion(qIdx + 1), 200)
  }
}

const scrollToQuestion = (idx) => {
  activeQIdx.value = idx
  nextTick(() => {
    const el = document.getElementById(`q-card-${idx}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}
</script>

<template>
  <div :class="['cloze-workspace', { 'is-full-screen': isFullScreen }]">
    
    <BlankEditForm 
      v-if="viewMode === 'edit'"
      :student="student"
      :initialData="activeQuiz"
      @save="(data) => { emit('save', data); viewMode = 'list' }"
      @cancel="viewMode = 'list'"
      class="full-view-editor"
    />

    <template v-else>
      <div class="workspace-layout">
        <aside :class="['sidebar-panel', { collapsed: collapsed }]">
          <div class="toggle-btn" @click="collapsed = !collapsed">
            {{ collapsed ? '▶' : '◀' }}
          </div>

          <div v-show="!collapsed" class="panel-content">
            <div class="student-profile-card">
              <div class="avatar-box">
                {{ student?.name?.charAt(0).toUpperCase() }}
              </div>
              <div class="profile-info">
                <span class="badge-text">SPECIAL TRAINING</span>
                <h3 class="student-name">{{ student?.name }} 的完形库</h3>
              </div>
            </div>

            <button v-if="canEdit" class="btn-primary-add" @click="openEdit(null)">
              <span class="plus-icon">+</span> 录入新练习
            </button>

            <div class="list-wrapper">
              <div class="list-header-label">最近更新 ({{ quizzes.length }})</div>
              
              <div v-if="isLoading" class="loader-wrap"><div class="mini-loader"></div></div>
              
              <div v-else class="cloze-list-scroll">
                <div 
                  v-for="q in quizzes" 
                  :key="q.id" 
                  :class="['cloze-item-card', { active: activeQuiz?.id === q.id }]"
                  @click="selectQuiz(q)"
                >
                  <div class="active-bar"></div>
                  <div class="item-icon">🖋️</div>
                  <div class="item-main">
                    <span class="item-title">{{ q.title || '无标题练习' }}</span>
                    <div class="item-sub">
                      <span>{{ q.quiz?.length }} 题</span>
                      <span class="dot">·</span>
                      <span>{{ new Date(q.created_at).toLocaleDateString() }}</span>
                    </div>
                  </div>
                  <div v-if="canEdit" class="item-ctrls">
                    <button class="mini-icon-btn" @click.stop="openEdit(q)">✏️</button>
                    <button class="mini-icon-btn del" @click.stop="emit('delete', q.id)">🗑️</button>
                  </div>
                </div>
                
                <div v-if="quizzes.length === 0" class="empty-list-tip">
                   <p>书架空空的</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main class="main-content-panel">
          <div v-if="activeQuiz" class="exercise-stage fade-in">
            <div class="stage-header">
              <div class="title-badge">📖 {{ activeQuiz.title }}</div>
              <div class="action-group">
                <button v-if="isSubmitted && activeQuiz.body_cn" class="btn-glass" @click="showChinese = !showChinese">
                  {{ showChinese ? '显示原文' : '译文对照' }}
                </button>
                <button class="btn-glass" @click="emit('toggleFull')">
                  {{ isFullScreen ? '缩小' : '全屏' }}
                </button>
                <button class="btn-glass exit" @click="emit('close')">关闭</button>
              </div>
            </div>

            <div class="exercise-body">
              <article class="reading-area">
                <div v-if="showChinese && isSubmitted" class="translation-box fade-in">
                  {{ activeQuiz.body_cn }}
                </div>
                <div v-else class="text-content">
                  <template v-for="(seg, i) in parsedSegments" :key="i">
                    <span v-if="seg.type === 'text'">{{ seg.content }}</span>
                    <span 
                      v-else 
                      :class="['cloze-slot', { 'active': activeQIdx === seg.qIdx, 'filled': userSelections[seg.qIdx] !== null, 'correct': isSubmitted && userSelections[seg.qIdx] === activeQuiz.quiz[seg.qIdx]?.answer, 'wrong': isSubmitted && userSelections[seg.qIdx] !== null && userSelections[seg.qIdx] !== activeQuiz.quiz[seg.qIdx]?.answer }]"
                      @click="scrollToQuestion(seg.qIdx)"
                    >
                      <span class="slot-idx">{{ seg.qIdx + 1 }}</span>
                      <span class="slot-answer">{{ userSelections[seg.qIdx] !== null ? String.fromCharCode(65 + userSelections[seg.qIdx]) : '' }}</span>
                    </span>
                  </template>
                </div>
              </article>

              <aside class="options-panel">
                <div class="options-scroll">
                  <div v-for="(q, qIdx) in activeQuiz.quiz" :key="qIdx" :id="`q-card-${qIdx}`" :class="['question-card', { active: activeQIdx === qIdx }]">
                    <div class="q-header">
                      <span class="q-label">QUESTION {{ qIdx + 1 }}</span>
                      <span v-if="isSubmitted" :class="['ans-status', userSelections[qIdx] === q.answer ? 'is-ok' : 'is-no']">
                        {{ userSelections[qIdx] === q.answer ? 'Correct' : 'Incorrect' }}
                      </span>
                    </div>
                    <div class="opts-list">
                      <button 
                        v-for="(opt, oIdx) in q.options" 
                        :key="oIdx" 
                        :class="['opt-choice', { 'selected': userSelections[qIdx] === oIdx, 'is-ans': isSubmitted && oIdx === q.answer }]" 
                        @click="handleSelect(qIdx, oIdx)"
                      >
                        <span class="letter">{{ String.fromCharCode(65 + oIdx) }}</span>
                        <span class="text">{{ opt }}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="panel-footer">
                  <div v-if="isSubmitted" class="score-pill">{{ scoreInfo }}</div>
                  <button v-else class="btn-submit-main" :disabled="userSelections.includes(null)" @click="isSubmitted = true">
                    提交并核对答案
                  </button>
                </div>
              </aside>
            </div>
          </div>

          <div v-else class="empty-guide-stage">
            <div class="guide-content">
              <div class="guide-icon">👈</div>
              <h3>开始训练</h3>
              <p>请从左侧列表选择一个完形填空文章</p>
            </div>
          </div>
        </main>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 核心工作区容器 */
.cloze-workspace {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff; /* 强制底色为白，防止漏出背后的灰色 */
}
.full-view-editor {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: #fff; /* 确保背景纯白，盖住后面的列表 */
}
.is-full-screen { position: fixed; inset: 0; z-index: 9999; }
.workspace-layout {
  display: flex;
  flex: 1;      /* 确保它占据所有垂直空间 */
  width: 100%;  /* 确保它横向占满 */
  overflow: hidden;
}

/* --- 侧边栏 UI --- */
.sidebar-panel {
  width: 280px;
  background: #ffffff;
  border-right: 1px solid #edf2f7;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  flex-direction: column;
}
.sidebar-panel.collapsed { width: 40px; }

.panel-content { width: 280px; padding: 20px 16px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; }

.student-profile-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f1f5f9;
  border-radius: 16px;
  margin-bottom: 20px;
}
.avatar-box {
  width: 42px;
  height: 42px;
  background: #1e293b;
  color: white;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
}
.badge-text { font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; }
.student-name { font-size: 14px; font-weight: 700; color: #1e293b; margin: 2px 0 0 0; }

.btn-primary-add {
  width: 100%;
  padding: 14px;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 24px;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-primary-add:hover { background: #27ae60; transform: translateY(-1px); }

.list-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.list-header-label { font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 12px; padding-left: 4px; }
.cloze-list-scroll { flex: 1; overflow-y: auto; padding-right: 4px; }

.cloze-item-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #f1f5f9;
  margin-bottom: 10px;
  cursor: pointer;
  transition: 0.2s;
}
.cloze-item-card:hover { border-color: #cbd5e1; background: #f8fafc; }
.cloze-item-card.active { background: #f0f9ff; border-color: #3b82f6; }
.active-bar { position: absolute; left: 0; top: 25%; height: 50%; width: 4px; background: transparent; border-radius: 0 4px 4px 0; }
.cloze-item-card.active .active-bar { background: #3b82f6; }

.item-icon { font-size: 18px; }
.item-title { font-size: 13px; font-weight: 600; color: #334155; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-sub { font-size: 10px; color: #94a3b8; display: flex; gap: 4px; }

.item-ctrls { display: flex; gap: 4px; opacity: 0; }
.cloze-item-card:hover .item-ctrls { opacity: 1; }
.mini-icon-btn { border: none; background: #fff; padding: 5px; border-radius: 6px; cursor: pointer; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

/* --- 右侧内容区 UI --- */
.main-content-panel {
  flex: 1;             /* 这行至关重要，它会让右侧占据除侧边栏外的所有空间 */
  background: #ffffff;
  display: flex;
  flex-direction: column;
  height: 100%;        /* 确保高度也占满 */
  position: relative;
}
.stage-header {
  height: 64px;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
}
.title-badge { background: #f1f5f9; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; color: #1e293b; }

.btn-glass { border: 1px solid #e2e8f0; background: #fff; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 8px; transition: 0.2s; }
.btn-glass:hover { background: #f8fafc; }
.btn-glass.exit { color: #ef4444; }

.exercise-body { flex: 1; display: flex; overflow: hidden; }
.reading-area { flex: 1; padding: 40px 60px; overflow-y: auto; line-height: 2.2; font-size: 19px; color: #334155; }

/* 挖空样式 */
.cloze-slot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 30px;
  background: #f1f5f9;
  border-bottom: 2px solid #cbd5e1;
  border-radius: 4px;
  margin: 0 6px;
  cursor: pointer;
  vertical-align: middle;
  transition: 0.2s;
}
.cloze-slot.active { background: #e0f2fe; border-color: #3b82f6; transform: translateY(-2px); }
.cloze-slot.filled { background: #f0f9ff; border-color: #0ea5e9; }
.cloze-slot.correct { background: #dcfce7 !important; border-color: #22c55e !important; }
.cloze-slot.wrong { background: #fee2e2 !important; border-color: #ef4444 !important; }

.slot-idx { font-size: 11px; color: #94a3b8; margin-right: 4px; }
.slot-answer { font-weight: 800; color: #2563eb; }

/* 侧边选项卡片 */
.options-panel { width: 360px; background: #f8fafc; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column; }
.options-scroll { flex: 1; overflow-y: auto; padding: 20px; }

.question-card { background: white; border-radius: 16px; padding: 18px; margin-bottom: 16px; border: 2px solid transparent; transition: 0.3s; }
.question-card.active { border-color: #3b82f6; box-shadow: 0 8px 20px rgba(59,130,246,0.1); }

.q-label { font-size: 11px; font-weight: 800; color: #64748b; }
.opt-choice {
  width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #f1f5f9; 
  background: #fff; border-radius: 10px; margin-top: 8px; cursor: pointer; text-align: left; transition: 0.2s;
}
.opt-choice:hover { background: #f8fafc; }
.opt-choice.selected { background: #3b82f6; color: white; border-color: #3b82f6; }
.opt-choice.is-ans { border: 2px solid #22c55e; }

.letter { font-weight: 800; width: 24px; }

/* 底部操作 */
.panel-footer { padding: 20px; background: white; border-top: 1px solid #e2e8f0; }
.btn-submit-main { width: 100%; padding: 16px; background: #0f172a; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; }
.btn-submit-main:disabled { background: #cbd5e1; cursor: not-allowed; }

.empty-guide-stage {
  flex: 1;            /* 占据 main 的所有垂直空间 */
  width: 100%;        /* 占据 main 的所有水平空间 */
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff; /* 确保背景色和 main 一致 */
}
.guide-content { text-align: center; color: #94a3b8; }
.guide-icon { font-size: 60px; margin-bottom: 20px; animation: bounce 2s infinite; }

@keyframes bounce { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-10px); } }
.fade-in { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* 侧边栏收缩逻辑 */
.toggle-btn {
  position: absolute; right: -12px; top: 30px; width: 24px; height: 24px; background: #fff;
  border: 1px solid #e2e8f0; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; z-index: 10;
}
</style>
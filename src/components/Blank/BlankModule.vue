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

    <BlankEditForm v-if="viewMode === 'edit'" :student="student" :initialData="activeQuiz"
      @save="(data) => { emit('save', data); viewMode = 'list' }" @cancel="viewMode = 'list'"
      class="full-view-editor" />

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

              <div v-if="isLoading" class="loader-wrap">
                <div class="mini-loader"></div>
              </div>

              <div v-else class="cloze-list-scroll">
                <div v-for="q in quizzes" :key="q.id" :class="['cloze-item-card', { active: activeQuiz?.id === q.id }]"
                  @click="selectQuiz(q)">
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
                    <div class="empty-icon">✍🏻</div>
                    <p>题库空空的</p>
                    <p class="sub-tip">{{ canEdit ? '点击上方按钮开始录入' : '等老师为你布置内容哦' }}</p>
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
                    <span v-else
                      :class="['cloze-slot', { 'active': activeQIdx === seg.qIdx, 'filled': userSelections[seg.qIdx] !== null, 'correct': isSubmitted && userSelections[seg.qIdx] === activeQuiz.quiz[seg.qIdx]?.answer, 'wrong': isSubmitted && userSelections[seg.qIdx] !== null && userSelections[seg.qIdx] !== activeQuiz.quiz[seg.qIdx]?.answer }]"
                      @click="scrollToQuestion(seg.qIdx)">
                      <span class="slot-idx">{{ seg.qIdx + 1 }}</span>
                      <span class="slot-answer">{{ userSelections[seg.qIdx] !== null ? String.fromCharCode(65 +
                        userSelections[seg.qIdx]) : '' }}</span>
                    </span>
                  </template>
                </div>
              </article>

              <aside class="options-panel">
                <div class="options-scroll">
                  <div v-for="(q, qIdx) in activeQuiz.quiz" :key="qIdx" :id="`q-card-${qIdx}`"
                    :class="['question-card', { active: activeQIdx === qIdx }]">

                    <div class="q-row-layout">
                      <span class="q-label">{{ qIdx + 1 }}.</span>

                      <div class="opts-list">
                        <button v-for="(opt, oIdx) in q.options" :key="oIdx"
                          :class="['opt-choice', { 'selected': userSelections[qIdx] === oIdx, 'is-ans': isSubmitted && oIdx === q.answer }]"
                          @click="handleSelect(qIdx, oIdx)">
                          <span class="letter">{{ String.fromCharCode(65 + oIdx) }}</span>
                          <span class="text">{{ opt }}</span>
                        </button>
                      </div>
                    </div>

                    <div v-if="isSubmitted"
                      :class="['ans-status', userSelections[qIdx] === q.answer ? 'is-ok' : 'is-no']">
                      {{ userSelections[qIdx] === q.answer ? '✓' : '✗' }}
                    </div>
                  </div>
                </div>
                <div class="panel-footer">
                  <div v-if="isSubmitted" class="score-pill">{{ scoreInfo }}</div>
                  <button v-else class="btn-submit-main" :disabled="userSelections.includes(null)"
                    @click="isSubmitted = true">
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
.cloze-workspace {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}
.full-view-editor {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: #fff;
  /* 确保背景纯白，盖住后面的列表 */
}
.is-full-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
}
.workspace-layout {
  display: flex;
  flex: 1;
  height: 0;
  /* 关键：强制子元素高度计算，使其内部滚动生效 */
  width: 100%;
  overflow: hidden;
}
.sidebar-panel {
  width: 280px;
  background: #ffffff;
  border-right: 1px solid #edf2f7;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  flex-direction: column;
}
.sidebar-panel.collapsed {
  width: 40px;
}
.panel-content {
  width: 280px;
  padding: 20px 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
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
.badge-text {
  font-size: 10px;
  font-weight: 800;
  color: #64748b;
  letter-spacing: 0.5px;
}
.student-name {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  margin: 2px 0 0 0;
}
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
.btn-primary-add:hover {
  background: #27ae60;
  transform: translateY(-1px);
}
.list-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.list-header-label {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  margin-bottom: 12px;
  padding-left: 4px;
}
.cloze-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}
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
  overflow: hidden; 
}
.cloze-item-card:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
.cloze-item-card.active {
  background: #f0f9ff;
  border-color: #3b82f6;
}
.active-bar {
  position: absolute;
  left: 0;
  top: 25%;
  height: 50%;
  width: 4px;
  background: transparent;
  border-radius: 0 4px 4px 0;
}
.cloze-item-card.active .active-bar {
  background: #3b82f6;
}
.item-icon {
  font-size: 18px;
}
.item-main {
  flex: 1;
  min-width: 0; /* 关键：允许 flex 项目在必要时收缩，从而触发省略号 */
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 标题文本截断逻辑 */
.item-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%; /* 确保占据容器宽度 */
}
.item-sub {
  font-size: 10px;
  color: #94a3b8;
  display: flex;
  gap: 4px;
}
.item-ctrls {
  display: flex;
  gap: 4px;
  opacity: 0;
  flex-shrink: 0; /* 关键：防止按钮被过长的标题挤扁 */
  transition: opacity 0.2s;
}
.cloze-item-card:hover .item-ctrls {
  opacity: 1;
}
.mini-icon-btn {
  border: none;
  background: #fff;
  padding: 5px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.main-content-panel {
  flex: 1;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  height: 100%;
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
.title-badge {
  background: #f1f5f9;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}
.btn-glass {
  border: 1px solid #e2e8f0;
  background: #fff;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-left: 8px;
  transition: 0.2s;
}
.btn-glass:hover {
  background: #f8fafc;
}
.btn-glass.exit {
  color: #ef4444;
}
.exercise-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.reading-area {
  flex: 1.2;
  min-height: 200px;
  overflow-y: auto;
  padding: 30px 40px;
  line-height: 2.2;
  font-size: 19px;
  color: #334155;
  background: #fff;
}
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
.cloze-slot.active {
  background: #e0f2fe;
  border-color: #3b82f6;
  transform: translateY(-2px);
}
.cloze-slot.filled {
  background: #f0f9ff;
  border-color: #0ea5e9;
}
.cloze-slot.correct {
  background: #dcfce7 !important;
  border-color: #22c55e !important;
}
.cloze-slot.wrong {
  background: #fee2e2 !important;
  border-color: #ef4444 !important;
}
.slot-idx {
  font-size: 11px;
  color: #94a3b8;
  margin-right: 4px;
}

.slot-answer {
  font-weight: 800;
  color: #2563eb;
}

/* 侧边选项卡片 */
/* 确保右侧选项面板高度锁死，不随内容无限拉长 */
.options-panel {
  width: 400px;
  background: #f8fafc;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  /* 确保占据父级全部高度 */
}

/* 核心滚动区 */
.options-scroll {
  flex: 1;
  overflow-y: auto;
  /* 这里产生上下滚动条 */
  padding: 16px;
  background: #f8fafc;
}

.question-card {
  background: white; 
  border-radius: 8px; 
  padding: 6px 10px;   /* 压缩上下内边距 */
  margin-bottom: 8px;  /* 题目之间的间距 */
  border: 1px solid #e2e8f0; 
  transition: 0.2s; 
  position: relative;
}

.question-card.active {
  border-color: #3b82f6;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.1);
}
.opts-list {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr); /* 严格平分四份 */
  gap: 4px; /* 减小间距以适应较窄的面板 */
  align-items: center;
}
/* 1. 新增：行布局，让题号和选项并排 */
.q-row-layout {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* 2. 序号样式：固定宽度防止对齐错乱 */
.q-label {
  font-size: 10px;
  font-weight: 800;
  color: #1e293b;
  min-width: 10px;     /* 保证 1. 和 10. 占位一致 */
  flex-shrink: 0;
}
.opt-choice {
  display: flex;
  flex-direction: row; /* 强制字母和单词在一行 */
  align-items: center;
  justify-content: flex-start; /* 靠左对齐，这是对齐的关键 */
  padding: 4px 6px;
  background: #fff;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  cursor: pointer;
  transition: 0.15s;
}
.opt-choice:hover {
  background: #f8fafc;
}
.opt-choice.selected {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
.opt-choice.is-ans {
  border: 2px solid #22c55e;
}
/* 字母标签：设置固定宽度实现垂直对齐 */
.letter {
  display: inline-block;
  width: 14px;         /* 关键：设置固定宽度，确保后面的单词起始点一致 */
  font-size: 10px;
  font-weight: 800;
  color: #94a3b8;
  flex-shrink: 0;      /* 禁止字母被挤压 */
  text-align: left;    /* 字母在自己的 14px 空间内左对齐 */
}
/* 选项文字：如果文字较长，强制截断并缩小字体 */
.opt-choice .text {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 2px;    /* 字母和单词之间微小的固定间距 */
}
.opt-choice.selected .letter {
  color: rgba(255, 255, 255, 0.8);
}
/* 底部操作 */
.panel-footer {
  padding: 20px;
  background: white;
  border-top: 1px solid #e2e8f0;
}

.btn-submit-main {
  width: 100%;
  padding: 16px;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
}

.btn-submit-main:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.empty-guide-stage {
  flex: 1;
  /* 占据 main 的所有垂直空间 */
  width: 100%;
  /* 占据 main 的所有水平空间 */
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  /* 确保背景色和 main 一致 */
}

.guide-content {
  text-align: center;
  color: #94a3b8;
}

.guide-icon {
  font-size: 60px;
  margin-bottom: 20px;
  animation: bounce 2s infinite;
}

@keyframes bounce {

  0%,
  100% {
    transform: translateX(0);
  }

  50% {
    transform: translateX(-10px);
  }
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 侧边栏收缩逻辑 */
.toggle-btn {
  position: absolute;
  right: -12px;
  top: 30px;
  width: 24px;
  height: 24px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  z-index: 10;
}
.ans-status {
  position: absolute;
  right: 5px;
  top: 2px;
  font-size: 10px;
}
.is-ok { color: #22c55e; }
.is-no { color: #ef4444; }
/* 空状态 */
.empty-list-tip {
  text-align: center; 
  margin-top: 60px;
}
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.sub-tip { font-size: 12px; color: #94a3b8; margin-top: 4px; }
</style>
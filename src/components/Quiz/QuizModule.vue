<script setup>
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  student: Object,
  quizzes: Array,
  canEdit: Boolean
})

const emit = defineEmits(['save', 'delete', 'batch-save'])

// --- 状态管理 ---
const selectedQuiz = ref(null)
const isAdding = ref(false)
const listCollapsed = ref(false)
const isFullScreen = ref(false)
const filterType = ref('all')
const isBatchImporting = ref(false)
const batchJsonText = ref('')
// --- 答题交互状态 ---
const userAnswer = ref(null)
const isChecked = ref(false)
// --- 录入表单数据 ---
const form = reactive({
  id: null,
  question: '',
  options: ['', '', '', ''],
  answer_index: 0,
  category: '',
  explanation: ''
})

// --- 逻辑处理 ---
const filteredQuizzes = computed(() => {
  if (filterType.value === 'all') return props.quizzes || []
  return props.quizzes.filter(q => q.category === filterType.value)
})

const currentIndex = computed(() => {
  if (!selectedQuiz.value) return -1
  return filteredQuizzes.value.findIndex(q => q.id === selectedQuiz.value.id)
})

const allCategories = computed(() => {
  const defaults = ['语法', '词汇', '真题', '阅读']
  if (!props.quizzes) return defaults
  const existing = props.quizzes.map(q => q.category).filter(Boolean)
  return [...new Set([...defaults, ...existing])].sort()
})

const handleBatchImport = () => {
  try {
    const data = JSON.parse(batchJsonText.value)
    if (!Array.isArray(data)) throw new Error('数据格式必须是数组 []')
    const formattedQuizzes = data.map((item, index) => {
      if (!item.question || !Array.isArray(item.options)) {
        throw new Error(`第 ${index + 1} 项数据不完整`)
      }
      return {
        question: item.question,
        options: item.options.slice(0, 4),
        answer_index: parseInt(item.answer_index) || 0,
        category: item.category || '未分类',
        explanation: item.explanation || ''
      }
    })

    // --- 修改点：不再循环 emit，而是触发一个新的批量事件 ---
    emit('batch-save', formattedQuizzes)
    // 成功后重置状态
    isBatchImporting.value = false
    batchJsonText.value = ''
  } catch (err) {
    alert('格式解析失败：' + err.message)
  }
}

const goToPrev = () => {
  if (currentIndex.value > 0) {
    selectedQuiz.value = filteredQuizzes.value[currentIndex.value - 1]
  }
}

const goToNext = () => {
  if (currentIndex.value < filteredQuizzes.value.length - 1) {
    selectedQuiz.value = filteredQuizzes.value[currentIndex.value + 1]
  }
}

const handleSelect = (idx) => {
  if (isChecked.value) return
  userAnswer.value = idx
  isChecked.value = true
}

const handleKeyDown = (e) => {
  if (isAdding.value) return
  if (e.key === 'ArrowLeft') goToPrev()
  if (e.key === 'ArrowRight') goToNext()
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

watch(selectedQuiz, () => {
  userAnswer.value = null
  isChecked.value = false
})

const openQuiz = (q) => {
  selectedQuiz.value = q
  isAdding.value = false
}

const startAdd = () => {
  isAdding.value = true
  selectedQuiz.value = null
  Object.assign(form, { id: null, question: '', options: ['', '', '', ''], answer_index: 0, category: '', explanation: '' })
}

const startEdit = () => {
  if (!selectedQuiz.value) return
  isAdding.value = true
  Object.assign(form, {
    id: selectedQuiz.value.id,
    question: selectedQuiz.value.question,
    options: [...selectedQuiz.value.options],
    answer_index: selectedQuiz.value.answer_index,
    category: selectedQuiz.value.category,
    explanation: selectedQuiz.value.explanation
  })
}

const submitForm = () => {
  if (!form.question || form.options.some(o => !o)) return alert('请填写完整内容哦！')
  emit('save', { ...form })
  isAdding.value = false
}

const handleDelete = (id) => {
  if (confirm('确定要删除这道题吗？')) {
    emit('delete', id)
    selectedQuiz.value = null
  }
}
</script>

<template>
  <div :class="['quiz-module-layout', { 'full-screen-mode': isFullScreen }]">

    <aside v-if="!isFullScreen" :class="['quiz-list-panel', { 'is-collapsed': listCollapsed }]">
      <button class="side-toggle-pill" @click="listCollapsed = !listCollapsed">
        <span>{{ listCollapsed ? '❯' : '❮' }}</span>
      </button>

      <div class="panel-inner-container" v-show="!listCollapsed">
        <div class="panel-header">
          <span class="header-title">📝 题目库 ({{ filteredQuizzes.length }})</span>
        </div>

        <div class="panel-content">
          <div class="filter-bar">
            <select v-model="filterType" class="cat-select">
              <option value="all">📖 全部展示</option>
              <option v-for="cat in allCategories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
            <button v-if="canEdit" class="import-mini-btn" @click="isBatchImporting = true" title="批量导入"><svg
                class="import-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M12 3V15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                  stroke-linejoin="round" />
                <path d="M16 11L12 15L8 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
            <button v-if="canEdit" class="add-mini-btn" @click="startAdd">＋</button>
          </div>
          <div class="scroll-list">
            <div v-for="(q, index) in filteredQuizzes" :key="q.id"
              :class="['quiz-item', { active: selectedQuiz?.id === q.id }]" @click="openQuiz(q)">
              <span class="item-cat">N.{{ index + 1 }} · {{ q.category }}</span>
              <div class="item-title">{{ q.question }}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <main class="quiz-main-space">
      <div class="main-toolbar" v-if="selectedQuiz || isAdding">
        <div class="nav-controls" v-if="selectedQuiz && !isAdding">
          <button class="nav-btn" @click="goToPrev" :disabled="currentIndex <= 0">上一题</button>
          <span class="nav-indicator">{{ currentIndex + 1 }} / {{ filteredQuizzes.length }}</span>
          <button class="nav-btn" @click="goToNext" :disabled="currentIndex >= filteredQuizzes.length - 1">下一题</button>
        </div>
        <div v-else></div>
        <button class="tool-btn" @click="isFullScreen = !isFullScreen">{{ isFullScreen ? '退出' : '📺 全屏' }}</button>
      </div>

      <div v-if="isAdding" class="quiz-editor-overlay">
        <div class="editor-container-compact">
          <header class="editor-header-slim">
            <div class="header-left">
              <span class="editor-tag">{{ form.id ? '编辑题目' : '新增题目' }}</span>
              <span class="header-id" v-if="form.id">#{{ form.id }}</span>
            </div>
            <button class="close-btn-slim" @click="isAdding = false">×</button>
          </header>

          <div class="editor-content-flex">
            <div class="editor-left-col">
              <div class="compact-field category-field">
                <label>所属分类</label>
                <div class="datalist-wrapper">
                  <input v-model="form.category" class="compact-input datalist-input" list="category-data"
                    placeholder="选择或输入..." @focus="$event.target.select()" @mousedown="form.category = ''">
                  <datalist id="category-data">
                    <option v-for="cat in allCategories" :key="cat" :value="cat" />
                  </datalist>
                </div>
              </div>
              <div class="compact-field fill-flex">
                <label>题干内容 (英文)</label>
                <textarea v-model="form.question" class="compact-area" placeholder="在此输入题干..."></textarea>
              </div>
            </div>

            <div class="editor-right-col">
              <label class="col-label">选项与答案设置</label>
              <div class="options-compact-stack">
                <div v-for="(opt, idx) in form.options" :key="idx"
                  :class="['opt-edit-pill', { 'is-answer': form.answer_index === idx }]">
                  <div class="pill-radio-hit" @click="form.answer_index = idx">
                    <div class="inner-dot"></div>
                  </div>
                  <input v-model="form.options[idx]" class="pill-input"
                    :placeholder="'选项 ' + String.fromCharCode(65 + idx)">
                  <span class="pill-letter">{{ String.fromCharCode(65 + idx) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="editor-bottom-section">
            <label>解析与备注</label>
            <textarea v-model="form.explanation" class="compact-area-small" placeholder="输入知识点解析..."></textarea>
          </div>

          <footer class="editor-footer-slim">
            <button v-if="form.id" class="text-del-btn" @click="handleDelete(form.id)">删除题目</button>
            <div class="footer-btns">
              <button class="secondary-btn" @click="isAdding = false">取消修改</button>
              <button class="primary-confirm-btn" @click="submitForm">确认并保存</button>
            </div>
          </footer>
        </div>
      </div>

      <div v-if="selectedQuiz && !isAdding" class="quiz-viewer">
        <div class="quiz-card-fancy">
          <div class="quiz-card-header">
            <div class="quiz-header-actions">
              <span class="quiz-tag">🏷️ {{ selectedQuiz.category }}</span>
              <button v-if="canEdit" class="edit-btn-pill" @click="startEdit">✎ 编辑题目</button>
            </div>
            <div class="quiz-question-display">{{ selectedQuiz.question }}</div>
          </div>

          <div class="quiz-scroll-body">
            <div class="quiz-options-container">
              <button v-for="(opt, idx) in selectedQuiz.options" :key="idx" :class="['opt-box-fancy', {
                'is-correct': isChecked && idx === selectedQuiz.answer_index,
                'is-wrong': isChecked && userAnswer === idx && idx !== selectedQuiz.answer_index,
                'is-dimmed': isChecked && idx !== selectedQuiz.answer_index && userAnswer !== idx
              }]" @click="handleSelect(idx)">
                <span class="opt-letter">{{ String.fromCharCode(65 + idx) }}</span>
                <span class="opt-content">{{ opt }}</span>
                <div class="status-indicator" v-if="isChecked">
                  <span v-if="idx === selectedQuiz.answer_index">✅</span>
                  <span v-else-if="userAnswer === idx">❌</span>
                </div>
              </button>
            </div>

            <transition name="pop">
              <div v-if="isChecked" class="feedback-inline-box">
                <div :class="['result-badge-pill', userAnswer === selectedQuiz.answer_index ? 'success' : 'error']">
                  {{ userAnswer === selectedQuiz.answer_index ? '答对啦 🌟' : '差一点点 ✍️' }}
                </div>
                <div class="explanation-text">
                  <strong>💡 解析：</strong> {{ selectedQuiz.explanation || '暂无详细解析' }}
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <div v-if="!selectedQuiz && !isAdding" class="empty-state">
        <div class="empty-icon">🍃</div>
        <p>请从左侧选择题目开始挑战</p>
      </div>
      <div v-if="isBatchImporting" class="quiz-editor-overlay glass-effect">
        <div class="editor-container-large">
          <header class="editor-header-fancy">
            <div class="header-main-info">
              <div class="icon-circle"><svg class="import-icon-svg" viewBox="0 0 24 24" fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M12 3V15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round" />
                  <path d="M16 11L12 15L8 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg></div>
              <div>
                <h3>批量导入题目</h3>
                <p>支持 JSON 数组格式快速录入库</p>
              </div>
            </div>
            <button class="close-btn-circle" @click="isBatchImporting = false">×</button>
          </header>

          <div class="batch-import-content">
            <div class="import-editor-wrapper">
              <div class="editor-label-bar">
                <span>JSON 数据源</span>
              </div>
              <textarea v-model="batchJsonText" class="modern-editor-area" placeholder='[
  {
    "question": "The capital of France is ______.",
    "options": ["London", "Berlin", "Paris", "Rome"],
    "answer_index": 2,
    "category": "Geography",
    "explanation": "Paris is the capital and largest city of France."
  }
]'></textarea>
            </div>

            <aside class="import-guide-aside">
              <h4>💡 录入指南</h4>
              <ul class="guide-list">
                <li><strong>数组格式：</strong>必须以 <code>[ ]</code> 包裹。</li>
                <li><strong>选项控制：</strong><code>options</code> 建议固定为 4 个。</li>
                <li><strong>索引值：</strong><code>answer_index</code> 从 0 开始计算（0=A, 1=B...）。</li>
                <li><strong>分类：</strong>若分类不存在，系统将自动创建。</li>
              </ul>
              <div class="warning-box">
                请确保 JSON 语法正确，否则将导致解析失败。
              </div>
            </aside>
          </div>

          <footer class="editor-footer-fancy">
            <button class="btn-cancel" @click="isBatchImporting = false">取消返回</button>
            <button class="btn-import-execute" @click="handleBatchImport">
              🚀 执行批量导入 ({{ (batchJsonText.match(/question/g) || []).length }} 题)
            </button>
          </footer>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* --- 全局盒模型 --- */
.quiz-module-layout * {
  box-sizing: border-box;
}

/* --- 修复双箭头逻辑 --- */
.datalist-input {
  /* 移除原生外观 */
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;

  cursor: pointer;
  /* 使用自定义箭头 */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 35px;
}

/* 彻底隐藏 Chrome 和 Edge 的默认下拉图标 */
.datalist-input::-webkit-calendar-picker-indicator {
  display: none !important;
}

/* 针对部分浏览器的兼容处理，防止点击箭头不弹出 */
.datalist-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
}

/* --- 布局对齐 --- */
.category-field {
  width: 100%;
  max-width: 240px;
  /* 限制分类选框宽度，避免变丑 */
}

.editor-content-flex {
  display: flex;
  gap: 24px;
  padding: 24px;
  flex: 1;
  overflow: hidden;
}

/* 修改此处的样式 */
.panel-content {
  flex: 1;
  /* 占据 header 之外的所有空间 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 关键：防止内容撑开父容器 */
}

.editor-left-col {
  flex: 1.4;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-right-col {
  flex: 1;
  background: #f8fafc;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
}

.compact-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compact-field.fill-flex {
  flex: 1;
  /* 让题干占据所有垂直空间 */
}

.compact-field label {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
}

.compact-input {
  height: 42px;
  padding: 0 14px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
}

.compact-input:focus {
  border-color: #48bb78;
}

.compact-area {
  flex: 1;
  padding: 14px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  resize: none;
  outline: none;
  line-height: 1.6;
}

/* --- 基础 UI 结构 --- */
.quiz-module-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  background: #f8fafc;
  overflow: hidden;
}

.quiz-list-panel {
  width: 260px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.4s;
  z-index: 5;
}

.quiz-list-panel.is-collapsed {
  width: 0;
}

.side-toggle-pill {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 48px;
  background: #334155;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 101;
  /* 比遮罩的 100 高 */
}

.panel-inner-container {
  width: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 18px;
  border-bottom: 1px solid #f1f5f9;
}

.header-title {
  font-weight: 800;
  color: #1e293b;
}

.filter-bar {
  padding: 10px;
  display: flex;
  gap: 5px;
}

.cat-select {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  font-size: 13px;
  outline: none;
}

.add-mini-btn {
  background: #48bb78;
  color: white;
  border: none;
  width: 34px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}

.scroll-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

/* 美化左侧列表滚动条 */
.scroll-list::-webkit-scrollbar {
  width: 5px;
}

.scroll-list::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 10px;
}

.scroll-list::-webkit-scrollbar-track {
  background: transparent;
}

.quiz-item {
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
  margin-bottom: 8px;
  cursor: pointer;
  overflow-y: auto;
}

.quiz-item.active {
  border-color: #48bb78;
  background: #f0fff4;
}

.item-cat {
  font-size: 10px;
  color: #48bb78;
  font-weight: bold;
}

.item-title {
  font-size: 12px;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quiz-main-space {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #fbfcfe;
}

.main-toolbar {
  padding: 10px 24px;
  background: white;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-btn,
.tool-btn {
  padding: 5px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.nav-btn:disabled {
  opacity: 0.3;
}

.nav-indicator {
  font-size: 12px;
  font-weight: 800;
  color: #94a3b8;
  margin: 0 8px;
}

.quiz-editor-overlay {
  position: absolute;
  /* 这里的 top, bottom, right 保持 0 */
  top: 0;
  right: 0;
  bottom: 0;
  /* 将 left 设置为一个合适的值，避开左侧按钮区域（例如 40px） */
  left: 20px;
  background: rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  /* 加上圆角让过渡不那么生硬 */
  border-top-left-radius: 20px;
  border-bottom-left-radius: 20px;
}

.editor-container-compact {
  width: 100%;
  max-width: 1200px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  max-height: 95vh;
  overflow: hidden;
}

.editor-header-slim {
  padding: 14px 20px;
  background: #1e293b;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-tag {
  background: #48bb78;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}

.close-btn-slim {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
}

.options-compact-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.opt-edit-pill {
  display: flex;
  align-items: center;
  background: white;
  border: 2px solid #e2e8f0;
  padding: 6px 12px;
  border-radius: 12px;
}

.opt-edit-pill.is-answer {
  border-color: #48bb78;
  background: #f0fff4;
}

.pill-radio-hit {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  margin-right: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.is-answer .inner-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #48bb78;
}

.pill-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  outline: none;
}

.pill-letter {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 800;
}

.editor-bottom-section {
  padding: 0 20px 14px;
}

.compact-area-small {
  width: 100%;
  height: 50px;
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
  resize: none;
  outline: none;
}

.editor-footer-slim {
  padding: 14px 20px 20px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-del-btn {
  color: #ef4444;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.primary-confirm-btn {
  background: #48bb78;
  color: white;
  border: none;
  padding: 8px 24px;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
}

.secondary-btn {
  background: white;
  border: 1px solid #e2e8f0;
  padding: 8px 18px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 8px;
}

.quiz-viewer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.quiz-card-fancy {
  width: 100%;
  max-width: 650px;
  background: white;
  padding: 25px;
  border-radius: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}

.quiz-question-display {
  font-size: 19px;
  font-weight: 800;
  margin-top: 10px;
  line-height: 1.4;
}

.quiz-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.edit-btn-pill {
  background: #f1f5f9;
  border: none;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.quiz-tag {
  background: #f0fff4;
  color: #27ae60;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: bold;
}

.opt-box-fancy {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: 2px solid #f1f5f9;
  background: white;
  margin-bottom: 8px;
  cursor: pointer;
  text-align: left;
  transition: 0.2s;
}

.opt-box-fancy:hover:not(.is-dimmed) {
  border-color: #48bb78;
  transform: translateX(3px);
}

.opt-letter {
  width: 26px;
  height: 26px;
  background: #f1f5f9;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-weight: 900;
  font-size: 12px;
}

.opt-content {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.is-correct {
  border-color: #48bb78 !important;
  background: #f0fff4 !important;
}

.is-wrong {
  border-color: #f56565 !important;
  background: #fff5f5 !important;
}

.is-dimmed {
  opacity: 0.4;
}

.feedback-inline-box {
  margin-top: 15px;
  background: #f8fafc;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid #f1f5f9;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.import-mini-btn {
  background: #3b82f6;
  /* 更接近现代简约的蓝色 */
  color: white;
  border: none;
  width: 34px;
  height: 34px;
  /* 显式设置高度，保持正方形 */
  border-radius: 10px;
  /* 增加一点圆角弧度，更高级 */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  /* 更丝滑的过渡动画 */
}

/* 按钮的反馈效果 */
.import-mini-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);
  /* 增加一点光晕，增加视觉交互 */
}

/* SVG 控制 */
.import-icon-svg {
  width: 20px;
  /* 图标稍稍放大，使其更聚焦 */
  height: 20px;
}

.batch-import-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.import-tip {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
  background: #f1f5f9;
  padding: 10px;
  border-radius: 8px;
}

.batch-textarea {
  height: 300px !important;
  font-family: monospace;
  font-size: 12px !important;
  background: #1e293b;
  color: #a7f3d0;
  /* 类似代码编辑器的配色 */
  border-color: #334155;
}

.batch-textarea::placeholder {
  color: #64748b;
}

/* 遮罩层 - 引入磨砂玻璃感 */
.glass-effect {
  background: rgba(15, 23, 42, 0.6) !important;
  backdrop-filter: blur(12px) !important;
}

/* 容器升级为大尺寸 */
.editor-container-large {
  width: 90vw;
  max-width: 1000px;
  height: 80vh;
  background: white;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalSlideUp 0.3s ease-out;
}

@keyframes modalSlideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 头部样式优化 */
.editor-header-fancy {
  padding: 24px 32px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-main-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-main-info h3 {
  margin: 0;
  font-size: 20px;
  color: #1e293b;
}

.header-main-info p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}

.icon-circle {
  width: 48px;
  height: 48px;
  background: #e0e7ff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

/* 内容区双栏布局 */
.batch-import-content {
  flex: 1;
  display: flex;
  padding: 24px;
  gap: 24px;
  overflow: hidden;
}

.import-editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-label-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
}

/* 模拟代码编辑器 */
.modern-editor-area {
  flex: 1;
  background: #1e293b;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 16px;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  border: 4px solid #1e293b;
  transition: border-color 0.2s;
}

.modern-editor-area:focus {
  border-color: #3b82f6;
}

/* 侧边指南 */
.import-guide-aside {
  width: 280px;
  background: #f1f5f9;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.guide-list {
  list-style: none;
  padding: 0;
  margin: 16px 0;
  font-size: 13px;
  color: #475569;
  flex: 1;
}

.guide-list li {
  margin-bottom: 12px;
  line-height: 1.5;
}

.warning-box {
  background: #fffbeb;
  border-left: 4px solid #f59e0b;
  padding: 12px;
  font-size: 12px;
  color: #92400e;
  border-radius: 4px;
}

/* 底部按钮区 */
.editor-footer-fancy {
  padding: 20px 32px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel {
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  cursor: pointer;
  font-weight: 600;
}

.btn-import-execute {
  padding: 10px 28px;
  border-radius: 10px;
  border: none;
  background: #3b82f6;
  color: white;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.39);
  transition: all 0.2s;
}

.btn-import-execute:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.close-btn-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #e2e8f0;
  color: #64748b;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn-circle:hover {
  background: #ef4444;
  color: white;
}

/* --- 批量导入编辑器滚动条美化 --- */

/* 1. 针对深色文本框的整体样式 */
.modern-editor-area::-webkit-scrollbar {
  width: 8px;
  /* 纵向宽度 */
  height: 8px;
  /* 横向高度（防止长 JSON 溢出） */
}

/* 2. 滚动条轨道：保持深色，与编辑器背景融为一体 */
.modern-editor-area::-webkit-scrollbar-track {
  background: #1e293b;
  border-radius: 0 16px 16px 0;
  /* 配合容器圆角 */
}

/* 3. 滚动条滑块：使用半透明的浅色，营造玻璃感 */
.modern-editor-area::-webkit-scrollbar-thumb {
  background-color: rgba(96, 165, 250, 0.2);
  /* 使用你定义的 blue-400 颜色并加透明度 */
  border-radius: 10px;
  border: 2px solid #1e293b;
  /* 增加边框间隙，使滑块看起来是悬浮的 */
}

/* 4. 鼠标悬停滑块：加亮反馈 */
.modern-editor-area::-webkit-scrollbar-thumb:hover {
  background-color: rgba(96, 165, 250, 0.5);
}

/* 5. 针对滑块被点击拖动时的状态 */
.modern-editor-area::-webkit-scrollbar-thumb:active {
  background-color: rgba(96, 165, 250, 0.8);
}

/* Firefox 浏览器的简易兼容 */
.modern-editor-area {
  scrollbar-width: thin;
  scrollbar-color: rgba(96, 165, 250, 0.3) #1e293b;
}

/* --- 侧边指南区的滚动条 (如果有溢出) --- */
.import-guide-aside::-webkit-scrollbar {
  width: 4px;
}

.import-guide-aside::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
</style>
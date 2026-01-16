<script setup>
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  student: Object,
  quizzes: Array,
  canEdit: Boolean
})

const emit = defineEmits(['save', 'delete'])

// --- 状态管理 ---
const selectedQuiz = ref(null) 
const isAdding = ref(false)     
const listCollapsed = ref(false) 
const isFullScreen = ref(false)  
const filterType = ref('all') 

// --- 答题交互状态 ---
const userAnswer = ref(null)
const isChecked = ref(false) 

// --- 录入表单数据 ---
const form = reactive({ 
  id: null, 
  question: '', 
  options: ['', '', '', ''], 
  answer_index: 0, 
  category: '语法', 
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

const allCategories = computed(() => {
  const defaults = ['语法', '词汇', '真题', '阅读']
  if (!props.quizzes) return defaults
  const existing = props.quizzes.map(q => q.category).filter(Boolean)
  return [...new Set([...defaults, ...existing])]
})

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
  Object.assign(form, { id: null, question: '', options: ['', '', '', ''], answer_index: 0, category: '语法', explanation: '' })
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
              <option value="all">📖 全部</option>
              <option v-for="cat in allCategories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
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
              <div class="compact-field">
                <label>所属分类</label>
                <input v-model="form.category" class="compact-input" placeholder="输入或选择分类">
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
                  <input v-model="form.options[idx]" class="pill-input" :placeholder="'选项 '+String.fromCharCode(65+idx)">
                  <span class="pill-letter">{{ String.fromCharCode(65+idx) }}</span>
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
              <button v-for="(opt, idx) in selectedQuiz.options" :key="idx"
                :class="['opt-box-fancy', {
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
    </main>
  </div>
</template>

<style scoped>
.quiz-module-layout { display: flex; width: 100%; height: 100vh; background: #f8fafc; overflow: hidden; }

/* --- 侧边栏面板优化 --- */
.quiz-list-panel { 
  width: 260px; 
  background: white; 
  border-right: 1px solid #e2e8f0; 
  display: flex; 
  flex-direction: column; 
  position: relative; 
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
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
  z-index: 10; 
  display: flex; 
  align-items: center; 
  justify-content: center;
  box-shadow: 2px 0 8px rgba(0,0,0,0.1);
  color: white;
  padding: 0;
  transition: all 0.2s;
}

.side-toggle-pill:hover {
  background: #48bb78;
}

.panel-inner-container {
  width: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header { padding: 20px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
.header-title { font-weight: 800; color: #1e293b; }
.filter-bar { padding: 10px; display: flex; gap: 5px; white-space: nowrap; }

.cat-select { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; outline: none; }
.add-mini-btn { background: #48bb78; color: white; border: none; width: 34px; border-radius: 8px; cursor: pointer; font-weight: bold; }
.scroll-list { flex: 1; overflow-y: auto; padding: 10px; }
.quiz-item { padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9; margin-bottom: 10px; cursor: pointer; transition: 0.2s; }
.quiz-item:hover { background: #f8fafc; }
.quiz-item.active { border-color: #48bb78; background: #f0fff4; }
.item-cat { font-size: 10px; color: #48bb78; font-weight: bold; }
.item-title { font-size: 12px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* --- 主内容区 --- */
.quiz-main-space { flex: 1; display: flex; flex-direction: column; position: relative; background: #fbfcfe; }
.main-toolbar { padding: 12px 25px; background: white; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; z-index: 4; }
.nav-btn, .tool-btn { padding: 6px 15px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; }
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.nav-indicator { font-size: 13px; font-weight: 800; color: #94a3b8; margin: 0 10px; }

/* --- 编辑按钮样式修复 --- */
.quiz-header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.edit-btn-pill { 
  background: #f1f5f9; 
  color: #64748b; 
  border: none; 
  padding: 6px 14px; 
  border-radius: 20px; 
  font-size: 12px; 
  font-weight: 600; 
  cursor: pointer; 
  transition: 0.2s;
}
.edit-btn-pill:hover { 
  background: #e2e8f0; 
  color: #1e293b; 
}
.quiz-tag { background: #f0fff4; color: #27ae60; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; border: 1px solid #dcfce7; }

/* 管理员录入框样式 */
.quiz-editor-overlay { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.1); backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
.editor-container-compact { width: 100%; max-width: 900px; background: white; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; max-height: 95vh; overflow: hidden; }
.editor-header-slim { padding: 18px 25px; background: #1e293b; color: white; display: flex; justify-content: space-between; align-items: center; }
.editor-tag { background: #48bb78; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; }
.close-btn-slim { background: none; border: none; color: white; font-size: 28px; cursor: pointer; opacity: 0.7; }
.editor-content-flex { display: flex; gap: 25px; padding: 25px 25px 15px; flex: 1; overflow: hidden; }
.editor-left-col { flex: 1.2; display: flex; flex-direction: column; gap: 15px; }
.editor-right-col { flex: 1; background: #f8fafc; padding: 20px; border-radius: 18px; border: 1px solid #f1f5f9; display: flex; flex-direction: column; }
.compact-field { display: flex; flex-direction: column; gap: 6px; }
.compact-field label { font-size: 12px; font-weight: 700; color: #94a3b8; }
.compact-input { padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; outline: none; transition: 0.2s; }
.compact-area { flex: 1; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 15px; resize: none; outline: none; line-height: 1.5; }
.options-compact-stack { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; overflow-y: auto; }
.opt-edit-pill { display: flex; align-items: center; background: white; border: 2px solid #e2e8f0; padding: 8px 12px; border-radius: 14px; transition: 0.2s; }
.opt-edit-pill.is-answer { border-color: #48bb78; background: #f0fff4; }
.pill-radio-hit { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #cbd5e1; margin-right: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.is-answer .inner-dot { width: 10px; height: 10px; border-radius: 50%; background: #48bb78; }
.pill-input { flex: 1; border: none; background: transparent; font-size: 14px; font-weight: 600; outline: none; }
.editor-bottom-section { padding: 0 25px 15px; }
.compact-area-small { width: 100%; height: 60px; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 14px; resize: none; outline: none; }

.editor-footer-slim { padding: 15px 25px 25px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
.text-del-btn { background: transparent; border: none; color: #ef4444; font-size: 13px; font-weight: 600; cursor: pointer; padding: 8px 12px; border-radius: 8px; transition: 0.2s; }
.text-del-btn:hover { background: #fef2f2; }
.footer-btns { display: flex; gap: 12px; }
.secondary-btn { background: white; border: 1px solid #e2e8f0; color: #64748b; padding: 10px 20px; border-radius: 12px; font-weight: 600; cursor: pointer; }
.primary-confirm-btn { background: #48bb78; color: white; border: none; padding: 10px 25px; border-radius: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(72, 187, 120, 0.2); }

/* 学员端题目区 */
.quiz-viewer { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; overflow: hidden; transform: translateY(-20px); }
.quiz-card-fancy { width: 100%; max-width: 680px; max-height: 85vh; background: white; padding: 30px; border-radius: 32px; box-shadow: 0 12px 40px rgba(30, 41, 59, 0.08); border: 1px solid #edf2f7; display: flex; flex-direction: column; }
.quiz-question-display { font-size: 21px; font-weight: 800; line-height: 1.35; color: #0f172a; margin-top: 10px; }
.quiz-scroll-body { flex: 1; overflow-y: auto; padding-right: 4px; }
.opt-box-fancy { display: flex; align-items: center; width: 100%; padding: 14px 18px; border-radius: 14px; border: 2px solid #f1f5f9; background: white; margin-bottom: 8px; cursor: pointer; transition: 0.15s; text-align: left; }
.opt-box-fancy:hover:not(.is-dimmed) { border-color: #48bb78; transform: translateX(2px); }
.opt-letter { width: 28px; height: 28px; background: #f1f5f9; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; margin-right: 12px; flex-shrink: 0; font-size: 13px; }
.opt-content { font-size: 15px; font-weight: 600; color: #334155; flex: 1; }
.is-correct { border-color: #48bb78 !important; background: #f0fff4 !important; }
.is-wrong { border-color: #f56565 !important; background: #fff5f5 !important; }
.is-dimmed { opacity: 0.4; }

.feedback-inline-box { margin-top: 15px; background: #f8fafc; border-radius: 16px; padding: 18px; border: 1px solid #f1f5f9; animation: slideUp 0.3s ease-out; }
.result-badge-pill { display: inline-block; padding: 3px 12px; border-radius: 100px; font-size: 12px; font-weight: 800; margin-bottom: 8px; color: white; }
.result-badge-pill.success { background: #48bb78; }
.result-badge-pill.error { background: #f56565; }
.explanation-text { font-size: 14px; color: #475569; line-height: 1.6; }

@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #cbd5e1; }
.empty-icon { font-size: 60px; margin-bottom: 10px; opacity: 0.5; }
</style>
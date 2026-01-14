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
  options: ['', ''], 
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
  const defaults = ['语法', '词汇', '真题']
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
  Object.assign(form, { id: null, question: '', options: ['', ''], answer_index: 0, category: '语法', explanation: '' })
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
  if (!form.question || form.options.some(o => !o)) return alert('请填写完整内容')
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
      <div class="panel-header">
        <span class="header-title" v-show="!listCollapsed">📝 题目 ({{ filteredQuizzes.length }})</span>
        <button class="toggle-mini" @click="listCollapsed = !listCollapsed">
          {{ listCollapsed ? '▶' : '◀' }}
        </button>
      </div>

      <div v-show="!listCollapsed" class="panel-content">
        <div class="filter-bar">
          <select v-model="filterType" class="cat-select">
            <option value="all">所有分类</option>
            <option v-for="cat in allCategories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
          <button v-if="canEdit" class="add-mini-btn" @click="startAdd">＋</button>
        </div>

        <div class="scroll-list">
          <div 
            v-for="q in filteredQuizzes" :key="q.id" 
            :class="['quiz-item', { active: selectedQuiz?.id === q.id }]"
            @click="openQuiz(q)"
          >
            <div class="item-info"><span class="item-cat">{{ q.category || '未分类' }}</span></div>
            <div class="item-title">{{ q.question }}</div>
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
        <button class="tool-btn" @click="isFullScreen = !isFullScreen">
          {{ isFullScreen ? '退出全屏' : '全屏' }}
        </button>
      </div>

      <div v-if="isAdding" class="quiz-editor">
        <div class="editor-card compact-card">
          <div class="card-header">
            <h3>{{ form.id ? '🛠️ 修改' : '✨ 新题' }}</h3>
            <button class="close-btn" @click="isAdding = false">×</button>
          </div>
          <div class="form-body">
            <div class="form-row">
              <input v-model="form.category" list="cat-opts" class="compact-input" placeholder="题型分类">
              <datalist id="cat-opts"><option v-for="cat in allCategories" :key="cat" :value="cat"></option></datalist>
            </div>
            <div class="form-row">
              <textarea v-model="form.question" rows="2" class="compact-area" placeholder="题干内容"></textarea>
            </div>
            <div class="compact-options-grid">
              <div v-for="(opt, idx) in form.options" :key="idx" class="compact-opt-row">
                <input type="radio" :value="idx" v-model="form.answer_index">
                <input v-model="form.options[idx]" class="compact-input-field" :placeholder="'选项 '+String.fromCharCode(65+idx)">
                <button class="remove-opt" @click="form.options.splice(idx,1)" v-if="form.options.length > 2">×</button>
              </div>
            </div>
            <button class="add-opt-mini" @click="form.options.push('')">+ 选项</button>
            <div class="form-row" style="margin-top:10px">
              <textarea v-model="form.explanation" rows="2" class="compact-area" placeholder="Tips/解析"></textarea>
            </div>
          </div>
          <div class="form-footer">
            <button class="btn-save" @click="submitForm">保存</button>
          </div>
        </div>
      </div>

      <div v-if="selectedQuiz && !isAdding" class="quiz-viewer">
        <div class="quiz-card compact-card">
          <div class="quiz-meta">
            <span class="quiz-tag">{{ selectedQuiz.category }}</span>
            <button v-if="canEdit" class="edit-link" @click="startEdit">✎ 编辑</button>
          </div>

          <div class="quiz-question-compact">{{ selectedQuiz.question }}</div>
          
          <div class="quiz-options-grid">
            <button 
              v-for="(opt, idx) in selectedQuiz.options" :key="idx"
              :class="['compact-opt-box', {
                'is-correct': isChecked && idx === selectedQuiz.answer_index,
                'is-wrong': isChecked && userAnswer === idx && idx !== selectedQuiz.answer_index,
                'is-dimmed': isChecked && idx !== selectedQuiz.answer_index && userAnswer !== idx
              }]"
              @click="handleSelect(idx)"
            >
              <span class="opt-indicator">{{ String.fromCharCode(65 + idx) }}</span>
              <span class="opt-text">{{ opt }}</span>
              <span v-if="isChecked && idx === selectedQuiz.answer_index" class="feedback-icon">✓</span>
              <span v-if="isChecked && userAnswer === idx && idx !== selectedQuiz.answer_index" class="feedback-icon">✕</span>
            </button>
          </div>

          <div v-if="isChecked" class="instant-feedback-area">
            <div :class="['result-banner', userAnswer === selectedQuiz.answer_index ? 'success' : 'error']">
              {{ userAnswer === selectedQuiz.answer_index ? '回答正确！' : '回答错误' }}
            </div>
            <div class="explanation-mini">
              <strong>💡 Tips：</strong> {{ selectedQuiz.explanation || '无解析。' }}
            </div>
            <button v-if="canEdit" class="del-link" @click="handleDelete(selectedQuiz.id)">🗑️ 删除此题</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.quiz-module-layout { display: flex; width: 100%; height: 100%; background: #fff; overflow: hidden; font-family: system-ui, sans-serif; }

/* 侧边栏列表 */
.quiz-list-panel { width: 240px; background: #f8fafc; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; transition: width 0.3s; }
.quiz-list-panel.is-collapsed { width: 48px; }
.panel-header { padding: 0 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; height: 44px; }
.header-title { font-weight: bold; font-size: 13px; color: #1e293b; white-space: nowrap; }
.filter-bar { padding: 8px; display: flex; gap: 6px; border-bottom: 1px solid #f1f5f9; }
.cat-select { flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 12px; outline: none; }
.add-mini-btn { background: #1e293b; color: white; border: none; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; font-size: 16px; }

.scroll-list { flex: 1; overflow-y: auto; padding: 8px; }
.quiz-item { padding: 10px; border-radius: 6px; background: white; margin-bottom: 6px; cursor: pointer; border: 1px solid #f1f5f9; }
.quiz-item.active { background: #27ae60; color: white; }
.item-cat { font-size: 9px; font-weight: bold; opacity: 0.8; }
.item-title { font-size: 12px; line-height: 1.4; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* 主区域工具栏 */
.quiz-main-space { flex: 1; overflow-y: auto; background: #fff; display: flex; flex-direction: column; }
.main-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 0 15px; border-bottom: 1px solid #f1f5f9; min-height: 44px; }
.nav-btn { padding: 3px 10px; border: 1px solid #e2e8f0; background: white; border-radius: 4px; cursor: pointer; font-size: 11px; }
.nav-indicator { font-size: 12px; font-weight: 600; color: #64748b; margin: 0 10px; }
.tool-btn { padding: 3px 8px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 4px; cursor: pointer; font-size: 11px; }

/* 答题区聚焦显示优化 */
.quiz-viewer { flex: 1; padding: 20px 15px; }
.compact-card { max-width: 720px; margin: 0 auto; width: 100%; }
.quiz-meta { display: flex; justify-content: space-between; margin-bottom: 8px; }
.quiz-tag { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 10px; color: #64748b; }
.edit-link { font-size: 11px; color: #94a3b8; text-decoration: underline; background:none; border:none; cursor:pointer;}

.quiz-question-compact { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 15px; line-height: 1.4; }

.quiz-options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } /* ✨ 选项改为两列布局以节省空间 */
.compact-opt-box { 
  padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; 
  background: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px; 
  transition: 0.1s; position: relative; width: 100%; text-align: left;
}
.compact-opt-box.is-correct { border-color: #22c55e; background: #f0fdf4; border-width: 2px; }
.compact-opt-box.is-wrong { border-color: #ef4444; background: #fef2f2; border-width: 2px; }
.compact-opt-box.is-dimmed { opacity: 0.4; }

.opt-indicator { 
  width: 22px; height: 22px; background: #f1f5f9; border-radius: 4px; 
  display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #64748b; flex-shrink: 0;
}
.opt-text { font-size: 14px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 即时反馈区 */
.instant-feedback-area { margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0; }
.result-banner { padding: 6px; border-radius: 6px; text-align: center; font-weight: 800; margin-bottom: 10px; font-size: 13px; }
.result-banner.success { background: #dcfce7; color: #166534; }
.result-banner.error { background: #fee2e2; color: #991b1b; }
.explanation-mini { background: #fffbeb; padding: 12px; border-radius: 8px; font-size: 13px; color: #92400e; border: 1px solid #fef3c7; line-height: 1.5; }
.del-link { display: block; margin: 10px auto 0; font-size: 10px; color: #cbd5e1; background: none; border: none; cursor: pointer; }

/* 编辑器微调 */
.form-row { margin-bottom: 8px; }
.compact-input, .compact-input-field { width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px; }
.compact-area { width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-family: inherit; font-size: 13px; resize: none; }
.compact-options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.compact-opt-row { display: flex; align-items: center; gap: 6px; background: #f1f5f9; padding: 4px; border-radius: 6px; }
.btn-save { background: #27ae60; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px; }
</style>
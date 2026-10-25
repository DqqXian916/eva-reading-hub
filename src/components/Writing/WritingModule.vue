<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../../supabase'
import { useStudentStore } from '../../stores/useStudentStore'

const props = defineProps({
  student: {
    type: Object,
    required: true
  },
  canEdit: {
    type: Boolean,
    default: false
  },
  isFullScreen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggleFull'])

const studentStore = useStudentStore()

// --- 状态管理 ---
const writingTasks = ref([])
const activeTask = ref(null)
const userArticle = ref('')
const isSubmitting = ref(false)
const isSubmitted = ref(false)
const showEditModal = ref(false)
const isLoading = ref(false)

// 编辑/新建任务表单
const taskForm = ref({
  id: null,
  title: '',
  prompt: '',
  reference_vocab: '', // 推荐词汇（用换行或逗号分隔）
  min_words: 50
})

// 计算实时字数
const wordCount = computed(() => {
  const text = userArticle.value.trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
})

// 计算已使用的推荐词汇列表
const usedVocabList = computed(() => {
  if (!activeTask.value || !activeTask.value.reference_vocab) return []
  const vocabs = activeTask.value.reference_vocab
    .split(/[\n,，]/)
    .map(v => v.trim())
    .filter(Boolean)
  
  const text = userArticle.value.toLowerCase()
  return vocabs.map(vocab => ({
    word: vocab,
    used: text.includes(vocab.toLowerCase())
  }))
})

// 加载学员的写作任务列表
const fetchWritingTasks = async () => {
  if (!props.student) return
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('writing_tasks')
      .select('*')
      .eq('student_id', props.student.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    writingTasks.value = data || []
    if (writingTasks.value.length > 0 && !activeTask.value) {
      selectTask(writingTasks.value[0])
    }
  } catch (e) {
    console.error('获取写作任务失败:', e)
  } finally {
    isLoading.value = false
  }
}

// 选择特定任务
const selectTask = (task) => {
  activeTask.value = task
  userArticle.value = task.student_submission || ''
  isSubmitted.value = !!task.student_submission
}

// 保存/新增写作任务（管理端）
const handleSaveTask = async () => {
  if (!taskForm.value.title || !taskForm.value.prompt) {
    alert('请填写完整的题目和写作要求！')
    return
  }

  try {
    isLoading.value = true
    const payload = {
      title: taskForm.value.title,
      prompt: taskForm.value.prompt,
      reference_vocab: taskForm.value.reference_vocab,
      min_words: taskForm.value.min_words,
      student_id: props.student.id
    }

    let res
    if (taskForm.value.id) {
      res = await supabase
        .from('writing_tasks')
        .update(payload)
        .eq('id', taskForm.value.id)
    } else {
      res = await supabase.from('writing_tasks').insert([payload])
    }

    if (res.error) throw res.error
    alert(taskForm.value.id ? '✅ 写作任务更新成功' : '🚀 写作任务发布成功')
    showEditModal.value = false
    await fetchWritingTasks()
  } catch (e) {
    alert('保存任务失败：' + e.message)
  } finally {
    isLoading.value = false
  }
}

// 打开编辑框
const openEditModal = (task = null) => {
  if (task) {
    taskForm.value = { ...task }
  } else {
    taskForm.value = {
      id: null,
      title: '',
      prompt: '',
      reference_vocab: '',
      min_words: 50
    }
  }
  showEditModal.value = true
}

// 删除任务（管理端）
const handleDeleteTask = async (id) => {
  if (!confirm('确定要彻底删除该写作任务吗？')) return
  try {
    const { error } = await supabase.from('writing_tasks').delete().eq('id', id)
    if (error) throw error
    if (activeTask.value?.id === id) activeTask.value = null
    await fetchWritingTasks()
  } catch (e) {
    alert('删除失败：' + e.message)
  }
}

// 学员提交作文
const handleSubmitArticle = async () => {
  if (!activeTask.value) return
  if (wordCount.value < (activeTask.value.min_words || 10)) {
    alert(`字数未达标哦，至少需要写 ${activeTask.value.min_words || 10} 个单词！`)
    return
  }

  try {
    isSubmitting.value = true
    const { error } = await supabase
      .from('writing_tasks')
      .update({
        student_submission: userArticle.value,
        submitted_at: new Date().toISOString()
      })
      .eq('id', activeTask.value.id)

    if (error) throw error

    isSubmitted.value = true
    // 给予 XP 积分奖励
    const earnedXP = 30
    await studentStore.awardXP(earnedXP, 'writing', `完成写作: ${activeTask.value.title}`)
    alert(`🎉 恭喜完成写作！获得 ${earnedXP} Exp 积分！`)
  } catch (e) {
    alert('提交失败：' + e.message)
  } finally {
    isSubmitting.value = false
  }
}

watch(() => props.student, fetchWritingTasks, { immediate: true })
</script>

<template>
  <div class="writing-container">
    <!-- 左侧：任务列表栏 -->
    <aside class="task-sidebar">
      <div class="sidebar-header">
        <h3>✍️ 写作任务</h3>
        <button v-if="canEdit" class="btn-add" @click="openEditModal()">+ 发布题目</button>
      </div>

      <div class="task-list" v-if="writingTasks.length > 0">
        <div 
          v-for="task in writingTasks" 
          :key="task.id" 
          :class="['task-item', { active: activeTask?.id === task.id }]"
          @click="selectTask(task)"
        >
          <div class="task-info">
            <span class="task-title">{{ task.title }}</span>
            <span :class="['status-badge', task.student_submission ? 'submitted' : 'pending']">
              {{ task.student_submission ? '已完成' : '未完成' }}
            </span>
          </div>
          <button v-if="canEdit" class="btn-icon-del" @click.stop="handleDeleteTask(task.id)">🗑️</button>
        </div>
      </div>

      <div v-else class="empty-tasks">
        <p>暂无写作任务 🍃</p>
      </div>
    </aside>

    <!-- 右侧：写作工作区 -->
    <main class="workspace" v-if="activeTask">
      <div class="workspace-header">
        <div class="title-area">
          <h2>{{ activeTask.title }}</h2>
          <span class="min-words-tag">目标：至少 {{ activeTask.min_words || 50 }} 词</span>
        </div>
        <div class="action-tools">
          <button class="btn-full" @click="emit('toggleFull')">
            {{ isFullScreen ? '退出全屏' : '全屏模式' }}
          </button>
          <button v-if="canEdit" class="btn-edit" @click="openEditModal(activeTask)">修改题目</button>
        </div>
      </div>

      <!-- 题目要求与参考词汇 -->
      <div class="prompt-card">
        <div class="prompt-text">
          <span class="label">📌 写作要求：</span>
          <p>{{ activeTask.prompt }}</p>
        </div>

        <div v-if="usedVocabList.length > 0" class="vocab-recommend-box">
          <span class="label">💡 建议使用的词汇：</span>
          <div class="vocab-tags">
            <span 
              v-for="(item, idx) in usedVocabList" 
              :key="idx" 
              :class="['vocab-tag', { used: item.used }]"
            >
              {{ item.word }} {{ item.used ? '✓' : '' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 作文编辑区域 -->
      <div class="editor-area">
        <textarea 
          v-model="userArticle" 
          placeholder="Start writing your passage in English here..."
          :readonly="isSubmitted && !canEdit"
        ></textarea>

        <!-- 编辑器底部工具栏 -->
        <div class="editor-footer">
          <div class="word-counter">
            单词量：<strong :class="{ 'has-met': wordCount >= (activeTask.min_words || 10) }">{{ wordCount }}</strong> / {{ activeTask.min_words || 50 }} 词
          </div>

          <div class="submit-actions">
            <button 
              v-if="isSubmitted && !canEdit" 
              class="btn-submitted" 
              disabled
            >
              ✅ 已提交作文
            </button>
            <button 
              v-else 
              class="btn-submit" 
              :disabled="isSubmitting"
              @click="handleSubmitArticle"
            >
              {{ isSubmitting ? '提交中...' : (isSubmitted ? '更新作文' : '🚀 提交作文 (+30 Exp)') }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <div v-else class="empty-workspace">
      <div class="welcome-card">
        <h3>🖊️ 请从左侧选择或发布一个写作任务吧</h3>
      </div>
    </div>

    <!-- 管理端：编辑/新增写作任务模态框 -->
    <Transition name="fade">
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-card">
          <h3>{{ taskForm.id ? '修改写作任务' : '发布新写作任务' }}</h3>

          <div class="form-group">
            <label>任务标题</label>
            <input v-model="taskForm.title" placeholder="如：A Special Day" />
          </div>

          <div class="form-group">
            <label>写作题目与提示要求</label>
            <textarea v-model="taskForm.prompt" rows="3" placeholder="描述你的一个特殊日子，并说明原因..."></textarea>
          </div>

          <div class="form-group">
            <label>推荐使用词汇 (用逗号或换行分隔)</label>
            <textarea v-model="taskForm.reference_vocab" rows="2" placeholder="unforgettable, excited, memory"></textarea>
          </div>

          <div class="form-group">
            <label>最低单词数量</label>
            <input type="number" v-model="taskForm.min_words" placeholder="50" />
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" @click="showEditModal = false">取消</button>
            <button class="btn-save" @click="handleSaveTask">保存并发布</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.writing-container {
  display: flex;
  width: 100%;
  height: 100%;
  background: #f8fafc;
}

/* 任务列表 */
.task-sidebar {
  width: 280px;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  color: #10143a;
}

.btn-add {
  background: #1c5426;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.task-item {
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
}

.task-item:hover, .task-item.active {
  background: #eef7ee;
  border: 1px solid #4C976D;
}

.task-title {
  font-weight: 600;
  font-size: 14px;
  color: #334155;
  display: block;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  margin-top: 4px;
  display: inline-block;
}

.status-badge.pending { background: #fef3c7; color: #d97706; }
.status-badge.submitted { background: #dcfce7; color: #15803d; }

.btn-icon-del {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.6;
}

.btn-icon-del:hover { opacity: 1; }

/* 工作区 */
.workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow-y: auto;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.workspace-header h2 {
  margin: 0;
  color: #10143a;
  font-size: 22px;
}

.min-words-tag {
  font-size: 12px;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 6px;
  color: #475569;
  margin-top: 4px;
  display: inline-block;
}

.prompt-card {
  background: white;
  border-radius: 16px;
  padding: 16px 20px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
}

.prompt-text p {
  margin: 6px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
}

.vocab-recommend-box {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e2e8f0;
}

.vocab-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.vocab-tag {
  font-size: 12px;
  background: #f1f5f9;
  color: #64748b;
  padding: 4px 10px;
  border-radius: 20px;
  transition: all 0.2s;
}

.vocab-tag.used {
  background: #dcfce7;
  color: #16a34a;
  font-weight: 600;
}

/* 编辑器 */
.editor-area {
  flex: 1;
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-area textarea {
  flex: 1;
  padding: 20px;
  border: none;
  resize: none;
  font-size: 16px;
  line-height: 1.6;
  outline: none;
  font-family: inherit;
}

.editor-footer {
  padding: 12px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.word-counter strong.has-met {
  color: #16a34a;
}

.btn-submit {
  background: #1c5426;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-submitted {
  background: #e2e8f0;
  color: #64748b;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
}

.empty-workspace {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: white;
  width: 450px;
  padding: 24px;
  border-radius: 20px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #475569;
}

.form-group input, .form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn-cancel {
  background: #f1f5f9;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}

.btn-save {
  background: #1c5426;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}
</style>
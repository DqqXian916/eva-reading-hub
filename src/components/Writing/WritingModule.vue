<script setup>
import { ref, computed, watch } from 'vue'
import { supabase } from '../../supabase'
import { useStudentStore } from '../../stores/useStudentStore'

const props = defineProps({
  student: { type: Object, required: true },
  canEdit: { type: Boolean, default: false },
  isFullScreen: { type: Boolean, default: false }
})

const emit = defineEmits(['toggleFull'])
const studentStore = useStudentStore()

// --- 题型字典配置 ---
const EXAM_PRESETS = [
  {
    key: 'primary_picture',
    stageLabel: '小学 / 初中',
    typeLabel: '看图写话 / 话题短文',
    task_type: 'chart',
    defaultWords: 60,
    placeholderPrompt: '请根据图片内容或提示要点，写一篇英语短文...',
    needImage: true
  },
  {
    key: 'hs_applied',
    stageLabel: '高中英语',
    typeLabel: '应用文写作 (书信/通知)',
    task_type: 'essay',
    defaultWords: 80,
    placeholderPrompt: '假定你是李华，请你给外教 Chris 写一封邮件...',
    needImage: false
  },
  {
    key: 'hs_continuation',
    stageLabel: '高中英语',
    typeLabel: '读后续写 (两段式续写)',
    task_type: 'continuation',
    defaultWords: 150,
    placeholderPrompt: '注意：1. 续写词数应为150左右；2. 请按如下格式在答题卡的相应位置作答。',
    needImage: false
  },
  {
    key: 'cet_kaoyan',
    stageLabel: '四六级 / 考研',
    typeLabel: '图表 / 漫画 / 哲理作文',
    task_type: 'chart',
    defaultWords: 150,
    placeholderPrompt: 'Directions: Write an essay based on the picture/chart below. You should start your essay with a brief description...',
    needImage: true
  },
  {
    key: 'ielts_task1',
    stageLabel: '雅思 IELTS',
    typeLabel: 'Task 1 小作文 (图表/流程/地图)',
    task_type: 'chart',
    defaultWords: 150,
    placeholderPrompt: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    needImage: true
  },
  {
    key: 'ielts_task2',
    stageLabel: '雅思 IELTS',
    typeLabel: 'Task 2 大作文 (议论文)',
    task_type: 'essay',
    defaultWords: 250,
    placeholderPrompt: 'Discuss both these views and give your own opinion.',
    needImage: false
  }
]

// --- 状态管理 ---
const writingTasks = ref([])
const activeTask = ref(null)

// 作答内容状态（兼容普通作文 & 两段式续写）
const userArticle = ref('')
const userPara1 = ref('')
const userPara2 = ref('')

const isSubmitting = ref(false)
const isSubmitted = ref(false)
const showEditModal = ref(false)
const isLoading = ref(false)
const isUploadingImg = ref(false)

// 编辑/新建任务表单
const defaultForm = () => ({
  id: null,
  exam_stage: 'hs_applied',
  task_type: 'essay',
  title: '',
  prompt: '',
  reading_material: '',
  continuation_p1: '',
  continuation_p2: '',
  prompt_images: [],
  reference_vocab: '',
  min_words: 80
})

const taskForm = ref(defaultForm())

// 当前选中的预设配置
const currentPreset = computed(() => {
  return EXAM_PRESETS.find(p => p.key === taskForm.value.exam_stage) || EXAM_PRESETS[0]
})

// 切换题型预设时的联动处理
const handlePresetChange = (presetKey) => {
  const preset = EXAM_PRESETS.find(p => p.key === presetKey)
  if (!preset) return
  taskForm.value.exam_stage = preset.key
  taskForm.value.task_type = preset.task_type
  if (!taskForm.value.id) {
    taskForm.value.min_words = preset.defaultWords
    if (preset.key === 'hs_continuation' && !taskForm.value.prompt) {
      taskForm.value.prompt = preset.placeholderPrompt
    }
  }
}

// 计算实时总字数
const countWords = (str) => {
  const text = (str || '').trim()
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}

const wordCount = computed(() => {
  if (activeTask.value?.task_type === 'continuation') {
    return countWords(userPara1.value) + countWords(userPara2.value)
  }
  return countWords(userArticle.value)
})

// 计算已使用的推荐词汇列表
const usedVocabList = computed(() => {
  if (!activeTask.value || !activeTask.value.reference_vocab) return []
  const vocabs = activeTask.value.reference_vocab
    .split(/[\n,，]/)
    .map(v => v.trim())
    .filter(Boolean)

  const combinedText = activeTask.value.task_type === 'continuation'
    ? `${userPara1.value} ${userPara2.value}`.toLowerCase()
    : userArticle.value.toLowerCase()

  return vocabs.map(vocab => ({
    word: vocab,
    used: combinedText.includes(vocab.toLowerCase())
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
    if (writingTasks.value.length > 0) {
      const target = activeTask.value
        ? writingTasks.value.find(t => t.id === activeTask.value.id) || writingTasks.value[0]
        : writingTasks.value[0]
      selectTask(target)
    } else {
      activeTask.value = null
    }
  } catch (e) {
    console.error('获取写作任务失败:', e)
  } finally {
    isLoading.value = false
  }
}

// 选择特定任务并回显作答内容
const selectTask = (task) => {
  activeTask.value = task
  isSubmitted.value = !!task.student_submission

  if (task.task_type === 'continuation') {
    try {
      const parsed = task.student_submission ? JSON.parse(task.student_submission) : {}
      userPara1.value = parsed.p1 || ''
      userPara2.value = parsed.p2 || ''
    } catch {
      userPara1.value = task.student_submission || ''
      userPara2.value = ''
    }
  } else {
    userArticle.value = task.student_submission || ''
  }
}

// 图片上传逻辑
const uploadImageFile = async (file) => {
  if (!file || !file.type.startsWith('image/')) return
  try {
    isUploadingImg.value = true
    const fileExt = file.name?.split('.').pop() || 'png'
    const fileName = `${props.student.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${fileExt}`
    const filePath = `prompts/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('writing-images')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('writing-images').getPublicUrl(filePath)
    if (data?.publicUrl) {
      taskForm.value.prompt_images.push(data.publicUrl)
    }
  } catch (e) {
    alert('图片上传失败，请确保已在 Supabase 创建 writing-images 桶并配置好 RLS 策略：' + e.message)
  } finally {
    isUploadingImg.value = false
  }
}

const handleFileInput = async (e) => {
  const files = Array.from(e.target.files || [])
  for (const file of files) {
    await uploadImageFile(file)
  }
  e.target.value = ''
}

const handlePasteImage = async (e) => {
  const items = e.clipboardData?.items || []
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile()
      await uploadImageFile(file)
    }
  }
}

const removeImage = (index) => {
  taskForm.value.prompt_images.splice(index, 1)
}

// 保存/新增写作任务（管理端）
const handleSaveTask = async () => {
  if (!taskForm.value.title.trim()) {
    alert('请填写任务标题！')
    return
  }
  if (taskForm.value.task_type === 'continuation') {
    if (!taskForm.value.reading_material.trim() || !taskForm.value.continuation_p1.trim() || !taskForm.value.continuation_p2.trim()) {
      alert('读后续写题型请完整填写【阅读原文】以及【两段续写开头】！')
      return
    }
  } else if (!taskForm.value.prompt.trim() && taskForm.value.prompt_images.length === 0) {
    alert('请填写写作要求或上传题目图片！')
    return
  }

  try {
    isLoading.value = true
    const payload = {
      exam_stage: taskForm.value.exam_stage,
      task_type: taskForm.value.task_type,
      title: taskForm.value.title,
      prompt: taskForm.value.prompt,
      reading_material: taskForm.value.task_type === 'continuation' ? taskForm.value.reading_material : null,
      continuation_p1: taskForm.value.task_type === 'continuation' ? taskForm.value.continuation_p1 : null,
      continuation_p2: taskForm.value.task_type === 'continuation' ? taskForm.value.continuation_p2 : null,
      prompt_images: taskForm.value.prompt_images,
      reference_vocab: taskForm.value.reference_vocab,
      min_words: Number(taskForm.value.min_words) || 50,
      student_id: props.student.id
    }

    let res
    if (taskForm.value.id) {
      res = await supabase.from('writing_tasks').update(payload).eq('id', taskForm.value.id)
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
    taskForm.value = {
      ...defaultForm(),
      ...task,
      prompt_images: Array.isArray(task.prompt_images) ? [...task.prompt_images] : []
    }
  } else {
    taskForm.value = defaultForm()
  }
  showEditModal.value = true
}

// 删除任务
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
  const targetWords = activeTask.value.min_words || 10
  if (wordCount.value < targetWords) {
    alert(`字数未达标哦，至少需要写 ${targetWords} 个单词（当前 ${wordCount.value} 词）！`)
    return
  }

  const submissionPayload = activeTask.value.task_type === 'continuation'
    ? JSON.stringify({ p1: userPara1.value, p2: userPara2.value })
    : userArticle.value

  try {
    isSubmitting.value = true
    const { error } = await supabase
      .from('writing_tasks')
      .update({
        student_submission: submissionPayload,
        submitted_at: new Date().toISOString()
      })
      .eq('id', activeTask.value.id)

    if (error) throw error

    const firstTimeSubmit = !isSubmitted.value
    isSubmitted.value = true
    activeTask.value.student_submission = submissionPayload

    if (firstTimeSubmit) {
      const earnedXP = activeTask.value.task_type === 'continuation' || targetWords >= 150 ? 50 : 30
      await studentStore.awardXP(earnedXP, 'writing', `完成写作: ${activeTask.value.title}`)
      alert(`🎉 恭喜完成写作！获得 ${earnedXP} Exp 积分！`)
    } else {
      alert('✅ 作文内容已更新！')
    }
  } catch (e) {
    alert('提交失败：' + e.message)
  } finally {
    isSubmitting.value = false
  }
}

const getStageBadge = (stageKey) => {
  const found = EXAM_PRESETS.find(p => p.key === stageKey)
  return found ? found.stageLabel : '常规写作'
}

watch(() => props.student, fetchWritingTasks, { immediate: true })
</script>

<template>
  <div class="writing-container">
    <!-- 左侧：任务列表栏 -->
    <aside class="task-sidebar">
      <div class="sidebar-header">
        <h3>✍️ 写作训练</h3>
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
            <div class="task-meta-tags">
              <span class="stage-tag">{{ getStageBadge(task.exam_stage) }}</span>
              <span v-if="task.task_type === 'continuation'" class="type-tag continuation">续写</span>
              <span v-else-if="task.prompt_images?.length" class="type-tag image">图文</span>
            </div>
            <span class="task-title">{{ task.title }}</span>
            <span :class="['status-badge', task.student_submission ? 'submitted' : 'pending']">
              {{ task.student_submission ? '已完成' : '待完成' }}
            </span>
          </div>
          <button v-if="canEdit" class="btn-icon-del" @click.stop="handleDeleteTask(task.id)" title="删除任务">🗑️</button>
        </div>
      </div>

      <!-- 优化后的精美左侧空状态 -->
      <div v-else class="empty-tasks">
        <div class="empty-icon-box">🍃</div>
        <p class="empty-title">暂无写作任务</p>
        <p class="empty-desc">{{ canEdit ? '点击上方按钮发布第一道写作训练题吧' : '老师还没有发布写作任务哦' }}</p>
        <button v-if="canEdit" class="btn-empty-action" @click="openEditModal()">立即发布题目</button>
      </div>
    </aside>

    <!-- 右侧：写作工作区 -->
    <main class="workspace" v-if="activeTask">
      <div class="workspace-header">
        <div class="title-area">
          <div class="header-badges">
            <span class="badge-stage">{{ getStageBadge(activeTask.exam_stage) }}</span>
            <span class="min-words-tag">目标词数：≥ {{ activeTask.min_words || 50 }} 词</span>
          </div>
          <h2>{{ activeTask.title }}</h2>
        </div>
        <div class="action-tools">
          <button class="btn-full" @click="emit('toggleFull')">
            {{ isFullScreen ? '退出全屏' : '全屏专注' }}
          </button>
          <button v-if="canEdit" class="btn-edit" @click="openEditModal(activeTask)">编辑题目</button>
        </div>
      </div>

      <!-- 题干与材料展示区 -->
      <div class="prompt-card">
        <div v-if="activeTask.task_type === 'continuation' && activeTask.reading_material" class="reading-passage-box">
          <div class="section-label">📖 阅读材料 (请仔细阅读下文，并根据两段首句续写)：</div>
          <div class="passage-content">{{ activeTask.reading_material }}</div>
        </div>

        <div v-if="activeTask.prompt" class="prompt-text">
          <span class="section-label">📌 写作要求：</span>
          <p>{{ activeTask.prompt }}</p>
        </div>

        <div v-if="activeTask.prompt_images && activeTask.prompt_images.length > 0" class="prompt-images-gallery">
          <div v-for="(imgUrl, idx) in activeTask.prompt_images" :key="idx" class="gallery-item">
            <img :src="imgUrl" alt="写作题目配图" />
          </div>
        </div>

        <div v-if="usedVocabList.length > 0" class="vocab-recommend-box">
          <span class="section-label">💡 建议高分词汇 (写入文章自动点亮)：</span>
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
        <div v-if="activeTask.task_type === 'continuation'" class="continuation-editor">
          <div class="para-block">
            <div class="para-starter">
              <span class="para-badge">Paragraph 1</span>
              <span class="starter-text">{{ activeTask.continuation_p1 }}</span>
            </div>
            <textarea
              v-model="userPara1"
              placeholder="请紧接第一段首句继续书写剧情发展..."
              :readonly="isSubmitted && !canEdit"
            ></textarea>
          </div>

          <div class="para-block">
            <div class="para-starter">
              <span class="para-badge">Paragraph 2</span>
              <span class="starter-text">{{ activeTask.continuation_p2 }}</span>
            </div>
            <textarea
              v-model="userPara2"
              placeholder="请紧接第二段首句完成故事升华与结局..."
              :readonly="isSubmitted && !canEdit"
            ></textarea>
          </div>
        </div>

        <textarea
          v-else
          v-model="userArticle"
          placeholder="Start writing your passage in English here..."
          :readonly="isSubmitted && !canEdit"
        ></textarea>

        <div class="editor-footer">
          <div class="word-counter">
            已写单词：<strong :class="{ 'has-met': wordCount >= (activeTask.min_words || 10) }">{{ wordCount }}</strong> / {{ activeTask.min_words || 50 }} 词
            <span v-if="activeTask.task_type === 'continuation'" class="sub-count">
              (第一段 {{ countWords(userPara1) }} 词 + 第二段 {{ countWords(userPara2) }} 词)
            </span>
          </div>

          <div class="submit-actions">
            <button v-if="isSubmitted && !canEdit" class="btn-submitted" disabled>
              ✅ 已提交作文
            </button>
            <button
              v-else
              class="btn-submit"
              :disabled="isSubmitting"
              @click="handleSubmitArticle"
            >
              {{ isSubmitting ? '提交中...' : (isSubmitted ? '更新作文' : `🚀 提交作文 (+${(activeTask.task_type === 'continuation' || activeTask.min_words >= 150) ? 50 : 30} Exp)`) }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- 优化后的精美主工作区空状态 -->
    <div v-else class="empty-workspace">
      <div class="welcome-card-enhanced">
        <div class="welcome-icon">✍️</div>
        <h3>Let's write!</h3>
        <p>请从左侧选择一个写作任务开始作答。</p>
        <button v-if="canEdit" class="btn-welcome-publish" @click="openEditModal()">+ 立即发布第一道题目</button>
      </div>
    </div>

    <!-- 管理端：全学段智能出题模态框 -->
    <Transition name="fade">
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false" @paste="handlePasteImage">
        <div class="modal-card modal-large">
          <div class="modal-header">
            <h3>{{ taskForm.id ? '✏️ 编辑写作任务' : '✨ 发布新写作任务' }}</h3>
            <span class="paste-tip">💡 提示：支持直接按 Ctrl+V 粘贴截图上传题目图片</span>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label>1. 选择学段与考试题型</label>
              <div class="preset-grid">
                <div
                  v-for="preset in EXAM_PRESETS"
                  :key="preset.key"
                  :class="['preset-card', { active: taskForm.exam_stage === preset.key }]"
                  @click="handlePresetChange(preset.key)"
                >
                  <div class="preset-stage">{{ preset.stageLabel }}</div>
                  <div class="preset-type">{{ preset.typeLabel }}</div>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group flex-2">
                <label>2. 题目名称</label>
                <input v-model="taskForm.title" placeholder="例如：2024新课标I卷读后续写 / 雅思Task1柱状图" />
              </div>
              <div class="form-group flex-1">
                <label>最低单词数</label>
                <input type="number" v-model="taskForm.min_words" />
              </div>
            </div>

            <template v-if="taskForm.task_type === 'continuation'">
              <div class="special-box continuation-box">
                <div class="form-group">
                  <label>📖 阅读原文 (Story Context)</label>
                  <textarea
                    v-model="taskForm.reading_material"
                    rows="5"
                    placeholder="请在此粘贴完整的阅读短文材料..."
                  ></textarea>
                </div>
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>✍️ 第一段续写开头 (Paragraph 1)</label>
                    <textarea
                      v-model="taskForm.continuation_p1"
                      rows="2"
                      placeholder="例如：With a deep breath, I knocked on the door..."
                    ></textarea>
                  </div>
                  <div class="form-group flex-1">
                    <label>✍️ 第二段续写开头 (Paragraph 2)</label>
                    <textarea
                      v-model="taskForm.continuation_p2"
                      rows="2"
                      placeholder="例如：Years later, whenever I looked at that photo..."
                    ></textarea>
                  </div>
                </div>
              </div>
            </template>

            <div class="form-group">
              <label>{{ taskForm.task_type === 'continuation' ? '补充写作要求' : '3. 写作题目与提示要求' }}</label>
              <textarea
                v-model="taskForm.prompt"
                rows="3"
                :placeholder="currentPreset.placeholderPrompt"
              ></textarea>
            </div>

            <div class="form-group">
              <label>
                4. 题目配图 / 图表 / 漫画录入
                <span v-if="currentPreset.needImage" class="required-hint">(当前题型建议上传图片)</span>
              </label>
              <div class="image-uploader-area">
                <div class="uploaded-list">
                  <div v-for="(img, idx) in taskForm.prompt_images" :key="idx" class="img-preview-item">
                    <img :src="img" />
                    <button type="button" class="btn-remove-img" @click="removeImage(idx)">×</button>
                  </div>

                  <label class="upload-trigger" :class="{ uploading: isUploadingImg }">
                    <input type="file" accept="image/*" multiple hidden @change="handleFileInput" :disabled="isUploadingImg" />
                    <span v-if="isUploadingImg">⏳ 上传中...</span>
                    <span v-else>+ 上传图片 / Ctrl+V粘贴</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>5. 推荐使用词汇 / 短语 (选填，用逗号或换行分隔)</label>
              <textarea
                v-model="taskForm.reference_vocab"
                rows="2"
                placeholder="例如：account for, dramatic increase, in contrast"
              ></textarea>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-cancel" @click="showEditModal = false">取消</button>
            <button class="btn-save" :disabled="isLoading || isUploadingImg" @click="handleSaveTask">
              {{ isLoading ? '保存中...' : '确认发布任务' }}
            </button>
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

/* 左侧任务列表 */
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
  font-weight: 600;
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
  border: 1.5px solid transparent;
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
}

.task-item:hover, .task-item.active {
  background: #eef7ee;
  border-color: #4C976D;
}

.task-meta-tags {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.stage-tag {
  font-size: 10px;
  background: #e2e8f0;
  color: #334155;
  padding: 1px 6px;
  border-radius: 4px;
}

.type-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.type-tag.continuation { background: #ede9fe; color: #6d28d9; }
.type-tag.image { background: #e0f2fe; color: #0369a1; }

.task-title {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  display: block;
}

.status-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
  margin-top: 6px;
  display: inline-block;
}
.status-badge.pending { background: #fef3c7; color: #d97706; }
.status-badge.submitted { background: #dcfce7; color: #15803d; }

.btn-icon-del {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
}
.btn-icon-del:hover { opacity: 1; }

/* 优化后的侧边栏空状态 */
.empty-tasks {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}
.empty-icon-box {
  font-size: 32px;
  margin-bottom: 8px;
}
.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 4px 0;
}
.empty-desc {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 16px 0;
  line-height: 1.4;
}
.btn-empty-action {
  background: #1c5426;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

/* 右侧工作区 */
.workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  overflow-y: auto;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}

.header-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.badge-stage {
  font-size: 12px;
  background: #1c5426;
  color: #fff;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.min-words-tag {
  font-size: 12px;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 6px;
  color: #475569;
}

.workspace-header h2 {
  margin: 0;
  color: #10143a;
  font-size: 20px;
}

.action-tools {
  display: flex;
  gap: 8px;
}

.btn-full, .btn-edit {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: white;
  font-size: 13px;
  cursor: pointer;
}

.prompt-card {
  background: white;
  border-radius: 14px;
  padding: 16px 20px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
  max-height: 36vh;
  overflow-y: auto;
}

.section-label {
  font-weight: 600;
  font-size: 13px;
  color: #1e293b;
}

.reading-passage-box {
  background: #f8fafc;
  padding: 12px 14px;
  border-radius: 10px;
  border-left: 3px solid #6d28d9;
  margin-bottom: 12px;
}

.passage-content {
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.65;
  color: #334155;
  white-space: pre-wrap;
}

.prompt-text p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.prompt-images-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.gallery-item img {
  max-height: 200px;
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  object-fit: contain;
}

.vocab-recommend-box {
  margin-top: 12px;
  padding-top: 10px;
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
  padding: 3px 10px;
  border-radius: 20px;
}
.vocab-tag.used {
  background: #dcfce7;
  color: #16a34a;
  font-weight: 600;
}

.editor-area {
  flex: 1;
  min-height: 260px;
  background: white;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-area > textarea {
  flex: 1;
  padding: 18px 20px;
  border: none;
  resize: none;
  font-size: 15px;
  line-height: 1.7;
  outline: none;
  font-family: inherit;
}

.continuation-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px 20px;
  gap: 16px;
}

.para-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.para-starter {
  background: #f5f3ff;
  padding: 10px 14px;
  border-bottom: 1px solid #ede9fe;
  font-size: 14px;
  line-height: 1.5;
}

.para-badge {
  background: #6d28d9;
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
  font-weight: 600;
}

.starter-text {
  font-weight: 600;
  color: #1e1b4b;
}

.para-block textarea {
  flex: 1;
  min-height: 90px;
  padding: 12px 14px;
  border: none;
  resize: none;
  font-size: 15px;
  line-height: 1.65;
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

.word-counter {
  font-size: 13px;
  color: #475569;
}
.word-counter strong.has-met {
  color: #16a34a;
  font-size: 15px;
}
.sub-count {
  color: #94a3b8;
  font-size: 12px;
  margin-left: 6px;
}

.btn-submit {
  background: #1c5426;
  color: white;
  border: none;
  padding: 9px 18px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-submitted {
  background: #e2e8f0;
  color: #64748b;
  border: none;
  padding: 9px 18px;
  border-radius: 10px;
}

/* 优化后的精美主工作区空状态 */
.empty-workspace {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.welcome-card-enhanced {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  max-width: 420px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
.welcome-icon {
  font-size: 44px;
  margin-bottom: 12px;
}
.welcome-card-enhanced h3 {
  margin: 0 0 8px 0;
  color: #10143a;
  font-size: 18px;
}
.welcome-card-enhanced p {
  margin: 0 0 20px 0;
  color: #64748b;
  font-size: 13.5px;
  line-height: 1.5;
}
.btn-welcome-publish {
  background: #1c5426;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
}

/* 管理员出题模态框样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card.modal-large {
  background: white;
  width: 720px;
  max-width: 95vw;
  max-height: 90vh;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  padding: 18px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 { margin: 0; font-size: 18px; color: #0f172a; }
.paste-tip { font-size: 12px; color: #16a34a; background: #dcfce7; padding: 3px 8px; border-radius: 6px; }

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 6px;
}

.preset-card {
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s;
  background: #f8fafc;
}
.preset-card:hover { border-color: #94a3b8; }
.preset-card.active {
  border-color: #1c5426;
  background: #eef7ee;
}
.preset-stage { font-size: 11px; color: #64748b; font-weight: 600; }
.preset-card.active .preset-stage { color: #1c5426; }
.preset-type { font-size: 13px; color: #1e293b; font-weight: 600; margin-top: 2px; }

.form-row {
  display: flex;
  gap: 12px;
}
.flex-1 { flex: 1; }
.flex-2 { flex: 2; }

.form-group {
  margin-bottom: 14px;
}
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 5px;
  color: #334155;
}
.required-hint { color: #d97706; font-weight: normal; font-size: 12px; }

.form-group input, .form-group textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 13.5px;
  font-family: inherit;
}
.form-group input:focus, .form-group textarea:focus {
  outline: none;
  border-color: #1c5426;
}

.special-box.continuation-box {
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  padding: 14px;
  border-radius: 12px;
  margin-bottom: 14px;
}

.image-uploader-area {
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  padding: 12px;
  background: #f8fafc;
}

.uploaded-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.img-preview-item {
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  background: white;
}
.img-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.btn-remove-img {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  border: none;
  cursor: pointer;
  line-height: 1;
}

.upload-trigger {
  height: 84px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px dashed #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  background: white;
}
.upload-trigger:hover {
  border-color: #1c5426;
  color: #1c5426;
}

.modal-actions {
  padding: 14px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: #f8fafc;
}

.btn-cancel {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}

.btn-save {
  background: #1c5426;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
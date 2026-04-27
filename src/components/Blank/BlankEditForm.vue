<script setup>
import { ref, reactive, onMounted, nextTick, watch } from 'vue'

const props = defineProps({
  student: Object,
  initialData: Object // 编辑模式下传入的对象，新增模式为 null
})

const emit = defineEmits(['save', 'cancel'])

const editorRef = ref(null)
const isShowingCn = ref(false)
// 新增：控制 JSON 弹窗显示
const isJsonModalOpen = ref(false)
const jsonInput = ref('')

const form = reactive({
  id: props.initialData?.id || null,
  title: props.initialData?.title || '',
  body: props.initialData?.body || '',
  body_cn: props.initialData?.body_cn || '',
  quiz: JSON.parse(JSON.stringify(props.initialData?.quiz || []))
})

// 初始化编辑器内容
onMounted(() => {
  nextTick(() => {
    if (editorRef.value) {
      editorRef.value.innerHTML = isShowingCn.value ? form.body_cn : form.body
    }
  })
})

// 监听中英切换，同步编辑器显示内容
watch(isShowingCn, (val) => {
  if (editorRef.value) {
    editorRef.value.innerHTML = val ? form.body_cn : form.body
  }
})

// 新增：JSON 导入逻辑
const importFromJson = () => {
  try {
    const data = JSON.parse(jsonInput.value)
    // 基础校验
    if (!data.title || !Array.isArray(data.quiz)) {
      throw new Error("JSON 格式不正确，需包含 title 和 quiz 数组")
    }
    // 更新表单数据
    form.title = data.title
    form.body = data.body || ''
    form.body_cn = data.body_cn || ''

    // 深度拷贝题目数据
    form.quiz = data.quiz.map(q => ({
      options: q.options || ['', '', '', ''],
      answer: q.answer || 0,
      analysis: q.analysis || ''
    }))
    // 如果 body 中没有标记，尝试根据题目数量自动生成 (可选逻辑)
    if (!form.body.includes('[1]') && form.quiz.length > 0) {
      let placeholder = '\n\n'
      form.quiz.forEach((_, i) => placeholder += `[${i + 1}] `)
      form.body += placeholder
    }
    // 同步到编辑器视图
    if (editorRef.value) {
      editorRef.value.innerHTML = isShowingCn.value ? form.body_cn : form.body
    }
    isJsonModalOpen.value = false
    jsonInput.value = ''
    alert("导入成功！")
  } catch (e) {
    alert("导入失败: " + e.message)
  }
}

// 处理编辑器输入：同步数据并识别 [n] 标记
const handleInput = () => {
  if (!editorRef.value) return
  const content = editorRef.value.innerHTML

  if (isShowingCn.value) {
    form.body_cn = content
  } else {
    form.body = content
    // 识别形如 [1], [2] 的标记
    const matches = content.match(/\[(\d+)\]/g) || []
    const count = matches.length

    // 自动调整题目数组长度
    if (form.quiz.length < count) {
      for (let i = form.quiz.length; i < count; i++) {
        form.quiz.push({
          options: ['', '', '', ''],
          answer: 0,
          analysis: ''
        })
      }
    } else if (form.quiz.length > count) {
      form.quiz.splice(count)
    }
  }
}

const submitSave = () => {
  if (!form.title.trim()) return alert("请输入练习标题")
  if (!form.body.includes('[1]')) return alert("请在正文中至少设置一个挖空标记，例如 [1]")

  // 检查选项是否完整
  const isComplete = form.quiz.every(q => q.options.every(opt => opt.trim() !== ''))
  if (!isComplete) {
    if (!confirm("部分题目的选项尚未填写完整，确认要保存吗？")) return
  }

  emit('save', { ...form })
}
</script>

<template>
  <div class="edit-page-overlay">
    <header class="edit-navbar">
      <div class="nav-left">
        <button class="btn-back" @click="emit('cancel')">
          <span class="icon">←</span> 返回列表
        </button>
        <div class="divider"></div>
        <input v-model="form.title" class="title-input" placeholder="在此输入练习标题（如：Grade 6 Cloze Test...）">
      </div>
      <div class="nav-right">
        <div class="student-tag">学生: {{ student?.name }}</div>
        <button class="btn-save-main" @click="submitSave">发布练习</button>
      </div>
    </header>

    <div class="edit-main-layout">
      <section class="editor-pane">
        <div class="pane-header">
          <div class="mode-info">
            <span class="dot"></span>
            {{ isShowingCn ? '译文模式 (对照显示)' : '正文模式 (录入原文)' }}
          </div>
          <button :class="['btn-toggle', { 'is-cn': isShowingCn }]" @click="isShowingCn = !isShowingCn">
            {{ isShowingCn ? '← 返回修改英文' : '录入中文翻译 →' }}
          </button>
        </div>

        <div class="editor-container">
          <div ref="editorRef" contenteditable="true" class="cloze-editor"
            :data-placeholder="isShowingCn ? '在此输入中文翻译内容...' : '在此录入英文原文。题目请用 [1], [2] 代替...'" @input="handleInput">
          </div>

          <div class="editor-footer-tip">
            提示：输入 <b>[1]</b> 即可自动生成第 1 题的 ABCD 选项配置。
          </div>
        </div>
      </section>
      <aside class="config-pane">
        <div class="pane-header">
          题目配置 ({{ form.quiz.length }})
          <button class="btn-import-json" @click="isJsonModalOpen = true">导入 JSON</button>
        </div>

        <div class="config-scroll-area">
          <div v-if="form.quiz.length === 0" class="empty-quiz-tip">
            <div class="icon">🔍</div>
            <p>在左侧编辑器中输入 [1] 来创建题目</p>
          </div>

          <div v-for="(q, idx) in form.quiz" :key="idx" class="q-config-card">
            <div class="q-card-head">
              <span class="q-number">Question {{ idx + 1 }}</span>
              <div class="q-type-tag">单选题</div>
            </div>

            <div class="options-grid">
              <div v-for="i in 4" :key="i" class="opt-field">
                <span class="opt-label">{{ String.fromCharCode(64 + i) }}</span>
                <input v-model="q.options[i - 1]" placeholder="输入选项内容">
              </div>
            </div>

            <div class="answer-row">
              <label>正确答案</label>
              <div class="answer-selector">
                <button v-for="i in 4" :key="i" :class="{ active: q.answer === i - 1 }" @click="q.answer = i - 1">
                  {{ String.fromCharCode(64 + i) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div v-if="isJsonModalOpen" class="modal-overlay">
        <div class="json-modal">
          <h3>快速录入 (JSON)</h3>
          <p class="modal-tip">请粘贴符合规范的练习 JSON 数据：</p>
          <textarea v-model="jsonInput" placeholder='{ "title": "...", "body": "...", "quiz": [...] }'></textarea>
          <div class="modal-actions">
            <button class="btn-cancel" @click="isJsonModalOpen = false">取消</button>
            <button class="btn-confirm" @click="importFromJson">确认导入</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 强制覆盖全屏 */
.edit-page-overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

/* 导航栏 */
.edit-navbar {
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid #f1f5f9;
  background: #fff;
}

.nav-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.btn-back {
  background: none;
  border: none;
  font-size: 14px;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  width: 1px;
  height: 24px;
  background: #e2e8f0;
  margin: 0 20px;
}

.title-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.student-tag {
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 4px 12px;
  border-radius: 20px;
}

.btn-save-main {
  background: #0f172a;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s;
}

.btn-save-main:hover {
  background: #22c55e;
  transform: translateY(-1px);
}

/* 主布局 */
.edit-main-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧编辑器 */
.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #f1f5f9;
}

.pane-header {
  height: 48px;
  padding: 0 20px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mode-info {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-info .dot {
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
}

.btn-toggle {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
}

.btn-toggle.is-cn {
  border-color: #3b82f6;
  color: #3b82f6;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 40px 60px;
  overflow: hidden;
}

.cloze-editor {
  flex: 1;
  outline: none;
  font-size: 20px;
  line-height: 2;
  color: #1e293b;
  overflow-y: auto;
  text-align: justify;
}

.cloze-editor:empty:before {
  content: attr(data-placeholder);
  color: #cbd5e1;
}

.editor-footer-tip {
  padding-top: 20px;
  font-size: 12px;
  color: #94a3b8;
  border-top: 1px solid #f1f5f9;
}

/* 右侧配置区 */
.config-pane {
  width: 400px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
}

.config-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.q-config-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.q-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.q-number {
  font-size: 13px;
  font-weight: 800;
  color: #1e293b;
}

.q-type-tag {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opt-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.opt-label {
  width: 24px;
  font-weight: 800;
  color: #94a3b8;
  font-size: 14px;
}

.opt-field input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  font-size: 14px;
  transition: 0.2s;
}

.opt-field input:focus {
  border-color: #3b82f6;
  background: #fff;
}

.answer-row {
margin-top: 10px;
  padding-top: 10px;
  /* 维持现状或改为靠左对齐 */
  justify-content: flex-start; 
  gap: 15px;
}

.answer-row label {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.answer-selector {
  display: flex;
  gap: 6px;
}

.answer-selector button {
  width: 28px; /* 稍微缩小按钮 */
  height: 28px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s;
}

.answer-selector button.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.empty-quiz-tip {
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  text-align: center;
}

.empty-quiz-tip .icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}
/* 导入按钮样式 */
.btn-import-json {
  font-size: 11px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.btn-import-json:hover { background: #e2e8f0; }

/* 弹窗遮罩 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

/* 弹窗主体 */
.json-modal {
  background: white;
  width: 600px;
  max-width: 90vw;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
.json-modal h3 { margin: 0 0 8px 0; color: #1e293b; }
.modal-tip { font-size: 13px; color: #64748b; margin-bottom: 16px; }
.json-modal textarea {
  width: 97%;
  height: 300px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  resize: none;
  outline: none;
}
.json-modal textarea:focus { border-color: #3b82f6; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
.btn-cancel { padding: 8px 16px; background: none; border: none; cursor: pointer; color: #64748b; font-weight: 600; }
.btn-confirm { 
  padding: 8px 24px; background: #3b82f6; color: white; 
  border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
}
/* 确保配置面板高度固定为父容器高度 */
.config-pane {
  width: 400px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  height: 100%; /* 确保高度填满 */
  overflow: hidden; /* 关键：防止面板本身溢出 */
}

/* 确保滚动区域能够正确计算剩余空间 */
.config-scroll-area {
  flex: 1;
  overflow-y: auto; /* 这里会产生滚动条 */
  padding: 20px;
  /* 建议添加一个平滑滚动效果 */
  scroll-behavior: smooth;
}
/* 修改为 2x2 网格或者 1x4 横向 */
.options-grid {
  display: grid;
  /* 如果屏幕够宽想排成一行： */
  grid-template-columns: repeat(4, 1fr); 
  gap: 8px;
  margin-bottom: 12px;
}

.opt-field {
  display: flex;
  flex-direction: column; /* 标签在输入框上方，节省横向空间 */
  align-items: flex-start;
  gap: 4px;
}

.opt-label {
  width: auto; /* 取消固定宽度 */
  font-size: 11px;
  color: #64748b;
}

.opt-field input {
  width: 100%; /* 填满 grid 单元格 */
  padding: 6px 8px; /* 稍微收紧内边距 */
  font-size: 13px;
}

/* 优化：当宽度不足时，自动换行成两行 */
@media (max-width: 1200px) {
  .options-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
<script setup>
import { ref, reactive, onMounted, nextTick, watch } from 'vue'

const props = defineProps({
  student: Object,
  initialData: Object // 编辑模式下传入的对象，新增模式为 null
})

const emit = defineEmits(['save', 'cancel'])

const editorRef = ref(null)
const isShowingCn = ref(false)

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
        <input 
          v-model="form.title" 
          class="title-input" 
          placeholder="在此输入练习标题（如：Grade 6 Cloze Test...）"
        >
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
          <button 
            :class="['btn-toggle', { 'is-cn': isShowingCn }]" 
            @click="isShowingCn = !isShowingCn"
          >
            {{ isShowingCn ? '← 返回修改英文' : '录入中文翻译 →' }}
          </button>
        </div>
        
        <div class="editor-container">
          <div 
            ref="editorRef" 
            contenteditable="true" 
            class="cloze-editor"
            :data-placeholder="isShowingCn ? '在此输入中文翻译内容...' : '在此录入英文原文。题目请用 [1], [2] 代替...'"
            @input="handleInput"
          ></div>
          
          <div class="editor-footer-tip">
            提示：输入 <b>[1]</b> 即可自动生成第 1 题的 ABCD 选项配置。
          </div>
        </div>
      </section>

      <aside class="config-pane">
        <div class="pane-header">
          题目配置 ({{ form.quiz.length }})
        </div>
        
        <div class="config-scroll-area">
          <div v-if="form.quiz.length === 0" class="empty-quiz-tip">
            <div class="icon">🔍</div>
            <p>在左侧编辑器中输入 [1] 来创建题目</p>
          </div>

          <div 
            v-for="(q, idx) in form.quiz" 
            :key="idx" 
            class="q-config-card"
          >
            <div class="q-card-head">
              <span class="q-number">Question {{ idx + 1 }}</span>
              <div class="q-type-tag">单选题</div>
            </div>

            <div class="options-grid">
              <div v-for="i in 4" :key="i" class="opt-field">
                <span class="opt-label">{{ String.fromCharCode(64 + i) }}</span>
                <input 
                  v-model="q.options[i-1]" 
                  placeholder="输入选项内容"
                >
              </div>
            </div>

            <div class="answer-row">
              <label>正确答案</label>
              <div class="answer-selector">
                <button 
                  v-for="i in 4" 
                  :key="i"
                  :class="{ active: q.answer === i-1 }"
                  @click="q.answer = i-1"
                >
                  {{ String.fromCharCode(64 + i) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
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
.nav-left { display: flex; align-items: center; flex: 1; }
.btn-back { 
  background: none; border: none; font-size: 14px; color: #64748b; 
  cursor: pointer; display: flex; align-items: center; gap: 8px;
}
.divider { width: 1px; height: 24px; background: #e2e8f0; margin: 0 20px; }
.title-input { 
  flex: 1; border: none; outline: none; font-size: 18px; 
  font-weight: 700; color: #1e293b;
}
.nav-right { display: flex; align-items: center; gap: 20px; }
.student-tag { font-size: 12px; font-weight: 600; color: #3b82f6; background: #eff6ff; padding: 4px 12px; border-radius: 20px; }
.btn-save-main { 
  background: #0f172a; color: white; border: none; padding: 10px 24px; 
  border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s;
}
.btn-save-main:hover { background: #22c55e; transform: translateY(-1px); }

/* 主布局 */
.edit-main-layout { flex: 1; display: flex; overflow: hidden; }

/* 左侧编辑器 */
.editor-pane { flex: 1; display: flex; flex-direction: column; border-right: 1px solid #f1f5f9; }
.pane-header { 
  height: 48px; padding: 0 20px; background: #f8fafc; border-bottom: 1px solid #f1f5f9;
  display: flex; justify-content: space-between; align-items: center;
}
.mode-info { font-size: 12px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 8px; }
.mode-info .dot { width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; }
.btn-toggle { font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; }
.btn-toggle.is-cn { border-color: #3b82f6; color: #3b82f6; }

.editor-container { flex: 1; display: flex; flex-direction: column; padding: 40px 60px; overflow: hidden; }
.cloze-editor {
  flex: 1; outline: none; font-size: 20px; line-height: 2; color: #1e293b;
  overflow-y: auto; text-align: justify;
}
.cloze-editor:empty:before { content: attr(data-placeholder); color: #cbd5e1; }
.editor-footer-tip { padding-top: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }

/* 右侧配置区 */
.config-pane { width: 400px; background: #f8fafc; display: flex; flex-direction: column; }
.config-scroll-area { flex: 1; overflow-y: auto; padding: 20px; }

.q-config-card {
  background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; 
  padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.q-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.q-number { font-size: 13px; font-weight: 800; color: #1e293b; }
.q-type-tag { font-size: 10px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }

.options-grid { display: flex; flex-direction: column; gap: 8px; }
.opt-field { display: flex; align-items: center; gap: 10px; }
.opt-label { width: 24px; font-weight: 800; color: #94a3b8; font-size: 14px; }
.opt-field input { flex: 1; padding: 8px 12px; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 14px; transition: 0.2s; }
.opt-field input:focus { border-color: #3b82f6; background: #fff; }

.answer-row { margin-top: 16px; padding-top: 16px; border-top: 1px dashed #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
.answer-row label { font-size: 12px; font-weight: 700; color: #64748b; }
.answer-selector { display: flex; gap: 6px; }
.answer-selector button {
  width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; 
  background: #fff; font-weight: 700; cursor: pointer; transition: 0.2s;
}
.answer-selector button.active { background: #3b82f6; border-color: #3b82f6; color: #fff; }

.empty-quiz-tip { 
  height: 200px; display: flex; flex-direction: column; align-items: center; 
  justify-content: center; color: #94a3b8; text-align: center;
}
.empty-quiz-tip .icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
</style>
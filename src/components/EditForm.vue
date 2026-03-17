<script setup>
import { reactive, onMounted, ref, nextTick } from 'vue'

const props = defineProps({
  student: Object,
  initialData: Object
})

const emit = defineEmits(['save', 'cancel'])

// --- 状态管理 ---
const editorRef = ref(null)
const form = reactive({
  id: null,
  title: '',
  content: '', // 包含文字和 <img> 标签的 HTML
  quizRaw: ''
})

onMounted(() => {
  if (props.initialData) {
    form.id = props.initialData.id
    form.title = props.initialData.title || ''
    // 兼容旧数据：如果旧数据有 image_url 和 body，则合并
    const oldImage = props.initialData.image_url ? `<img src="${props.initialData.image_url}" style="max-width:100%; border-radius:8px; margin:10px 0;">` : ''
    form.content = props.initialData.content || (oldImage + (props.initialData.body || ''))
    form.quizRaw = JSON.stringify(props.initialData.quiz, null, 2)
    
    // 初始化编辑器内容
    if (editorRef.value) editorRef.value.innerHTML = form.content
  }
})

// --- 核心：处理粘贴图片 ---
const handlePaste = (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault() // 阻止默认粘贴
      const file = item.getAsFile()
      const reader = new FileReader()
      reader.onload = (event) => {
        // 在光标处插入图片
        const imgHtml = `<img src="${event.target.result}" style="max-width:100%; border-radius:8px; display:block; margin:10px 0;">`
        document.execCommand('insertHTML', false, imgHtml)
        updateContent()
      }
      reader.readAsDataURL(file)
    }
  }
}

// 同步内容到响应式变量
const updateContent = () => {
  form.content = editorRef.value.innerHTML
}

// --- 保存逻辑 ---
const handleSave = () => {
  // 强制同步一次最新的 HTML 内容
  form.content = editorRef.value.innerHTML
  if (!form.content.trim() || form.content === '<br>') {
    alert("eva老师，正文内容不能为空哦 ❤️")
    return
  }
  if (!form.quizRaw) {
    alert("请录入题目数据！")
    return
  }
  try {
    const quizJson = JSON.parse(form.quizRaw)
    // 构造提交给后端的数据对象
    const submitData = {
    id: form.id,
    title: form.title,
    body: form.content, // 注意这里：必须把 content 赋值给数据库认的 body 字段
    quiz: quizJson,
    student_id: props.student.id // 确保 student_id 也没有漏掉
  }
    emit('save', submitData)
  } catch (e) {
    alert("题目 JSON 格式错误，请检查！")
  }
}
</script>

<template>
  <div class="edit-view">
    <div class="edit-container">
      <header class="edit-header">
        <div class="title-group">
          <h3>{{ form.id ? '✏️ 修改文章' : '📝 录入新文章' }}</h3>
          <p class="subtitle">学员：<span class="highlight">{{ student.name }}</span></p>
        </div>
        <button class="btn-close" @click="$emit('cancel')">✕</button>
      </header>

      <div class="form-body">
        <div class="input-group">
          <label>文章标题 (选填)</label>
          <input v-model="form.title" class="input" placeholder="输入标题...">
        </div>

        <div class="input-group">
          <label>文章内容 (支持文字、图片粘贴/拖入) *</label>
          <div 
            ref="editorRef"
            contenteditable="true" 
            class="rich-editor"
            placeholder="在此输入文字，或直接粘贴/拖入图片..."
            @input="updateContent"
            @paste="handlePaste"
          ></div>
          <p class="hint-text">💡 提示：可以直接从本地或其他网页复制图片粘贴到此处。</p>
        </div>

        <div class="input-group">
          <label>题目数据 (JSON) *</label>
          <textarea v-model="form.quizRaw" class="textarea json-text" placeholder='JSON 格式内容...'></textarea>
        </div>

        <button class="btn-save" @click="handleSave">
          {{ form.id ? '确认更新' : '保存到云端' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 原有样式保留并添加/修改以下部分 */
.rich-editor {
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  padding: 15px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  font-size: 15px;
  line-height: 1.6;
  outline: none;
  transition: 0.3s;
}

.rich-editor:focus {
  border-color: #27ae60;
  box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.1);
}

/* 模拟 Placeholder */
.rich-editor:empty:before {
  content: attr(placeholder);
  color: #94a3b8;
  cursor: text;
}

/* 限制编辑器内图片样式 */
.rich-editor :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 10px 0;
  display: block;
}

.hint-text { font-size: 12px; color: #94a3b8; margin-top: 4px; }

/* 其他样式与你之前的一致... */
.edit-view { height: 100%; overflow-y: auto; background: #f8fafc; padding: 40px 20px; }
.edit-container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
.edit-header { display: flex; justify-content: space-between; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
.highlight { color: #27ae60; font-weight: bold; }
.form-body { display: flex; flex-direction: column; gap: 18px; }
.input-group { display: flex; flex-direction: column; gap: 8px; }
.input-group label { font-size: 13px; font-weight: 700; color: #64748b; }
.input, .textarea { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; }
.json-text { font-family: 'Fira Code', monospace; background: #1e293b; color: #e2e8f0; font-size: 12px; min-height: 120px; }
.btn-save { background: #0f172a; color: white; border: none; height: 48px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.3s; margin-top: 5px; }
.btn-save:hover { background: #27ae60; }
.btn-close { background: #f1f5f9; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; }
</style>
<script setup>
import { reactive, onMounted, ref, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps({
  student: Object,
  initialData: Object
})

const emit = defineEmits(['save', 'cancel'])
const isShowingCn = ref(false) // 记录当前是否是中文预览模式

// --- 状态管理 ---
const editorRef = ref(null)
const toolbarRef = ref(null)
const form = reactive({
  id: null,
  title: '',
  content: '',     // 英文/原版内容
  content_cn: '',  // 新增：中文内容
  quizRaw: ''
})

const toolbarState = reactive({
  show: false,
  top: 0,
  left: 0,
  targetContainer: null
})

const toggleLanguage = () => {
  // 1. 切换前，务必把当前编辑器的最新内容同步到对应的变量中
  if (isShowingCn.value) {
    form.content_cn = editorRef.value.innerHTML
  } else {
    form.content = editorRef.value.innerHTML
  }

  // 2. 翻转状态
  isShowingCn.value = !isShowingCn.value

  // 3. 将新内容填入编辑器
  nextTick(() => {
    editorRef.value.innerHTML = isShowingCn.value ? (form.content_cn || '') : form.content
  })
}

// --- 核心工具：自动包装图片 ---
const wrapImagesWithContainer = (html) => {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgs = doc.querySelectorAll('img');

  imgs.forEach(img => {
    if (img.parentElement && img.parentElement.classList.contains('resizable-img-container')) return;
    const container = doc.createElement('div');
    container.className = 'resizable-img-container';
    const width = img.style.width || '300px';
    container.setAttribute('style', `width: ${width}; display: block; margin-left: auto; margin-right: auto;`);
    img.parentNode.insertBefore(container, img);
    container.appendChild(img);
    img.style.width = '100%';
    img.style.height = 'auto';
  });
  return doc.body.innerHTML;
};

onMounted(() => {
  if (props.initialData) {
    form.id = props.initialData.id
    form.title = props.initialData.title || ''
    // 加载英文
    const oldImage = props.initialData.image_url ? `<img src="${props.initialData.image_url}">` : ''
    let combinedContent = props.initialData.content || (oldImage + (props.initialData.body || ''))
    form.content = wrapImagesWithContainer(combinedContent)
    // --- 【修改点 1】加载中文 ---
    if (props.initialData.body_cn) {
      form.content_cn = wrapImagesWithContainer(props.initialData.body_cn)
    }
    form.quizRaw = JSON.stringify(props.initialData.quiz, null, 2)
    // 初始化编辑器内容（根据当前模式显示）
    if (editorRef.value) {
      editorRef.value.innerHTML = isShowingCn.value ? (form.content_cn || '') : form.content
    }
  }
  document.addEventListener('mousedown', handleGlobalClick);
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleGlobalClick);
});

// --- 交互逻辑 ---
const handleEditorClick = (e) => {
  const container = e.target.closest('.resizable-img-container');
  if (container) {
    toolbarState.show = true;
    toolbarState.targetContainer = container;
    nextTick(() => {
      const rect = container.getBoundingClientRect();
      const toolbarRect = toolbarRef.value.getBoundingClientRect();
      toolbarState.top = rect.top + window.scrollY - toolbarRect.height - 10;
      toolbarState.left = rect.left + window.scrollX + (rect.width / 2) - (toolbarRect.width / 2);
    });
  } else if (!e.target.closest('.image-toolbar')) {
    hideToolbar();
  }
};

const hideToolbar = () => {
  toolbarState.show = false;
  toolbarState.targetContainer = null;
}

const handleGlobalClick = (e) => {
  if (editorRef.value && !editorRef.value.contains(e.target) && !toolbarRef.value?.contains(e.target)) {
    hideToolbar();
  }
}

const alignImage = (type) => {
  if (!toolbarState.targetContainer) return;
  const el = toolbarState.targetContainer;
  el.style.display = 'block';
  if (type === 'left') { el.style.marginLeft = '0'; el.style.marginRight = 'auto'; }
  else if (type === 'center') { el.style.marginLeft = 'auto'; el.style.marginRight = 'auto'; }
  else if (type === 'right') { el.style.marginLeft = 'auto'; el.style.marginRight = '0'; }
  updateContent();
  hideToolbar();
};

const removeImage = () => {
  if (toolbarState.targetContainer) {
    toolbarState.targetContainer.remove();
    updateContent();
    hideToolbar();
  }
};

const handlePaste = (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault()
      const file = item.getAsFile()
      const reader = new FileReader()
      reader.onload = (event) => {
        const imgHtml = `<div class="resizable-img-container" style="width: 300px; display: block; margin: 10px auto;"><img src="${event.target.result}" style="width:100%;"></div><p><br></p>`
        document.execCommand('insertHTML', false, imgHtml)
        updateContent()
      }
      reader.readAsDataURL(file)
    }
  }
}

const updateContent = () => {
  if (!editorRef.value) return
  if (isShowingCn.value) {
    form.content_cn = editorRef.value.innerHTML
  } else {
    form.content = editorRef.value.innerHTML
  }
}

const handleSave = () => {
  // 1. 最后强制同步一次
  updateContent()

  // 2. 校验英文原文
  if (!form.content.trim() || form.content === '<br>') {
    alert("正文内容不能为空哦 ❤️")
    return
  }
  try {
    // 3. 构造数据包
    const submitData = {
      id: form.id,
      title: form.title,
      body: form.content,       // 对应数据库 body
      body_cn: form.content_cn, // 确保 Key 名与 Supabase 字段名一致
      quiz: JSON.parse(form.quizRaw),
      student_id: props.student.id 
    }
    // 打印日志方便你在控制台检查
    console.log("提交的数据:", submitData)
    emit('save', submitData)
  } catch (e) {
    console.error(e)
    alert("题目 JSON 格式错误！")
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
          <div class="label-row">
            <label>文章内容 *</label>
            <button @click="toggleLanguage" class="lang-toggle-btn" :class="{ 'is-cn': isShowingCn }">
              {{ isShowingCn ? '返回原文' : '对照中文' }}
            </button>
          </div>

          <div ref="editorRef" contenteditable="true" :class="['rich-editor', { 'cn-mode': isShowingCn }]"
            :placeholder="isShowingCn ? '请输入中文翻译...' : '粘贴图片或输入文字...'" @input="updateContent" @paste="handlePaste"
            @mousedown="handleEditorClick"></div>
        </div>
        <div class="input-group">
          <label>题目数据 (JSON) *</label>
          <textarea v-model="form.quizRaw" class="textarea json-text" placeholder="请输入题目 JSON..."></textarea>
        </div>

        <button class="btn-save" @click="handleSave">确认并保存到云端</button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade-up">
        <div v-if="toolbarState.show" ref="toolbarRef" class="image-toolbar"
          :style="{ top: toolbarState.top + 'px', left: toolbarState.left + 'px' }">
          <button class="tool-btn" @click.stop="alignImage('left')" title="左对齐">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 19h18v-2H3v2zm0-4h12v-2H3v2zm0-4h18V9H3v2zm0-6v2h12V3H3z" />
            </svg>
          </button>
          <button class="tool-btn" @click.stop="alignImage('center')" title="居中">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 19h18v-2H3v2zm4-4h10v-2H7v2zm-4-4h18V9H3v2zm4-6v2h10V3H7z" />
            </svg>
          </button>
          <button class="tool-btn" @click.stop="alignImage('right')" title="右对齐">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M3 19h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18V9H3v2zm6-6v2h12V3H9z" />
            </svg>
          </button>
          <div class="divider"></div>
          <button class="tool-btn delete-btn" @click.stop="removeImage" title="删除图片">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor"
                d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z" />
            </svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* --- 布局修复：核心点 --- */
.edit-view {
  position: fixed;
  /* 覆盖全屏，防止内容撑破外部容器 */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: #f8fafc;
  padding: 20px;
  overflow-y: auto;
  /* 确保这里有滚动条 */
  display: flex;
  justify-content: center;
}

.edit-container {
  width: 100%;
  max-width: 800px;
  margin: auto;
  /* 垂直居中 */
  background: white;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  height: fit-content;
  /* 根据内容自适应，但受父级滚动控制 */
}

/* --- 头部样式修复 --- */
.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 15px;
}

.btn-close {
  background: #f1f5f9;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #64748b;
  transition: 0.2s;
}

.btn-close:hover {
  background: #e2e8f0;
  color: #ef4444;
}

/* --- 编辑器修复 --- */
.rich-editor {
  min-height: 200px;
  max-height: 450px;
  /* 限制高度，防止无限拉长 */
  overflow-y: auto;
  padding: 15px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  outline: none;
  line-height: 1.6;
}

.rich-editor :deep(.resizable-img-container) {
  position: relative;
  display: block;
  max-width: 100%;
  padding: 2px;
  border: 2px solid transparent;
  box-sizing: border-box;
  resize: both;
  overflow: hidden;
  transition: border-color 0.3s;
  border-radius: 8px;
  /* 容器也给圆角 */
}

/* 鼠标经过或选中（点击）时，给一个明显的呼吸灯边框 */
.rich-editor :deep(.resizable-img-container:hover),
.rich-editor :deep(.resizable-img-container:focus-within) {
  border-color: rgba(39, 174, 96, 0.5);
  background: rgba(39, 174, 96, 0.02);
}

/* 美化右下角的缩放手柄 (换成一个精致的小三角形) */
.rich-editor :deep(.resizable-img-container::-webkit-resizer) {
  background-color: transparent;
  background-image: radial-gradient(circle, #27ae60 1.5px, transparent 1.5px);
  background-size: 4px 4px;
  /* 波点纹理感 */
}

/* --- 按钮与表单 --- */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-weight: 700;
  color: #64748b;
  font-size: 13px;
}

.input {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  outline: none;
}

.input:focus {
  border-color: #27ae60;
}

.json-text {
  height: 120px;
  font-family: 'Fira Code', monospace;
  background: #1e293b;
  color: #38bdf8;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
}

.btn-save {
  background: #0f172a;
  color: white;
  border: none;
  padding: 14px;
  border-radius: 10px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.3s;
}

.btn-save:hover {
  background: #27ae60;
  transform: translateY(-1px);
}

/* --- 现代感工具条 --- */
.image-toolbar {
  position: absolute;
  z-index: 10000;
  background: rgba(15, 23, 42, 0.85);
  /* 深色磨砂玻璃 */
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
}

.tool-btn {
  background: transparent;
  border: none;
  color: #cbd5e1; /* 柔和的文字颜色 */
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  transform: translateY(-1px);
}

.tool-btn:active {
  transform: translateY(0);
}

.tool-btn.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

/* --- 优雅的淡入动画 --- */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.2s ease-out;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

/* 新增：Label 行布局 */
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 新增：切换按钮样式 */
.lang-toggle-btn {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s;
}

.lang-toggle-btn.is-cn {
  background: #27ae60;
  color: white;
  border-color: #27ae60;
  font-weight: bold;
}

/* 当处于中文模式时，编辑器背景微调提示用户 */
.rich-editor.cn-mode {
  background-color: #fdfcf7; /* 淡淡的纸张色，区分编辑状态 */
  border-color: #27ae60;
}
</style>
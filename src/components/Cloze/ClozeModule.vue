<script setup>
import { ref, computed, reactive, onMounted, nextTick } from 'vue'

const props = defineProps({
    quizzes: { type: Array, default: () => [] },
    canEdit: { type: Boolean, default: true },
    isFullScreen: { type: Boolean, default: false } // 接收父组件传入的全屏状态
})

const emit = defineEmits(['save', 'delete', 'batch-save', 'toggleFull'])
// --- 状态控制 ---
const selectedQuiz = ref(null)
const isAdding = ref(false)
const isChecked = ref(false)
const listCollapsed = ref(false)
const userAnswers = reactive({})
const inputRefs = ref([])
const configInputRefs = ref([]) // 用于引用管理员端的输入框
// --- 图片浮动预览状态 ---
const floatImgUrl = ref(null)
const floatPos = reactive({ x: 100, y: 100 })
const floatScale = ref(3)
const isDragging = ref(false)
const editMode = ref('manual') // 'manual' (表单录入) | 'json' (JSON录入)
const jsonInput = ref('')      // 存储用户输入的 JSON 字符串

// 标准的 JSON 录入模板提示
const jsonTemplate = `[
  {
    "title": "Unit 3 Winter Story",
    "cloze_text": "It was very {{1}} yesterday. We stayed at {{2}}.",
    "answers": ["cold", "home"],
    "category": "短文填空"
  }
]`

let dragOffset = { x: 0, y: 0 }
const editorTextareaRef = ref(null)

const handleToggleFull = () => {
    emit('toggleFull')
}

// 检查当前是否处于编辑状态（修复全屏按钮处变量未定义隐患）
const isEditing = computed(() => !!form.id)

const form = reactive({
    id: null,
    cloze_text: '',
    title: '', 
    answers: [],
    category: '短文填空'
})

// ====== ✨ 新增：实时解析 JSON 识别文章篇数 ======
const parsedJsonCount = computed(() => {
    if (!jsonInput.value.trim()) return 0
    try {
        const parsed = JSON.parse(jsonInput.value)
        if (Array.isArray(parsed)) {
            return parsed.length
        } else if (parsed && typeof parsed === 'object') {
            // 单个对象也视为 1 篇
            return 1
        }
        return 0
    } catch (e) {
        // 输入过程中或格式不正确时，静默捕获不报错
        return 0
    }
})

const startAdd = () => {
    selectedQuiz.value = null
    isAdding.value = true
    editMode.value = 'manual' // 默认回到常规录入
    jsonInput.value = ''
    Object.assign(form, { id: null, title: '', cloze_text: '', answers: [], category: '短文填空' })
}

const openQuiz = (q) => {
    isAdding.value = false
    selectedQuiz.value = q
    isChecked.value = false
    Object.keys(userAnswers).forEach(k => delete userAnswers[k])
}

const handleEdit = (q) => {
    isAdding.value = true
    selectedQuiz.value = null
    Object.assign(form, { ...q })
}

const focusInput = (index) => {
    const target = inputRefs.value[index]
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.focus()
    }
}

const handlePaste = async (event) => {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            event.preventDefault(); 
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                insertTextAtCursor(`\n![图片](${base64})\n`);
            };
            reader.readAsDataURL(blob);
        }
    }
};

const insertTextAtCursor = (text) => {
    const el = editorTextareaRef.value; 
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const originalText = form.cloze_text;

    form.cloze_text = originalText.substring(0, start) + text + originalText.substring(end);

    nextTick(() => {
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
    });
};

const scrollToAnswer = (n) => {
    const target = configInputRefs.value[n - 1]
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.focus()
        const parent = target.closest('.config-row')
        parent?.classList.add('highlight-flash')
        setTimeout(() => parent?.classList.remove('highlight-flash'), 1000)
    }
}

const openFloatImg = (url) => {
    floatImgUrl.value = url
    floatScale.value = 3 
}

const closeFloatImg = () => {
    floatImgUrl.value = null
}

const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    floatScale.value = Math.max(2, Math.min(5, floatScale.value + delta))
}

const startDrag = (e) => {
    if (e.target.classList.contains('close-float-mini')) return;
    isDragging.value = true;
    dragOffset.x = e.clientX - floatPos.x;
    dragOffset.y = e.clientY - floatPos.y;
    e.currentTarget.parentElement.style.opacity = '0.8';
    
    const onDrag = (e) => {
        if (!isDragging.value) return;
        floatPos.x = e.clientX - dragOffset.x;
        floatPos.y = e.clientY - dragOffset.y;
    };
    
    const stopDrag = () => {
        isDragging.value = false;
        const windowEl = document.querySelector('.float-img-window');
        if (windowEl) windowEl.style.opacity = '1';
        window.removeEventListener('mousemove', onDrag);
        window.removeEventListener('mouseup', stopDrag);
    };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
};

const toggleEditMode = (mode) => {
    editMode.value = mode
    if (mode === 'json' && !jsonInput.value) {
        jsonInput.value = jsonTemplate
    }
}

// 核心：单次 emit 批量数组的解析逻辑
const handleJsonImport = () => {
    try {
        const parsed = JSON.parse(jsonInput.value) // 统一读取用户键入的 jsonInput
        const quizzesArray = Array.isArray(parsed) ? parsed : [parsed]

        for (const [index, item] of quizzesArray.entries()) {
            if (!item.title || !item.cloze_text) {
                throw new Error(`第 ${index + 1} 篇短文缺少 title 或 cloze_text 字段！`)
            }
            if (!Array.isArray(item.answers) || item.answers.length === 0) {
                throw new Error(`第 ${index + 1} 篇短文《${item.title}》的 answers 必须是一个非空数组！`)
            }
        }
        
        const formattedQuizzes = quizzesArray.map(quiz => ({
            title: quiz.title.trim(),
            cloze_text: quiz.cloze_text,
            answers: quiz.answers.map(ans => String(ans).trim()),
            category: quiz.category || '短文填空'
        }))

        emit('batch-save', formattedQuizzes)
        isAdding.value = false
        jsonInput.value = ''
    } catch (err) {
        alert("⚠️ 格式解析失败：" + err.message)
    }
}

onMounted(() => {
    window.addEventListener('focus-gap', (e) => focusInput(e.detail - 1))
    window.addEventListener('scroll-to-ans', (e) => scrollToAnswer(e.detail))
    window.dispatchEvent(new CustomEvent('init-view'))
    window.addEventListener('open-float-img', (e) => openFloatImg(e.detail))
})

const insertImageTemplate = () => {
    const template = '![图片描述](这里粘贴图片URL)';
    form.cloze_text += `\n${template}\n`;
}

const renderedText = computed(() => {
    let text = isAdding.value ? form.cloze_text : (selectedQuiz.value?.cloze_text || '')
    if (!text) return '<p class="empty-hint">等待内容录入...</p>'

    text = text.replace(/!\[.*?\]\((.*?)\)/g,
        '<img src="$1" class="embedded-img" onclick="window.dispatchEvent(new CustomEvent(\'open-float-img\', {detail: \'$1\'}))" />')
    
    return text.replace(/\{\{(\d+)\}\}/g, (match, p1) => {
        const eventName = isAdding.value ? 'scroll-to-ans' : 'focus-gap'
        return `<span class="gap-pill" onclick="window.dispatchEvent(new CustomEvent('${eventName}', {detail: ${p1}}))">(${p1})</span>`
    })
})

const gapCount = computed(() => {
    const text = isAdding.value ? form.cloze_text : (selectedQuiz.value?.cloze_text || '')
    return (text.match(/\{\{(\d+)\}\}/g) || []).length
})

const isUserCorrect = (n) => {
    const correct = selectedQuiz.value?.answers[n]?.trim().toLowerCase()
    const user = userAnswers[n]?.trim().toLowerCase()
    return user === correct
}

const checkAnswers = () => {
    isChecked.value = true;
    if (document.activeElement) {
        document.activeElement.blur();
    }
}
</script>

<template>
    <div :class="['cloze-app-container', { 'is-full-screen': isFullScreen }]">
        <aside :class="['cloze-sidebar', { 'is-collapsed': listCollapsed }]">
            <div class="sidebar-inner-content">
                <div class="sidebar-header">
                    <div class="header-content">
                        <div class="icon-wrapper">📖</div>
                        <div class="title-text">
                            <h3>练习题库</h3>
                            <span class="sub-title">Quiz Library</span>
                        </div>
                    </div>
                    <button v-if="canEdit" class="add-btn" @click="startAdd">
                        <span class="plus-icon">＋</span>
                    </button>
                </div>

                <div class="sidebar-list scroll-y">
                    <div v-for="(q, idx) in quizzes" :key="q.id"
                        :class="['nav-item-card', { active: selectedQuiz?.id === q.id && !isAdding }]"
                        @click="openQuiz(q)">

                        <div class="card-main-content">
                            <div class="item-index-box">{{ String(idx + 1).padStart(2, '0') }}</div>
                            <div class="item-info">
                                <div class="item-title">{{ q.title }}</div>
                                <div class="item-meta">🧩 {{ (q.answers || []).length }} Gaps</div>
                            </div>
                        </div>

                        <div v-if="canEdit" class="item-actions">
                            <button class="action-btn edit" @click.stop="handleEdit(q)" title="修改">✎</button>
                            <button class="action-btn delete" @click.stop="emit('delete', q.id)" title="删除">🗑</button>
                        </div>
                    </div>
                </div>
            </div>

            <button class="toggle-trigger" @click="listCollapsed = !listCollapsed">
                <span class="arrow-icon">{{ listCollapsed ? '❯' : '❮' }}</span>
            </button>
        </aside>

        <main class="cloze-viewport">
            <button class="fullscreen-toggle-btn" :class="{ 'is-admin-hidden': isAdding || isEditing }"
                @click="handleToggleFull">
                {{ isFullScreen ? ' ↙' : ' ↗' }}
            </button>
            
            <div v-if="selectedQuiz && !isAdding" class="practice-layout">
                <div class="reading-section card-base animate-in">
                    <div class="section-top">
                        <div class="breadcrumb">Reading Passage</div>
                    </div>
                    <div class="reading-scroll scroll-y">
                        <div class="article-body" v-html="renderedText"></div>
                    </div>
                </div>

                <div class="answer-section animate-in" style="animation-delay: 0.1s">
                    <div class="answer-card card-base">
                        <div class="card-head">
                            <div class="title-wrap">
                                <span class="dot"></span>
                                <h4>答题卡</h4>
                            </div>
                            <div class="badge">{{ gapCount }} Gaps</div>
                        </div>

                        <div class="card-body scroll-y">
                            <div v-for="n in gapCount" :key="n" class="input-row">
                                <div :class="['input-wrapper', {
                                    'is-correct': isChecked && isUserCorrect(n - 1),
                                    'is-wrong': isChecked && !isUserCorrect(n - 1)
                                }]">
                                    <span class="input-prefix">({{ n }})</span>

                                    <input v-if="!isChecked || isUserCorrect(n - 1)" :ref="el => inputRefs[n - 1] = el"
                                        v-model="userAnswers[n - 1]" :disabled="isChecked" class="gap-input"
                                        :class="{ 'user-correct-text': isChecked && isUserCorrect(n - 1) }">

                                    <div v-else class="wrong-and-corrected-text">
                                        {{ selectedQuiz.answers[n - 1] }}
                                    </div>

                                    <div v-if="isChecked" class="status-indicator">
                                        <span v-if="isUserCorrect(n - 1)" class="icon-v">✓</span>
                                        <span v-else class="icon-x">✕</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card-foot">
                            <button v-if="!isChecked" class="btn-primary" @click="checkAnswers">核对答案</button>
                            <button v-else class="btn-secondary" @click="isChecked = false">重新练习</button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="isAdding" class="editor-layout animate-in">
                <div class="editor-top-bar">
                    <div class="editor-info">
                        <h2>{{ form.id ? '编辑练习' : '新增练习' }}</h2>
                        <div v-if="!form.id" class="mode-selector-tabs">
                            <button :class="['mode-tab-btn', { active: editMode === 'manual' }]" @click="toggleEditMode('manual')">✍️ 表单录入</button>
                            <button :class="['mode-tab-btn', { active: editMode === 'json' }]" @click="toggleEditMode('json')">⚡ JSON导入 </button>
                        </div>
                        <span v-else class="editor-tag">CLOZE EDITOR</span>
                    </div>
                    <div class="editor-actions">
                        <button class="btn-cancel" @click="isAdding = false">取消</button>
                        <button v-if="editMode === 'manual'" class="btn-save" @click="emit('save', { ...form })">保存题目</button>
                        <button v-else class="btn-save json-import-btn" :disabled="parsedJsonCount === 0" @click="handleJsonImport">🚀 批量导入</button>
                    </div>
                </div>

                <div v-if="editMode === 'manual'" class="editor-split-container">
                    <div class="editor-pane edit-area card-base">
                        <div class="pane-label">练习标题 (Title)</div>
                        <input v-model="form.title" class="title-input-field" placeholder="输入练习标题，例如：Unit 3 Grammar Focus" />
                        <div class="pane-label">
                            文章录入 (Markdown)
                            <span @click="insertImageTemplate" style="cursor:pointer; float:right;">🖼️ 插入图片</span>
                        </div>
                        <textarea ref="editorTextareaRef" v-model="form.cloze_text" @paste="handlePaste" placeholder="录入文章，用 {{1}} 表示第1个空格..." class="fancy-textarea"></textarea>

                        <div class="answer-config-panel">
                            <div class="pane-label">配置正确答案 ({{ gapCount }}个)</div>
                            <div class="answer-grid scroll-y">
                                <div v-for="n in gapCount" :key="n" class="config-row">
                                    <span class="index-tag">{{ n }}</span>
                                    <input :ref="el => configInputRefs[n - 1] = el" v-model="form.answers[n - 1]" class="config-input" placeholder="答案..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="editor-pane preview-area card-base">
                        <div class="pane-label">实时效果预览 (点击数字可定位左侧答案框)</div>
                        <div class="preview-content scroll-y">
                            <div class="article-body" v-html="renderedText"></div>
                        </div>
                    </div>
                </div>

                <div v-else class="json-editor-container card-base animate-in">
                    <div class="pane-label">
                        请在此粘贴包含标准字段的 JSON 数组结构
                        <span v-if="parsedJsonCount > 0" class="badge" style="float: none; margin-left: 10px; background: #f6ffed; color: #52c41a; border-color: #b7eb8f;">
                            已识别：{{ parsedJsonCount }} 篇短文
                        </span>
                        <span v-else class="badge" style="float: none; margin-left: 10px; background: #f5f5f5; color: #94a3b8; border-color: #d9d9d9;">
                            等待解析有效的数组...
                        </span>
                        <span class="format-tip">⚠️ 格式：必须是符合 JSON 规范的方括号 [ ] 数组包围</span>
                    </div>
                    <textarea 
                        v-model="jsonInput" 
                        class="json-textarea" 
                        placeholder="请在此粘贴 JSON 数据..."
                    ></textarea>
                </div>
            </div>
            
            <div v-else class="empty-state animate-in">
                <div class="empty-glass-card">
                    <div class="empty-illustration">
                        <div class="icon-circle">
                            <span class="main-icon">🌿</span>
                            <div class="sub-dot"></div>
                        </div>
                        <div class="floating-elements">
                            <span class="float-item t1">🧩</span>
                            <span class="float-item t2">✍️</span>
                            <span class="float-item t3">📖</span>
                        </div>
                    </div>
                    <div class="empty-text">
                        <h3>准备好开始了吗？</h3>
                        <p>从左侧题库挑选一个练习，或者开启一段新的知识录入</p>
                    </div>
                </div>
            </div>
        </main>

        <div v-if="floatImgUrl" class="float-img-window"
            :style="{ left: floatPos.x + 'px', top: floatPos.y + 'px', transform: `scale(${floatScale})` }"
            @wheel="handleWheel">
            <button class="close-float-mini" @click.stop="closeFloatImg" title="关闭预览">✕</button>
            <div class="drag-overlay" @mousedown="startDrag">
                <div class="drag-hint">⠿ DRAG</div>
            </div>
            <div class="float-body">
                <img :src="floatImgUrl" draggable="false" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* --- 布局与核心容器 --- */
.cloze-app-container {
    position: relative;
    display: flex;
    width: 100%;
    height: 100vh;
    background: #f8fafc;
    overflow: hidden;
}

/* 全屏沉浸模式 */
.cloze-app-container.is-full-screen {
    position: fixed !important;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2000;
    background: #ffffff !important;
}

.cloze-sidebar {
    position: relative;
    width: 280px;
    flex-shrink: 0;
    background: #fff;
    border-right: 1px solid #efefef;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 20;
}

.cloze-sidebar.is-collapsed {
    width: 0;
    border-right: none;
}

.sidebar-inner-content {
    width: 280px;
    height: 100%;
    overflow: hidden;
    transition: opacity 0.2s;
}

.is-collapsed .sidebar-inner-content {
    opacity: 0;
    pointer-events: none;
}

.sidebar-header {
    padding: 32px 20px 24px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(to bottom, #ffffff, #fcfdfe);
}

.header-content {
    display: flex;
    align-items: center;
    gap: 12px;
}

.header-content h3 {
    font-size: 17px;
    font-weight: 800;
    margin: 0;
    color: #1e293b;
    letter-spacing: 0.5px;
}

.sidebar-list {
    padding: 0 16px;
}

.nav-item-card {
    position: relative;
    padding: 16px;
    background: #fff;
    border: 1px solid #f1f5f9;
    border-radius: 16px;
    cursor: pointer;
    margin-bottom: 12px;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px; /* 确保内容区与操作按钮之间有安全间距 */
}

.nav-item-card:hover {
    background: #f8fafc;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    border-color: #e2e8f0;
}

.nav-item-card.active {
    background: #f6ffed;
    border: 2px solid #52c41a;
}

.item-info {
    flex: 1;        /* 关键：让文字容器充满主内容区 */
    min-width: 0;   /* 关键：防止文字撑破父容器 */
}

.card-main-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;        /* 关键：让内容区占据除按钮外的剩余全部空间 */
    min-width: 0;   /* 关键：允许 Flex 子元素缩小，触发内部文字的 ellipsis 省略号 */
}

.item-index-box {
    font-size: 11px;
    font-weight: 900;
    color: #cbd5e1;
    background: #f8fafc;
    padding: 4px 8px;
    border-radius: 6px;
    flex-shrink: 0; /* 防止数字盒子被压缩 */
}

.active .item-index-box {
    color: #52c41a;
    background: #fff;
}

.item-title {
    font-size: 14px;
    font-weight: 800;
    color: #334155;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis; /* 超出部分自动变省略号 */
    width: 100%;             /* 铺满父级 */
}

.item-meta {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
}

.item-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: 0.2s;
    flex-shrink: 0; /* 关键：强行保护按钮，绝对不允许被挤压或缩小 */
}

.nav-item-card:hover .item-actions {
    opacity: 1;
}

/* --- 按钮通用样式 --- */
.action-btn, .add-btn, .btn-primary, .btn-secondary, .close-float, .fullscreen-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
}

.action-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: #fff;
    color: #64748b;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.action-btn:hover {
    background: #1e293b;
    color: #fff;
}

.action-btn.delete:hover {
    background: #ef4444;
}

.add-btn {
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    border: none;
    background: #1e293b;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(30, 41, 59, 0.2);
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.add-btn .plus-icon {
    font-size: 20px;
    font-weight: 300;
    line-height: 1;
    transition: transform 0.4s;
}

.add-btn:hover {
    background: #22c55e;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(34, 197, 94, 0.3);
}

.add-btn:hover .plus-icon {
    transform: rotate(90deg);
}

.add-btn:active {
    transform: scale(0.92);
}

.add-btn::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transform: rotate(45deg);
    transition: 0.6s;
}

.add-btn:hover::after {
    left: 100%;
}

/* --- 核心提交与切换按钮（合并去重） --- */
.btn-primary, .btn-secondary {
    width: 100%;
    height: 40px;
    font-size: 14px;
    font-weight: 800;
    border-radius: 14px;
    box-sizing: border-box;
}

.btn-primary {
    background: #1e293b;
    color: #fff;
    border: none;
}

.btn-primary:hover {
    background: #52c41a;
    transform: translateY(-2px);
}

.btn-secondary {
    background: #fff;
    color: #64748b;
    border: 2px solid #f1f5f9;
}

.btn-secondary:active {
    padding-bottom: 1px;
}

.toggle-trigger {
    position: absolute;
    left: 100%;
    top: 30px;
    transform: translateX(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid #e1f3d8;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 30;
    box-shadow: 0 2px 8px rgba(82, 196, 26, 0.15);
    transition: all 0.2s ease;
}

.toggle-trigger .arrow-icon {
    font-size: 10px;
    color: #52c41a;
    font-weight: bold;
}

.is-collapsed .toggle-trigger {
    left: 15px;
    transform: none;
}

.toggle-trigger:hover {
    border-color: #52c41a;
    background: #f6ffed;
}

.is-full-screen .toggle-trigger {
    display: none;
}

/* --- 视图与主工作区 --- */
.cloze-viewport {
    flex: 1;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-sizing: border-box;
    overflow: hidden;
}

.is-collapsed + .cloze-viewport {
    padding-left: 50px;
}

.practice-layout {
    display: flex;
    gap: 20px;
    flex: 1;
    min-height: 0;
}

.card-base {
    background: #fff;
    border: 1px solid #f1f5f9;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
}

/* --- 阅读文章区域 --- */
.reading-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.section-top {
    padding: 20px 40px;
    border-bottom: 1px solid #f8fafc;
}

.breadcrumb {
    font-size: 11px;
    font-weight: 700;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.reading-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 30px 50px;
}

.article-body {
    font-size: 19px;
    line-height: 2.2;
    color: #334155;
    white-space: pre-wrap;
    word-break: break-word;
}

.is-full-screen .article-body {
    max-width: 900px;
    margin: 0 auto;
    font-size: 22px;
    line-height: 2;
}

/* --- 答题交互卡片 --- */
.answer-section {
    width: 280px;
    flex-shrink: 0;
    display: flex;
}

.answer-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.card-head {
    padding: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f8fafc;
}

.title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
}

.dot {
    width: 8px;
    height: 8px;
    background: #52c41a;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(82, 196, 26, 0.3);
}

.badge {
    font-size: 12px;
    background: #f6ffed;
    color: #52c41a;
    border: 1px solid #b7eb8f;
    padding: 3px 12px;
    border-radius: 20px;
    font-weight: 700;
}

.card-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}

.card-foot {
    padding: 12px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* --- 输入框反馈状态 --- */
.input-row {
    margin-bottom: 12px;
}

.input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 2px solid #f1f5f9;
    border-radius: 14px;
    padding: 2px 16px;
    min-height: 44px;
    transition: background-color 0.3s, border-color 0.3s, box-shadow 0.2s;
}

.input-wrapper:focus-within {
    background: #fff;
    border-color: #52c41a;
    box-shadow: 0 4px 12px rgba(82, 196, 26, 0.08);
}

.input-wrapper.is-correct {
    background: #f0fff4;
    border-color: #9ae6b4;
}

.input-wrapper.is-wrong {
    background: #fff5f5;
    border-color: #feb2b2;
}

.gap-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 10px 0;
    font-size: 14px;
    font-weight: 700;
    color: #334155;
    outline: none;
}

.gap-input:disabled {
    cursor: default;
    background: transparent;
}

.user-correct-text {
    color: #38a169 !important;
    -webkit-text-fill-color: #38a169;
    opacity: 1 !important;
}

.wrong-and-corrected-text {
    flex: 1;
    color: #e53e3e;
    font-size: 14px;
    font-weight: 800;
    padding: 10px 0;
    animation: fadeInFast 0.3s ease-out;
}

.status-indicator {
    margin-left: 8px;
    font-size: 16px;
    font-weight: bold;
}

.icon-v { color: #52c41a; }
.icon-x { color: #ff4d4f; }

/* --- 文内挖空/小药丸 --- */
:deep(.gap-pill) {
    background: #f8fafc;
    padding: 2px 10px;
    border-radius: 8px;
    font-weight: 800;
    cursor: pointer;
    margin: 0 4px;
    border: 1px solid #e2e8f0;
    transition: 0.2s;
}

:deep(.gap-pill:hover) {
    background: #52c41a;
    color: #fff;
    border-color: #52c41a;
}

/* --- 编辑器与管理面板 --- */
.editor-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 16px;
    overflow: hidden;
}

.editor-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 10px;
}

.editor-info h2 {
    font-size: 20px;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
}

.editor-tag {
    font-size: 11px;
    color: #52c41a;
    background: #f6ffed;
    padding: 2px 8px;
    border-radius: 6px;
    display: inline-block;
    margin-top: 4px;
    font-weight: 700;
}

.editor-actions {
    display: flex;
    gap: 12px;
}

.btn-cancel {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-weight: 700;
    cursor: pointer;
}

.btn-save {
    background: #1e293b;
    color: #fff;
    border: none;
    padding: 10px 24px;
    border-radius: 12px;
    font-weight: 700;
    transition: 0.2s;
}

.btn-save:hover {
    background: #52c41a;
    transform: translateY(-2px);
}

.editor-split-container {
    display: flex;
    gap: 20px;
    flex: 1;
    min-height: 0;
}

.editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
}

.editor-pane.edit-area, .editor-pane.preview-area {
    overflow: hidden;
}

.pane-label {
    padding: 12px 20px;
    font-size: 11px;
    font-weight: 800;
    color: #cbd5e1;
    text-transform: uppercase;
    border-bottom: 1px solid #f1f5f9;
}

.fancy-textarea {
    flex: 1;
    border: none;
    padding: 20px;
    font-size: 16px;
    line-height: 1.8;
    color: #334155;
    resize: none;
    outline: none;
    background: #fafafa;
}

.title-input-field {
    width: 100%;
    border: none;
    padding: 12px 20px;
    font-size: 15px;
    font-weight: 700;
    outline: none;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
}

.title-input-field::placeholder {
    color: #cbd5e1;
    font-weight: 400;
}

.title-input-field:focus {
    background: #fcfdfe;
}

.preview-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 30px;
    background: #fff;
}

.preview-area .article-body {
    font-size: 17px;
    line-height: 1.8;
}

/* 答案配置面板 */
.answer-config-panel {
    height: 40%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-top: 1px solid #f1f5f9;
}

.answer-grid {
    flex: 1;
    overflow-y: auto;
}

.config-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #fff;
    padding: 8px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;
}

.config-input {
    flex: 1;
    border: 1px solid #edf2f7;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
}

.config-input:focus {
    border-color: #52c41a;
}

.config-input.auto-height {
    resize: vertical;
    min-height: 36px;
    line-height: 1.5;
    padding-top: 8px;
    white-space: pre-wrap;
}

.index-tag {
    width: 24px;
    height: 24px;
    background: #1e293b;
    color: #fff;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
}

/* --- JSON 录入模式 --- */
.mode-selector-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 10px;
    margin-left: 20px;
    vertical-align: middle;
}

.mode-tab-btn {
    padding: 6px 14px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    color: #64748b;
}

.mode-tab-btn.active {
    background: #fff;
    color: #52c41a;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.json-editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: #fff;
}

.json-textarea {
    flex: 1;
    border: none;
    padding: 24px;
    font-family: 'Fira Code', 'Courier New', Courier, monospace;
    font-size: 14px;
    line-height: 1.6;
    color: #0f172a;
    background: #f8fafc;
    resize: none;
    outline: none;
}

.format-tip {
    float: right;
    color: #94a3b8;
    font-weight: normal;
    text-transform: none;
}

.json-import-btn {
    background: #52c41a !important;
}

.json-import-btn:hover {
    background: #389e0d !important;
}

/* --- 全屏与浮动工具按钮 --- */
.fullscreen-toggle-btn {
    position: absolute;
    top: 25px;
    right: 35px;
    width: 25px;
    height: 25px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    color: #64748b;
    font-size: 13px;
    z-index: 100;
}

.fullscreen-toggle-btn:hover {
    background: #fff;
    color: #52c41a;
    border-color: #52c41a;
    box-shadow: 0 4px 12px rgba(82, 196, 26, 0.15);
    transform: translateY(-2px);
}

.fullscreen-toggle-btn.is-admin-hidden {
    display: none !important;
}

.icon-wrapper {
    font-size: 20px;
    background: #f1f5f9;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
}

/* --- 悬浮图片窗口组件 --- */
.float-img-window {
    position: fixed;
    z-index: 9999;
    width: 180px;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    transform-origin: center;
    transition: transform 0.1s ease-out, box-shadow 0.3s ease;
    border: 1px solid rgba(0, 0, 0, 0.08);
}

.float-img-window:hover {
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
}

.float-controls {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 32px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.2);
    opacity: 0;
    transition: opacity 0.2s;
    cursor: move;
    z-index: 100;
    box-sizing: border-box;
}

.float-img-window:hover .float-controls {
    opacity: 1;
}

.close-float-mini {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.9);
    font-size: 5px;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
}

.float-img-window:hover .close-float-mini {
    opacity: 1;
    transform: scale(1);
}

.close-float-mini:hover {
    background: #ef4444;
    color: #fff;
    transform: scale(1.1);
}

.float-body {
    width: 100%;
    line-height: 0;
}

.float-body img {
    width: 100%;
    height: auto;
    display: block;
    vertical-align: middle;
}

.drag-overlay {
    position: absolute;
    all: 0;
    background: transparent;
    cursor: move;
    z-index: 100;
}

.drag-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.float-img-window:active .drag-hint {
    opacity: 1;
}

:deep(.embedded-img) {
    cursor: zoom-in;
    transition: 0.3s;
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    margin: 10px 0;
    display: block;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

:deep(.embedded-img:hover) {
    filter: brightness(0.9);
    outline: 3px solid #52c41a;
}

/* --- 空状态与动画特效 --- */
.empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at center, #f0fdf4 0%, #fdfdfd 100%);
}

.empty-glass-card {
    text-align: center;
    padding: 60px 80px;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(10px);
    border-radius: 40px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.02);
}

.empty-illustration {
    position: relative;
    width: 120px;
    height: 120px;
    margin: 0 auto 30px;
}

.icon-circle {
    width: 100%;
    height: 100%;
    background: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 50px;
    box-shadow: 0 10px 25px rgba(82, 196, 26, 0.15);
    position: relative;
    z-index: 2;
}

.sub-dot {
    position: absolute;
    bottom: 5px;
    right: 5px;
    width: 24px;
    height: 24px;
    background: #52c41a;
    border: 4px solid #fff;
    border-radius: 50%;
}

.floating-elements .float-item {
    position: absolute;
    font-size: 24px;
    z-index: 1;
    animation: float 3s ease-in-out infinite;
}

.t1 { top: -5px; left: -75px; animation-delay: 0s !important; }
.t2 { top: 20px; right: -60px; animation-delay: 0.5s !important; }
.t3 { bottom: -20px; left: -50px; animation-delay: 1s !important; }

.title-text {
    display: flex;
    flex-direction: column;
}

.sub-title {
    font-size: 10px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 2px;
}

.empty-text h3 {
    font-size: 22px;
    font-weight: 800;
    color: #1e293b;
    margin: 0 0 10px 0;
}

.empty-text p {
    font-size: 14px;
    color: #94a3b8;
    max-width: 240px;
    line-height: 1.6;
    margin: 0 auto;
}

.highlight-flash {
    animation: flash-green 1s ease;
    border-color: #52c41a !important;
    background: #f6ffed !important;
    box-shadow: 0 0 10px rgba(82, 196, 26, 0.2);
}

.animate-in {
    animation: slideIn 0.4s ease-out both;
}

/* --- 自定义滚动条 --- */
.scroll-y::-webkit-scrollbar {
    width: 4px;
}

.scroll-y::-webkit-scrollbar-track {
    background: transparent;
}

.scroll-y::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
}

.scroll-y:hover::-webkit-scrollbar-thumb {
    background: #cbd5e1;
}

/* --- 关键帧动画 --- */
@keyframes slideIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes float {
    0%, 100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-15px) rotate(10deg); }
}

@keyframes flash-green {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

@keyframes fadeInFast {
    from { opacity: 0; transform: translateY(2px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
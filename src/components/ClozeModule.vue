<script setup>
import { ref, computed, reactive, onMounted, nextTick } from 'vue'

const props = defineProps({
    quizzes: { type: Array, default: () => [] },
    canEdit: { type: Boolean, default: true },
    isFullScreen: { type: Boolean, default: false } // 接收父组件传入的全屏状态
})

const emit = defineEmits(['save', 'delete', 'toggleFull']) // 增加 toggleFull 事件
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
const floatScale = ref(1)
const isDragging = ref(false)
let dragOffset = { x: 0, y: 0 }
// 定义 ref 绑定到 DOM
const editorTextareaRef = ref(null)
const handleToggleFull = () => {
    emit('toggleFull')
}

const form = reactive({
    id: null,
    cloze_text: '',
    title: '', // 1. 确保初始值有 title
    answers: [],
    category: '短文填空'
})

// --- 逻辑处理 ---
const startAdd = () => {
    selectedQuiz.value = null
    isAdding.value = true
    // 2. 重置时清空 title
    Object.assign(form, { id: null, title: '', cloze_text: '', answers: [], category: '短文填空' })
}

const openQuiz = (q) => {
    isAdding.value = false
    selectedQuiz.value = q
    isChecked.value = false
    Object.keys(userAnswers).forEach(k => delete userAnswers[k])
}

// 修改功能逻辑
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
        // 检查是否为图片
        if (item.type.indexOf('image') !== -1) {
            event.preventDefault(); // 只有是图片时才阻止默认行为，避免干扰普通文本粘贴
            const blob = item.getAsFile();
            const reader = new FileReader();

            reader.onload = (e) => {
                const base64 = e.target.result;
                // 自动换行包裹图片，体验更好
                insertTextAtCursor(`\n![图片](${base64})\n`);
            };
            reader.readAsDataURL(blob);
        }
    }
};

const insertTextAtCursor = (text) => {
    const el = editorTextareaRef.value; // 使用 ref 获取 DOM
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const originalText = form.cloze_text;

    // 更新响应式数据
    form.cloze_text = originalText.substring(0, start) + text + originalText.substring(end);

    // 必须在下一次 DOM 更新后恢复光标位置
    nextTick(() => {
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
    });
};

const scrollToAnswer = (n) => {
    const target = configInputRefs.value[n - 1]
    if (target) {
        // 1. 平滑滚动到视野中心
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 2. 自动聚焦
        target.focus()
        // 3. 触发瞬间高亮动画（通过增加临时 class）
        const parent = target.closest('.config-row')
        parent?.classList.add('highlight-flash')
        setTimeout(() => parent?.classList.remove('highlight-flash'), 1000)
    }
}

const openFloatImg = (url) => {
    floatImgUrl.value = url
    floatScale.value = 1 // 重置缩放
}

const closeFloatImg = () => {
    floatImgUrl.value = null
}

// 缩放处理
const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    floatScale.value = Math.max(0.2, Math.min(3, floatScale.value + delta))
}

// 拖拽处理
const startDrag = (e) => {
    // 排除掉点击关闭按钮的触发
    if (e.target.classList.contains('close-float-mini')) return;
    isDragging.value = true;
    dragOffset.x = e.clientX - floatPos.x;
    dragOffset.y = e.clientY - floatPos.y;
    // 拖动时增加一点透明度反馈
    e.currentTarget.parentElement.style.opacity = '0.8';
    const onDrag = (e) => {
        if (!isDragging.value) return;
        floatPos.x = e.clientX - dragOffset.x;
        floatPos.y = e.clientY - dragOffset.y;
    };
    const stopDrag = () => {
        isDragging.value = false;
        document.querySelector('.float-img-window').style.opacity = '1';
        window.removeEventListener('mousemove', onDrag);
        window.removeEventListener('mouseup', stopDrag);
    };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
};
const onDrag = (e) => {
    if (!isDragging.value) return
    floatPos.x = e.clientX - dragOffset.x
    floatPos.y = e.clientY - dragOffset.y
}

const stopDrag = () => {
    isDragging.value = false
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', stopDrag)
}

onMounted(() => {
    window.addEventListener('focus-gap', (e) => focusInput(e.detail - 1))
    window.addEventListener('scroll-to-ans', (e) => scrollToAnswer(e.detail))
    window.dispatchEvent(new CustomEvent('init-view'))
    window.addEventListener('open-float-img', (e) => openFloatImg(e.detail))
})

const insertImageTemplate = () => {
    const template = '![图片描述](这里粘贴图片URL)';
    // 简单实现：直接加在末尾
    form.cloze_text += `\n${template}\n`;
    // 高级实现建议使用 textarea 的 selectionStart 获取光标位置插入
}

// 修改 renderedText 的事件派发逻辑
const renderedText = computed(() => {
    let text = isAdding.value ? form.cloze_text : (selectedQuiz.value?.cloze_text || '')
    if (!text) return '<p class="empty-hint">等待内容录入...</p>'

    // 1. 先处理图片 Markdown: ![alt](url) -> <img src="url" />
    // 找到 renderedText 里的 replace 部分，添加 onclick
    text = text.replace(/!\[.*?\]\((.*?)\)/g,
        '<img src="$1" class="embedded-img" onclick="window.dispatchEvent(new CustomEvent(\'open-float-img\', {detail: \'$1\'}))" />')
    // 2. 再处理填空占位符 {{n}}
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
    // 强制失去焦点，让所有的 input 样式统一渲染
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
                                <div class="item-title">{{ q.title}}</div>
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
             <button class="fullscreen-toggle-btn" :class="{ 'is-admin-hidden': isAdding || isEditing }" @click="handleToggleFull">
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
                        <span class="editor-tag">CLOZE EDITOR</span>
                    </div>
                    <div class="editor-actions">
                        <button class="btn-cancel" @click="isAdding = false">取消</button>
                        <button class="btn-save" @click="emit('save', { ...form })">保存题目</button>
                    </div>
                </div>
                <div class="editor-split-container">
                    <div class="editor-pane edit-area card-base">
                        <div class="pane-label">练习标题 (Title)</div>
                        <input v-model="form.title" class="title-input-field"
                            placeholder="输入练习标题，例如：Unit 3 Grammar Focus" />
                        <div class="pane-label">
                            文章录入 (Markdown)
                            <span @click="insertImageTemplate" style="cursor:pointer; float:right;">🖼️ 插入图片</span>
                        </div>
                        <textarea ref="editorTextareaRef" v-model="form.cloze_text" @paste="handlePaste"
                            placeholder="录入文章，用 {{1}} 表示第1个空格..." class="fancy-textarea"></textarea>

                        <div class="answer-config-panel">
                            <div class="pane-label">配置正确答案 ({{ gapCount }}个)</div>
                            <div class="answer-grid scroll-y" style="flex: 1; overflow-y: auto;">
                                <div v-for="n in gapCount" :key="n" class="config-row">
                                    <span class="index-tag">{{ n }}</span>
                                    <input :ref="el => configInputRefs[n - 1] = el" v-model="form.answers[n - 1]"
                                        class="config-input" placeholder="答案..." />
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

            <div class="float-controls" @mousedown="startDrag">
                <div class="drag-hint">⠿ DRAG</div>
                <button class="close-float-mini" @click="closeFloatImg">✕</button>
                <div class="zoom-badge">{{ Math.round(floatScale * 100) }}%</div>
            </div>

            <div class="float-body">
                <img :src="floatImgUrl" draggable="false" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 容器保持不变 */
.cloze-app-container {
    position: relative;
    display: flex;
    width: 100%;
    height: 100vh;
    background: #f8fafc;
    overflow: hidden;
}

/* 侧边栏基础结构保持不变 */
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

/* --- 侧边栏列表改动：匹配阅读模块二级菜单卡片 --- */
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
}

.edit-area {
    display: flex;
    flex-direction: column;
    flex: 1;
}

.nav-item-card:hover {
    background: #f8fafc;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    border-color: #e2e8f0;
}

.nav-item-card.active {
    background: #f6ffed;
    border-color: #52c41a;
    border-width: 2px;
}

.card-main-content {
    display: flex;
    align-items: center;
    gap: 12px;
}

.item-index-box {
    font-size: 11px;
    font-weight: 900;
    color: #cbd5e1;
    background: #f8fafc;
    padding: 4px 8px;
    border-radius: 6px;
}

.active .item-index-box {
    color: #52c41a;
    background: #fff;
}

.item-title {
    font-size: 13px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 2px;
}

.item-meta {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
}

/* 管理按钮样式：默认隐藏，Hover显示 */
.item-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: 0.2s;
}

.nav-item-card:hover .item-actions {
    opacity: 1;
}

.action-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: #fff;
    color: #64748b;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
}

.action-btn:hover {
    background: #1e293b;
    color: #fff;
}

.action-btn.delete:hover {
    background: #ef4444;
}

/* 切换按钮及主视图样式（保持原有绿色主题） */
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

.cloze-viewport {
    flex: 1;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-sizing: border-box;
    overflow: hidden;
    /* 禁止视口产生滚动条 */
}

.is-collapsed+.cloze-viewport {
    padding-left: 50px;
}

.practice-layout {
    display: flex;
    gap: 20px;
    flex: 1;
    /* 占用 viewport 剩余所有空间 */
    min-height: 0;
    /* 极其重要：允许子元素收缩，防止被内容撑开 */
}

.card-base {
    background: #fff;
    border: 1px solid #f1f5f9;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
}

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
    /* 核心：吸收剩余高度 */
    overflow-y: auto;
    padding: 30px 50px;
}

.article-body {
    font-size: 19px;
    line-height: 2.2;
    color: #334155;
}

.answer-section {
    width: 280px;
    flex-shrink: 0;
    display: flex;
}

.answer-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    /* 纵向排列 Head, Body, Foot */
    min-height: 0;
    /* 极其重要 */
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

.input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 2px solid #f1f5f9;
    border-radius: 14px;
    padding: 2px 16px;
    transition: all 0.2s ease;
}

.input-wrapper:focus-within {
    background: #fff;
    border-color: #52c41a;
    box-shadow: 0 4px 12px rgba(82, 196, 26, 0.08);
}

/* 5. 缩小按钮尺寸 */
.btn-primary,
.btn-secondary {
    height: 40px;
    /* 固定高度，紧凑感 */
    padding: 0;
    font-size: 14px;
    border-radius: 10px;
}


.gap-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 10px 0;
    /* 减小输入框上下内边距 */
    font-size: 14px;
    font-weight: 700;
    color: #334155;
    outline: none;
}

.card-body {
    flex: 1;
    /* 核心：让答案列表吸收所有剩余高度 */
    overflow-y: auto;
    /* 这里是唯一的滚动点 */
    padding: 16px;
}

/* 4. 锁定底部，减小 Padding */
.card-foot {
    padding: 12px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px; /* 确保按钮之间有间距 */
}

/* 修正了之前过大的 padding */
.btn-primary {
    width: 100%;
    padding: 10px;
    background: #1e293b;
    color: #fff;
    border: none;
    border-radius: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: 0.2s;
}

.btn-primary:hover {
    background: #52c41a;
    transform: translateY(-2px);
}

.btn-secondary {
    width: 100%;
    padding: 15px;
    background: #fff;
    color: #64748b;
    border: 2px solid #f1f5f9;
    border-radius: 14px;
    font-weight: 800;
    cursor: pointer;
}

/* 统一基础样式 */
.btn-primary,
.btn-secondary {
    width: 100%;
    height: 40px;
    
    /* 核心对齐修复 */
    display: flex;
    align-items: center;      /* 垂直居中 */
    justify-content: center;   /* 水平居中 */
    line-height: 1;           /* 消除行高干扰 */
    
    font-size: 14px;
    font-weight: 800;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
    box-sizing: border-box;    /* 极其重要：确保边框不撑大高度 */
}

/* 核对答案按钮 */
.btn-primary {
    background: #1e293b;
    color: #fff;
    border: none;
}

/* 重新练习按钮 */
.btn-secondary {
    background: #fff;
    color: #64748b;
    border: 2px solid #f1f5f9; /* 2px边框会被 box-sizing 包含在40px内 */
    padding: 0;                /* 移除可能的默认内边距 */
}

/* 视觉微调：如果字体本身导致偏下，可以加一个极小的负偏移 */
.btn-secondary:active, .btn-secondary {
    padding-bottom: 1px; /* 有时字体的渲染基准线偏上，可以微调 padding */
}

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

.add-btn {
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    border: none;
    background: #1e293b;
    /* 深色主题 */
    color: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 4px 12px rgba(30, 41, 59, 0.2);
    overflow: hidden;
}

.add-btn .plus-icon {
    font-size: 20px;
    font-weight: 300;
    line-height: 1;
    transition: transform 0.4s;
}

.scroll-y::-webkit-scrollbar {
    width: 4px;
}

.scroll-y::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
}

.animate-in {
    animation: slideIn 0.4s ease-out both;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(12px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 悬停动效：背景变色、旋转、阴影增强 */
.add-btn:hover {
    background: #22c55e;
    /* 悬停变为充满生机的绿色 */
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(34, 197, 94, 0.3);
}

.add-btn:hover .plus-icon {
    transform: rotate(90deg);
}

/* 点击时的波纹感缩放 */
.add-btn:active {
    transform: translateY(0) scale(0.92);
}

/* 装饰性光晕 */
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

/* --- 管理员编辑器专用样式 (仅影响 isAdding 状态) --- */
.editor-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
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
    cursor: pointer;
    transition: 0.2s;
}

.btn-save:hover {
    background: #52c41a;
    transform: translateY(-2px);
}

.editor-split-container {
    flex: 1;
    display: flex;
    gap: 20px;
    min-height: 0;
    /* 防止编辑器撑开整页 */
}

.editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
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
    min-height: 0;
    /* 允许 textarea 在 flex 下收缩 */
    overflow-y: auto;
}

.fancy-textarea {
    flex: 2;
    /* 给予文本框更多空间 */
    min-height: 200px;
}

.preview-content {
    flex: 1;
    padding: 20px 30px;
    background: #fff;
}

/* 确保预览时的 article-body 缩放比例适中 */
.preview-area .article-body {
    font-size: 17px;
    opacity: 0.9;
}

/* --- 管理员编辑器专用样式 (仅影响 isAdding 状态) --- */
.editor-layout {
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
    cursor: pointer;
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
    /* 关键：防止 flex 容器被撑开 */
}

.editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
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

.preview-content {
    flex: 1;
    padding: 20px 30px;
    background: #fff;
}

/* 确保预览时的 article-body 缩放比例适中 */
.preview-area .article-body {
    font-size: 17px;
    opacity: 0.9;
}

/* --- 优化后的空状态样式 --- */
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

/* 漂浮装饰元素动画 */
.floating-elements .float-item {
    position: absolute;
    font-size: 24px;
    z-index: 1;
    animation: float 3s ease-in-out infinite;
}

.t1 {
    top: -5px;
    left: -75px;
    animation-delay: 0s !important;
}

.t2 {
    top: 20px;
    right: -60px;
    animation-delay: 0.5s !important;
}

.title-text {
    display: flex;
    flex-direction: column;
}

.t3 {
    bottom: -20px;
    left: -50px;
    animation-delay: 1s !important;
}

.sub-title {
    font-size: 10px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 2px;
}

@keyframes float {

    0%,
    100% {
        transform: translateY(0) rotate(0);
    }

    50% {
        transform: translateY(-15px) rotate(10deg);
    }
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

/* 管理员答案配置面板 */
.answer-config-panel {
    height: 40%;
    /* 或者使用 flex: 0.8 */
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.border-top {
    border-top: 1px solid #f1f5f9;
}

.answer-grid {
    flex: 1;
    overflow-y: auto;
    /* 答案过长时在此内部滚动 */
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

/* 高亮闪烁动画 */
.highlight-flash {
    animation: flash-green 1s ease;
    border-color: #52c41a !important;
    background: #f6ffed !important;
    box-shadow: 0 0 10px rgba(82, 196, 26, 0.2);
}

@keyframes flash-green {
    0% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.05);
    }

    100% {
        transform: scale(1);
    }
}

/* 只有在鼠标悬停在滚动区域时才显示滚动条，或者干脆做得极细 */
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

.config-input.auto-height {
    resize: vertical;
    /* 允许手动拉伸高度 */
    min-height: 36px;
    line-height: 1.5;
    padding-top: 8px;
    white-space: pre-wrap;
    /* 核心：保留换行符 */
}

:deep(.embedded-img) {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    margin: 10px 0;
    display: block;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 找到 .article-body，添加以下属性 */
.article-body {
    font-size: 19px;
    line-height: 2.2;
    color: #334155;

    /* 核心修改：保留空格和换行符 */
    white-space: pre-wrap;
    word-break: break-word;
    /* 防止长单词撑破布局 */
}

/* 浮动窗口基础样式 */
.float-img-window {
    position: fixed;
    z-index: 9999;
    width: 350px;
    /* 初始宽度 */
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border: 1px solid #e2e8f0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform 0.1s ease-out;
    /* 缩放时更丝滑 */
}

.float-header {
    padding: 8px 12px;
    background: #1e293b;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
    /* 提示可拖拽 */
    user-select: none;
}

.drag-handle {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
}

.close-float {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    cursor: pointer;
    transition: 0.2s;
}

.close-float:hover {
    background: #ef4444;
}

.float-footer {
    padding: 4px 12px;
    font-size: 10px;
    color: #94a3b8;
    background: #fff;
    border-top: 1px solid #f1f5f9;
    text-align: right;
    font-weight: bold;
}

/* 增强原有的图片样式，增加点击提示 */
:deep(.embedded-img) {
    cursor: zoom-in;
    transition: 0.3s;
}

:deep(.embedded-img:hover) {
    filter: brightness(0.9);
    outline: 3px solid #52c41a;
}

/* 极简容器 */
.float-img-window {
    position: fixed;
    z-index: 9999;
    width: 320px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    /* 保证图片圆角 */
    transition: transform 0.1s ease-out, box-shadow 0.3s;
    border: 1px solid rgba(0, 0, 0, 0.05);
}

.float-img-window:hover {
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
}

/* 悬浮操作层：默认透明 */
.float-controls {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0;
    background: rgba(0, 0, 0, 0.1);
    /* 淡淡的遮罩感 */
    transition: opacity 0.2s;
    cursor: move;
    z-index: 10;
}

.float-img-window:hover .float-controls {
    opacity: 1;
}

/* 拖拽文字提示 */
.drag-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 2px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    pointer-events: none;
}

/* 迷你关闭按钮 */
.close-float-mini {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: 0.2s;
}

.close-float-mini:hover {
    background: #ff4d4f;
    color: #fff;
    transform: scale(1.1);
}

/* 缩放比例标牌 */
.zoom-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 2px 8px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border-radius: 4px;
    font-size: 10px;
    font-family: monospace;
}

.float-body {
    width: 100%;
    line-height: 0;
    /* 消除图片下方的微小间隙 */
}

.float-body img {
    width: 100%;
    height: auto;
    display: block;
}

/* --- 优化后的答题卡反馈样式 --- */

/* 1. 调整容器，为弹出层提供定位基准 */
.input-row {
    margin-bottom: 12px;
    /* 稍微增加间距给气泡留空间 */
}

/* 2. 错误状态下的输入框 */
.input-wrapper.is-wrong {
    border-color: #fecaca;
    /* 浅红色边框 */
    background: #fff;
    /* 保持白色，避免太花哨 */
}

/* 5. 状态图标动画 */
.status-indicator {
    margin-left: 8px;
    font-size: 16px;
    font-weight: bold;
}

.ans-label {
    font-size: 10px;
    color: #ef4444;
    font-weight: 800;
    text-transform: uppercase;
    margin-right: 6px;
    opacity: 0.7;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-5px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.icon-v {
    color: #52c41a;
}

.icon-x {
    color: #ff4d4f;
}

/* 弹出动画 */
@keyframes popIn {
    from {
        opacity: 0;
        transform: translateY(10px) scale(0.95);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* 6. 正确状态的小优化 */
.input-wrapper.is-correct {
    border-color: #52c41a;
    background: #f6ffed;
}

/* 修改输入框基础容器，增加过渡效果 */
.input-wrapper {
    min-height: 44px;
    transition: background-color 0.3s, border-color 0.3s;
}

/* 答错时的容器：背景给极浅的红，衬托红色的字 */
.input-wrapper.is-wrong {
    background: #fff5f5;
    border-color: #feb2b2;
}

/* 答错后显示的正确答案文本：醒目的红色 */
.wrong-and-corrected-text {
    flex: 1;
    color: #e53e3e;
    /* 强烈的红色提示纠错 */
    font-size: 14px;
    font-weight: 800;
    padding: 10px 0;
    animation: fadeInFast 0.3s ease-out;
}

/* 答对时的输入框：文字可以变成深绿色或保持原样 */
.user-correct-text {
    color: #38a169 !important;
    /* 答对了变成深绿色 */
    -webkit-text-fill-color: #38a169;
    /* 兼容部分浏览器禁用的 input 颜色 */
    opacity: 1 !important;
    /* 确保禁用后颜色依然清晰 */
}

/* 答对时的容器背景 */
.input-wrapper.is-correct {
    background: #f0fff4;
    border-color: #9ae6b4;
}

/* 快速淡入动画 */
@keyframes fadeInFast {
    from {
        opacity: 0;
        transform: translateY(2px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 禁用状态下的 input 默认颜色修复 (针对 Chrome) */
.gap-input:disabled {
    cursor: default;
    background: transparent;
}
.title-input-field {
    width: 100%;
    border: none;
    padding: 15px 20px;
    font-size: 18px;
    font-weight: 800;
    color: #1e293b;
    outline: none;
    background: #fff;
}

.title-input-field::placeholder {
    color: #cbd5e1;
    font-weight: 400;
}

/* 侧边栏标题显示优化 */
.item-title {
    font-size: 14px;
    font-weight: 800;
    color: #334155;
    /* 限制单行，防止标题过长撑破卡片 */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
/* 全屏切换按钮 */
.fullscreen-toggle-btn {
    position: absolute;
    top: 25px;
    right: 35px; /* 避开滚动条位置 */
    width: 25px;
    height: 25px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    color: #64748b;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100; /* 确保在最上层 */
    transition: all 0.3s ease;
}

.fullscreen-toggle-btn:hover {
    background: #fff;
    color: #52c41a;
    border-color: #52c41a;
    box-shadow: 0 4px 12px rgba(82, 196, 26, 0.15);
    transform: translateY(-2px);
}

/* 全屏时的内容区域微调 */
.is-full-screen .article-body {
    max-width: 900px; /* 全屏时限制阅读宽度，防止文字太长行导致阅读疲劳 */
    margin: 0 auto;
    font-size: 22px; /* 全屏大字模式 */
}
/* 当全屏类名激活时 */
.cloze-app-container.is-full-screen {
    position: fixed !important;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2000;
    background: #ffffff !important; /* 防止全屏后背景变黑或透明 */
    display: flex;
}

/* 全屏时让练习区域居中，字号变大，更有沉浸感 */
.is-full-screen .article-body {
    max-width: 900px;
    margin: 0 auto;
    font-size: 22px; 
    line-height: 2;
}

/* 全屏时隐藏侧边栏的触发箭头，防止干扰 */
.is-full-screen .toggle-trigger {
    display: none;
}
/* 当处于管理员/编辑模式时，强行隐藏按钮 */
.fullscreen-toggle-btn.is-admin-hidden {
    display: none !important;
}
</style>
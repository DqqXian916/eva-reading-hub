<script setup>
import { ref, computed, reactive, onMounted } from 'vue'

const props = defineProps({
    quizzes: { type: Array, default: () => [] },
    canEdit: { type: Boolean, default: true }
})

const emit = defineEmits(['save', 'delete'])

// --- 状态控制 ---
const selectedQuiz = ref(null)
const isAdding = ref(false)
const isChecked = ref(false)
const listCollapsed = ref(false)
const userAnswers = reactive({})
const inputRefs = ref([])
const configInputRefs = ref([]) // 用于引用管理员端的输入框

const form = reactive({
    id: null,
    cloze_text: '',
    answers: [],
    category: '短文填空'
})

// --- 逻辑处理 ---
const startAdd = () => {
    selectedQuiz.value = null
    isAdding.value = true
    Object.assign(form, { id: null, cloze_text: '', answers: [], category: '短文填空' })
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

onMounted(() => {
    window.addEventListener('focus-gap', (e) => focusInput(e.detail - 1))
    window.addEventListener('scroll-to-ans', (e) => scrollToAnswer(e.detail))
    window.dispatchEvent(new CustomEvent('init-view'))
})

// 修改 renderedText 的事件派发逻辑
const renderedText = computed(() => {
    const text = isAdding.value ? form.cloze_text : (selectedQuiz.value?.cloze_text || '')
    if (!text) return '<p class="empty-hint">等待内容录入...</p>'
    
    return text.replace(/\{\{(\d+)\}\}/g, (match, p1) => {
        // 如果是编辑模式，派发 scroll-to-ans；如果是练习模式，派发 focus-gap
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
</script>

<template>
    <div class="cloze-app-container">
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
                                <div class="item-title">{{ q.cloze_text.substring(0, 20) }}...</div>
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
                                    <input :ref="el => inputRefs[n - 1] = el" v-model="userAnswers[n - 1]"
                                        :disabled="isChecked" class="gap-input">

                                    <div v-if="isChecked" class="status-indicator">
                                        <span v-if="isUserCorrect(n - 1)" class="icon-v">✓</span>
                                        <span v-else class="icon-x">✕</span>
                                    </div>

                                    <div v-if="isChecked && !isUserCorrect(n - 1)" class="ans-popup">
                                        {{ selectedQuiz.answers[n - 1] }}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card-foot">
                            <button v-if="!isChecked" class="btn-primary" @click="isChecked = true">核对答案</button>
                            <button v-else class="btn-secondary" @click="isChecked = false">重新练习</button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="isAdding" class="editor-layout animate-in">
    <div class="editor-top-bar">...</div> 

    <div class="editor-split-container">
        <div class="editor-pane edit-area card-base">
            <div class="pane-label">文章录入 (Markdown)</div>
            <textarea v-model="form.cloze_text" placeholder="录入文章，用 {{1}} 表示第1个空格..." class="fancy-textarea"></textarea>
            
            <div class="answer-config-panel">
                <div class="pane-label border-top">配置正确答案 ({{ gapCount }}个)</div>
                <div class="answer-grid scroll-y">
                    <div v-for="n in gapCount" :key="n" class="config-row">
                        <span class="index-tag">{{ n }}</span>
                        <input 
                            :ref="el => configInputRefs[n-1] = el" 
                            v-model="form.answers[n - 1]" 
                            class="config-input" 
                            placeholder="填入正确答案..." 
                        />
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
    min-width: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-sizing: border-box;
    background: #fdfdfd;
    transition: padding-left 0.3s;
}

.is-collapsed+.cloze-viewport {
    padding-left: 50px;
}

.practice-layout {
    display: flex;
    gap: 24px;
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

.reading-section {
    flex: 1;
    display: flex;
    flex-direction: column;
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
}

.answer-section {
    width: 360px;
    flex-shrink: 0;
}

.answer-card {
    height: 100%;
    display: flex;
    flex-direction: column;
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

.gap-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 14px 0;
    font-size: 15px;
    font-weight: 700;
    color: #334155;
    outline: none;
}

.card-foot {
    padding: 5px;
    border-top: 1px solid #f8fafc;
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
    background: #1e293b; /* 深色主题 */
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
    background: #22c55e; /* 悬停变为充满生机的绿色 */
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
    background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
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
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
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
    height: 300px; /* 固定高度，超出滚动 */
    display: flex;
    flex-direction: column;
    background: #fff;
}

.border-top {
    border-top: 1px solid #f1f5f9;
}

.answer-grid {
    flex: 1;
    padding: 16px;
    display: grid;
    grid-template-columns: repeat(2, 1fr); /* 答案双列排布，更高效 */
    gap: 12px;
    background: #fafafa;
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
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}
</style>
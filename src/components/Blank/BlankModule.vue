<script setup>
import { ref, computed, nextTick } from 'vue'
import BlankEditForm from './BlankEditForm.vue'

const props = defineProps({
  student: Object,
  quizzes: { type: Array, default: () => [] },
  canEdit: Boolean,
  isLoading: Boolean,
  scoreInfo: String,
  isFullScreen: Boolean
})

const emit = defineEmits(['toggleFull', 'close', 'save', 'delete', 'submit'])

// --- 状态控制 ---
const viewMode = ref('list')
const collapsed = ref(false)
const activeQuiz = ref(null)
const activeQIdx = ref(0)
const userSelections = ref([])
const isSubmitted = ref(false)
const showChinese = ref(false)

// --- 计算属性：解析文章 ---
const parsedSegments = computed(() => {
  if (!activeQuiz.value?.body) return []
  
  const slotRegex = /\[(\d+)\]/g
  const initialParts = []
  let lastIndex = 0
  let match

  while ((match = slotRegex.exec(activeQuiz.value.body)) !== null) {
    if (match.index > lastIndex) {
      initialParts.push({ type: 'text', content: activeQuiz.value.body.slice(lastIndex, match.index) })
    }
    initialParts.push({ type: 'slot', qIdx: parseInt(match[1]) - 1 })
    lastIndex = slotRegex.lastIndex
  }
  if (lastIndex < activeQuiz.value.body.length) {
    initialParts.push({ type: 'text', content: activeQuiz.value.body.slice(lastIndex) })
  }

  const finalParts = []
  initialParts.forEach(part => {
    if (part.type === 'slot') {
      finalParts.push(part)
    } else {
      const subLines = part.content.split('\n')
      subLines.forEach((line, index) => {
        if (line) {
          finalParts.push({ type: 'text', content: line })
        }
        if (index < subLines.length - 1) {
          finalParts.push({ type: 'newline' })
        }
      })
    }
  })
  return finalParts
})

// --- 计算正确题数总结 ---
const correctCount = computed(() => {
  if (!activeQuiz.value?.quiz) return 0
  return activeQuiz.value.quiz.reduce((acc, q, idx) => {
    return acc + (userSelections.value[idx] === q.answer ? 1 : 0)
  }, 0)
})

// --- 交互逻辑 ---
const selectQuiz = (quiz) => {
  activeQuiz.value = quiz
  userSelections.value = new Array(quiz.quiz?.length || 0).fill(null)
  isSubmitted.value = false
  showChinese.value = false
  activeQIdx.value = 0
}

const openEdit = (quiz = null) => {
  activeQuiz.value = quiz
  viewMode.value = 'edit'
}

const handleSelect = (qIdx, oIdx) => {
  if (isSubmitted.value) return
  userSelections.value[qIdx] = oIdx
  if (activeQuiz.value?.quiz && qIdx < activeQuiz.value.quiz.length - 1) {
    setTimeout(() => scrollToQuestion(qIdx + 1), 200)
  }
}

const scrollToQuestion = (idx) => {
  activeQIdx.value = idx
  nextTick(() => {
    setTimeout(() => {
      const el = document.getElementById(`q-card-${idx}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, isSubmitted.value ? 50 : 0)
  })
}

/**
 * 核心：完美无损打印完形填空做题报告
 */
const handlePrintReport = () => {
  const quizData = activeQuiz.value
  if (!quizData) return

  // 1. 获取文章正文 HTML (支持中英文切换)
  let rawBody = (showChinese.value && quizData.body_cn) ? quizData.body_cn : quizData.body

  // 2. 将正文中的 [1], [2] 完形空位替换为带有学生作答记录的优美徽章标签
  const processedArticleHtml = rawBody.replace(/\[(\d+)\]/g, (match, p1) => {
    const qIdx = parseInt(p1) - 1
    const userSel = userSelections.value[qIdx]
    const targetQ = quizData.quiz ? quizData.quiz[qIdx] : null
    const userLetter = userSel !== null ? String.fromCharCode(65 + userSel) : '_'
    
    let slotClass = 'print-slot'
    if (targetQ) {
      if (userSel === targetQ.answer) {
        slotClass += ' print-slot-correct'
      } else {
        slotClass += ' print-slot-wrong'
      }
    }
    return `<span class="${slotClass}"><b>(${p1})</b> ${userLetter}</span>`
  }).replace(/\n/g, '<br />')

  // 3. 拼接题目、各选项与解析
  let quizDetailsHtml = ''
  if (quizData.quiz && quizData.quiz.length) {
    quizDetailsHtml = quizData.quiz.map((q, qIdx) => {
      const userSel = userSelections.value[qIdx]
      const isCorrect = userSel === q.answer
      const statusText = isCorrect ? '✓ 回答正确' : '✕ 回答错误'
      const statusClass = isCorrect ? 'correct' : 'wrong'

      // 渲染选项列表
      let optionsHtml = ''
      if (q.options && q.options.length) {
        optionsHtml = q.options.map((opt, oIdx) => {
          const optLetter = String.fromCharCode(65 + oIdx)
          let itemClass = 'print-opt-item'
          let markBadge = ''

          if (oIdx === q.answer) {
            itemClass += ' opt-is-correct-ans'
            markBadge += '<span class="badge-ans">【正确答案】</span>'
          }
          if (userSel === oIdx) {
            if (oIdx === q.answer) {
              itemClass += ' opt-user-selected'
              markBadge += '<span class="badge-user-ok">（你的选择 ✓）</span>'
            } else {
              itemClass += ' opt-user-wrong'
              markBadge += '<span class="badge-user-no">（你的选择 ✕）</span>'
            }
          }

          return `
            <div class="${itemClass}">
              <span class="opt-letter">${optLetter}.</span> 
              <span class="opt-text">${opt}</span>
              ${markBadge}
            </div>
          `
        }).join('')
      }

      // 兼容字符串或数组格式的解析
      let analysisContent = '暂无该题解析'
      if (q.analysis) {
        if (Array.isArray(q.analysis)) {
          analysisContent = q.analysis[q.answer] || q.analysis[0] || '暂无解析'
        } else {
          analysisContent = q.analysis
        }
      }

      return `
        <div class="question-card">
          <div class="q-header">
            <div class="q-title"><strong>${qIdx + 1}.</strong> 完形填空第 ${qIdx + 1} 题</div>
            <span class="status-tag ${statusClass}">${statusText}</span>
          </div>
          <div class="options-list">
            ${optionsHtml}
          </div>
          <div class="analysis-box">
            <div class="analysis-title">💡 答案解析：</div>
            <div class="analysis-body">${analysisContent}</div>
          </div>
        </div>
      `
    }).join('')
  }

  // 4. 打开独立窗口并写入精心设计的打印模板
  const printWindow = window.open('', '_blank')
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${quizData.title || '完形填空做题报告'}</title>
      <style>
        @page {
          size: A4;
          margin: 10mm 12mm;
        }
        *, *::before, *::after { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          color: #1e293b;
          line-height: 1.6;
          padding: 0;
          margin: 0;
        }
        .header-box {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 16px;
        }
        .report-title {
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 6px 0;
          color: #0f172a;
        }
        .meta-info {
          font-size: 12px;
          color: #64748b;
          display: flex;
          justify-content: space-between;
        }
        .section-box {
          margin-bottom: 20px;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          border-left: 4px solid #3b82f6;
          padding-left: 8px;
          margin-bottom: 10px;
          color: #0f172a;
        }
        .article-content {
          background: #f8fafc;
          padding: 16px 20px;
          border-radius: 6px;
          font-size: 14px;
          line-height: 2.2;
          border: 1px solid #e2e8f0;
          text-align: justify;
        }
        /* 完形填空内嵌答题槽打印样式 */
        .print-slot {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          margin: 0 3px;
          background: #f1f5f9;
          border-bottom: 2px solid #94a3b8;
          border-radius: 4px;
          font-weight: bold;
          font-size: 13px;
        }
        .print-slot-correct {
          background: #dcfce7 !important;
          border-color: #22c55e !important;
          color: #15803d;
        }
        .print-slot-wrong {
          background: #fee2e2 !important;
          border-color: #ef4444 !important;
          color: #b91c1c;
        }

        .question-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 12px;
          page-break-inside: avoid;
          break-inside: avoid;
          background: #ffffff;
        }
        .q-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          font-size: 13.5px;
          margin-bottom: 8px;
        }
        .q-title {
          font-weight: 600;
          color: #0f172a;
        }
        .status-tag {
          font-size: 11px;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .status-tag.correct { background: #dcfce7; color: #15803d; }
        .status-tag.wrong { background: #fee2e2; color: #b91c1c; }

        .options-list {
          margin: 8px 0;
          font-size: 13px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .print-opt-item {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid #f1f5f9;
          background: #fafafa;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .opt-letter {
          font-weight: bold;
          color: #64748b;
        }
        .opt-text {
          flex: 1;
        }
        .opt-is-correct-ans {
          background-color: #f0fdf4 !important;
          border-color: #bbf7d0 !important;
        }
        .opt-user-wrong {
          background-color: #fef2f2 !important;
          border-color: #fecaca !important;
        }
        .badge-ans {
          color: #16a34a;
          font-weight: bold;
          font-size: 11px;
          margin-left: auto;
        }
        .badge-user-ok {
          color: #16a34a;
          font-weight: bold;
          font-size: 11px;
        }
        .badge-user-no {
          color: #dc2626;
          font-weight: bold;
          font-size: 11px;
          margin-left: auto;
        }

        .analysis-box {
          margin-top: 10px;
          background: #f8fafc;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 12.5px;
          color: #334155;
          border-left: 3px solid #94a3b8;
          line-height: 1.6;
        }
        .analysis-title {
          font-weight: bold;
          margin-bottom: 4px;
          color: #1e293b;
        }
      </style>
    </head>
    <body>
      <div class="header-box">
        <h1 class="report-title">${quizData.title || '完形填空练习报告'}</h1>
        <div class="meta-info">
          <span><strong>学生姓名：</strong>${'suzy 苏阳涵钰' || '学员'} &nbsp;|&nbsp; <strong>得分：</strong>${props.scoreInfo || `${correctCount.value} / ${quizData.quiz?.length}`}</span>
          <span>打印时间：${new Date().toLocaleString()}</span>
        </div>
      </div>

      <div class="section-box">
        <div class="section-title">一、完形填空文章与填空记录</div>
        <div class="article-content">${processedArticleHtml}</div>
      </div>

      <div class="section-box">
        <div class="section-title">二、逐题解析与作答核对</div>
        ${quizDetailsHtml}
      </div>
    </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()

  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 350)
}
</script>

<template>
  <div :class="['cloze-workspace', { 'is-full-screen': isFullScreen }]">

    <BlankEditForm v-if="viewMode === 'edit'" :student="student" :initialData="activeQuiz"
      @save="(data) => { emit('save', data); viewMode = 'list' }" @cancel="viewMode = 'list'"
      class="full-view-editor" />

    <template v-else>
      <div class="workspace-layout">
        <aside :class="['sidebar-panel', { collapsed: collapsed }]">
          <div class="toggle-btn" @click="collapsed = !collapsed">
            {{ collapsed ? '▶' : '◀' }}
          </div>

          <div v-show="!collapsed" class="panel-content">
            <div class="student-profile-card">
              <div class="avatar-box">
                {{ student?.name?.charAt(0).toUpperCase() }}
              </div>
              <div class="profile-info">
                <span class="badge-text">SPECIAL TRAINING</span>
                <h3 class="student-name">{{ student?.name }} 的完形库</h3>
              </div>
            </div>

            <button v-if="canEdit" class="btn-primary-add" @click="openEdit(null)">
              <span class="plus-icon">+</span> 录入新练习
            </button>

            <div class="list-wrapper">
              <div class="list-header-label">最近更新 ({{ quizzes.length }})</div>

              <div v-if="isLoading" class="loader-wrap">
                <div class="mini-loader"></div>
              </div>

              <div v-else class="cloze-list-scroll">
                <div v-for="q in quizzes" :key="q.id" :class="['cloze-item-card', { active: activeQuiz?.id === q.id }]"
                  @click="selectQuiz(q)">
                  <div class="active-bar"></div>
                  <div class="item-icon">🖋️</div>
                  <div class="item-main">
                    <span class="item-title">{{ q.title || '无标题练习' }}</span>
                    <div class="item-sub">
                      <span>{{ q.quiz?.length }} 题</span>
                      <span class="dot">·</span>
                      <span>{{ new Date(q.created_at).toLocaleDateString() }}</span>
                    </div>
                  </div>
                  <div v-if="canEdit" class="item-ctrls">
                    <button class="mini-icon-btn" @click.stop="openEdit(q)">✏️</button>
                    <button class="mini-icon-btn del" @click.stop="emit('delete', q.id)">🗑️</button>
                  </div>
                </div>

                <div v-if="quizzes.length === 0" class="empty-list-tip">
                  <div class="empty-icon">✍🏻</div>
                  <p>题库空空的</p>
                  <p class="sub-tip">{{ canEdit ? '点击上方按钮开始录入' : '等老师为你布置内容哦' }}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
        
        <main class="main-content-panel">
          <div v-if="activeQuiz" class="exercise-stage fade-in">
            <div class="stage-header">
              <div class="title-badge">📖 {{ activeQuiz.title }}</div>
              <div class="action-group">
                <!-- 新增：优化后的打印报告按钮（提交后可见） -->
                <button v-if="isSubmitted" class="btn-glass btn-print" @click="handlePrintReport">
                  🖨️ 打印完形报告
                </button>
                <button v-if="isSubmitted && activeQuiz.body_cn" class="btn-glass" @click="showChinese = !showChinese">
                  {{ showChinese ? '显示原文' : '译文对照' }}
                </button>
                <button class="btn-glass" @click="emit('toggleFull')">
                  {{ isFullScreen ? '缩小' : '全屏' }}
                </button>
              </div>
            </div>

            <div class="exercise-body">
              <article class="reading-area">
                <div v-if="showChinese && isSubmitted" class="translation-box fade-in">
                  {{ activeQuiz.body_cn }}
                </div>
                <div v-else class="text-content">
                  <template v-for="(seg, i) in parsedSegments" :key="i">
                    <span v-if="seg.type === 'text'">{{ seg.content }}</span>
                    <br v-else-if="seg.type === 'newline'" />
                    <span v-else
                      :class="['cloze-slot', { 'active': activeQIdx === seg.qIdx, 'filled': userSelections[seg.qIdx] !== null, 'correct': isSubmitted && userSelections[seg.qIdx] === activeQuiz.quiz[seg.qIdx]?.answer, 'wrong': isSubmitted && userSelections[seg.qIdx] !== null && userSelections[seg.qIdx] !== activeQuiz.quiz[seg.qIdx]?.answer }]"
                      @click="scrollToQuestion(seg.qIdx)">
                      <span class="slot-idx">{{ seg.qIdx + 1 }}</span>
                      <span class="slot-answer">{{ userSelections[seg.qIdx] !== null ? String.fromCharCode(65 + userSelections[seg.qIdx]) : '' }}</span>
                    </span>
                  </template>
                </div>
              </article>

              <aside class="options-panel">
                <div class="options-scroll">
                  <div v-for="(q, qIdx) in activeQuiz.quiz" :key="qIdx" :id="`q-card-${qIdx}`"
                    :class="['question-card', { active: activeQIdx === qIdx }]">
                    <div class="q-row-layout">
                      <span class="q-label">{{ qIdx + 1 }}.</span>
                      <div class="opts-list">
                        <button v-for="(opt, oIdx) in q.options" :key="oIdx"
                          :class="['opt-choice', { 'selected': userSelections[qIdx] === oIdx, 'is-ans': isSubmitted && oIdx === q.answer }]"
                          @click="handleSelect(qIdx, oIdx)">
                          <span class="letter">{{ String.fromCharCode(65 + oIdx) }}</span>
                          <span class="text">{{ opt }}</span>
                        </button>
                      </div>
                    </div>
                    <div v-if="isSubmitted"
                      :class="['ans-status', userSelections[qIdx] === q.answer ? 'is-ok' : 'is-no']">
                      {{ userSelections[qIdx] === q.answer ? '✓' : '✗' }}
                    </div>
                    <transition name="slide-down">
                      <div v-if="isSubmitted && q.analysis" class="analysis-box">
                        <div class="analysis-header">
                          <span class="analysis-tag">解析</span>
                          <span class="correct-ans-tip">
                            正确答案：<strong class="text-success">{{ String.fromCharCode(65 + q.answer) }}</strong>
                          </span>
                        </div>
                        <p class="analysis-text">{{ q.analysis }}</p>
                      </div>
                    </transition>
                  </div>
                </div>
                <div class="panel-footer">
                  <div v-if="isSubmitted" class="score-pill">{{ scoreInfo }}</div>
                  <button v-else class="btn-submit-main" :disabled="userSelections.includes(null)"
                    @click="isSubmitted = true">
                    提交并核对答案
                  </button>
                </div>
              </aside>
            </div>
          </div>

          <div v-else class="empty-guide-stage">
            <div class="guide-content">
              <div class="guide-icon">🌳</div>
              <h3>开始练习？</h3>
            </div>
          </div>
        </main>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 样式保持原样 */
.cloze-workspace {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}
.full-view-editor { position: absolute; inset: 0; z-index: 100; background: #fff; }
.is-full-screen { position: fixed; inset: 0; z-index: 9999; }
.workspace-layout { display: flex; flex: 1; height: 0; min-height: 0; width: 100%; overflow: hidden; }
.sidebar-panel { width: 280px; background: #ffffff; border-right: 1px solid #edf2f7; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; display: flex; flex-direction: column; }
.sidebar-panel.collapsed { width: 40px; }
.panel-content { width: 280px; padding: 20px 16px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; }
.student-profile-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: #f1f5f9; border-radius: 16px; margin-bottom: 20px; }
.avatar-box { width: 42px; height: 42px; background: #1e293b; color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; }
.badge-text { font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; }
.student-name { font-size: 14px; font-weight: 700; color: #1e293b; margin: 2px 0 0 0; }
.btn-primary-add { width: 100%; padding: 14px; background: #0f172a; color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; margin-bottom: 24px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-primary-add:hover { background: #27ae60; }
.list-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.list-header-label { font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 12px; padding-left: 4px; }
.cloze-list-scroll { flex: 1; overflow-y: auto; padding-right: 4px; }
.cloze-item-card { position: relative; display: flex; align-items: center; gap: 12px; padding: 14px; background: #fff; border-radius: 14px; border: 1px solid #f1f5f9; margin-bottom: 10px; cursor: pointer; overflow: hidden; }
.cloze-item-card:hover { border-color: #cbd5e1; background: #f8fafc; }
.cloze-item-card.active { background: #f0f9ff; border-color: #3b82f6; }
.active-bar { position: absolute; left: 0; top: 25%; height: 50%; width: 4px; background: transparent; border-radius: 0 4px 4px 0; }
.cloze-item-card.active .active-bar { background: #3b82f6; }
.item-icon { font-size: 18px; }
.item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.item-title { font-size: 13px; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
.item-sub { font-size: 10px; color: #94a3b8; display: flex; gap: 4px; }
.item-ctrls { display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
.cloze-item-card:hover .item-ctrls { opacity: 1; }
.mini-icon-btn { border: none; background: #fff; padding: 5px; border-radius: 6px; cursor: pointer; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.exercise-stage { flex: 1; display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.main-content-panel { flex: 1; background: #ffffff; display: flex; flex-direction: column; height: 100%; position: relative; }
.stage-header { height: 64px; padding: 0 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
.title-badge { background: #f1f5f9; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; color: #1e293b; }
.btn-glass { border: 1px solid #e2e8f0; background: #fff; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 8px; }
.btn-glass:hover { background: #f8fafc; }
.btn-print { color: #2563eb; border-color: #bfdbfe; background-color: #eff6ff; }
.btn-print:hover { background-color: #dbeafe; }
.exercise-body { flex: 1; display: flex; overflow: hidden; min-height: 0; height: 100%; }
.reading-area { flex: 1.2; overflow-y: auto; padding: 30px 40px; line-height: 2.2; font-size: 19px; color: #334155; background: #fff; }
.cloze-slot { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; height: 30px; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; border-radius: 4px; margin: 0 6px; cursor: pointer; vertical-align: middle; }
.cloze-slot.active { background: #e0f2fe; border-color: #3b82f6; transform: translateY(-2px); }
.cloze-slot.filled { background: #f0f9ff; border-color: #0ea5e9; }
.cloze-slot.correct { background: #dcfce7 !important; border-color: #22c55e !important; }
.cloze-slot.wrong { background: #fee2e2 !important; border-color: #ef4444 !important; }
.slot-idx { font-size: 11px; color: #94a3b8; margin-right: 4px; }
.slot-answer { font-weight: 800; color: #2563eb; }
.options-panel { width: 400px; background: #f8fafc; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column; height: 100%; min-height: 0; }
.options-scroll { flex: 1; overflow-y: auto !important; min-height: 0; padding: 16px; padding-right: 12px; }
.question-card { background: white; border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; border: 1px solid #e2e8f0; position: relative; }
.question-card.active { border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,0.08); }
.opts-list { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; align-items: center; }
.q-row-layout { display: flex; align-items: center; gap: 8px; }
.q-label { font-size: 10px; font-weight: 800; color: #1e293b; min-width: 10px; }
.opt-choice { display: flex; align-items: center; justify-content: flex-start; padding: 4px 6px; background: #fff; border: 1px solid #f1f5f9; border-radius: 6px; cursor: pointer; }
.opt-choice:hover { background: #f8fafc; }
.opt-choice.selected { background: #3b82f6; color: white; border-color: #3b82f6; }
.opt-choice.is-ans { border: 2px solid #22c55e; }
.letter { display: inline-block; width: 14px; font-size: 10px; font-weight: 800; color: #94a3b8; text-align: left; }
.opt-choice .text { font-size: 13px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 2px; }
.panel-footer { padding: 20px; background: white; border-top: 1px solid #e2e8f0; }
.btn-submit-main { width: 100%; padding: 16px; background: #0f172a; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; }
.btn-submit-main:disabled { background: #cbd5e1; cursor: not-allowed; }
.empty-guide-stage { flex: 1; width: 100%; display: flex; align-items: center; justify-content: center; background: #ffffff; }
.guide-content { text-align: center; color: #94a3b8; }
.guide-icon { font-size: 60px; margin-bottom: 20px; }
.fade-in { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.toggle-btn { position: absolute; right: -12px; top: 30px; width: 24px; height: 24px; background: #fff; border: 1px solid #e2e8f0; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; z-index: 10; }
.ans-status { position: absolute; right: 5px; top: 2px; font-size: 10px; }
.is-ok { color: #22c55e; }
.is-no { color: #ef4444; }
.empty-list-tip { text-align: center; margin-top: 60px; }
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.sub-tip { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.analysis-box { margin-top: 10px; padding: 10px 12px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #64748b; font-size: 12px; }
.question-card:has(.is-no) .analysis-box { border-left-color: #fca5a5; }
.question-card:has(.is-ok) .analysis-box { border-left-color: #86efac; }
.analysis-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.analysis-tag { background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px; }
.correct-ans-tip { color: #64748b; }
.text-success { color: #22c55e; font-weight: 800; }
.analysis-text { margin: 0; color: #475569; line-height: 1.6; white-space: pre-wrap; }
.text-content { white-space: pre-wrap; word-break: break-word; }
.translation-box { white-space: pre-wrap; line-height: 1.8; color: #475569; }
</style>
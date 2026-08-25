<script setup>
/**
 * Props 说明：
 * activeReading: 当前正在阅读的文章对象
 * isFullScreen: 是否处于全屏沉浸模式
 * userSelections: 学生的选项记录数组
 * isSubmitted: 是否已提交核对
 * scoreInfo: 得分汇总文字
 */
import { ref } from 'vue'

const props = defineProps({
  activeReading: Object,
  isFullScreen: Boolean,
  userSelections: Array,
  isSubmitted: Boolean,
  scoreInfo: String
})

const hoverIdx = ref(null)
const hoverOptIdx = ref(null)
const showChinese = ref(false)

const emit = defineEmits(['toggleFull', 'close', 'submit', 'updateSelection'])

const handleSubmit = () => {
  emit('submit')
}

/**
 * 核心：完美无损打印 PDF 报告
 */
const handlePrintReport = () => {
  const reading = props.activeReading
  if (!reading) return

  // 1. 获取文章正文 HTML
  const articleHtml = (showChinese.value && reading.body_cn) ? reading.body_cn : reading.body

  // 2. 拼接题目与解析
  let quizHtml = ''
  if (reading.quiz && reading.quiz.length) {
    quizHtml = reading.quiz.map((q, qIdx) => {
      const userSel = props.userSelections ? props.userSelections[qIdx] : null
      const isCorrect = userSel === q.answer
      const statusText = isCorrect ? '✓ 正确' : '✕ 错误'
      const statusClass = isCorrect ? 'correct' : 'wrong'

      // A. 渲染组合题声明语句框 sub_q (例如 ①②③④ 列表)
      let subQHtml = ''
      if (q.sub_q && q.sub_q.length) {
        const subItems = q.sub_q.map(item => `
          <div class="stmt-item">
            <span class="stmt-idx">${item.slice(0, 1)}</span>
            <span class="stmt-txt">${item.slice(1)}</span>
          </div>
        `).join('')
        subQHtml = `<div class="statements-box">${subItems}</div>`
      }

      // B. 渲染选项 (自动清洗重复字母)
      let optionsHtml = ''
      if (q.options && q.options.length) {
        optionsHtml = q.options.map((opt, oIdx) => {
          let optText = opt
          if (q.option_type === 'image_base64') {
            optText = `<img src="${opt.data}" style="max-height:60px; vertical-align:middle;" />`
          } else if (typeof opt === 'string') {
            // 如果选项自带 "A. " 或 "A. A." 则自动去重
            optText = opt.replace(/^[A-Z]\.\s*/i, '')
          }

          const optLetter = String.fromCharCode(65 + oIdx)
          let labelExtra = ''
          if (props.isSubmitted) {
            if (userSel === oIdx && oIdx !== q.answer) {
              labelExtra = ' <strong style="color:#ef4444; margin-left:8px;">(你的答案 ✕)</strong>'
            }
            if (oIdx === q.answer) {
              labelExtra = ' <strong style="color:#16a34a; margin-left:8px;">(正确答案 ✓)</strong>'
            }
          }

          return `<div class="opt-item"><span class="opt-letter">${optLetter}.</span> ${optText}${labelExtra}</div>`
        }).join('')
      }

      // C. 渲染解析内容 (兼容数组解析与字符串解析)
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
            <div class="q-title"><strong>${qIdx + 1}.</strong> ${q.q}</div>
            ${props.isSubmitted ? `<span class="status-tag ${statusClass}">${statusText}</span>` : ''}
          </div>

          ${subQHtml}

          <div class="options-list">
            ${optionsHtml}
          </div>

          ${props.isSubmitted ? `
            <div class="analysis-box">
              <div class="analysis-title">💡 答案解析：</div>
              <div class="analysis-body">${analysisContent}</div>
            </div>
          ` : ''}
        </div>
      `
    }).join('')
  }

  // 3. 打开独立窗口构建打印文档
  const printWindow = window.open('', '_blank')
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reading.title || '阅读分析报告'}</title>
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        *, *::before, *::after { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          color: #1e293b;
          line-height: 1.6;
          padding: 15mm 12mm;
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
          padding: 14px 16px;
          border-radius: 6px;
          font-size: 13.5px;
          line-height: 1.75;
          border: 1px solid #e2e8f0;
          text-align: justify;
        }
        .article-content img {
          max-width: 100%;
          border-radius: 6px;
          margin: 10px 0;
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
          flex: 1;
        }
        .status-tag {
          font-size: 11px;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
          margin-left: 10px;
        }
        .status-tag.correct { background: #dcfce7; color: #15803d; }
        .status-tag.wrong { background: #fee2e2; color: #b91c1c; }
        
        .statements-box {
          margin: 6px 0 10px 16px;
          padding: 8px 12px;
          background-color: #f1f5f9;
          border-radius: 6px;
          font-size: 12.5px;
        }
        .stmt-item {
          display: flex;
          gap: 6px;
          margin-bottom: 4px;
          color: #334155;
        }
        .stmt-idx { font-weight: bold; color: #64748b; }

        .options-list {
          margin: 6px 0;
          font-size: 13px;
        }
        .opt-item {
          margin-bottom: 5px;
          color: #334155;
          line-height: 1.5;
        }
        .opt-letter {
          font-weight: bold;
          margin-right: 4px;
        }
        .analysis-box {
          margin-top: 8px;
          background: #f8fafc;
          padding: 8px 10px;
          border-radius: 4px;
          font-size: 12.5px;
          color: #334155;
          border-left: 3px solid #94a3b8;
          line-height: 1.6;
        }
        .analysis-title {
          font-weight: bold;
          margin-bottom: 3px;
          color: #1e293b;
        }
        .analysis-body img {
          max-width: 100%;
        }
      </style>
    </head>
    <body>
      <div class="header-box">
        <h1 class="report-title">${reading.title || '阅读完成报告'}</h1>
        <div class="meta-info">
          <span>${props.scoreInfo || ''}</span>
          <span>打印时间：${new Date().toLocaleString()}</span>
        </div>
      </div>

      <div class="section-box">
        <div class="section-title">一、阅读文章（Reading Material）</div>
        <div class="article-content">${articleHtml}</div>
      </div>

      <div class="section-box">
        <div class="section-title">二、题目与解析（Quiz & Analysis）</div>
        ${quizHtml}
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
  <div :class="['reading-view', { 'is-full-screen': isFullScreen }]">
    <!-- 顶部工具栏 -->
    <div class="reading-toolbar">
      <div class="exclusive-badge">✨ Eva老师 爱徒专用 ❤️</div>
      <div class="tool-group">
        <button class="btn-tool" @click="$emit('toggleFull')">
          {{ isFullScreen ? '退出 ↙' : '全屏 ↗' }}
        </button>
        <button class="btn-tool close" @click="$emit('close')">返回</button>
      </div>
    </div>

    <div class="content-container">
      <!-- 文章栏 -->
      <article class="article-col">
        <div class="article-header">
          <div class="header-top-row">
            <div class="student-tag">READING MATERIAL（阅读文章） 🌟</div>

            <button v-if="isSubmitted && activeReading.body_cn" class="lang-toggle-btn"
              :class="{ 'is-active': showChinese }" @click="showChinese = !showChinese">
              {{ showChinese ? '查看原文' : '对照中文' }}
            </button>
          </div>
          <h1 class="article-title">{{ activeReading.title }}</h1>
        </div>

        <div v-html="(showChinese && activeReading.body_cn) ? activeReading.body_cn : activeReading.body"
          class="article-text rich-content" :class="{ 'cn-mode': showChinese && activeReading.body_cn }"></div>
      </article>

      <!-- 答题栏 -->
      <aside class="quiz-col">
        <div class="questions-list">
          <div v-for="(q, qIdx) in activeReading.quiz" :key="qIdx" class="question-card">
            <div class="q-row">
              <span class="q-num">{{ qIdx + 1 }}</span>
              <span class="q-title">{{ q.q }}</span>
            </div>
            <div v-if="q.sub_q" class="statements-box">
              <div v-for="(item, sIdx) in q.sub_q" :key="sIdx" class="statement-item">
                <span class="statement-index">{{ item.slice(0, 1) }}</span>
                <span class="statement-text">{{ item.slice(1) }}</span>
              </div>
            </div>
            <div class="options-group">
              <div v-for="(opt, oIdx) in q.options" :key="oIdx" :class="['option',
                { selected: userSelections[qIdx] === oIdx },
                { correct: isSubmitted && oIdx === q.answer },
                { wrong: isSubmitted && userSelections[qIdx] === oIdx && oIdx !== q.answer },
                { 'is-image-opt': q.option_type === 'image_base64' }
              ]" @click="!isSubmitted && $emit('updateSelection', { qIdx, oIdx })"
                @mouseenter="isSubmitted && (hoverIdx = qIdx, hoverOptIdx = oIdx)"
                @mouseleave="hoverIdx = null, hoverOptIdx = null">

                <template v-if="q.option_type === 'image_base64'">
                  <div class="opt-img-wrapper">
                    <span class="opt-letter">{{ String.fromCharCode(65 + oIdx) }}.</span>
                    <img :src="opt.data" :alt="opt.desc" class="opt-img" />
                  </div>
                </template>

                <template v-else>
                  <span class="option-content">{{ opt }}</span>
                </template>
              </div>
            </div>

            <div v-if="isSubmitted" class="analysis-box" :class="{ 'is-hovering': hoverIdx === qIdx }">
              <template v-if="hoverIdx === qIdx">
                <div class="analysis-label hover-mode">
                  <span class="icon">🔍</span> 选项 {{ String.fromCharCode(65 + hoverOptIdx) }} 详解：
                </div>
                <div class="analysis-text" v-html="q.analysis && q.analysis[hoverOptIdx] ? q.analysis[hoverOptIdx] : '暂无该选项解析'"></div>
              </template>

              <template v-else>
                <div class="analysis-label">
                  <span class="icon">💡</span> 答案解析：
                </div>
                <div class="analysis-text" v-html="q.analysis && q.analysis[q.answer] ? q.analysis[q.answer] : (q.analysis && q.analysis[0] ? q.analysis[0] : '暂无该选项解析')"></div>
              </template>
            </div>
          </div>
        </div>

        <div class="quiz-footer">
          <div v-if="isSubmitted" class="score-box">
            <div v-if="scoreInfo" class="score-text">{{ scoreInfo }}</div>
            <div class="btn-group">
              <button class="btn-print" @click="handlePrintReport">🖨️ 打印阅读报告</button>
              <button class="btn-retry" @click="$emit('close')">返回文章列表</button>
            </div>
          </div>

          <button v-else class="btn-primary submit-btn" :disabled="userSelections.includes(null)"
            @click="handleSubmit">
            提交答案
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.reading-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: white;
}

.reading-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 25px;
  border-bottom: 1px solid #f1f5f9;
}

.tool-group {
  display: flex;
  gap: 10px;
}

.btn-tool {
  padding: 6px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #64748b;
}

.content-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.article-col {
  flex: 1;
  padding: 40px 30px;
  overflow-y: auto;
  border-right: 1px solid #f1f5f9;
}

.article-title {
  font-size: 28px;
  color: #1e293b;
  margin: 10px 0 25px 0;
}

.article-text {
  font-size: 18px;
  line-height: 1.8;
  color: #334155;
}

.article-text :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  margin: 15px 0;
  display: block;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.is-full-screen .article-text :deep(img) {
  max-width: 80%;
  margin: 20px auto;
}

.quiz-col {
  width: 380px;
  background: #fcfcfd;
  display: flex;
  flex-direction: column;
}

.questions-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.question-card {
  background: white;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 20px;
  border: 1px solid #eef2f6;
}

.q-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.q-num {
  background: #f1f5f9;
  color: #64748b;
  min-width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  font-size: 12px;
  font-weight: bold;
  margin-top: 2px;
}

.q-title {
  font-weight: 600;
  color: #1e293b;
  line-height: 1.5;
  font-size: 15px;
  flex: 1;
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option {
  padding: 10px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.option:hover {
  background: #f8fafc;
}

.option.selected {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #1d4ed8;
}

.option.correct {
  background: #dcfce7 !important;
  border-color: #22c55e !important;
  color: #166534;
  font-weight: bold;
}

.option.wrong {
  background: #fee2e2 !important;
  border-color: #ef4444 !important;
  color: #991b1b;
}

.quiz-footer {
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
  background: #fff;
  flex-shrink: 0;
}

.score-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.score-text {
  font-size: 15px;
  font-weight: bold;
  color: #1e293b;
  text-align: center;
}

.btn-group {
  display: flex;
  gap: 10px;
}

.btn-print {
  flex: 1;
  padding: 10px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-print:hover {
  background: #1d4ed8;
}

.btn-retry {
  flex: 1;
  padding: 10px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
}

.submit-btn {
  width: 100%;
  height: 45px;
  background: #1e293b;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}

.submit-btn:disabled {
  background: #e2e8f0;
  cursor: not-allowed;
}

.exclusive-badge {
  padding: 4px 12px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 15px;
  color: #e11d48;
  font-size: 12px;
  font-weight: 600;
}

.is-full-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
}

.is-full-screen .article-col {
  padding: 40px 30px;
  font-size: 20px;
}

.is-full-screen .student-tag,
.is-full-screen .exclusive-badge {
  display: none;
}

.is-full-screen .reading-toolbar {
  justify-content: flex-end;
  padding: 8px 25px;
  background: transparent;
}

.analysis-box {
  margin-top: 16px;
  padding: 14px;
  background-color: #f8fafc;
  border-left: 4px solid #cbd5e1;
  border-radius: 8px;
  transition: all 0.2s ease;
  min-height: 80px;
}

.analysis-box.is-hovering {
  background-color: #f1f5f9;
  border-left-color: #94a3b8;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}

.analysis-label {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.analysis-label.hover-mode {
  color: #1e293b;
}

.analysis-text {
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
  animation: fadeInShort 0.2s ease-out;
  word-break: break-word;
}

@keyframes fadeInShort {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

.option:hover {
  background: #f1f5f9;
  transform: translateX(4px);
  transition: transform 0.2s ease;
}

.is-image-opt {
  padding: 8px !important;
}

.opt-img-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.opt-letter {
  font-weight: bold;
  color: #64748b;
  font-size: 14px;
}

.opt-img {
  max-width: 100%;
  max-height: 80px;
  object-fit: contain;
  border-radius: 4px;
  background: white;
}

.statements-box {
  margin: 12px 0 16px 32px;
  padding: 12px 16px;
  background-color: #f8fafc;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.statement-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #475569;
}

.statement-index {
  color: grey;
  font-weight: bold;
}

.statement-text {
  line-height: 1.6;
}

.header-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lang-toggle-btn {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid #3b82f6;
  background: white;
  color: #3b82f6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.lang-toggle-btn:hover {
  background: #eff6ff;
  transform: translateY(-1px);
}

.lang-toggle-btn.is-active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.article-text.cn-mode {
  color: #1e293b;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.9;
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
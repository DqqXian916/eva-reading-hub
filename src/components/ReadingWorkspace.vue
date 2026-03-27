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
defineProps({
  activeReading: Object,
  isFullScreen: Boolean,
  userSelections: Array,
  isSubmitted: Boolean,
  scoreInfo: String
})
const hoverIdx = ref(null) // 记录当前悬停的题目索引
const hoverOptIdx = ref(null) // 记录当前悬停的选项索引
defineEmits(['toggleFull', 'close', 'submit', 'updateSelection'])
</script>

<template>
  <div :class="['reading-view', { 'is-full-screen': isFullScreen }]">
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
      <article class="article-col">
        <div class="article-header">
          <div class="student-tag">READING MATERIAL（阅读文章） 🌟</div>
          <h1 class="article-title">{{ activeReading.title }}</h1>
        </div>
        <div v-html="activeReading.body" class="article-text rich-content"></div>
      </article>

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
                { 'is-image-opt': q.option_type === 'image_base64' } // 新增类名
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
                <div class="analysis-text">
                  {{ q.analysis[hoverOptIdx] }}
                </div>
              </template>

              <template v-else>
                <div class="analysis-label">
                  <span class="icon">💡</span> 答案解析：
                </div>
                <div class="analysis-text">
                  {{ q.analysis[q.answer] }}
                </div>
              </template>
            </div>
          </div>
        </div>
        <div class="quiz-footer">
          <div v-if="isSubmitted && scoreInfo" class="score-box">
            <div class="score-text">{{ scoreInfo }}</div>
            <button class="btn-retry" @click="$emit('close')">查看其他文章</button>
          </div>

          <button v-else class="btn-primary submit-btn" :disabled="userSelections.includes(null)"
            @click="$emit('submit')">
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

/* 文章栏：根据要求取消留白 */
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

/* 针对全屏模式微调图片 */
.is-full-screen .article-text :deep(img) {
  max-width: 80%;
  /* 全屏时图片不要太大，居中显示 */
  margin: 20px auto;
}

/* 答题栏 */
.quiz-col {
  width: 380px;
  background: #fcfcfd;
  display: flex;
  flex-direction: column;
}

.quiz-header {
  padding: 20px;
  border-bottom: 1px solid #f1f5f9;
}

.questions-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* 修复错位：Q-Row 样式 */
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

/* 选项样式：取消自带字母前缀 */
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
  padding: 20px;
  border-top: 1px solid #f1f5f9;
  background: #fff;
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

/* 全屏模式无留白 */
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

/* 当处于全屏模式时，隐藏学生提示标签 */
.is-full-screen .student-tag {
  display: none;
}

/* --- 全屏模式下的界面纯净化 --- */

/* 隐藏学生提示标签和爱徒专用勋章 */
.is-full-screen .student-tag,
.is-full-screen .exclusive-badge {
  display: none;
}

/* 全屏时让工具栏高度稍微收缩，保持简洁 */
.is-full-screen .reading-toolbar {
  justify-content: flex-end;
  /* 让按钮组靠右，左侧留白更清爽 */
  padding: 8px 25px;
  background: transparent;
  /* 背景透明，减少分割感 */
}

/* 修改后的解析框样式 */
.analysis-box {
  margin-top: 16px;
  padding: 14px;
  background-color: #f8fafc;
  border-left: 4px solid #cbd5e1;
  border-radius: 8px;
  transition: all 0.2s ease;
  /* 让背景色和边框色切换平滑 */
  min-height: 90px;
  /* 设置最小高度，防止切换选项时下方内容跳动 */
}

/* 悬停选项时，解析框的反馈效果 */
.analysis-box.is-hovering {
  background-color: #f1f5f9;
  /* 稍微加深一点颜色 */
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

/* 悬停时的标签高亮 */
.analysis-label.hover-mode {
  color: #1e293b;
}

.analysis-text {
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
  animation: fadeInShort 0.2s ease-out;
  /* 切换内容时的微小淡入 */
}

@keyframes fadeInShort {
  from {
    opacity: 0.7;
  }

  to {
    opacity: 1;
  }
}

/* 提交后鼠标移入选项的反馈 */
.option:hover {
  background: #f1f5f9;
  transform: translateX(4px);
  transition: transform 0.2s ease;
}

.is-submitted .option {
  cursor: help;
  /* 提交后鼠标变成问号，提示用户“这里有解析” */
}

.analysis-label {
  font-size: 13px;
  font-weight: 700;
  /* 加粗标题 */
  color: #475569;
  /* 灰蓝色标题 */
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 5px;
  /* 图标与文字的间距 */
}

.analysis-text {
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
  /* 深灰蓝正文，阅读体验极佳 */
  word-break: break-word;
  /* 防止长文本溢出 */
}

/* 进场动画 */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 新增：图片选项专用布局 */
.is-image-opt {
  padding: 8px !important;
  /* 图片选项缩小内边距 */
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
  /* 自动适应容器宽度 */
  max-height: 80px;
  /* 限制高度防止撑爆卡片 */
  object-fit: contain;
  border-radius: 4px;
  background: white;
  /* 给透明图层垫底 */
}

/* 提交后的反馈效果增强 */
.option.correct.is-image-opt {
  border: 2px solid #22c55e !important;
}

.option.wrong.is-image-opt {
  border: 2px solid #ef4444 !important;
}

/* 鼠标悬停时的放大微动效 */
.is-image-opt:hover .opt-img {
  transform: scale(1.05);
  transition: transform 0.2s ease;
}
/* 组合题陈述区整体容器 */
.statements-box {
  margin: 12px 0 16px 32px; /* 与题目标题对齐 */
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

/* 序号样式（①②③④） */
.statement-index {
  color: grey; 
  font-weight: bold;
}

.statement-text {
  line-height: 1.6;
}
</style>
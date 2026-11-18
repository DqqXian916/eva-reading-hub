<script setup>
/**
 * 完形填空做题报告子组件
 */
defineProps({
  scoreReport: {
    type: Object,
    required: true,
    default: () => ({ total: 0, correctCount: 0, wrongCount: 0, accuracy: '0', score: 0, details: [] })
  },
  quizTitle: { type: String, default: '' },
  category: { type: String, default: '短文填空' },
  clozeText: { type: String, default: '' }
})
</script>

<template>
  <!-- 专用于打印的报告容器：平时在页面中隐藏，打印时仅展示该部分 -->
  <div id="print-report-container" class="print-only">
    <div class="header-box">
      <h1 class="report-title">{{ quizTitle || '短文填空练习报告' }}</h1>
      <div class="meta-info">
        <span><strong>分类：</strong>{{ category }}</span>
        <span><strong>打印时间：</strong>{{ new Date().toLocaleString() }}</span>
      </div>
    </div>

    <!-- 一、阅读文章部分 -->
    <div class="section-box" v-if="clozeText">
      <div class="section-title">一、阅读文章（Reading Passage）</div>
      <div class="article-content" v-html="clozeText"></div>
    </div>

    <!-- 二、成绩汇总 -->
    <div class="section-box">
      <div class="section-title">二、成绩汇总（Score Summary）</div>
      <div class="print-score-box">
        <div class="score-item">
          <div class="label">总题数</div>
          <div class="val">{{ scoreReport.total }}</div>
        </div>
        <div class="score-item">
          <div class="label">答对</div>
          <div class="val correct">{{ scoreReport.correctCount }}</div>
        </div>
        <div class="score-item">
          <div class="label">答错</div>
          <div class="val wrong">{{ scoreReport.wrongCount }}</div>
        </div>
        <div class="score-item">
          <div class="label">正确率</div>
          <div class="val">{{ scoreReport.accuracy }}%</div>
        </div>
        <div class="score-item">
          <div class="label">综合得分</div>
          <div class="val score-big">{{ scoreReport.score }}</div>
        </div>
      </div>
    </div>

    <!-- 三、答题详情与对错分析 -->
    <div class="section-box table-section">
      <div class="section-title">三、答题详情与对错分析（Answer Details）</div>
      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 15%">题号 (Gap)</th>
            <th style="width: 35%">你的答案 (Your Answer)</th>
            <th style="width: 35%">正确答案 (Correct Answer)</th>
            <th style="width: 15%">评判结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in scoreReport.details" :key="item.index">
            <td><strong>({{ item.index }})</strong></td>
            <td :class="{ 'wrong-ans': !item.isCorrect }">{{ item.userAns }}</td>
            <td class="correct-ans-cell">{{ item.correctAns }}</td>
            <td>
              <span v-if="item.isCorrect" class="status-badge ok">正确 ✓</span>
              <span v-else class="status-badge err">错误 ✕</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.print-only {
  display: none;
}
</style>

<style>
@media print {
  @page {
    size: A4;
    /* 核心修复：设置页面边距，防止四周被裁切 */
    margin: 10mm 12mm;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* 隐藏所有非打印区域元素 */
  body * {
    visibility: hidden !important;
  }

  /* 仅精准显示打印容器及其内部所有子元素 */
  #print-report-container, 
  #print-report-container * {
    visibility: visible !important;
  }

  #print-report-container {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    background: #ffffff !important;
    color: #1e293b !important;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif !important;
    line-height: 1.5 !important;
    z-index: 99999 !important;
  }

  .header-box {
    border-bottom: 2px solid #0f172a;
    padding-bottom: 6px;
    margin-bottom: 12px;
  }

  .report-title {
    /* 核心修复：减小标题字号，防止超长标题换行截断 */
    font-size: 16px;
    font-weight: bold;
    margin: 0 0 4px 0;
    color: #0f172a;
    word-break: break-all;
  }

  .meta-info {
    font-size: 11px;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }

  .section-box {
    margin-bottom: 12px;
  }

  .section-title {
    font-size: 12.5px;
    font-weight: bold;
    border-left: 3px solid #3b82f6;
    padding-left: 6px;
    margin-bottom: 6px;
    color: #0f172a;
  }

  .article-content {
    background: #f8fafc;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 11.5px;
    line-height: 1.6;
    border: 1px solid #e2e8f0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .print-score-box {
    display: flex;
    justify-content: space-around;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px;
    text-align: center;
  }

  .score-item {
    flex: 1;
  }

  .print-score-box .label {
    font-size: 10px;
    color: #64748b;
    margin-bottom: 1px;
  }

  .print-score-box .val {
    font-size: 14px;
    font-weight: bold;
    color: #1e293b;
  }

  .print-score-box .val.correct { color: #15803d; }
  .print-score-box .val.wrong { color: #b91c1c; }
  .print-score-box .val.score-big { font-size: 16px; color: #2563eb; }

  .print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .print-table th, 
  .print-table td {
    border: 1px solid #cbd5e1;
    /* 核心修复：收紧表格单元格上下边距，确保10题甚至更多题目能一口气完整塞进一页 */
    padding: 5px 8px;
    text-align: center;
  }

  .print-table th {
    background: #f1f5f9;
    font-weight: bold;
    color: #1e293b;
  }

  .wrong-ans {
    color: #b91c1c;
    text-decoration: line-through;
    background-color: #fee2e2;
  }

  .correct-ans-cell {
    color: #15803d;
    font-weight: 600;
  }

  .status-badge {
    display: inline-block;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
  }

  .status-badge.ok { background: #dcfce7; color: #15803d; }
  .status-badge.err { background: #fee2e2; color: #b91c1c; }
}
</style>
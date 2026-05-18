<template>
  <div class="eva-study-wrapper">
    <!-- 左侧列表 -->
    <nav class="word-side-list">
      <div class="list-header">
        <span 
          class="header-tag hidden-trigger" 
          @dblclick="startDictation"
          title="双击听写"
        >
          TODAY'S PICK 🍔
        </span>
        
        <!-- 🖨️ 新增功能：一键打印/导出全部单词为 DOCX -->
        <button class="print-docx-btn" @click="exportToDocx" title="导出全部单词为Word文档">
          📝 打印
        </button>

        <div class="progress-info">
          <span class="progress-num">{{ masteredCount }}/{{ initialWords.length }}</span>
          <div class="plankton-warning">
            <span class="warning-text">窃取中：痞老板警告</span>
            <span class="plankton-eye">
              <svg class="plankton-icon" width="13" height="16" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 6C7 6 6 2 4 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M17 6C17 6 18 2 20 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M12 28C6.47715 28 2 23.5228 2 18V9C2 6.23858 4.23858 4 7 4H17C19.7614 4 22 6.23858 22 9V18C22 23.5228 17.5228 28 12 28Z" fill="currentColor"/>
                <circle cx="12" cy="14" r="5" fill="white"/>
                <circle cx="12" cy="14" r="2.5" fill="#0f172a"/>
                <path d="M8 21.5C8.82843 23.2386 10.6046 24.5 12.5 24.5C14.3954 24.5 16.1716 23.2386 17 21.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
        </div>
      </div>

      <div class="scroll-area">
        <div 
          v-for="(item, index) in initialWords" 
          :key="index"
          class="mini-card"
          :class="{ 'is-active': currentIndex === index, 'is-done': item.m }"
          @click="selectWord(index)"
        >
          <div class="check-box" @click.stop="toggleMastery(index)">
            <span class="check-mark" v-if="item.m">✓</span>
          </div>
          <span class="en-text">{{ item.en }}</span>
        </div>
      </div>
    </nav>

    <!-- 右侧详情区 -->
    <main class="detail-stage">
      <div class="stage-content" v-if="currentWord.en">
        
        <section class="word-hero">
          <div class="hero-top">
            <h1>{{ currentWord.en }}</h1>
            <button class="voice-btn" @click="speak(currentWord.en)">🔊</button>
          </div>
          <div class="phonetic-tag" v-if="currentWord.ps">
            / {{ currentWord.ps }} /
          </div>
        </section>

        <section class="meaning-box" :class="{ 'revealed': isRevealed }" @click="isRevealed = true">
          <div class="section-label">中文释义</div>
          <div class="meaning-content">
            <p class="cn-text">{{ currentWord.cn }}</p>
            <div class="mask-layer" v-if="!isRevealed">
              <span class="eye-icon">👁️</span> 点击或回车显示释义
            </div>
          </div>
        </section>

        <section class="sentence-box" v-if="currentWord.s">
          <div class="section-label">例句</div>
          <div class="sentence-card">
            <p class="s-en" v-html="formatSentence(currentWord.s, currentWord.en)"></p>
            <button class="s-voice" @click="speak(currentWord.s)">点击朗读全句</button>
          </div>
        </section>

        <div class="stage-footer">
          <button class="nav-prev" :disabled="currentIndex === 0" @click="selectWord(currentIndex - 1)">上一个 (↑)</button>
          <button class="nav-next" :disabled="currentIndex === initialWords.length - 1" @click="selectWord(currentIndex + 1)">下一个 (Enter / ↓)</button>
        </div>
      </div>
    </main>

    <!-- ⚡ 听写清单模态弹窗（纯全显展示） -->
    <div class="dictation-overlay" v-if="dictationVisible" @click.self="closeDictation">
      <div class="dictation-modal">
        <button class="close-modal-btn" @click="closeDictation">✕</button>
        
        <div class="modal-header">
          <h3>📋 10词听写清单</h3>
          <button class="refresh-list-btn" @click="startDictation">🔄 换一组</button>
        </div>

        <div class="dictation-list-container">
          <div 
            v-for="(word, index) in dictationWords" 
            :key="index"
            class="dictation-list-item"
          >
            <span class="item-num">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="item-real-content">
              <span class="item-en">{{ word.en }}</span>
              <span class="item-ps" v-if="word.ps">/{{ word.ps }}/</span>
              <span class="item-cn">{{ word.cn }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
// 导入生成 docx 所需的模块
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle, TextRun } from 'docx'
import { saveAs } from 'file-saver'

const props = defineProps({
  student: Object,
  initialWords: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update-progress'])

const currentIndex = ref(0)
const isRevealed = ref(false)
const dictationVisible = ref(false)
const dictationWords = ref([])

// 开启听写
const startDictation = () => {
  if (props.initialWords.length === 0) return
  const shuffled = [...props.initialWords].sort(() => 0.5 - Math.random())
  dictationWords.value = shuffled.slice(0, 10)
  dictationVisible.value = true
}

const closeDictation = () => {
  dictationVisible.value = false
}

// 🖨️ 核心功能：构建并下载规范的 DOCX 文件
const exportToDocx = () => {
  if (props.initialWords.length === 0) {
    alert("当前没有可导出的单词！")
    return
  }

  // 1. 定义表头行
  const headerRow = new TableRow({
    children: [
      createCell("序号", true, "E2E8F0", 10),
      createCell("英文", true, "E2E8F0", 25),
      createCell("中文", true, "E2E8F0", 25),
      createCell("例句", true, "E2E8F0", 40),
    ],
    isHeader: true,
  })

  // 2. 遍历注入所有数据行
  const dataRows = props.initialWords.map((word, index) => {
    return new TableRow({
      children: [
        createCell(String(index + 1).padStart(2, '0'), false, null, 10, true), // 序号居中
        createCell(word.en || "", false, null, 25),
        createCell(word.cn || "", false, null, 25),
        createCell(word.s || "—", false, null, 40),
      ]
    })
  })

  // 3. 创建表格并配置基本样式 (100% 宽度，细微灰色边框)
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "F1F5F9" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "F1F5F9" },
    },
    rows: [headerRow, ...dataRows],
  })

  // 4. 组装整篇文档结构
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `${props.student.name} 单词清单`,
                bold: true,
                size: 32, // 16pt 字号
              }),
            ],
            spacing: { bottom: 400 },
          }),
          table,
        ],
      },
    ],
  })

  // 5. 编译打包成 Blob 并通过 file-saver 触发下载
  Packer.toBlob(doc).then((blob) => {
    const filename = `${props.student.name}_${new Date().toISOString().slice(0,10)}.docx`
    saveAs(blob, filename)
  }).catch(err => {
    console.error("生成Word文档失败：", err)
  })
}

// 辅助函数：快速创建符合排版规范的单元格
const createCell = (text, isHeader = false, bgColor = null, widthPercent = 25, centerText = false) => {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: bgColor ? { fill: bgColor } : undefined,
    margins: { top: 120, bottom: 120, left: 150, right: 150 }, // 单元格内边距
    children: [
      new Paragraph({
        alignment: centerText ? "center" : "left",
        children: [
          new TextRun({
            text: text,
            bold: isHeader,
            size: isHeader ? 22 : 20, // 表头字号略大
            font: "Microsoft YaHei", // 适配中文环境字体
          }),
        ],
      }),
    ],
  })
}

// 键盘监听
const handleKeyDown = (e) => {
  if (dictationVisible.value) {
    if (e.key === 'Escape') closeDictation()
    return 
  }

  if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault() }

  if (e.key === 'Enter') {
    if (!isRevealed.value) { isRevealed.value = true } 
    else if (currentIndex.value < props.initialWords.length - 1) { selectWord(currentIndex.value + 1) }
  } else if (e.key === 'ArrowDown' && currentIndex.value < props.initialWords.length - 1) {
    selectWord(currentIndex.value + 1)
  } else if (e.key === 'ArrowUp' && currentIndex.value > 0) {
    selectWord(currentIndex.value - 1)
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

watch(currentIndex, () => {
  setTimeout(() => {
    const activeEl = document.querySelector('.mini-card.is-active')
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, 50)
})

watch(() => props.initialWords, (newVal) => {
  if (currentIndex.value >= newVal.length) currentIndex.value = 0
}, { deep: true, immediate: true })

const currentWord = computed(() => props.initialWords[currentIndex.value] || {})
const masteredCount = computed(() => props.initialWords.filter(word => word.m).length)

const selectWord = (index) => {
  currentIndex.value = index
  isRevealed.value = false
  speak(props.initialWords[index].en)
}

const toggleMastery = (index) => {
  const words = [...props.initialWords]
  words[index].m = !words[index].m
  emit('update-progress', words)
}

const speak = (text) => {
  if (!text) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = 'en-US'
  msg.rate = 0.85
  window.speechSynthesis.speak(msg)
}

const formatSentence = (s, word) => {
  if (!s || !word) return s
  const regex = new RegExp(`(${word})`, 'gi')
  return s.replace(regex, '<b class="highlight">$1</b>')
}
</script>

<style scoped>
/* ==================== 基础骨架样式 ==================== */
.eva-study-wrapper { display: flex; flex: 1; height: 100%; background: #ffffff; overflow: hidden; }
.word-side-list { width: 255px; height: 100%; border-right: 1px solid #f1f5f9; display: flex; flex-direction: column; background: #ffffff; flex-shrink: 0; }
.list-header { padding: 25px 20px 15px; display: flex; flex-direction: column; gap: 10px; }
.header-tag { font-size: 10px; font-weight: 800; color: #27ae60; letter-spacing: 1px; display: inline-block; }

/* ✨ 新增：高质感打印按钮样式 */
.print-docx-btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}
.print-docx-btn:hover {
  background: #1e293b;
  color: #ffffff;
  border-color: #1e293b;
  box-shadow: 0 4px 12px rgba(30, 41, 59, 0.1);
}

.hidden-trigger { cursor: help; padding: 2px 4px; border-radius: 4px; transition: all 0.2s ease; user-select: none; align-self: flex-start; }
.hidden-trigger:hover { background: #f0fdf4; color: #1e293b; }

.scroll-area { flex: 1; overflow-y: auto; padding: 0 10px 20px; }
.mini-card { display: flex; align-items: center; padding: 10px 14px; border-radius: 8px; cursor: pointer; margin-bottom: 2px; transition: 0.2s; }
.mini-card.is-active { background: #f1f5f9; }
.en-text { font-size: 14px; color: #334155; font-weight: 500; }
.is-done .en-text { color: #cbd5e1; text-decoration: line-through; }
.check-box { width: 16px; height: 16px; border: 2px solid #e2e8f0; border-radius: 4px; margin-right: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; }
.is-done .check-box { background: #27ae60; border-color: #27ae60; }
.check-mark { color: white; font-size: 10px; }

.detail-stage { flex: 1; height: 100%; overflow-y: auto; background: #ffffff; scrollbar-gutter: stable; }
.stage-content { width: 100%; max-width: 800px; margin: 0 auto; padding: 40px 60px; }
.word-hero { margin-bottom: 25px; }
.hero-top { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.word-hero h1 { font-size: 64px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1; }

.phonetic-tag { display: inline-block; margin-top: 8px; padding: 4px 12px; background: #f8fafc; color: #64748b; border-radius: 6px; font-size: 18px; }

.meaning-box { position: relative; background: #f8fafc; border: 1px dashed #e2e8f0; padding: 30px 40px; border-radius: 20px; cursor: pointer; margin-bottom: 30px; min-height: 110px; display: flex; flex-direction: column; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.meaning-box.revealed { background: #ffffff; border: 1px solid #27ae60; box-shadow: 0 10px 25px -5px rgba(39, 174, 96, 0.1); }
.section-label { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; margin-bottom: 12px; text-transform: uppercase; }
.cn-text { font-size: 32px; font-weight: 700; color: #27ae60; margin: 0; line-height: 1.2; }
.mask-layer { position: absolute; inset: 0; background: #f1f5f9; border-radius: 18px; display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748b; font-weight: 600; font-size: 17px; z-index: 10; }

.sentence-card { border-left: 4px solid #27ae60; padding: 5px 25px; margin-bottom: 10px; }
.s-en { font-size: 22px; line-height: 1.5; color: #334155; font-family: 'Georgia', serif; }
:deep(.highlight) { color: #27ae60; border-bottom: 2px solid #27ae6033; }

.stage-footer { margin-top: 50px; display: flex; gap: 20px; padding-bottom: 60px; }
.nav-prev, .nav-next { flex: 1; padding: 18px; border-radius: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: 1px solid #e2e8f0; font-size: 16px; display: flex; align-items: center; justify-content: center; }
.nav-next { background: #1e293b; color: #ffffff; border-color: #1e293b; box-shadow: 0 4px 12px rgba(30, 41, 59, 0.15); }
.nav-next:hover { transform: translateY(-2px); background: #334155; }
.nav-prev { background: #ffffff; color: #64748b; }
.nav-prev:hover:not(:disabled) { background: #f8fafc; color: #0f172a; }
.nav-prev:disabled { opacity: 0.3; cursor: not-allowed; }

.voice-btn { background: #f1f5f9; border: none; outline: none; cursor: pointer; width: 44px; height: 44px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 20px; color: #64748b; margin-left: 12px; vertical-align: middle; }
.voice-btn:hover { background: #27ae60; color: white; transform: scale(1.1); box-shadow: 0 4px 12px rgba(39, 174, 96, 0.2); }
.voice-btn:active { transform: scale(0.95); }

.s-voice { margin-top: 20px; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 12px; font-size: 14px; color: #64748b; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
.s-voice:hover { border-color: #27ae60; color: #27ae60; background: #f0fdf4; }

.progress-info { display: flex; align-items: center; gap: 8px; justify-content: space-between; width: 100%; }
.progress-num { font-family: 'Monaco', monospace; font-size: 14px; font-weight: 800; color: #0f172a; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
.plankton-warning { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 6px; position: relative; overflow: hidden; }
.warning-text { font-size: 9px; font-weight: 600; color: #166534; letter-spacing: 0.3px; text-transform: uppercase; }
.plankton-eye { display: inline-flex; align-items: center; justify-content: center; margin-left: 4px; animation: plankton-life 3s infinite ease-in-out; transform-origin: center bottom; }
.plankton-icon { display: block; color: #27ae60; transition: color 0.3s ease; }

@keyframes plankton-life {
  0%, 100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 0px rgba(39, 174, 96, 0)); }
  50% { transform: scale(1.1) rotate(3deg); filter: drop-shadow(0 0 3px rgba(39, 174, 96, 0.4)); }
}
.plankton-warning::before { content: ''; width: 4px; height: 4px; background: #22c55e; border-radius: 50%; margin-right: 4px; box-shadow: 0 0 5px #22c55e; animation: led-blink 1s infinite; }
@keyframes led-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }


/* ==================== 听写清单弹窗样式 ==================== */
.dictation-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.25); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease-out; }
.dictation-modal { background: #ffffff; width: 90%; max-width: 680px; max-height: 85vh; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15); padding: 25px 30px; position: relative; display: flex; flex-direction: column; animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.close-modal-btn { position: absolute; top: 22px; right: 25px; background: #f1f5f9; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.close-modal-btn:hover { background: #ef4444; color: white; }
.modal-header { display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px; }
.modal-header h3 { margin: 0; font-size: 16px; color: #0f172a; font-weight: 700; }
.refresh-list-btn { background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.2s; }
.refresh-list-btn:hover { background: #f1f5f9; color: #27ae60; border-color: #27ae60; }
.dictation-list-container { flex: 1; overflow-y: auto; padding-right: 5px; }
.dictation-list-item { display: flex; align-items: center; padding: 10px 14px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; margin-bottom: 8px; }
.item-num { font-family: 'Monaco', monospace; font-size: 13px; font-weight: 800; color: #94a3b8; margin-right: 15px; background: #ffffff; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid #e2e8f0; }
.item-real-content { display: flex; align-items: baseline; gap: 12px; width: 100%; }
.item-en { font-size: 18px; font-weight: 700; color: #0f172a; }
.item-ps { font-size: 13px; color: #64748b; font-family: sans-serif; }
.item-cn { font-size: 14px; font-weight: 600; color: #27ae60; margin-left: auto; text-align: right; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleUp { from { transform: scale(0.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
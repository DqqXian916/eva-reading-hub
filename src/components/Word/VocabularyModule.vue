<template>
  <div class="eva-study-wrapper">
    <!-- 左侧列表 -->
    <nav class="word-side-list">
      <div class="list-header">
        <span class="header-tag hidden-trigger" @dblclick="startDictation" title="双击听写">
          TODAY'S PICK 🍔
        </span>

        <!-- 🖨️ 导出全部单词为 DOCX -->
        <button class="print-docx-btn" @click="exportToDocx" title="导出全部单词为Word文档">
          📝 打印
        </button>

        <div class="progress-info">
          <span class="progress-num">{{ masteredCount }}/{{ initialWords.length }}</span>
          <div class="plankton-warning">
            <span class="warning-text">窃取中：痞老板警告</span>
            <span class="plankton-eye">
              <svg class="plankton-icon" width="13" height="16" viewBox="0 0 24 32" fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path d="M7 6C7 6 6 2 4 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <path d="M17 6C17 6 18 2 20 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <path
                  d="M12 28C6.47715 28 2 23.5228 2 18V9C2 6.23858 4.23858 4 7 4H17C19.7614 4 22 6.23858 22 9V18C22 23.5228 17.5228 28 12 28Z"
                  fill="currentColor" />
                <circle cx="12" cy="14" r="5" fill="white" />
                <circle cx="12" cy="14" r="2.5" fill="#0f172a" />
                <path d="M8 21.5C8.82843 23.2386 10.6046 24.5 12.5 24.5C14.3954 24.5 16.1716 23.2386 17 21.5"
                  stroke="white" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </span>
          </div>
        </div>

        <!-- 🔍 单词搜索框 -->
        <div class="search-box">
          <span class="search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input 
            type="text" 
            class="search-input" 
            v-model="searchQuery" 
            placeholder="搜索英文或中文..." 
            @input="handleSearchInput"
          />
          <button v-if="searchQuery" class="clear-search-btn" @click="clearSearch" title="清空搜索">✕</button>
        </div>

        <!-- 🔍 单词状态筛选器 (全部 / 未掌握 / 已掌握) -->
        <div class="filter-tabs">
          <button 
            class="tab-btn" 
            :class="{ active: activeFilter === 'all' }" 
            @click="setFilter('all')"
          >
            全部 ({{ initialWords.length }})
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeFilter === 'unmastered' }" 
            @click="setFilter('unmastered')"
          >
            不会 ({{ initialWords.length - masteredCount }})
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeFilter === 'mastered' }" 
            @click="setFilter('mastered')"
          >
            会了 ({{ masteredCount }})
          </button>
        </div>
      </div>

      <!-- 滚动单词区域 -->
      <div class="scroll-area">
        <template v-if="paginatedWords.length > 0">
          <div v-for="(item) in paginatedWords" :key="item.originalIndex" class="mini-card"
            :class="{ 'is-active': currentIndex === item.originalIndex, 'is-done': item.m }" 
            @click="selectWordByRealIndex(item.originalIndex)">
            <div class="check-box" @click.stop="toggleMastery(item.originalIndex)">
              <span class="check-mark" v-if="item.m">✓</span>
            </div>
            <span class="en-text">{{ item.en }}</span>
          </div>
        </template>
        <div class="empty-tip" v-else>
          {{ searchQuery ? '未找到匹配单词' : '无对应单词' }}
        </div>
      </div>

      <!-- 📄 极简底部分页控制条 -->
      <div class="pagination-bar" v-if="totalPages > 1">
        <button class="page-btn" :disabled="currentPage === 1" @click="prevPage" title="上一页">‹</button>
        <div class="page-jump-box">
          <input 
            type="number" 
            class="page-input" 
            v-model.number="pageInput" 
            @keydown.enter="jumpToPage" 
            @blur="jumpToPage"
            min="1" 
            :max="totalPages"
          />
          <span class="page-total">/ {{ totalPages }}</span>
        </div>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage" title="下一页">›</button>
      </div>
    </nav>

    <!-- 右侧详情区 -->
    <main class="detail-stage">
      <div class="stage-content" v-if="currentWord && currentWord.en">

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
          <button class="nav-prev" :disabled="isFirstInFiltered" @click="selectPrevInFiltered">上一个 (↑)</button>
          <button class="nav-next" :disabled="isLastInFiltered" @click="selectNextInFiltered">下一个 (Enter / ↓) [ Q 键标记 ]</button>
        </div>
      </div>
      <div class="empty-stage" v-else>
        <p>当前筛选状态下没有可学习的单词 ~</p>
      </div>
    </main>

    <!-- ⚡ 听写清单模态弹窗 -->
    <div class="dictation-overlay" v-if="dictationVisible" @click.self="closeDictation">
      <div class="dictation-modal">
        <button class="close-modal-btn" @click="closeDictation">✕</button>

        <div class="modal-header">
          <h3>10词清单</h3>
          <button class="refresh-list-btn" @click="startDictation">🔄 </button>
        </div>

        <div class="dictation-list-container">
          <div v-for="(word, index) in dictationWords" :key="index" class="dictation-list-item">
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

// 🔍 筛选与搜索相关状态
const activeFilter = ref('all') // 'all' | 'unmastered' | 'mastered'
const searchQuery = ref('')      // 搜索关键词

// 📄 分页与跳页响应式状态
const currentPage = ref(1)
const pageSize = ref(20)
const pageInput = ref(1)

// 🔍 过滤后的基础列表（包含状态筛选与中英文关键词匹配）
const filteredWords = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return props.initialWords
    .map((word, index) => ({ ...word, originalIndex: index }))
    .filter(word => {
      // 1. 状态筛选
      if (activeFilter.value === 'mastered' && !word.m) return false
      if (activeFilter.value === 'unmastered' && word.m) return false

      // 2. 搜索关键词模糊匹配 (英文 / 中文)
      if (query) {
        const enMatch = word.en ? word.en.toLowerCase().includes(query) : false
        const cnMatch = word.cn ? word.cn.toLowerCase().includes(query) : false
        return enMatch || cnMatch
      }

      return true
    })
})

// 📄 基于过滤后列表计算总页数与当页数据
const totalPages = computed(() => {
  return Math.ceil(filteredWords.value.length / pageSize.value) || 1
})

const paginatedWords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredWords.value.slice(start, start + pageSize.value)
})

// 当前过滤数组中选中项的位置信息
const filteredCurrentIndex = computed(() => {
  return filteredWords.value.findIndex(item => item.originalIndex === currentIndex.value)
})

const isFirstInFiltered = computed(() => filteredCurrentIndex.value <= 0)
const isLastInFiltered = computed(() => filteredCurrentIndex.value === -1 || filteredCurrentIndex.value >= filteredWords.value.length - 1)

// 搜索框输入监听
const handleSearchInput = () => {
  currentPage.value = 1
  pageInput.value = 1
  if (filteredWords.value.length > 0) {
    const targetRealIndex = filteredWords.value[0].originalIndex
    currentIndex.value = targetRealIndex
    isRevealed.value = false
    // 静音切换：此处不再调用 speak()，避免打字时连续发音
  }
}

// 清空搜索框
const clearSearch = () => {
  searchQuery.value = ''
  currentPage.value = 1
  pageInput.value = 1
  if (filteredWords.value.length > 0) {
    currentIndex.value = filteredWords.value[0].originalIndex
    isRevealed.value = false
  }
}

// 设置筛选条件
const setFilter = (filterType) => {
  activeFilter.value = filterType
  currentPage.value = 1
  pageInput.value = 1
  
  if (filteredWords.value.length > 0) {
    selectWordByRealIndex(filteredWords.value[0].originalIndex)
  }
}

// 保持页码输入框与当前页同步
watch(currentPage, (val) => {
  pageInput.value = val
})

// 📄 跳页与切换逻辑
const jumpToPage = () => {
  let target = parseInt(pageInput.value, 10)
  if (isNaN(target) || target < 1) target = 1
  if (target > totalPages.value) target = totalPages.value
  
  currentPage.value = target
  pageInput.value = target
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

// 选中对应全局真实索引的单词，并同步调整页码
const selectWordByRealIndex = (realIndex) => {
  if (realIndex < 0 || realIndex >= props.initialWords.length) return
  currentIndex.value = realIndex
  isRevealed.value = false
  
  const targetFilteredPos = filteredWords.value.findIndex(item => item.originalIndex === realIndex)
  if (targetFilteredPos !== -1) {
    const targetPage = Math.floor(targetFilteredPos / pageSize.value) + 1
    if (currentPage.value !== targetPage) {
      currentPage.value = targetPage
    }
  }

  speak(props.initialWords[realIndex].en)
}

// 在筛选列表中切换上一个/下一个
const selectPrevInFiltered = () => {
  if (isFirstInFiltered.value) return
  const prevItem = filteredWords.value[filteredCurrentIndex.value - 1]
  if (prevItem) selectWordByRealIndex(prevItem.originalIndex)
}

const selectNextInFiltered = () => {
  if (isLastInFiltered.value) return
  const nextItem = filteredWords.value[filteredCurrentIndex.value + 1]
  if (nextItem) selectWordByRealIndex(nextItem.originalIndex)
}

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

// 🖨️ 导出 Word 文档
const exportToDocx = () => {
  if (props.initialWords.length === 0) {
    alert("当前没有可导出的单词！")
    return
  }

  const headerRow = new TableRow({
    children: [
      createCell("序号", true, "E2E8F0", 10),
      createCell("英文", true, "E2E8F0", 25),
      createCell("中文", true, "E2E8F0", 25),
      createCell("例句", true, "E2E8F0", 40),
    ],
    isHeader: true,
  })

  const dataRows = props.initialWords.map((word, index) => {
    return new TableRow({
      children: [
        createCell(String(index + 1).padStart(2, '0'), false, null, 10, true),
        createCell(word.en || "", false, null, 25),
        createCell(word.cn || "", false, null, 25),
        createCell(word.s || "—", false, null, 40),
      ]
    })
  })

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

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `${props.student?.name || ''} 单词清单`,
                bold: true,
                size: 32,
              }),
            ],
            spacing: { bottom: 400 },
          }),
          table,
        ],
      },
    ],
  })

  Packer.toBlob(doc).then((blob) => {
    const filename = `${props.student?.name || 'student'}_${new Date().toISOString().slice(0, 10)}.docx`
    saveAs(blob, filename)
  }).catch(err => {
    console.error("生成Word文档失败：", err)
  })
}

const createCell = (text, isHeader = false, bgColor = null, widthPercent = 25, centerText = false) => {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: bgColor ? { fill: bgColor } : undefined,
    margins: { top: 120, bottom: 120, left: 150, right: 150 },
    children: [
      new Paragraph({
        alignment: centerText ? "center" : "left",
        children: [
          new TextRun({
            text: text,
            bold: isHeader,
            size: isHeader ? 22 : 20,
            font: "Microsoft YaHei",
          }),
        ],
      }),
    ],
  })
}

// 键盘监听（搜索框聚焦时不触发全局快捷键）
const handleKeyDown = (e) => {
  if (
    document.activeElement.classList.contains('page-input') || 
    document.activeElement.classList.contains('search-input')
  ) {
    return
  }

  if (dictationVisible.value) {
    if (e.key === 'Escape') closeDictation()
    return
  }
  if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault() }
  
  if (e.key === 'q' || e.key === 'Q') {
    toggleMastery(currentIndex.value)
    return
  }
  if (e.key === 'Enter') {
    if (!isRevealed.value) { 
      isRevealed.value = true 
    } else { 
      selectNextInFiltered()
    }
  } else if (e.key === 'ArrowDown') {
    selectNextInFiltered()
  } else if (e.key === 'ArrowUp') {
    selectPrevInFiltered()
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

// 仅当单词总条数发生变化（如加载新单词包）时重置索引和页码
watch(() => props.initialWords.length, (newLength) => {
  if (currentIndex.value >= newLength) {
    currentIndex.value = 0
  }
  currentPage.value = 1
}, { immediate: true })

const currentWord = computed(() => props.initialWords[currentIndex.value] || {})
const masteredCount = computed(() => props.initialWords.filter(word => word.m).length)

// 切换单词掌握状态
const toggleMastery = (index) => {
  const words = [...props.initialWords]
  words[index].m = !words[index].m
  // 记录操作前当前单词在筛选列表中的位置
  const currentPosInFiltered = filteredCurrentIndex.value
  // 向父组件派发更新
  emit('update-progress', words)
  // 如果是在按分类筛选（如“不会”/“会了”）的模式下，当前单词状态改变后会从当前视图消失
  // 此时自动选中原位置上的下一个单词
  if (activeFilter.value !== 'all') {
    setTimeout(() => {
      if (filteredWords.value.length === 0) return
      // 取原位置的单词，若已经是最后一项则取新的最后一项
      const nextTargetPos = Math.min(currentPosInFiltered, filteredWords.value.length - 1)
      const targetItem = filteredWords.value[nextTargetPos]
      if (targetItem) {
        currentIndex.value = targetItem.originalIndex
        // 确保页码不会溢出
        if (currentPage.value > totalPages.value) {
          currentPage.value = totalPages.value
        }
      }
    }, 0)
  }
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
.eva-study-wrapper {
  display: flex;
  flex: 1;
  height: 100%;
  background: #ffffff;
  overflow: hidden;
}

.word-side-list {
  width: 265px;
  height: 100%;
  border-right: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  flex-shrink: 0;
}

.list-header {
  padding: 16px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-tag {
  font-size: 10px;
  font-weight: 800;
  color: #78A355;
  letter-spacing: 1px;
  display: inline-block;
}

/* 🔍 搜索框样式 */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  pointer-events: none;
  transition: color 0.2s ease;
}

.search-input {
  width: 100%;
  padding: 7px 28px 7px 30px;
  font-size: 12px;
  font-weight: 500;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  outline: none;
  background: #f8fafc;
  color: #0f172a;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-input::placeholder {
  color: #94a3b8;
  font-size: 12px;
}

.search-box:hover .search-input:not(:focus) {
  border-color: #cbd5e1;
  background: #ffffff;
}

.search-input:focus {
  background: #ffffff;
  border-color: #27ae60;
  box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.12), 0 2px 4px rgba(0, 0, 0, 0.02);
}

.search-box:focus-within .search-icon {
  color: #27ae60;
}

.clear-search-btn {
  position: absolute;
  right: 6px;
  width: 18px;
  height: 18px;
  background: #e2e8f0;
  border: none;
  font-size: 10px;
  font-weight: bold;
  color: #64748b;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  line-height: 1;
}

.clear-search-btn:hover {
  color: #ffffff;
  background: #94a3b8;
  transform: scale(1.08);
}

.clear-search-btn:active {
  transform: scale(0.95);
}

/* 🔍 筛选按钮组样式 */
.filter-tabs {
  display: flex;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 5px 0;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-btn:hover {
  color: #0f172a;
}

.tab-btn.active {
  background: #ffffff;
  color: #27ae60;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 10px;
}

/* 📄 极简底部分页控制条样式 */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 16px 12px;
  flex-shrink: 0;
}

.page-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: #27ae60;
}

.page-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.page-jump-box {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-input {
  width: 28px;
  height: 20px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  font-family: 'Monaco', monospace;
  color: #0f172a;
  background: transparent;
  border: none;
  border-bottom: 1.5px solid #cbd5e1;
  border-radius: 0;
  padding: 0;
  outline: none;
  transition: border-color 0.2s ease;
}

.page-input:focus {
  border-color: #27ae60;
}

.page-input::-webkit-inner-spin-button,
.page-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.page-total {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  font-family: 'Monaco', monospace;
}

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

.hidden-trigger {
  cursor: help;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  user-select: none;
  align-self: flex-start;
}

.hidden-trigger:hover {
  background: #f0fdf4;
  color: #1e293b;
}

.empty-tip {
  padding: 30px 0;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}

.mini-card {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 2px;
  transition: 0.2s;
}

.mini-card.is-active {
  background: #f1f5f9;
}

.en-text {
  font-size: 14px;
  color: #334155;
  font-weight: 500;
}

.is-done .en-text {
  color: #cbd5e1;
  text-decoration: line-through;
}

.check-box {
  width: 16px;
  height: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 4px;
  margin-right: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
}

.is-done .check-box {
  background: #6bb392;
  border-color: #6bb392;
}

.check-mark {
  color: white;
  font-size: 10px;
}

.detail-stage {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  background: #ffffff;
  scrollbar-gutter: stable;
}

.empty-stage {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 16px;
}

.stage-content {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 60px;
}

.word-hero {
  margin-bottom: 25px;
}

.hero-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.word-hero h1 {
  font-size: 64px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  line-height: 1;
}

.phonetic-tag {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 12px;
  background: #f8fafc;
  color: #64748b;
  border-radius: 6px;
  font-size: 18px;
}

.meaning-box {
  position: relative;
  background: #f8fafc;
  border: 1px dashed #e2e8f0;
  padding: 30px 40px;
  border-radius: 20px;
  cursor: pointer;
  margin-bottom: 30px;
  min-height: 110px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.meaning-box.revealed {
  background: #ffffff;
  border: 1px solid #27ae60;
  box-shadow: 0 10px 25px -5px rgba(39, 174, 96, 0.1);
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 1.5px;
  margin-bottom: 12px;
  text-transform: uppercase;
}

.cn-text {
  font-size: 32px;
  font-weight: 700;
  color: #27ae60;
  margin: 0;
  line-height: 1.2;
}

.mask-layer {
  position: absolute;
  inset: 0;
  background: #f1f5f9;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #64748b;
  font-weight: 600;
  font-size: 17px;
  z-index: 10;
}

.sentence-card {
  border-left: 4px solid #6e8b74;
  padding: 5px 25px;
  margin-bottom: 10px;
}

.s-en {
  font-size: 22px;
  line-height: 1.5;
  color: #334155;
  font-family: 'Georgia', serif;
}

:deep(.highlight) {
  color: #7BA57B;
  border-bottom: 2px solid #27ae6033;
}

.stage-footer {
  margin-top: 50px;
  display: flex;
  gap: 20px;
  padding-bottom: 60px;
}

.nav-prev,
.nav-next {
  flex: 1;
  padding: 18px;
  border-radius: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e2e8f0;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-next {
  background: #1e293b;
  color: #ffffff;
  border-color: #1e293b;
  box-shadow: 0 4px 12px rgba(30, 41, 59, 0.15);
}

.nav-next:hover:not(:disabled) {
  transform: translateY(-2px);
  background: #334155;
}

.nav-next:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-prev {
  background: #ffffff;
  color: #64748b;
}

.nav-prev:hover:not(:disabled) {
  background: #f8fafc;
  color: #0f172a;
}

.nav-prev:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.voice-btn {
  background: #f1f5f9;
  border: none;
  outline: none;
  cursor: pointer;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 20px;
  color: #64748b;
  margin-left: 12px;
  vertical-align: middle;
}

.voice-btn:hover {
  background: #27ae60;
  color: white;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.2);
}

.voice-btn:active {
  transform: scale(0.95);
}

.s-voice {
  margin-top: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.s-voice:hover {
  border-color: #27ae60;
  color: #27ae60;
  background: #f0fdf4;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  width: 100%;
}

.progress-num {
  font-family: 'Monaco', monospace;
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}

.plankton-warning {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #f0fdf4;
  border: 1px solid #dcfce7;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.warning-text {
  font-size: 9px;
  font-weight: 600;
  color: #166534;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

.plankton-eye {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  animation: plankton-life 3s infinite ease-in-out;
  transform-origin: center bottom;
}

.plankton-icon {
  display: block;
  color: #27ae60;
  transition: color 0.3s ease;
}

@keyframes plankton-life {

  0%,
  100% {
    transform: scale(1) rotate(0deg);
    filter: drop-shadow(0 0 0px rgba(39, 174, 96, 0));
  }

  50% {
    transform: scale(1.1) rotate(3deg);
    filter: drop-shadow(0 0 3px rgba(39, 174, 96, 0.4));
  }
}

.plankton-warning::before {
  content: '';
  width: 4px;
  height: 4px;
  background: #22c55e;
  border-radius: 50%;
  margin-right: 4px;
  box-shadow: 0 0 5px #22c55e;
  animation: led-blink 1s infinite;
}

@keyframes led-blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}

/* ==================== 听写清单弹窗样式 ==================== */
.dictation-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease-out;
}

.dictation-modal {
  background: #ffffff;
  width: 90%;
  max-width: 680px;
  max-height: 85vh;
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  padding: 25px 30px;
  position: relative;
  display: flex;
  flex-direction: column;
  animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.close-modal-btn {
  position: absolute;
  top: 22px;
  right: 25px;
  background: #f1f5f9;
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}

.close-modal-btn:hover {
  background: #ef4444;
  color: white;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 15px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 16px;
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
  font-weight: 700;
}

.refresh-list-btn {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: 0.2s;
}

.refresh-list-btn:hover {
  background: #f1f5f9;
  color: #27ae60;
  border-color: #27ae60;
}

.dictation-list-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 5px;
}

.dictation-list-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  margin-bottom: 8px;
}

.item-num {
  font-family: 'Monaco', monospace;
  font-size: 13px;
  font-weight: 800;
  color: #94a3b8;
  margin-right: 15px;
  background: #ffffff;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.item-real-content {
  display: flex;
  align-items: baseline;
  gap: 12px;
  width: 100%;
}

.item-en {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.item-ps {
  font-size: 13px;
  color: #64748b;
  font-family: sans-serif;
}

.item-cn {
  font-size: 14px;
  font-weight: 600;
  color: #355E3B;
  margin-left: auto;
  text-align: right;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from {
    transform: scale(0.97);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
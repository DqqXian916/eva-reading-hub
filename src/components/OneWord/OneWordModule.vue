<script setup>
/**
 * Props 说明：
 * quoteList: 一言数据历史数组 [ { id: '', english: '', chinese: '' }, ... ]
 * canEdit: 是否处于管理模式（对应父组件的 isAdminMode）
 * isFullScreen: 是否处于全屏沉浸模式
 */
import { ref, watch, computed } from 'vue'

const props = defineProps({
  quoteList: {
    type: Array,
    default: () => []
  },
  canEdit: Boolean,
  isFullScreen: Boolean
})

// 🚀 增加 onDelete 事件，用于通知父组件从云端抹除某条历史
const emit = defineEmits(['toggleFull', 'save', 'delete'])

// 局部响应式状态
const showChinese = ref(false)  // 控制学生端是否显示中文翻译
const editEnglish = ref('')     // 老师端编辑的英文
const editChinese = ref('')     // 老师端编辑的中文

const latestQuote = computed(() => {
  if (!props.quoteList || props.quoteList.length === 0) return null
  const validQuotes = props.quoteList.filter(q => q && q.english)
  if (validQuotes.length === 0) return null
  return validQuotes[validQuotes.length - 1]
})

// 计算属性：倒序排列的历史记录（最新的排在历史列表最上面）
const reversedHistory = computed(() => {
  if (!props.quoteList) return []
  return [...props.quoteList].reverse()
})

// 智能监听：同步成功追加数据时清空输入
watch(() => props.quoteList?.length, (newLength, oldLength) => {
  if (oldLength !== undefined && newLength > oldLength) {
    editEnglish.value = ''
    editChinese.value = ''
    showChinese.value = true 
  }
})

// 提交处理
const handleSync = () => {
  if (!editEnglish.value.trim() || !editChinese.value.trim()) return
  emit('save', {
    english: editEnglish.value.trim(),
    chinese: editChinese.value.trim()
  })
}
</script>

<template>
  <div :class="['sentence-view', { 'is-full-screen': isFullScreen }]">
    <div class="sentence-toolbar">
      <div class="exclusive-badge">✨ Eva老师 爱徒专用 ❤️</div>
      <div class="tool-group">
        <button class="btn-tool" @click="$emit('toggleFull')">
          {{ isFullScreen ? '退出 ↙' : '全屏 ↗' }}
        </button>
      </div>
    </div>

    <!-- 🚀 外层包裹一个滚动容器，防止历史记录变多时撑爆屏幕 -->
    <div class="scroll-wrapper">
      <div class="content-container">
        
        <div v-if="canEdit" class="panel-wrapper admin-panel">
          <div class="module-tag">一 言 语 · 录 入 模 式 🛠️</div>
          
          <div class="inputs-group animate-slide">
            <textarea
              v-model="editEnglish"
              placeholder="Today's Quote (English)..."
              rows="3"
              maxLength="400"
              className="input-eng"
            ></textarea>
            
            <div class="center-divider minimal"></div>
            
            <input 
              v-model="editChinese" 
              type="text" 
              placeholder="对应中文释义..." 
              className="input-cn"
              @keyup.enter="handleSync"
            />
          </div>

          <div class="action-zone">
            <button class="btn-sync" :disabled="!editEnglish.trim() || !editChinese.trim()" @click="handleSync">
              同 步 至 云 端
            </button>
          </div>
        </div>

        <div v-else class="panel-wrapper student-panel">
          <div class="header-action-row">
            <div class="student-tag">DAILY REFLECTION（每日一言） 🌟</div>
            
            <button 
              class="lang-toggle-btn" 
              :class="{ 'is-active': showChinese }"
              @click="showChinese = !showChinese"
            >
              {{ showChinese ? '隐去中文' : '对照中文' }}
            </button>
          </div>

          <div class="quote-display-card">
            <p class="article-text font-serif">
              {{ latestQuote?.english || 'No quote recorded for today.' }}
            </p>
            
            <div class="center-divider"></div>
            
            <Transition name="fade-blur">
              <p v-if="showChinese" class="chinese-translation">
                {{ latestQuote?.chinese || '暂无中文释义。' }}
              </p>
            </Transition>
          </div>
          
          <div class="footer-sign">TO BE CONTINUED.</div>
        </div>

      </div>

      <!-- 🚀 新增：历史一言时光机面板（全屏时自动隐藏保持沉浸感） -->
      <div v-if="!isFullScreen && reversedHistory.length > 0" class="history-container">
        <div class="history-header">
          <span class="history-title">📜 时 光 机</span>
          <span class="history-count">已积累 {{ reversedHistory.length }} 条精选</span>
        </div>
        
        <div class="history-list">
          <div v-for="(item, index) in reversedHistory" :key="item.id || index" class="history-item">
            <div class="history-content">
              <p class="hist-eng">{{ item.english }}</p>
              <p class="hist-cn">{{ item.chinese }}</p>
            </div>
            <!-- 只有管理模式下显示删除按钮 -->
            <button v-if="canEdit" class="btn-delete-hist" @click="$emit('delete', item)" title="从云端抹除此条记录">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 继承并内聚你原有的系统设计语言 */
.sentence-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #fafafa; /* 干净的纸张偏白调 */
  overflow: hidden;
}

.scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sentence-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 25px;
  border-bottom: 1px solid #f1f5f9;
  background: white;
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

.exclusive-badge {
  padding: 4px 12px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 15px;
  color: #e11d48;
  font-size: 12px;
  font-weight: 600;
}

/* 核心布局结构 */
.content-container {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  position: relative;
}

.panel-wrapper {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 学生端排版美学 */
.header-action-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 50px;
}

.student-tag, .module-tag {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.1em;
}

.quote-display-card {
  text-align: center;
  width: 100%;
}

.font-serif {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 26px;
  line-height: 1.7;
  color: #1e293b;
  font-weight: 300;
  letter-spacing: 0.01em;
  margin: 0;
}

.center-divider {
  width: 35px;
  height: 1px;
  background: #cbd5e1;
  margin: 40px auto;
}

.center-divider.minimal {
  width: 25px;
  margin: 25px auto;
}

.chinese-translation {
  font-size: 15px;
  color: #64748b;
  line-height: 1.9;
  letter-spacing: 0.15em;
  margin: 0;
}

.footer-sign {
  margin-top: 60px;
  font-size: 10px;
  letter-spacing: 0.4em;
  color: #cbd5e1;
  font-weight: 300;
}

/* 老师端输入排版 */
.admin-panel {
  max-width: 500px;
}

.module-tag {
  margin-bottom: 40px;
  letter-spacing: 0.2em;
}

.inputs-group {
  width: 100%;
  background: white;
  padding: 40px 30px;
  border-radius: 20px;
  border: 1px solid #eef2f6;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);
}

.inputs-group textarea, .inputs-group input {
  width: 100%;
  background: transparent;
  border: none;
  text-align: center;
  outline: none;
  box-sizing: border-box;
}

.input-eng {
  font-family: 'Georgia', serif;
  font-size: 18px;
  color: #334155;
  resize: none;
  line-height: 1.6;
}

.input-cn {
  font-size: 14px;
  color: #64748b;
  letter-spacing: 0.05em;
}

.inputs-group textarea::placeholder,
.inputs-group input::placeholder {
  color: #cbd5e1;
}

.action-zone {
  margin-top: 35px;
  width: 100%;
}

.btn-sync {
  width: 100%;
  height: 45px;
  background: #1e293b;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: bold;
  letter-spacing: 0.2em;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sync:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.btn-sync:not(:disabled):hover {
  background: #334155;
  transform: translateY(-1px);
}

/* 交互控制：对照中文按钮（完全复用阅读端逻辑） */
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
}

.lang-toggle-btn:hover {
  background: #eff6ff;
}

.lang-toggle-btn.is-active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

/* 🚀 历史时光机样式设计 */
.history-container {
  width: 100%;
  max-width: 760px;
  margin-top: 20px;
  margin-bottom: 50px;
  padding: 0 20px;
  box-sizing: border-box;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 2px dashed #e2e8f0;
  margin-bottom: 20px;
}

.history-title {
  font-size: 13px;
  font-weight: bold;
  color: #475569;
  letter-spacing: 0.1em;
}

.history-count {
  font-size: 12px;
  color: #94a3b8;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01);
  transition: all 0.2s;
}

.history-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  border-color: #e2e8f0;
}

.history-content {
  flex: 1;
  text-align: left;
  padding-right: 15px;
}

.hist-eng {
  font-family: 'Georgia', serif;
  font-size: 15px;
  color: #334155;
  margin: 0 0 6px 0;
  line-height: 1.5;
}

.hist-cn {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.btn-delete-hist {
  background: #fff5f5;
  border: 1px solid #ffe3e3;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-delete-hist:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  transform: scale(1.05);
}

/* 全屏降噪模式 */
.is-full-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
}

.is-full-screen .exclusive-badge,
.is-full-screen .student-tag {
  display: none;
}

.is-full-screen .sentence-toolbar {
  justify-content: flex-end;
  padding: 15px 30px;
  background: transparent;
  border-bottom: none;
}

/* 优雅的模糊淡入效果 */
.fade-blur-enter-active, .fade-blur-leave-active {
  transition: all 0.4s ease;
}
.fade-blur-enter-from, .fade-blur-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(5px);
}

.animate-slide {
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
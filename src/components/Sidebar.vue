<script setup>
import { ref, computed, watch } from 'vue'

/**
 * Props 说明：
 * students: 学员列表
 * currentStudent: 当前选中的学员
 * collapsed: 是否折叠
 * canEdit: 是否拥有管理权限（由 App.vue 的 isAdminMode 传入）
 */
const props = defineProps({
  students: {
    type: Array,
    default: () => []
  },
  currentStudent: Object,
  collapsed: Boolean,
  canEdit: Boolean
})

defineEmits(['select', 'add', 'toggle', 'deleteStudent'])

// 1. 搜索关键词状态
const searchQuery = ref('')

// 2. 分页状态
const currentPage = ref(1)
const pageSize = ref(8) // 每页显示的学员数量

// 3. 过滤后的学员列表（支持按姓名忽略大小写匹配）
const filteredStudents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.students || []
  return (props.students || []).filter(s => 
    s.name && s.name.toLowerCase().includes(query)
  )
})

// 4. 搜索框改变时自动切回第 1 页
watch(searchQuery, () => {
  currentPage.value = 1
})

// 数据减少导致页码超标时，重置当前页
watch(() => props.students?.length, () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = totalPages.value
  }
})

// 5. 计算总页数
const totalPages = computed(() => {
  return Math.ceil(filteredStudents.value.length / pageSize.value) || 1
})

// 6. 最终渲染的当页学员列表
const paginatedStudents = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredStudents.value.slice(start, start + pageSize.value)
})

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}
</script>

<template>
  <aside :class="['panel', 'sidebar', { collapsed: collapsed, 'admin-border': canEdit }]">
    <div class="toggle-btn" @click="$emit('toggle')">
      {{ collapsed ? '▶' : '◀' }}
    </div>

    <div v-show="!collapsed" class="panel-content">
      <div class="simple-logo">
        <div class="bulb-icon">💡</div>
        <div class="logo-text-group">
          <div class="brand-name">EVA READ</div>
          <div class="brand-tagline">{{ canEdit ? 'ADMIN PANEL' : 'STUDENT CENTER' }}</div>
        </div>
      </div>

      <div v-if="canEdit" class="admin-actions">
        <button class="btn-add-student" @click="$emit('add')">
          <span class="plus-icon">+</span> 新增学员
        </button>
      </div>

      <!-- 搜索框区域 -->
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input 
          v-model="searchQuery" 
          type="text" 
          class="search-input" 
          placeholder="搜索学员姓名" 
        />
        <span 
          v-if="searchQuery" 
          class="clear-icon" 
          @click="searchQuery = ''"
          title="清空"
        >✕</span>
      </div>

      <div class="list-container">
        <!-- 列表头部：左侧标题，右侧极简分页控制 -->
        <div class="list-header-row">
          <span class="list-title">{{ canEdit ? '📋 学员库管理' : '👤 请选择当前学员' }}</span>
          
          <!-- 仅优化：微调分页结构 -->
          <div v-if="totalPages > 1" class="mini-pagination">
            <button :disabled="currentPage === 1" class="page-arrow" @click="prevPage" title="上一页">‹</button>
            <span class="page-num">{{ currentPage }}<span class="slash">/</span>{{ totalPages }}</span>
            <button :disabled="currentPage === totalPages" class="page-arrow" @click="nextPage" title="下一页">›</button>
          </div>
        </div>

        <div class="list">
          <div 
            v-for="s in paginatedStudents" 
            :key="s.id" 
            :class="['item', { active: currentStudent?.id === s.id }]"
            @click="$emit('select', s)"
          >
            <span class="user-avatar">{{ currentStudent?.id === s.id ? '⭐' : '👤' }}</span>
            <span class="user-name">{{ s.name }}</span>
            <span 
              v-if="canEdit" 
              class="delete-student-btn" 
              @click.stop="$emit('deleteStudent', s)"
              title="删除学员"
            >🗑️</span>
          </div>

          <!-- 空状态 -->
          <div v-if="filteredStudents.length === 0" class="empty-tip">
            未找到匹配学员
          </div>
        </div>
      </div>
    </div>

    <div v-show="collapsed" class="collapsed-icons">
      <div class="mini-bulb" :title="canEdit ? '管理模式' : '学员模式'">💡</div>
      <div v-if="canEdit" class="mini-add" @click="$emit('add')" title="快捷添加学员">➕</div>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  position: relative;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
  background: #1e293b;
  color: white;
  border-right: 3px solid transparent;
}

/* 管理模式下边框绿色提示 */
.admin-border {
  border-right-color: #27ae60;
}

.panel.collapsed {
  width: 20px !important;
}

.panel-content {
  padding: 20px 15px;
  width: 230px;
  box-sizing: border-box;
  height: 100%;           
  flex-direction: column;
  display: flex;          
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.search-icon {
  position: absolute;
  left: 10px;
  font-size: 12px;
  opacity: 0.6;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 28px 8px 30px;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 8px;
  color: #f8fafc;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input::placeholder {
  color: #64748b;
}

.search-input:focus {
  border-color: #27ae60;
  background: #0f172a;
}

.clear-icon {
  position: absolute;
  right: 10px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
}

.clear-icon:hover {
  color: #f8fafc;
}

.empty-tip {
  padding: 15px 0;
  text-align: center;
  color: #64748b;
  font-size: 12px;
}

.list-container {
  flex: 1;                
  overflow-y: auto;       
  min-height: 0;          
  padding-right: 2px;     
}

.list-container::-webkit-scrollbar {
  width: 4px;
}
.list-container::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 10px;
}

/* Logo 样式 */
.simple-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0 25px 0;
  border-bottom: 1px solid #334155;
  margin-bottom: 20px;
}

.bulb-icon {
  width: 36px;
  height: 36px;
  background: #334155;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.1);
}

.brand-name {
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 1px;
}

.brand-tagline {
  color: #64748b;
  font-size: 9px;
  font-weight: bold;
  letter-spacing: 0.5px;
}

/* 管理员按钮 */
.btn-add-student {
  width: 100%;
  padding: 12px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  margin-bottom: 25px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 10px rgba(39, 174, 96, 0.2);
}

.btn-add-student:hover {
  background: #2ecc71;
  transform: translateY(-2px);
}

/* 列表顶部行（标题 + 极简分页） */
.list-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 2px;
}

.list-title {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* 仅针对极简分页做细微的美化改动 */
.mini-pagination {
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(15, 23, 42, 0.4);
  padding: 2px 4px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.page-arrow {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.2s ease;
  user-select: none;
}

.page-arrow:hover:not(:disabled) {
  color: #ffffff;
  background: #27ae60;
}

.page-arrow:disabled {
  color: #475569;
  cursor: not-allowed;
  opacity: 0.5;
}

.page-num {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 600;
  padding: 0 4px;
  font-variant-numeric: tabular-nums;
}

.slash {
  color: #475569;
  margin: 0 1px;
}

/* 列表项目样式 */
.item {
  position: relative; 
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 6px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
  color: #94a3b8;
}

.item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: white;
}

.item.active {
  background: #27ae60;
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.3);
}

.delete-student-btn {
  margin-left: auto; 
  opacity: 0; 
  transition: all 0.2s;
  padding: 4px;
  border-radius: 4px;
  font-size: 12px;
}

.item:hover .delete-student-btn {
  opacity: 0.6;
}

.delete-student-btn:hover {
  opacity: 1 !important;
  background: rgba(231, 76, 60, 0.2); 
  transform: scale(1.2);
}

/* 侧边栏折叠展开控制 */
.toggle-btn {
  position: absolute;
  right: -12px;
  top: 45%;
  width: 24px;
  height: 48px;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 12px;
  cursor: pointer;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #f8fafc;
  transition: all 0.3s;
}

.toggle-btn:hover {
  background: #27ae60;
  border-color: #27ae60;
}

.collapsed-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 30px;
  gap: 25px;
}

.mini-bulb { font-size: 18px; filter: grayscale(1); opacity: 0.5; }
.mini-add { cursor: pointer; font-size: 14px; color: #27ae60; }
</style>
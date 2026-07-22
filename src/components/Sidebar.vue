<script setup>
import { ref, computed } from 'vue'

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

// 1. 新增搜索关键词状态
const searchQuery = ref('')

// 2. 增加过滤后的学员计算属性（支持按姓名忽略大小写匹配）
const filteredStudents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.students || []
  return (props.students || []).filter(s => 
    s.name && s.name.toLowerCase().includes(query)
  )
})
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

      <!-- 新增：搜索框区域 -->
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
        <div class="list-header">
          {{ canEdit ? '📋 学员库管理' : '👤 请选择当前学员' }}
        </div>
        <div class="list">
          <!-- 修改：遍历 filteredStudents 而非原始 students -->
          <div 
            v-for="s in filteredStudents" 
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

          <!-- 新增：搜不到结果时的空状态 -->
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

/* 管理模式下给边框一个微弱的绿色提示 */
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

/* 空状态样式 */
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
  padding-right: 4px;     
}

/* 针对 Webkit 的滚动条美化 */
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

/* 列表样式 */
.list-header {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 12px;
  padding-left: 5px;
}

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

/* 切换按钮 */
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
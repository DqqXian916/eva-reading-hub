<script setup>
defineProps({
  collapsed: Boolean,
  currentStudent: Object,
  readings: Array,
  isLoading: Boolean,
  canEdit: Boolean
})

defineEmits(['toggle', 'open', 'goEdit', 'delete', 'onEditClick'])
</script>

<template>
  <aside :class="['panel', 'list-panel', { collapsed: collapsed }]">
    <div class="toggle-btn" @click="$emit('toggle')">
      {{ collapsed ? '▶' : '◀' }}
    </div>

    <div v-show="!collapsed" class="panel-content">
      <div class="student-profile-card" v-if="currentStudent">
        <div class="avatar-circle">
          {{ currentStudent.name.charAt(0).toUpperCase() }}
        </div>
        <div class="profile-info">
          <span class="welcome-text">STUDENT</span>
          <h3 class="student-name">{{ currentStudent.name }} 的书架</h3>
        </div>
      </div>
      <div v-else class="empty-header">
        <span class="title-text">请先选择学员</span>
      </div>
      
      <button v-if="currentStudent && canEdit" class="btn-add-reading" @click="$emit('goEdit')">
        <span class="plus-circle">+</span> 录入新文章
      </button>

      <div v-if="isLoading" class="loading-state">
        <div class="loader"></div>
        <p>同步云端中...</p>
      </div>

      <div class="list-scroll-area" v-else-if="readings && readings.length > 0">
        <div class="list-label">最近更新 ({{ readings.length }})</div>
        <div class="list">
          <div v-for="r in readings" :key="r.id" class="item-article" @click="$emit('open', r)">
            <div class="status-indicator"></div>
            <div class="doc-icon-box">📖</div>
            <div class="doc-info">
              <span class="doc-title">{{ r.title }}</span>
              <div class="meta-data">
                <span class="doc-date">📅 {{ new Date(r.created_at).toLocaleDateString() }}</span>
                <span class="quiz-count">📝 {{ r.quiz?.length || 0 }} 题</span>
              </div>
            </div>

            <div v-if="canEdit" class="actions">
              <button class="btn-action edit" @click.stop="$emit('onEditClick', r)">✏️</button>
              <button class="btn-action del" @click.stop="$emit('delete', r)">🗑️</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="currentStudent" class="empty-bookshelf">
        <div class="empty-icon">📚</div>
        <p>书架空空的</p>
        <p class="sub-tip">{{ canEdit ? '点击上方按钮开始录入' : '等老师为你布置内容哦' }}</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* 基础面板 */
.panel {
  position: relative;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
  border-right: 1px solid #edf2f7;
  background: #ffffff;
  box-shadow: 4px 0 15px rgba(0,0,0,0.02);
}
.panel.collapsed { width: 25px !important; }

.panel-content {
  padding: 24px 16px;
  width: 280px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

/* 学员卡片美化 */
.student-profile-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f6f9fc 0%, #edf2f7 100%);
  border-radius: 16px;
  margin-bottom: 24px;
}

.avatar-circle {
  width: 44px;
  height: 44px;
  background: #27ae60;
  color: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  box-shadow: 0 4px 10px rgba(39, 174, 96, 0.2);
}

.profile-info { display: flex; flex-direction: column; }
.welcome-text { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; }
.student-name { font-size: 15px; font-weight: 700; color: #1e293b; margin: 0; }

/* 录入按钮 */
.btn-add-reading {
  width: 100%;
  padding: 14px;
  margin-bottom: 24px;
  background: #1e293b;
  color: white;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.3s;
}
.btn-add-reading:hover {
  background: #27ae60;
  transform: translateY(-2px);
  box-shadow: 0 8px 15px rgba(39, 174, 96, 0.2);
}
.plus-circle {
  background: rgba(255,255,255,0.2);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 列表区域 */
.list-label {
  font-size: 11px;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 12px;
  padding-left: 4px;
  letter-spacing: 0.5px;
}

.list-scroll-area { flex: 1; overflow-y: auto; padding-right: 4px; }

/* 文章卡片美化 */
.item-article {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #f1f5f9;
  position: relative;
  overflow: hidden;
}

.status-indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: transparent;
  transition: 0.2s;
}

.item-article:hover {
  border-color: #27ae60;
  background: #f0fff4;
  transform: translateX(4px);
}
.item-article:hover .status-indicator { background: #27ae60; }

.doc-icon-box {
  width: 36px;
  height: 36px;
  background: #f8fafc;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.doc-info { flex: 1; overflow: hidden; }
.doc-title { font-size: 14px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.meta-data { display: flex; gap: 12px; align-items: center; }
.doc-date, .quiz-count { font-size: 10px; color: #94a3b8; font-weight: 500; }

/* 悬浮按钮组 */
.actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: 0.2s;
  background: white;
  padding: 4px;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}
.item-article:hover .actions { opacity: 1; }

.btn-action {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  font-size: 12px;
  transition: 0.2s;
}
.btn-action.edit:hover { background: #e0f2fe; }
.btn-action.del:hover { background: #fee2e2; }

/* 侧边收缩按钮 */
.toggle-btn {
  position: absolute;
  right: -12px;
  top: 40px;
  width: 24px;
  height: 24px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  z-index: 10;
}

/* 加载动画 */
.loader {
  width: 24px;
  height: 24px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #27ae60;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 20px auto;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* 空状态 */
.empty-bookshelf { text-align: center; margin-top: 60px; }
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.sub-tip { font-size: 12px; color: #94a3b8; margin-top: 4px; }
</style>
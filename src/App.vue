<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from './supabase'

// 导入组件
import Sidebar from './components/Sidebar.vue'
import ReadingList from './components/ReadingList.vue'
import EditForm from './components/EditForm.vue'
import ReadingWorkspace from './components/ReadingWorkspace.vue'

// --- 状态管理 ---
const activeModule = ref('reading') 
const isAdminMode = ref(false)
const students = ref([])
const currentStudent = ref(null)
const readings = ref([])
const activeReading = ref(null)    // 当前选中的文章详情
const editingReading = ref(null)   // 正在编辑的文章对象

const sidebarCollapsed = ref(false)
const listPanelCollapsed = ref(false)
const viewMode = ref('welcome')    // 关键状态：welcome | list | edit | reading
const isLoading = ref(false)
const isFullScreen = ref(false)

// 答题状态记录
const userSelections = ref([])
const isSubmitted = ref(false)

// --- 核心逻辑 ---

// 1. 监听切换（学员或模块改变时重置状态）
watch([currentStudent, activeModule], async ([newStudent, newModule]) => {
  if (!newStudent) return
  
  // 切换时默认回到列表状态
  viewMode.value = 'list'
  activeReading.value = null 
  
  if (newModule === 'reading') {
    await fetchReadings(newStudent.id)
  }
})

// 2. 获取数据
const fetchReadings = async (studentId) => {
  isLoading.value = true
  const { data } = await supabase.from('readings')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  readings.value = data || []
  isLoading.value = false
}

const fetchStudents = async () => {
  const { data } = await supabase.from('students').select('*').order('name')
  students.value = data || []
}

onMounted(fetchStudents)

// 3. ✨ 关键函数：打开文章详情
const openReading = (reading) => {
  activeReading.value = reading     // 1. 设置当前文章数据
  viewMode.value = 'reading'        // 2. 切换视图模式
  isSubmitted.value = false         // 3. 重置答题状态
  // 4. 初始化选项数组
  userSelections.value = new Array(reading.quiz?.length || 0).fill(null)
  
  // 5. 自动收起侧边栏，给阅读留出空间
  sidebarCollapsed.value = true
  listPanelCollapsed.value = true
}

// 4. 处理保存逻辑
const handleSave = async (formData) => {
  try {
    let res;
    if (formData.id) {
      res = await supabase.from('readings').update({
        title: formData.title, body: formData.body, quiz: formData.quiz
      }).eq('id', formData.id)
    } else {
      res = await supabase.from('readings').insert([{
        student_id: currentStudent.value.id,
        title: formData.title, body: formData.body, quiz: formData.quiz
      }])
    }
    if (res.error) throw res.error
    alert("保存成功")
    viewMode.value = 'list'
    await fetchReadings(currentStudent.id)
  } catch (e) { alert(e.message) }
}

const toggleRole = () => {
  if (!isAdminMode.value) {
    const pass = prompt("管理密码：")
    if (pass === "eva888") isAdminMode.value = true
  } else {
    isAdminMode.value = false
  }
}
</script>

<template>
  <div :class="['app-shell', isAdminMode ? 'admin-theme' : 'student-theme']">
    
    <header class="top-nav">
      <div class="nav-brand">
        <span class="brand-icon">⚡</span>
        <span class="brand-name">EVA ENGLISH</span>
      </div>
      <nav class="nav-center">
        <button :class="['module-tab', { active: activeModule === 'vocabulary' }]" @click="activeModule = 'vocabulary'">🗂️ 单词复习</button>
        <button :class="['module-tab', { active: activeModule === 'quiz' }]" @click="activeModule = 'quiz'">📝 单选训练</button>
        <button :class="['module-tab', { active: activeModule === 'reading' }]" @click="activeModule = 'reading'">📖 阅读训练</button>
      </nav>
      <div class="nav-right">
        <div class="role-switch" @dblclick="toggleRole">{{ isAdminMode ? '🛠️ 管理模式' : '👤 学员模式' }}</div>
      </div>
    </header>

    <div class="main-body">
      <Sidebar 
        :students="students" :currentStudent="currentStudent" :collapsed="sidebarCollapsed" :canEdit="isAdminMode" 
        @select="(s) => { currentStudent = s; }" @add="fetchStudents" @toggle="sidebarCollapsed = !sidebarCollapsed" 
      />

      <div class="module-view" v-if="currentStudent">
        <template v-if="activeModule === 'reading'">
          <ReadingList 
            :currentStudent="currentStudent" :readings="readings" :collapsed="listPanelCollapsed" :isLoading="isLoading" :canEdit="isAdminMode" 
            @open="openReading" 
            @goEdit="() => { editingReading = null; viewMode = 'edit'; }" 
            @onEditClick="(r) => { editingReading = r; viewMode = 'edit'; }" 
            @delete="fetchReadings(currentStudent.id)"
            @toggle="listPanelCollapsed = !listPanelCollapsed" 
          />

          <main class="content-space">
            <div v-if="viewMode === 'list' || viewMode === 'welcome'" class="placeholder">
              <div class="card">
                <h2>📚 {{ currentStudent.name }} 的书架</h2>
                <p>请点击中间列表中的文章进行阅读</p>
              </div>
            </div>

            <ReadingWorkspace 
              v-if="viewMode === 'reading' && activeReading" 
              :activeReading="activeReading" 
              :isFullScreen="isFullScreen"
              :userSelections="userSelections"
              :isSubmitted="isSubmitted"
              @toggleFull="isFullScreen = !isFullScreen"
              @close="viewMode = 'list'" 
              @submit="isSubmitted = true"
              @updateSelection="(d) => userSelections[d.qIdx] = d.oIdx"
            />

            <EditForm 
              v-if="viewMode === 'edit'" 
              :student="currentStudent" 
              :initialData="editingReading" 
              @save="handleSave"
              @cancel="viewMode = 'list'" 
            />
          </main>
        </template>

        <template v-else>
          <div class="placeholder">
            <div class="card">
              <h2>{{ activeModule === 'vocabulary' ? '🗂️ 单词复习' : '📝 单选训练' }}</h2>
              <p>正在为 {{ currentStudent.name }} 准备内容...</p>
            </div>
          </div>
        </template>
      </div>

      <div v-else class="full-welcome">
        <div class="welcome-card"><h1>👋 请先选择学员</h1></div>
      </div>
    </div>
  </div>
</template>

<style>
/* 保持之前的样式不变... */
:root { --nav-h: 60px; --primary: #27ae60; }
.app-shell { display: flex; flex-direction: column; width: 100vw; height: 100vh; overflow: hidden; background: #f8fafc; }
.top-nav { height: var(--nav-h); background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid #e2e8f0; z-index: 100; }
.main-body { display: flex; flex: 1; height: calc(100vh - var(--nav-h)); overflow: hidden; }
.module-view { display: flex; flex: 1; overflow: hidden; }
.content-space { flex: 1; position: relative; background: white; overflow: hidden; }
.placeholder, .full-welcome { flex:1; height: 100%; display: flex; align-items: center; justify-content: center; }
.card { padding: 40px; background: white; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); text-align: center; }
.nav-center { display: flex; background: #f1f5f9; padding: 4px; border-radius: 10px; gap: 4px; }
.module-tab { padding: 6px 16px; border: none; background: transparent; border-radius: 7px; cursor: pointer; font-weight: 600; color: #64748b; }
.module-tab.active { background: #fff; color: var(--primary); box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
.role-switch { font-size: 12px; color: #94a3b8; cursor: pointer; border: 1px solid #e2e8f0; padding: 4px 12px; border-radius: 20px; }
/* 优化欢迎卡片 */
.welcome-card {
  text-align: center;
  padding: 40px 60px;
  background: white;
  border-radius: 20px;
  /* 移除之前的红色边框，改用轻微投影，看起来更高级 */
  box-shadow: 0 4px 20px rgba(0,0,0,0.05); 
  border: 1px solid #f1f5f9;
}

.welcome-card h1 {
  margin: 0;
  font-size: 24px;
  color: #1e293b;
}
</style>
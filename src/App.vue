<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from './supabase'

// 导入组件
import Sidebar from './components/Sidebar.vue'
import ReadingList from './components/ReadingList.vue'
import EditForm from './components/EditForm.vue'
import ReadingWorkspace from './components/ReadingWorkspace.vue'
import QuizModule from './components/QuizModule.vue'

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
const viewMode = ref('welcome')    // welcome | list | edit | reading
const isLoading = ref(false)
const isFullScreen = ref(false)

const studentQuizzes = ref([])

// 答题状态记录
const userSelections = ref([])
const isSubmitted = ref(false)

// --- 核心逻辑 ---

// 1. 监听切换（学员或模块改变时重置状态并加载数据）
watch([currentStudent, activeModule], async ([newStudent, newModule]) => {
  if (!newStudent) return
  // 切换时重置视图状态
  if (newModule === 'reading') {
    viewMode.value = 'list'
    await fetchReadings(newStudent.id)
  }
  if (newModule === 'quiz') {
    await fetchQuizzes(newStudent.id) 
  }
})

// 2. 数据获取
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

const fetchQuizzes = async (studentId) => {
  const { data } = await supabase.from('quizzes')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  studentQuizzes.value = data || []
}

// 3. 题目存取逻辑
const saveQuiz = async (quizData) => {
  try {
    let res;
    // 整理要保存的数据
    const payload = {
      question: quizData.question,
      options: quizData.options,
      answer_index: quizData.answer_index,
      category: quizData.category,
      explanation: quizData.explanation
    }

    if (quizData.id) {
      // 修改模式
      res = await supabase.from('quizzes').update(payload).eq('id', quizData.id)
    } else {
      // 新增模式
      res = await supabase.from('quizzes').insert([{
        ...payload,
        student_id: currentStudent.value.id
      }])
    }

    if (res.error) throw res.error
    alert(quizData.id ? "✅ 修改成功" : "🚀 发布成功")
    await fetchQuizzes(currentStudent.value.id)
  } catch (e) {
    alert(e.message)
  }
}

const deleteQuiz = async (id) => {
  if (confirm('确认删除此题？')) {
    const { error } = await supabase.from('quizzes').delete().eq('id', id)
    if (error) alert(error.message)
    else fetchQuizzes(currentStudent.value.id)
  }
}

onMounted(fetchStudents)

// 4. 阅读模式关键函数
const openReading = (reading) => {
  activeReading.value = reading
  viewMode.value = 'reading'
  isSubmitted.value = false
  userSelections.value = new Array(reading.quiz?.length || 0).fill(null)
  
  sidebarCollapsed.value = true
  listPanelCollapsed.value = true
}

const handleSaveReading = async (formData) => {
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
    await fetchReadings(currentStudent.value.id)
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
        :students="students" 
        :currentStudent="currentStudent" 
        :collapsed="sidebarCollapsed" 
        :canEdit="isAdminMode" 
        @select="(s) => { currentStudent = s; }" 
        @add="fetchStudents" 
        @toggle="sidebarCollapsed = !sidebarCollapsed" 
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
              @save="handleSaveReading"
              @cancel="viewMode = 'list'" 
            />
          </main>
        </template>

        <template v-else-if="activeModule === 'quiz'">
          <QuizModule 
            :student="currentStudent" 
            :quizzes="studentQuizzes" 
            :canEdit="isAdminMode"
            @save="saveQuiz"
            @delete="deleteQuiz"
          />
        </template>

        <template v-else>
          <div class="placeholder">
            <div class="card">
              <h2>🗂️ 单词复习</h2>
              <p>正在为 {{ currentStudent.name }} 准备内容...</p>
            </div>
          </div>
        </template>
      </div>

      <div v-else class="full-welcome">
        <div class="welcome-card">
          <h1>👋 Hello!</h1>
          <p>请先从左侧选择一个学员开始教学</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root { --nav-h: 60px; --primary: #27ae60; }
body { margin: 0; font-family: 'Inter', sans-serif; }

.app-shell { display: flex; flex-direction: column; width: 100vw; height: 100vh; overflow: hidden; background: #f8fafc; }

/* 导航栏 */
.top-nav { height: var(--nav-h); background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; border-bottom: 1px solid #e2e8f0; z-index: 100; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; color: #1e293b; letter-spacing: -0.5px; }
.brand-icon { font-size: 20px; }
.nav-center { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; gap: 4px; }
.module-tab { padding: 8px 18px; border: none; background: transparent; border-radius: 8px; cursor: pointer; font-weight: 600; color: #64748b; transition: 0.2s; font-size: 14px; }
.module-tab.active { background: #fff; color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

/* 主布局 */
.main-body { display: flex; flex: 1; height: calc(100vh - var(--nav-h)); overflow: hidden; }
.module-view { display: flex; flex: 1; height: 100%; overflow: hidden; }

/* 阅读模块专用布局 */
.content-space { flex: 1; position: relative; background: white; overflow: hidden; display: flex; flex-direction: column; }

/* 欢迎页与占位符 */
.placeholder, .full-welcome { flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
.card { padding: 50px; background: white; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); text-align: center; border: 1px solid #f1f5f9; }
.welcome-card { text-align: center; padding: 60px; background: white; border-radius: 30px; box-shadow: 0 15px 40px rgba(0,0,0,0.05); }
.welcome-card h1 { font-size: 32px; margin-bottom: 10px; color: #1e293b; }
.welcome-card p { color: #94a3b8; font-size: 18px; }

/* 角色切换 */
.role-switch { font-size: 12px; color: #94a3b8; cursor: pointer; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-weight: 600; transition: 0.2s; }
.role-switch:hover { background: #f8fafc; border-color: #cbd5e1; }

/* 管理模式主题颜色微调 */
.admin-theme { --primary: #3498db; }
</style>
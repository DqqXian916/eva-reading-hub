<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { supabase } from './supabase'

// 导入组件
import Sidebar from './components/Sidebar.vue'
import ReadingList from './components/ReadingList.vue'
import EditForm from './components/EditForm.vue'
import ReadingWorkspace from './components/ReadingWorkspace.vue'
import QuizModule from './components/QuizModule.vue'
import ClozeModule from './components/ClozeModule.vue'
import VocabTestModule from './components/VocabTestModule.vue'


// --- 状态管理 ---
const activeModule = ref('reading')
const isAdminMode = ref(false)
const students = ref([])
const currentStudent = ref(null)
const readings = ref([])
const activeReading = ref(null)    // 当前选中的文章详情
const editingReading = ref(null)   // 正在编辑的文章对象
const confirmBtn = ref(null) // 定义按钮引用
const studentClozeQuizzes = ref([])
const studentVocabTests = ref([]) // 存储词汇评估记录

const sidebarCollapsed = ref(false)
const listPanelCollapsed = ref(false)
const viewMode = ref('welcome')    // welcome | list | edit | reading
const isLoading = ref(false)
const isFullScreen = ref(false)

const studentQuizzes = ref([])

// 答题状态记录
const userSelections = ref([])
const isSubmitted = ref(false)

// --- 新增状态控制 ---
const showAdminModal = ref(false)
const adminPassword = ref('')
const passwordError = ref(false)

const toggleRole = () => {
  if (!isAdminMode.value) {
    showAdminModal.value = true
    adminPassword.value = 'eva888' // 默认填好密码
    passwordError.value = false
    // 关键：在 DOM 更新后立即聚焦确认按钮
    nextTick(() => {
      if (confirmBtn.value) {
        confirmBtn.value.focus()
      }
    })
  } else {
    isAdminMode.value = false
  }
}

const verifyPassword = () => {
  if (adminPassword.value === "eva888") {
    isAdminMode.value = true
    showAdminModal.value = false
    passwordError.value = false
  } else {
    passwordError.value = true
    // 错误动画反馈：可以在样式里写个抖动效果
  }
}

// --- 核心逻辑 ---

// 1. 监听切换（学员或模块改变时重置状态并加载数据）
watch([currentStudent, activeModule], async ([newStudent, newModule]) => {
  if (!newStudent) return
  if (newModule === 'reading') {
    viewMode.value = 'list'
    await fetchReadings(newStudent.id)
  } else if (newModule === 'quiz') {
    await fetchQuizzes(newStudent.id)
  } else if (newModule === 'cloze') {
    await fetchClozeQuizzes(newStudent.id) // 新增：切换到填空模块时加载数据
  } else if (newModule === 'vocab-test') { 
    await fetchVocabTests(newStudent.id) // 新增：词汇评估模块数据加载
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


// --- 短文填空数据获取 ---
const fetchClozeQuizzes = async (studentId) => {
  isLoading.value = true
  const { data } = await supabase.from('cloze_quizzes') // 假设你的表名为 cloze_quizzes
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  studentClozeQuizzes.value = data || []
  isLoading.value = false
}

// 获取词汇评估历史记录
const fetchVocabTests = async (studentId) => {
  isLoading.value = true
  const { data } = await supabase.from('vocab_tests') 
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  studentVocabTests.value = data || []
  isLoading.value = false
}

// --- 新增：真正的文章删除逻辑 ---
const handleDeleteReading = async (reading) => {
  // 1. 二次确认，防止手抖
  if (!confirm(`确定要删除文章《${reading.title}》吗？此操作不可撤销哦 ❤️`)) return
  try {
    isLoading.value = true
    // 2. 这里的 supabase.from('readings') 对应你的文章表
    const { error } = await supabase
      .from('readings')
      .delete()
      .eq('id', reading.id)
    if (error) throw error
    alert("✅ 文章已从云端抹除")
    // 3. 关键：删除后重新刷新列表，或者手动从 readings 数组中 splice 掉
    await fetchReadings(currentStudent.value.id)
    // 如果当前正在阅读这篇文章，重置回列表页
    if (activeReading.value?.id === reading.id) {
      viewMode.value = 'list'
      activeReading.value = null
    }
  } catch (e) {
    alert("❌ 删除失败：" + e.message)
  } finally {
    isLoading.value = false
  }
}

const handleDeleteStudent = async (student) => {
  // 1. 二次确认
  const msg = `确定要删除学员 ${student.name} 吗？\n这将同时删除该学员的所有阅读记录和题目，不可恢复！`;
  if (!confirm(msg)) return;

  try {
    isLoading.value = true;
    // 2. 从 Supabase 删除数据
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', student.id);
    if (error) throw error;
    alert("✅ 学员记录已清除");
    // 3. 处理后续逻辑：重置当前选中，刷新列表
    if (currentStudent.value?.id === student.id) {
      currentStudent.value = null;
    }
    await fetchStudents();
    
  } catch (e) {
    alert("❌ 删除失败：" + e.message);
  } finally {
    isLoading.value = false;
  }
};


// App.vue 逻辑部分
const handleAddNewStudent = async () => {
  const name = prompt("请输入新学员的姓名：")
  
  if (name && name.trim()) {
    try {
      isLoading.value = true
      const { error } = await supabase
        .from('students')
        .insert([{ name: name.trim() }])
      
      if (error) throw error
      
      alert("✅ 学员添加成功！")
      await fetchStudents() // 添加成功后刷新列表
    } catch (e) {
      alert("❌ 添加失败：" + e.message)
    } finally {
      isLoading.value = false
    }
  }
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

// --- 短文填空存取逻辑 ---
const saveClozeQuiz = async (clozeData) => {
  try {
    let res;
    const payload = {
      cloze_text: clozeData.cloze_text, // 包含 {{1}} 占位符的短文
      answers: clozeData.answers,       // 存储正确答案的数组或对象
      category: clozeData.category,
      explanation: clozeData.explanation
    }

    if (clozeData.id) {
      res = await supabase.from('cloze_quizzes').update(payload).eq('id', clozeData.id)
    } else {
      res = await supabase.from('cloze_quizzes').insert([{
        ...payload,
        student_id: currentStudent.value.id
      }])
    }

    if (res.error) throw res.error
    alert("✅ 短文填空保存成功")
    await fetchClozeQuizzes(currentStudent.value.id)
  } catch (e) {
    alert(e.message)
  }
}

// 保存评估结果
const saveVocabTest = async (testData) => {
  try {
    const { error } = await supabase.from('vocab_tests').insert([{
      student_id: currentStudent.value.id,
      score: testData.score,
      level: testData.level,
      details: testData.details // 记录勾选了哪些词
    }])
    if (error) throw error
    alert("🚀 词汇量评估结果已存档")
    await fetchVocabTests(currentStudent.value.id)
  } catch (e) {
    alert("❌ 保存失败：" + e.message)
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

</script>

<template>
  <div :class="['app-shell', isAdminMode ? 'admin-theme' : 'student-theme']">

    <header class="top-nav">
      <div class="nav-brand">
        <span class="brand-icon">⚡</span>
        <span class="brand-name">EVA ENGLISH</span>
      </div>
      <nav class="nav-center">
        <button :class="['module-tab', { active: activeModule === 'vocab-test' }]"
          @click="activeModule = 'vocab-test'">📊 词汇评估</button>
        <button :class="['module-tab', { active: activeModule === 'vocabulary' }]"
          @click="activeModule = 'vocabulary'">🗂️ 单词复习</button>
        <button :class="['module-tab', { active: activeModule === 'quiz' }]" @click="activeModule = 'quiz'">📝
          单选训练</button>
        <button :class="['module-tab', { active: activeModule === 'reading' }]" @click="activeModule = 'reading'">📖
          阅读训练</button>
        <button :class="['module-tab', { active: activeModule === 'cloze' }]" @click="activeModule = 'cloze'">✍️
          短文填空</button>
      </nav>
      <div class="nav-right">
        <div class="role-switch" @dblclick="toggleRole">{{ isAdminMode ? '🛠️ 管理模式' : '👤 学员模式' }}</div>
      </div>
    </header>

    <div class="main-body">
      <Sidebar :students="students" :currentStudent="currentStudent" :collapsed="sidebarCollapsed"
        :canEdit="isAdminMode" @select="(s) => { currentStudent = s; }" @add="handleAddNewStudent" @deleteStudent="handleDeleteStudent"
        @toggle="sidebarCollapsed = !sidebarCollapsed" />

      <div class="module-view" v-if="currentStudent">

        <template v-if="activeModule === 'reading'">
          <ReadingList :currentStudent="currentStudent" :readings="readings" :collapsed="listPanelCollapsed"
            :isLoading="isLoading" :canEdit="isAdminMode" @open="openReading"
            @goEdit="() => { editingReading = null; viewMode = 'edit'; }"
            @onEditClick="(r) => { editingReading = r; viewMode = 'edit'; }" @delete="handleDeleteReading"
            @toggle="listPanelCollapsed = !listPanelCollapsed" />

          <main class="content-space">
            <div v-if="viewMode === 'list' || viewMode === 'welcome'" class="placeholder">
              <div class="card">
                <h2>📚 {{ currentStudent.name }} 的书架</h2>
                <p>请点击中间列表中的文章进行阅读</p>
              </div>
            </div>

            <ReadingWorkspace v-if="viewMode === 'reading' && activeReading" :activeReading="activeReading"
              :isFullScreen="isFullScreen" :userSelections="userSelections" :isSubmitted="isSubmitted"
              @toggleFull="isFullScreen = !isFullScreen" @close="viewMode = 'list'" @submit="isSubmitted = true"
              @updateSelection="(d) => userSelections[d.qIdx] = d.oIdx" />

            <EditForm v-if="viewMode === 'edit'" :student="currentStudent" :initialData="editingReading"
              @save="handleSaveReading" @cancel="viewMode = 'list'" />
          </main>
        </template>

        <template v-else-if="activeModule === 'quiz'">
          <QuizModule :student="currentStudent" :quizzes="studentQuizzes" :canEdit="isAdminMode" @save="saveQuiz"
            @delete="deleteQuiz" />
        </template>

        <template v-else-if="activeModule === 'cloze'">
          <ClozeModule 
            :student="currentStudent" 
            :quizzes="studentClozeQuizzes" 
            :canEdit="isAdminMode" 
            @save="saveClozeQuiz"
            @delete="deleteClozeQuiz" 
          />
        </template>

        <template v-else-if="activeModule === 'vocab-test'">
          <VocabTestModule 
            :student="currentStudent" 
            :records="studentVocabTests" 
            :canEdit="isAdminMode"
            @save="saveVocabTest" 
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
    <Transition name="fade">
      <div v-if="showAdminModal" class="modal-overlay" @click.self="showAdminModal = false">
        <div class="modal-content admin-auth-card">
          <div class="modal-header">
            <div class="icon-circle">🛠️</div>
            <h3>管理权限验证</h3>
            <p>请输入管理密码以开启编辑功能</p>
          </div>

          <div class="modal-body">
            <input v-model="adminPassword" type="password" placeholder="Enter Password"
              :class="{ 'error-input': passwordError }" @keyup.enter="verifyPassword" autofocus />
            <Transition name="shake">
              <span v-if="passwordError" class="error-msg">❌ 密码错误，请重新输入</span>
            </Transition>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showAdminModal = false">取消</button>
            <button class="btn-confirm" ref="confirmBtn" @click="verifyPassword">验证身份</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
:root {
  --nav-h: 60px;
  --primary: #27ae60;
}

body {
  margin: 0;
  font-family: 'Inter', sans-serif;
}

.app-shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #f8fafc;
}

/* 导航栏 */
.top-nav {
  height: var(--nav-h);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid #e2e8f0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 18px;
  color: #1e293b;
  letter-spacing: -0.5px;
}

.brand-icon {
  font-size: 20px;
}

.nav-center {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  gap: 4px;
}

.module-tab {
  padding: 8px 18px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #64748b;
  transition: 0.2s;
  font-size: 14px;
}

.module-tab.active {
  background: #fff;
  color: var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 主布局 */
.main-body {
  display: flex;
  flex: 1;
  height: calc(100vh - var(--nav-h));
  overflow: hidden;
}

.module-view {
  display: flex;
  flex: 1;
  height: 100%;
  overflow: hidden;
  overflow-y: auto; /* 允许纵向滚动 */
}

/* 阅读模块专用布局 */
.content-space {
  flex: 1;
  position: relative;
  background: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 欢迎页与占位符 */
.placeholder,
.full-welcome {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
}

.card {
  padding: 50px;
  background: white;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  text-align: center;
  border: 1px solid #f1f5f9;
}

.welcome-card {
  text-align: center;
  padding: 60px;
  background: white;
  border-radius: 30px;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.05);
}

.welcome-card h1 {
  font-size: 32px;
  margin-bottom: 10px;
  color: #1e293b;
}

.welcome-card p {
  color: #94a3b8;
  font-size: 18px;
}

/* 角色切换 */
.role-switch {
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 600;
  transition: 0.2s;
}

.role-switch:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

/* 管理模式主题颜色微调 */
.admin-theme {
  --primary: #3498db;
}

/* 模态框基础 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.admin-auth-card {
  background: white;
  width: 360px;
  padding: 32px;
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.icon-circle {
  width: 60px;
  height: 60px;
  background: #f1f5f9;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin: 0 auto 16px;
}

.modal-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 20px;
}

.modal-header p {
  color: #94a3b8;
  font-size: 14px;
  margin: 8px 0 24px;
}

/* 输入框优化 */
.modal-body input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 16px;
  text-align: center;
  transition: all 0.3s;
  box-sizing: border-box;
}

.modal-body input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.1);
}

.error-input {
  border-color: #ef4444 !important;
  background: #fef2f2;
}

.error-msg {
  color: #ef4444;
  font-size: 12px;
  display: block;
  margin-top: 8px;
  font-weight: 600;
}

/* 按钮组 */
.modal-footer {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.modal-footer button {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
  border: none;
}

.btn-cancel {
  background: #f1f5f9;
  color: #64748b;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-confirm {
  background: #3498db;
  color: white;
}

.btn-confirm:hover {
  background: #2980b9;
  transform: translateY(-1px);
}

/* 动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes shake {

  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-5px);
  }

  75% {
    transform: translateX(5px);
  }
}

.shake-enter-active {
  animation: shake 0.2s ease-in-out 0s 2;
}

.btn-confirm:focus {
  outline: none;
  box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.4); /* 蓝色光晕提示已聚焦 */
  transform: scale(1.02); /* 微微放大 */
}
</style>
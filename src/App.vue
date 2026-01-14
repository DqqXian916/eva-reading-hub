<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase'

import Sidebar from './components/Sidebar.vue'
import ReadingList from './components/ReadingList.vue'
import EditForm from './components/EditForm.vue'
import ReadingWorkspace from './components/ReadingWorkspace.vue'

const isAdminMode = ref(false)
const students = ref([])
const readings = ref([])
const currentStudent = ref(null)
const activeReading = ref(null)
const editingReading = ref(null) // ✨ 新增：存储正在编辑的文章对象

const sidebarCollapsed = ref(false)
const listPanelCollapsed = ref(true)
const viewMode = ref('welcome') 
const isLoading = ref(false)
const isFullScreen = ref(false)

const userSelections = ref([])
const isSubmitted = ref(false)
const scoreInfo = ref('')

const toggleRole = () => {
  if (!isAdminMode.value) {
    const pass = prompt("请输入管理密码：")
    if (pass === "eva888") { isAdminMode.value = true; alert("已进入管理后台"); }
  } else {
    isAdminMode.value = false; viewMode.value = 'welcome'; currentStudent.value = null;
  }
}

const addNewStudent = async () => {
  if (!isAdminMode.value) return // 安全校验
  
  const name = prompt("请输入新学员姓名：")
  if (!name || name.trim() === "") return // 防止空姓名
  
  try {
    const { error } = await supabase
      .from('students')
      .insert([{ name: name.trim() }])
      
    if (error) {
      console.error("添加失败:", error.message)
      alert("添加失败，请检查数据库连接")
    } else {
      alert(`学员 ${name} 已成功添加！`)
      await fetchStudents() // 重新获取列表，刷新界面
    }
  } catch (err) {
    console.error("系统错误:", err)
  }
}

const fetchStudents = async () => {
  const { data } = await supabase.from('students').select('*').order('name')
  students.value = data || []
}
onMounted(fetchStudents)

const selectStudent = async (student) => {
  currentStudent.value = student
  viewMode.value = 'list'
  isLoading.value = true
  listPanelCollapsed.value = false
  const { data } = await supabase.from('readings').select('*').eq('student_id', student.id).order('created_at', { ascending: false })
  readings.value = data || []
  isLoading.value = false
}

// ✨ 修改后的保存逻辑：支持新增和修改
const saveReading = async (formData) => {
  try {
    let result;
    if (formData.id) {
      // 修改模式
      result = await supabase.from('readings').update({
        title: formData.title,
        body: formData.body,
        quiz: formData.quiz
      }).eq('id', formData.id)
    } else {
      // 新增模式
      result = await supabase.from('readings').insert([{
        student_id: currentStudent.value.id,
        title: formData.title,
        body: formData.body,
        quiz: formData.quiz
      }])
    }
    
    if (result.error) throw result.error
    alert("保存成功！")
    editingReading.value = null
    await selectStudent(currentStudent.value)
  } catch (e) {
    alert("保存失败：" + e.message)
  }
}

const startEdit = (reading) => {
  editingReading.value = reading
  viewMode.value = 'edit'
}

const deleteReading = async (reading) => {
  if (confirm(`确定删除《${reading.title}》?`)) {
    await supabase.from('readings').delete().eq('id', reading.id)
    await selectStudent(currentStudent.value)
  }
}

const openReading = (reading) => {
  activeReading.value = reading
  viewMode.value = 'reading'
  isSubmitted.value = false
  userSelections.value = new Array(reading.quiz.length).fill(null)
  sidebarCollapsed.value = true
  listPanelCollapsed.value = true
}
</script>

<template>
  <div :class="['app-wrapper', isAdminMode ? 'admin-theme' : 'student-theme']">
    <div class="system-gate" @dblclick="toggleRole">{{ isAdminMode ? '🛠️ 管理模式' : '📖 学员模式' }}</div>

    <Sidebar :students="students" :currentStudent="currentStudent" :collapsed="sidebarCollapsed" :canEdit="isAdminMode" 
      @select="selectStudent" @add="addNewStudent" @toggle="sidebarCollapsed = !sidebarCollapsed" />

    <ReadingList :currentStudent="currentStudent" :readings="readings" :collapsed="listPanelCollapsed" :isLoading="isLoading" :canEdit="isAdminMode" 
      @open="openReading" 
      @goEdit="() => { editingReading = null; viewMode = 'edit'; }" 
      @onEditClick="startEdit" 
      @delete="deleteReading"
      @toggle="listPanelCollapsed = !listPanelCollapsed" />

    <main class="workspace">
      <div v-if="viewMode === 'welcome' || viewMode === 'list'" class="empty-state">
        <h2>{{ !currentStudent ? '欢迎使用阅读中心' : '已选择：' + currentStudent.name }}</h2>
      </div>

      <EditForm v-if="viewMode === 'edit'" 
        :student="currentStudent" 
        :initialData="editingReading"
        @save="saveReading" @cancel="viewMode = 'list'" />

      <ReadingWorkspace v-if="viewMode === 'reading'" 
        :activeReading="activeReading" :isFullScreen="isFullScreen" :userSelections="userSelections" :isSubmitted="isSubmitted" 
        @toggleFull="isFullScreen = !isFullScreen" @close="viewMode = 'list'" @submit="() => isSubmitted = true" 
        @updateSelection="(d) => userSelections[d.qIdx] = d.oIdx" />
    </main>
  </div>
</template>

<style>
:root { --bg: #f8fafc; }
body { margin: 0; font-family: sans-serif; }
.app-wrapper { display: flex; width: 100vw; height: 100vh; background: var(--bg); }
.system-gate { position: absolute; top: 10px; right: 20px; font-size: 11px; cursor: pointer; z-index: 100; }
.workspace { flex: 1; background: #fff; position: relative; }
.empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; }
</style>
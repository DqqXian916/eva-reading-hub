import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../supabase'

export const useStudentStore = defineStore('student', () => {
  const students = ref([])
  const currentStudent = ref(null)
  const isLoading = ref(false)

  // 获取学员列表
  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('name')
    students.value = data || []
  }

  // 新增学员
  const handleAddNewStudent = async () => {
    const name = prompt("请输入新学员的姓名：")
    if (name && name.trim()) {
      try {
        isLoading.value = true
        const { error } = await supabase.from('students').insert([{ name: name.trim() }])
        if (error) throw error
        alert("✅ 学员添加成功！")
        await fetchStudents()
      } catch (e) {
        alert("❌ 添加失败：" + e.message)
      } finally {
        isLoading.value = false
      }
    }
  }

  // 删除学员
  const handleDeleteStudent = async (student) => {
    const msg = `确定要删除学员 ${student.name} 吗？\n这将同时删除该学员的所有阅读记录和题目，不可恢复！`
    if (!confirm(msg)) return

    try {
      isLoading.value = true
      const { error } = await supabase.from('students').delete().eq('id', student.id)
      if (error) throw error
      alert("✅ 学员记录已清除")
      if (currentStudent.value?.id === student.id) {
        currentStudent.value = null
      }
      await fetchStudents()
    } catch (e) {
      alert("❌ 删除失败：" + e.message)
    } finally {
      isLoading.value = false
    }
  }

  // 奖励 XP
  const awardXP = async (amount, moduleName, reason) => {
    if (!currentStudent.value) return
    try {
      const { error: logError } = await supabase
        .from('xp_logs')
        .insert([{
          student_id: currentStudent.value.id,
          amount,
          module: moduleName,
          reason
        }])
      if (logError) throw logError
      const newTotal = (currentStudent.value.total_xp || 0) + amount
      const { error: updateError } = await supabase
        .from('students')
        .update({ total_xp: newTotal })
        .eq('id', currentStudent.value.id)
      if (updateError) throw updateError
      currentStudent.value.total_xp = newTotal
      console.log(`🚀 成功获取 ${amount} XP!`)
    } catch (e) {
      console.error("加分失败:", e.message)
    }
  }

  return {
    students,
    currentStudent,
    isLoading,
    fetchStudents,
    handleAddNewStudent,
    handleDeleteStudent,
    awardXP
  }
})
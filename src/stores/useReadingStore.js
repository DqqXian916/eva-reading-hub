import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../supabase'
import { useStudentStore } from './useStudentStore'

export const useReadingStore = defineStore('reading', () => {
  const readings = ref([])
  const activeReading = ref(null)
  const editingReading = ref(null)
  const isLoading = ref(false)

  const studentStore = useStudentStore()

  // 拉取阅读列表
  const fetchReadings = async (studentId) => {
    isLoading.value = true
    const { data } = await supabase
      .from('readings')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    readings.value = data || []
    isLoading.value = false
  }

  // 保存/更新文章
  const handleSaveReading = async (formData) => {
    try {
      let res
      const payload = {
        title: formData.title,
        body: formData.body,
        body_cn: formData.body_cn,
        quiz: formData.quiz
      }
      if (formData.id) {
        res = await supabase.from('readings').update(payload).eq('id', formData.id)
      } else {
        res = await supabase.from('readings').insert([{ 
          ...payload, 
          student_id: studentStore.currentStudent.id 
        }])
      }
      if (res.error) throw res.error
      alert("✅ 文章已成功保存到云端")
      await fetchReadings(studentStore.currentStudent.id)
      return true
    } catch (e) {
      console.error("保存失败:", e)
      alert("❌ 保存失败：" + e.message)
      return false
    }
  }

  // 删除文章
  const handleDeleteReading = async (reading) => {
    if (!confirm(`确定要删除文章《${reading.title}》吗？此操作不可撤销哦 ❤️`)) return
    try {
      isLoading.value = true
      const { error } = await supabase.from('readings').delete().eq('id', reading.id)
      if (error) throw error
      alert("✅ 文章已从云端抹除")
      await fetchReadings(studentStore.currentStudent.id)
      if (activeReading.value?.id === reading.id) {
        activeReading.value = null
      }
    } catch (e) {
      alert("❌ 删除失败：" + e.message)
    } finally {
      isLoading.value = false
    }
  }

  return {
    readings,
    activeReading,
    editingReading,
    isLoading,
    fetchReadings,
    handleSaveReading,
    handleDeleteReading
  }
})
import { defineStore } from 'pinia'
import { supabase } from '../supabase'

export const useGameStore = defineStore('game', {
  state: () => ({
    wordList: [],
    goal: 20,
    isLoading: false,
    currentStudentId: null
  }),

  actions: {
    setGameData(studentId, wordList, goal) {
      this.currentStudentId = studentId;
      this.wordList = wordList || [];
      this.goal = goal || 20;
      console.log("Store 已成功接收数据:", this.wordList.length, "个单词");
    },
    // 初始化/切换学生时获取数据
    async fetchStudentConfig(studentId) {
      if (!studentId) return
      this.currentStudentId = studentId
      this.isLoading = true

      try {
        const { data, error } = await supabase
          .from('student_configs')
          .select('current_word_list, game_goal')
          .eq('student_id', studentId)
          .maybeSingle()

        if (error) throw error
        this.wordList = data?.current_word_list || []
        this.goal = data?.game_goal || 20
      } catch (e) {
        console.error("加载配置异常:", e)
      } finally {
        this.isLoading = false
      }
    },

    // 更新配置并同步到数据库
    async updateConfig(newWordList, newGoal) {
      // 确保这里能过得去
      this.wordList = newWordList;
      if (newGoal !== undefined) this.goal = newGoal;

      // 如果没有 ID，至少也要让本地 UI 能跑起来，所以把 return 删掉或者改逻辑
      if (!this.currentStudentId) {
        console.warn("未识别到学生 ID，仅更新本地状态，不写入数据库");
        return;
      }
      // 2. 这里的 emit 逻辑可以保留在组件中，或者直接在这里调 API
      // 如果你希望 store 负责持久化，可以在这里写 supabase.from().upsert()
    }
  }
})
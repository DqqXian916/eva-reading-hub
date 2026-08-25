<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { supabase } from './supabase'
import { storeToRefs } from 'pinia'

import { useStudentStore } from './stores/useStudentStore'
import { useReadingStore } from './stores/useReadingStore'

// 导入组件
import Sidebar from './components/Sidebar.vue'
import ReadingList from './components/Reading/ReadingList.vue'
import EditForm from './components/Reading/EditForm.vue'
import ReadingWorkspace from './components/Reading/ReadingWorkspace.vue'
import QuizModule from './components/Quiz/QuizModule.vue'
import ClozeModule from './components/Cloze/ClozeModule.vue'
import BlankModule from './components/Blank/BlankModule.vue'
import VocabTestModule from './components/Word/VocabTestModule.vue'
import BrainBreakModule from './components/games/BrainBreakModule.vue'
import VocabularyModule from './components/Word/VocabularyModule.vue'
import WordModule from './components/Word/WordModule.vue' // 新增：单词学习与记忆模块
import OneWordModule from './components/OneWord/OneWordModule.vue'
import OneFilmModule from './components/OneFilm/OneFilmModule.vue'

// --- 状态管理 ---
const activeModule = ref('reading')
const isAdminMode = ref(false)
const confirmBtn = ref(null) // 定义按钮引用
const studentClozeQuizzes = ref([])
const studentVocabTests = ref([]) // 存储词汇评估记录
const currentWordList = ref([])
const isNavVisible = ref(true) // 控制顶栏显示/隐藏
const sidebarCollapsed = ref(false)
const listPanelCollapsed = ref(false)
const viewMode = ref('welcome')    // welcome | list | edit | reading
const isLoading = ref(false)
const isFullScreen = ref(false)
const studentBlankQuizzes = ref([]) // 存储从云端拉取的完形填空列表
const studentQuizzes = ref([])
const currentOneWordList = ref([]) // 存储当前学员的历史一言数组
const studentFilms = ref([]) // 存储从云端拉取的电影数据
// 单词学习模块新增状态
const studentWordBooks = ref([]) // 储存学员生词本及练习库
const wordStats = ref({ totalLearned: 0, todayReviewed: 0 })
// 排行榜状态
const showLeaderboard = ref(false)
const leaderboardData = ref([])
// 答题状态记录
const userSelections = ref([])
const isSubmitted = ref(false)
// 新增状态控制
const showAdminModal = ref(false)
const adminPassword = ref('')
const passwordError = ref(false)


// 实例化 Store 并解构数据与方法
const studentStore = useStudentStore()
// 使用 storeToRefs 确保解构出来的状态（ref）依然保持响应性
const { students, currentStudent, isLoading: isStudentLoading } = storeToRefs(studentStore)
const { fetchStudents, handleAddNewStudent, handleDeleteStudent, awardXP } = studentStore
const readingStore = useReadingStore()
const { readings, activeReading, editingReading, isLoading: isReadingLoading } = storeToRefs(readingStore)
const { fetchReadings, handleDeleteReading } = readingStore


const toggleRole = () => {
  if (!isAdminMode.value) {
    showAdminModal.value = true
    adminPassword.value = 'eva888' // 默认填好密码
    passwordError.value = false
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
  }
}

// 获取排行榜数据 (计算本周得分汇总)
const fetchLeaderboard = async () => {
  const { data, error } = await supabase
    .from('xp_logs')
    .select('amount, student_id, students(name)')
    .gte('created_at', getStartOfThisWeek());
  if (!error && data) {
    const summary = data.reduce((acc, curr) => {
      const id = curr.student_id;
      if (!acc[id]) acc[id] = { id, name: curr.students.name, total_xp: 0 };
      acc[id].total_xp += curr.amount;
      return acc;
    }, {});
    leaderboardData.value = Object.values(summary).sort((a, b) => b.total_xp - a.total_xp);
  }
};

// 删除单条历史一言记录
const handleDeleteOneWord = async (wordItem) => {
  if (!confirm(`确定要彻底删除这条历史一言吗？云端将同步抹除哦 ❤️`)) return

  try {
    isLoading.value = true
    const { error } = await supabase
      .from('one_words')
      .delete()
      .eq('id', wordItem.id)
    if (error) throw error
    currentOneWordList.value = currentOneWordList.value.filter(q => q.id !== wordItem.id)
    alert("✅ 该条历史纪录已彻底从云端移除")
  } catch (e) {
    console.error("从云端删除一言失败:", e)
    alert("❌ 删除失败：" + e.message)
  } finally {
    isLoading.value = false
  }
}

const fetchOneWord = async (studentId) => {
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('one_words')
      .select('*')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: true })

    if (error) throw error

    if (data) {
      currentOneWordList.value = [...data]
    }
  } catch (e) {
    console.error("从云端获取一言语失败:", e)
    currentOneWordList.value = []
  } finally {
    isLoading.value = false
  }
}

// 管理端保存“一言语”
const handleSaveOneWord = async (wordData) => {
  if (!currentStudent.value) {
    alert("❌ 请先在左侧选择一名学员")
    return
  }
  try {
    isLoading.value = true
    const { data, error } = await supabase
      .from('one_words')
      .insert([{
        student_id: currentStudent.value.id,
        english: wordData.english,
        chinese: wordData.chinese
      }])
      .select()
    if (error) throw error
    if (data && data.length > 0) {
      currentOneWordList.value = [...currentOneWordList.value, data[0]]
    } else {
      currentOneWordList.value = [...currentOneWordList.value, {
        ...wordData,
        id: Date.now()
      }]
    }
    alert("✅ 新的一言已成功追加至云端历史库")
  } catch (e) {
    console.error("同步云端失败:", e)
    alert("❌ 同步失败：" + e.message)
  } finally {
    isLoading.value = false
  }
}

// 辅助函数：获取本周一 00:00:00 的 ISO 字符串
const getStartOfThisWeek = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - day + 1);
  return now.toISOString();
};


// 2. 当选中的学员发生变化时，自动获取该学员的阅读列表
watch(currentStudent, (newStudent) => {
  if (newStudent) {
    fetchReadings(newStudent.id)
  } else {
    readings.value = []
  }
})

// 1. 监听切换（学员或模块改变时重置状态并加载数据）
watch([currentStudent, activeModule], async ([newStudent, newModule]) => {
  if (!newStudent) return
  if (newModule === 'reading') {
    viewMode.value = 'list'
    await fetchReadings(newStudent.id)
  } else if (newModule === 'quiz') {
    await fetchQuizzes(newStudent.id)
  } else if (newModule === 'cloze') {
    await fetchClozeQuizzes(newStudent.id)
  } else if (newModule === 'vocab-test') {
    await fetchVocabTests(newStudent.id)
  } else if (newModule === 'brain-break') {
    // await fetchGameScores(newStudent.id)
  } else if (newModule === 'words') {
    await fetchVocabulary(newStudent.id)
  } else if (newModule === 'word-study') { // 新增：单词学习模块分支
    await fetchWordData(newStudent.id)
  } else if (newModule === 'blank') {
    await fetchBlankQuizzes(newStudent.id)
  } else if (newModule === 'sentence') {
    await fetchOneWord(newStudent.id)
  } else if (newModule === 'film') {
    await fetchFilms(newStudent.id)
  }
})

// 单词学习板块数据获取
const fetchWordData = async (studentId) => {
  isLoading.value = true
  try {
    const { data: configs } = await supabase
      .from('student_configs')
      .select('current_word_list, word_stats')
      .eq('student_id', studentId)
      .single()

    if (configs) {
      studentWordBooks.value = configs.current_word_list || []
      wordStats.value = configs.word_stats || { totalLearned: 0, todayReviewed: 0 }
    }
  } catch (e) {
    console.error("获取单词数据失败:", e)
  } finally {
    isLoading.value = false
  }
}

// 保存/更新单词学习进度的处理函数
const handleSaveWordProgress = async (wordData) => {
  if (!currentStudent.value) return
  try {
    const { error } = await supabase
      .from('student_configs')
      .upsert({
        student_id: currentStudent.value.id,
        current_word_list: wordData.wordList,
        word_stats: wordData.stats,
        updated_at: new Date()
      }, { onConflict: 'student_id' })

    if (error) throw error
    if (wordData.earnedXP) {
      await awardXP(wordData.earnedXP, 'word-study', '完成单词单元复习/记忆训练')
    }
  } catch (e) {
    console.error("更新单词进度失败:", e)
  }
}

const handleReadingSubmit = () => {
  isSubmitted.value = true;
  const correctCount = userSelections.value.filter((sel, idx) => sel === activeReading.value.quiz[idx].answer).length;
  const totalCount = activeReading.value.quiz.length;
  let earnedXP = correctCount * 10;
  if (correctCount === totalCount) earnedXP += 20;
  if (earnedXP > 0) {
    awardXP(earnedXP, 'reading', `完成阅读: ${activeReading.value.title}`);
  }
};

const fetchFilms = async (studentId) => {
  isLoading.value = true
  const { data, error } = await supabase
    .from('movie_posts')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (!error) studentFilms.value = data || []
  isLoading.value = false
}

const saveFilmPost = async (movieData) => {
  try {
    const { data, error } = await supabase
      .from('movie_posts')
      .insert([{
        ...movieData,
        student_id: currentStudent.value.id
      }])
      .select();

    if (error) throw error;
    alert("发布成功！");
    await fetchFilms(currentStudent.value.id);
  } catch (err) {
    alert("保存失败：" + err.message);
  }
};

const fetchClozeQuizzes = async (studentId) => {
  isLoading.value = true
  const { data } = await supabase.from('cloze_quizzes')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  studentClozeQuizzes.value = data || []
  isLoading.value = false
}

const fetchVocabTests = async (studentId) => {
  isLoading.value = true
  const { data } = await supabase.from('vocab_tests')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  studentVocabTests.value = data || []
  isLoading.value = false
}

const fetchBlankQuizzes = async (studentId) => {
  isLoading.value = true
  const { data, error } = await supabase.from('blank_quizzes')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error("获取完形填空失败:", error)
  } else {
    studentBlankQuizzes.value = data || []
  }
  isLoading.value = false
}

const deleteClozeQuiz = async (id) => {
  if (!confirm('确定要删除这篇短文填空吗？此操作不可恢复 ❤️')) return
  try {
    isLoading.value = true
    const { error } = await supabase
      .from('cloze_quizzes')
      .delete()
      .eq('id', id)
    if (error) throw error
    alert("✅ 短文填空已从云端移除")
    if (currentStudent.value) {
      await fetchClozeQuizzes(currentStudent.value.id)
    }
  } catch (e) {
    console.error("Delete Error:", e)
    alert("❌ 删除失败：" + e.message)
  } finally {
    isLoading.value = false
  }
}

const handleUpdateWordProgress = async (updatedList) => {
  if (!currentStudent.value) return;

  try {
    const { error } = await supabase
      .from('student_configs')
      .upsert({
        student_id: currentStudent.value.id,
        current_word_list: updatedList,
        updated_at: new Date()
      }, {
        onConflict: 'student_id'
      });

    if (error) throw error;
    currentWordList.value = updatedList;
    console.log("✅ 掌握进度已同步");
  } catch (e) {
    console.error("同步失败:", e);
  }
};

const fetchVocabulary = async (studentId) => {
  isLoading.value = true
  const { data } = await supabase
    .from('student_configs')
    .select('current_word_list')
    .eq('student_id', studentId)
    .single()
  const list = data?.current_word_list || []
  currentWordList.value = list.map(word => ({
    ...word,
    m: word.m || false
  }))
  isLoading.value = false
}

const fetchQuizzes = async (studentId) => {
  const { data } = await supabase.from('quizzes')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  studentQuizzes.value = data || []
}

const getAvatarColor = (index) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#A8E6CF', '#D4A5A5']
  return colors[index % colors.length]
}

const handleQuizXP = (data) => {
  awardXP(data.amount, data.module, data.reason);
};

const handleSaveQuiz = async (quizData) => {
  try {
    let res;
    const payload = {
      question: quizData.question,
      options: quizData.options,
      answer_index: quizData.answer_index,
      category: quizData.category,
      explanation: quizData.explanation
    }
    if (quizData.id) {
      res = await supabase.from('quizzes').update(payload).eq('id', quizData.id)
    } else {
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

const handleBatchSaveQuizzes = async (quizzesArray) => {
  try {
    const finalData = quizzesArray.map(quiz => ({
      ...quiz,
      student_id: currentStudent.value.id
    }))
    const { error } = await supabase
      .from('quizzes')
      .insert(finalData)
    if (error) throw error
    alert(`🚀 成功批量发布 ${finalData.length} 道题目！`)
    await fetchQuizzes(currentStudent.value.id)
  } catch (e) {
    console.error(e)
    alert('批量保存失败：' + e.message)
  }
}

const saveClozeQuiz = async (clozeData) => {
  try {
    let res;
    const payload = {
      title: clozeData.title || '',
      cloze_text: clozeData.cloze_text,
      answers: clozeData.answers,
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
    console.error("Save Error:", e)
    alert("保存失败：" + e.message)
  }
}

const handleBatchSaveClozes = async (clozeQuizzesArray) => {
  if (!currentStudent.value) {
    alert("❌ 请先在左侧列表选择一名学员，再进行批量发布。")
    return
  }

  try {
    isLoading.value = true
    const finalData = clozeQuizzesArray.map(cloze => ({
      title: cloze.title || '未命名短文练习',
      cloze_text: cloze.cloze_text,
      answers: cloze.answers,
      category: cloze.category || '短文填空',
      explanation: cloze.explanation || '',
      student_id: currentStudent.value.id
    }))

    const { error } = await supabase
      .from('cloze_quizzes')
      .insert(finalData)

    if (error) throw error
    alert(`🚀 成功批量发布 ${finalData.length} 篇短文填空练习！`)
    await fetchClozeQuizzes(currentStudent.value.id)

  } catch (e) {
    console.error("Batch Save Cloze Error:", e)
    alert('批量发布失败：' + e.message)
  } finally {
    isLoading.value = false
  }
}

const handleBatchImportFilms = async (jsonString) => {
  try {
    const rawData = JSON.parse(jsonString);
    const { data: studentsList } = await supabase.from('students').select('id, name');
    const batchData = rawData.map(item => {
      const student = studentsList.find(s =>
        s.name.trim().toLowerCase() === item.student.trim().toLowerCase()
      );
      if (!student) return null;
      return {
        student_id: student.id,
        movie_display: item.movieDisplay,
        poster_url: item.poster,
        quote: item.quote,
        translation: item.translation
      };
    }).filter(item => item !== null);

    const { error } = await supabase.from('movie_posts').insert(batchData);
    if (error) throw error;
    alert(`🚀 成功批量导入 ${batchData.length} 条电影推送！`);
    if (currentStudent.value) {
      await fetchFilms(currentStudent.value.id);
    }
  } catch (e) {
    alert("导入失败，请检查 JSON 格式：" + e.message);
  }
};

const saveVocabTest = async (testData) => {
  try {
    const { error } = await supabase.from('vocab_tests').insert([{
      student_id: currentStudent.value.id,
      score: testData.score,
      level: testData.level,
      details: testData.details
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

onMounted(() => {
  fetchStudents()
  document.addEventListener('fullscreenchange', () => {
    isFullScreen.value = !!document.fullscreenElement
  })
})

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
    const payload = {
      title: formData.title,
      body: formData.body,
      body_cn: formData.body_cn,
      quiz: formData.quiz
    }
    if (formData.id) {
      res = await supabase
        .from('readings')
        .update(payload)
        .eq('id', formData.id)
    } else {
      res = await supabase
        .from('readings')
        .insert([{
          ...payload,
          student_id: currentStudent.value.id
        }])
    }
    if (res.error) throw res.error
    alert("✅ 文章已成功保存到云端")
    viewMode.value = 'list'
    await fetchReadings(currentStudent.value.id)
  } catch (e) {
    console.error("保存失败:", e)
    alert("❌ 保存失败：" + e.message)
  }
}

const saveBlankQuiz = async (blankData) => {
  try {
    isLoading.value = true
    const payload = {
      title: blankData.title,
      body: blankData.body,
      body_cn: blankData.body_cn,
      quiz: blankData.quiz,
      student_id: currentStudent.value.id
    }
    let res;
    if (blankData.id) {
      res = await supabase.from('blank_quizzes').update(payload).eq('id', blankData.id)
    } else {
      res = await supabase.from('blank_quizzes').insert([payload])
    }
    if (res.error) throw res.error
    await fetchBlankQuizzes(currentStudent.value.id)
    alert("✅ 完形填空已同步至云端")
  } catch (e) {
    console.error("Save Error:", e)
    alert("❌ 保存失败：" + e.message)
  } finally {
    isLoading.value = false
  }
}

const handleDeleteBlank = async (id) => {
  if (!confirm('确定要删除这篇完形填空吗？')) return
  const { error } = await supabase.from('blank_quizzes').delete().eq('id', id)
  if (error) alert(error.message)
  else await fetchBlankQuizzes(currentStudent.value.id)
}

const handleSaveGameConfig = async ({ studentId, wordList, goal }) => {
  try {
    isLoading.value = true
    const { error } = await supabase
      .from('student_configs')
      .upsert({
        student_id: studentId,
        current_word_list: wordList,
        game_goal: goal || 20,
        updated_at: new Date()
      }, {
        onConflict: 'student_id'
      })

    if (error) throw error
    alert("✅ 词库已同步到云端")
  } catch (e) {
    console.error("保存失败:", e)
    alert("❌ 保存失败：" + e.message)
  } finally {
    isLoading.value = false
  }
}

const toggleFullScreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      isFullScreen.value = true
    }).catch(err => {
      console.error(`全屏启动失败: ${err.message}`)
    })
  } else {
    document.exitFullscreen()
    isFullScreen.value = false
  }
}
</script>

<template>
  <div :class="['app-shell', isAdminMode ? 'admin-theme' : 'student-theme']">
    <div class="nav-stealth-trigger" :class="{ 'is-folded': !isNavVisible }" @click="isNavVisible = !isNavVisible">
      <div class="trigger-indicator"></div>
    </div>
    <Transition name="slide-nav">
      <header v-if="isNavVisible" class="top-nav">
        <!-- 左侧：品牌 Logo -->
        <div class="nav-brand">
          <div class="brand-logo">🏔️</div>
          <span class="brand-name">EVA ENGLISH</span>
        </div>

        <!-- 中间：精简后的分类导航菜单 -->
        <nav class="nav-center">
          <!-- 分组 1：词汇专区 -->
          <div class="nav-group">
            <button :class="['group-btn', { active: ['vocab-test', 'word-study', 'words'].includes(activeModule) }]">
              <span>🪵 Word Pump</span>
              <span class="chevron">▾</span>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item" :class="{ active: activeModule === 'vocab-test' }"
                @click="activeModule = 'vocab-test'">
                <span class="item-icon">📊</span>
                <div class="item-text"><span class="title">词汇评估</span><span class="desc">实时测试掌握词汇量</span></div>
              </div>
              <div class="dropdown-item" :class="{ active: activeModule === 'word-study' }"
                @click="activeModule = 'word-study'">
                <span class="item-icon">🧠</span>
                <div class="item-text"><span class="title">单词记忆</span><span class="desc">单元记忆与智能复习</span></div>
              </div>
              <div class="dropdown-item" :class="{ active: activeModule === 'words' }" @click="activeModule = 'words'">
                <span class="item-icon">🗂️</span>
                <div class="item-text"><span class="title">单词复习</span><span class="desc">强化复习与消灭难词</span></div>
              </div>
            </div>
          </div>

          <!-- 分组 2：综合训练 -->
          <div class="nav-group">
            <button :class="['group-btn', { active: ['quiz', 'reading', 'cloze', 'blank'].includes(activeModule) }]">
              <span>🌳 Brain Combo</span>
              <span class="chevron">▾</span>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item" :class="{ active: activeModule === 'reading' }"
                @click="activeModule = 'reading'">
                <span class="item-icon">📖</span>
                <div class="item-text"><span class="title">阅读理解</span></div>
              </div>
              <div class="dropdown-item" :class="{ active: activeModule === 'quiz' }" @click="activeModule = 'quiz'">
                <span class="item-icon">📝</span>
                <div class="item-text"><span class="title">单选训练</span></div>
              </div>
              <div class="dropdown-item" :class="{ active: activeModule === 'cloze' }" @click="activeModule = 'cloze'">
                <span class="item-icon">✍️</span>
                <div class="item-text"><span class="title">短文填空</span></div>
              </div>
              <div class="dropdown-item" :class="{ active: activeModule === 'blank' }" @click="activeModule = 'blank'">
                <span class="item-icon">🖋️</span>
                <div class="item-text"><span class="title">完形填空</span></div>
              </div>
            </div>
          </div>

          <!-- 分组 3：趣味拓展 -->
          <div class="nav-group">
            <button :class="['group-btn', { active: ['sentence', 'film', 'brain-break'].includes(activeModule) }]">
              <span>🍶 Chill & Refill </span>
              <span class="chevron">▾</span>
            </button>
            <div class="dropdown-menu">
              <div class="dropdown-item" :class="{ active: activeModule === 'sentence' }"
                @click="activeModule = 'sentence'">
                <span class="item-icon">🏞️</span>
                <div class="item-text"><span class="title">一言</span></div>
              </div>
              <div class="dropdown-item" :class="{ active: activeModule === 'film' }" @click="activeModule = 'film'">
                <span class="item-icon">🎬</span>
                <div class="item-text"><span class="title">一观</span></div>
              </div>
              <div class="dropdown-item" :class="{ active: activeModule === 'brain-break' }"
                @click="activeModule = 'brain-break'">
                <span class="item-icon">🎮</span>
                <div class="item-text"><span class="title">换个脑子</span></div>
              </div>
            </div>
          </div>
        </nav>

        <!-- 右侧：XP & 角色切换胶囊组件 -->
        <div class="nav-right">
          <div class="xp-badge" @click="showLeaderboard = true; fetchLeaderboard()">
            <span class="xp-icon">📜</span>
            <span class="xp-num">{{ currentStudent?.total_xp || 0 }}</span>
            <span class="xp-unit">XP</span>
          </div>

          <div :class="['role-pill', isAdminMode ? 'is-admin' : 'is-student']" @dblclick="toggleRole" title="双击切换模式">
            <span class="status-dot"></span>
            <span class="role-text">{{ isAdminMode ? '管理' : '学员' }}</span>
          </div>
        </div>
      </header>
    </Transition>

    <div class="main-body" :style="{ height: isNavVisible ? 'calc(100vh - var(--nav-h))' : '100vh' }">
      <Sidebar :students="students" :currentStudent="currentStudent" :collapsed="sidebarCollapsed"
        :canEdit="isAdminMode" @select="(s) => { currentStudent = s; }" @add="handleAddNewStudent"
        @deleteStudent="handleDeleteStudent" @toggle="sidebarCollapsed = !sidebarCollapsed" />

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
                <h2>🍀 开始训练？</h2>
              </div>
            </div>

            <ReadingWorkspace v-if="viewMode === 'reading' && activeReading" :activeReading="activeReading"
              :isFullScreen="isFullScreen" :userSelections="userSelections" :isSubmitted="isSubmitted"
              @toggleFull="isFullScreen = !isFullScreen" @close="viewMode = 'list'" @submit="handleReadingSubmit"
              @updateSelection="(d) => userSelections[d.qIdx] = d.oIdx" />

            <EditForm v-if="viewMode === 'edit'" :student="currentStudent" :initialData="editingReading"
              @save="handleSaveReading" @cancel="viewMode = 'list'" />
          </main>
        </template>

        <template v-else-if="activeModule === 'quiz'">
          <QuizModule :student="currentStudent" :quizzes="studentQuizzes" :canEdit="isAdminMode" @save="handleSaveQuiz"
            @delete="deleteQuiz" @add-xp="handleQuizXP" @batch-save="handleBatchSaveQuizzes" />
        </template>

        <template v-else-if="activeModule === 'brain-break'">
          <BrainBreakModule :student="currentStudent" :canEdit="isAdminMode" @saveConfig="handleSaveGameConfig" />
        </template>

        <template v-else-if="activeModule === 'cloze'">
          <ClozeModule :student="currentStudent" :quizzes="studentClozeQuizzes" :canEdit="isAdminMode"
            :isFullScreen="isFullScreen" @save="saveClozeQuiz" @delete="deleteClozeQuiz"
            @batch-save="handleBatchSaveClozes" @toggleFull="toggleFullScreen" />
        </template>

        <template v-else-if="activeModule === 'vocab-test'">
          <VocabTestModule :student="currentStudent" :records="studentVocabTests" :canEdit="isAdminMode"
            @save="saveVocabTest" />
        </template>

        <!-- 新增：单词学习板块核心渲染点 -->
        <template v-else-if="activeModule === 'word-study'">
          <WordModule :student="currentStudent" :wordList="studentWordBooks" :stats="wordStats" :canEdit="isAdminMode"
            @save-progress="handleSaveWordProgress" />
        </template>

        <template v-else-if="activeModule === 'words'">
          <VocabularyModule :key="currentStudent.id" :student="currentStudent" :initialWords="currentWordList"
            @update-progress="handleUpdateWordProgress" />
        </template>

        <template v-else-if="activeModule === 'blank'">
          <Transition name="module-fade" mode="out-in">
            <div v-if="!isLoading" :key="'content-' + currentStudent.id" class="module-content-wrapper">
              <BlankModule :student="currentStudent" :quizzes="studentBlankQuizzes || []" :canEdit="isAdminMode"
                :isFullScreen="isFullScreen" @save="saveBlankQuiz" @delete="handleDeleteBlank"
                @toggleFull="toggleFullScreen" />
            </div>

            <div v-else :key="'loading-' + currentStudent.id" class="loading-state">
              <div class="loader-visual">
                <div class="spinner-ring"></div>
                <div class="spinner-core"></div>
              </div>
              <div class="loading-text">
                <span>l</span><span>o</span><span>a</span><span>d</span><span>i</span><span>n</span><span>g</span>
              </div>
            </div>
          </Transition>
        </template>

        <template v-else-if="activeModule === 'sentence'">
          <OneWordModule :quoteList="currentOneWordList" :canEdit="isAdminMode" :isFullScreen="isFullScreen"
            @toggleFull="toggleFullScreen" @save="handleSaveOneWord" @delete="handleDeleteOneWord" />
        </template>

        <template v-else-if="activeModule === 'film'">
          <OneFilmModule :student="currentStudent" :movies="studentFilms" :canEdit="isAdminMode" @save="saveFilmPost"
            @import="handleBatchImportFilms" />
        </template>

        <template v-else>
          <div class="placeholder">
            <div class="card">
              <p>正在为 {{ currentStudent.name }} 准备内容...</p>
            </div>
          </div>
        </template>
      </div>

      <div v-else class="full-welcome">
        <div class="welcome-card">
          <h1>👋 Hello!</h1>
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

  <Transition name="fade">
    <div v-if="showLeaderboard" class="modal-overlay" @click.self="showLeaderboard = false">
      <div class="leaderboard-card">
        <div class="lb-header">
          <div class="lb-header-content">
            <span class="lb-trophy">🏆</span>
            <h2>班级排行榜</h2>
          </div>
          <div class="lb-timer">
            <span class="timer-icon">⏳</span>
            本周结算倒计时：<strong>3天 12小时</strong>
          </div>
        </div>

        <div class="lb-body">
          <div v-for="(item, index) in leaderboardData" :key="item.id" :class="['lb-item',
            { 'is-top-three': index < 3 },
            { 'is-current': item.id === currentStudent?.id }]">

            <div class="lb-rank">
              <span v-if="index === 0">🥇</span>
              <span v-else-if="index === 1">🥈</span>
              <span v-else-if="index === 2">🥉</span>
              <span v-else>{{ index + 1 }}</span>
            </div>

            <div class="lb-avatar" :style="{ backgroundColor: getAvatarColor(index) }">
              {{ item.name[0] }}
            </div>

            <div class="lb-info">
              <span class="lb-name">{{ item.name }}</span>
              <span v-if="item.id === currentStudent?.id" class="lb-tag">你</span>
            </div>

            <div class="lb-xp">
              <span class="xp-num">{{ item.total_xp }}</span>
              <span class="xp-unit">Exp</span>
            </div>
          </div>
        </div>

        <div class="lb-footer">
          <button class="lb-btn-confirm" @click="showLeaderboard = false">
            继续加油 🚀
          </button>
        </div>
      </div>
    </div>
  </Transition>
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
  height: 60px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  z-index: 100;
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.brand-logo {
  width: 32px;
  height: 32px;
  color: white;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);
}

.brand-name {
/* 1. 引入 Bodoni Moda 或 Didot 字体 */
  font-family: "Bodoni Moda", "Didot", "Bodoni MT", "Cinzel", serif;
  font-size: 18px; 
  font-weight: 900;
  line-height: 1;
  color: #1c5426; /* 配合深色/浅色导航栏 */
  
  /* 3. 避免全大写导致的“黑块感”，推荐混排或控制字符间距 */
  letter-spacing: 0.02em;
  white-space: nowrap; /* 防止换行撑开导航 */
  
  /* 4. 开启高级高对比度渲染 */
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  
  /* 允许在 Flex 布局中自适应微调 */
  display: inline-flex;
  align-items: center;
}

.brand-icon {
  font-size: 20px;
}

.nav-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 隐藏菜单栏的横向滚动条，保持干净外观 */
.nav-center::-webkit-scrollbar {
  display: none;
}

.nav-group {
  position: relative;
}

.group-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.group-btn .chevron {
  font-size: 10px;
  opacity: 0.5;
  transition: transform 0.2s ease;
}

.nav-group:hover .group-btn {
  background: #f1f5f9;
  color: #0f172a;
}

.nav-group:hover .chevron {
  transform: rotate(180deg);
  opacity: 1;
}

.group-btn.active {
  background: #1c5426;
  color: #f7f1e5;
}

.module-tab {
  padding: 6px 12px;
  /* 缩小内边距：原为 8px 18px */
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  font-weight: 600;
  color: #64748b;
  transition: all 0.2s ease;
  font-size: 13px;
  /* 字体适度调整为 13px */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.module-tab:hover {
  color: #1e293b;
  background: rgba(255, 255, 255, 0.5);
}

.module-tab.active {
  background: #fff;
  color: var(--primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
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
  overflow-y: auto;
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
  box-shadow: 0 0 0 4px rgba(85, 171, 103, 0.4);
  transform: scale(1.02);
}

/* --- 隐蔽的感应式触发器 --- */
.nav-stealth-trigger {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 8px;
  z-index: 1001;
  cursor: pointer;
  display: flex;
  justify-content: center;
  transition: all 0.3s;
}

.trigger-indicator {
  width: 40px;
  height: 3px;
  background: var(--primary);
  border-radius: 0 0 4px 4px;
  opacity: 0;
  transition: all 0.3s;
  transform: translateY(-2px);
}

.nav-stealth-trigger:hover .trigger-indicator {
  opacity: 0.6;
  transform: translateY(0);
  height: 6px;
  width: 80px;
}

.nav-stealth-trigger.is-folded .trigger-indicator {
  opacity: 0.2;
  width: 60px;
}

.nav-stealth-trigger.is-folded:hover .trigger-indicator {
  opacity: 1;
  box-shadow: 0 0 10px var(--primary);
}

.slide-nav-enter-active,
.slide-nav-leave-active {
  transition: transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.slide-nav-enter-from,
.slide-nav-leave-to {
  transform: translateY(-100%);
}

.main-body {
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.module-fade-enter-active,
.module-fade-leave-active {
  transition: all 0.3s ease;
}

.module-fade-enter-from,
.module-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.module-content-wrapper {
  width: 100%;
  height: 100%;
}

.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: transparent;
}

.loader-visual {
  position: relative;
  width: 50px;
  height: 50px;
  margin-bottom: 20px;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid #e2e8f0;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-core {
  position: absolute;
  top: 25%;
  left: 25%;
  width: 50%;
  height: 50%;
  background: var(--primary);
  border-radius: 50%;
  opacity: 0.3;
  animation: pulse 1.5s ease-in-out infinite;
}

.loading-text {
  display: flex;
  gap: 4px;
  font-size: 12px;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: 2px;
}

.loading-text span {
  animation: letter-jump 1.2s infinite;
}

.loading-text span:nth-child(2) {
  animation-delay: 0.1s;
}

.loading-text span:nth-child(3) {
  animation-delay: 0.2s;
}

.loading-text span:nth-child(4) {
  animation-delay: 0.3s;
}

.loading-text span:nth-child(5) {
  animation-delay: 0.4s;
}

.loading-text span:nth-child(6) {
  animation-delay: 0.5s;
}

.loading-text span:nth-child(7) {
  animation-delay: 0.6s;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.2;
  }

  50% {
    transform: scale(1.2);
    opacity: 0.5;
  }
}

@keyframes letter-jump {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

/* 排行榜专有样式 */
.leaderboard-card {
  background: white;
  width: 420px;
  max-height: 80vh;
  border-radius: 32px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 4px solid #f1f5f9;
}

.lb-header {
  padding: 30px 24px 20px;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  text-align: center;
  border-bottom: 2px solid #f1f5f9;
}

.lb-header-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 10px;
}

.lb-trophy {
  font-size: 40px;
}

.lb-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #1e293b;
}

.lb-timer {
  display: inline-block;
  padding: 6px 16px;
  background: #f1f5f9;
  border-radius: 20px;
  font-size: 13px;
  color: #64748b;
}

.lb-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lb-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 20px;
  background: #fff;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.lb-item:hover {
  background: #f8fafc;
  transform: scale(1.02);
}

.lb-item.is-current {
  background: #f0f9ff;
  border-color: #7dd3fc;
}

.lb-rank {
  width: 35px;
  font-size: 18px;
  font-weight: 900;
  color: #94a3b8;
}

.lb-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
  margin-right: 15px;
  box-shadow: inset 0 -3px rgba(0, 0, 0, 0.2);
}

.lb-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lb-name {
  font-weight: 700;
  color: #334155;
  font-size: 16px;
}

.lb-tag {
  background: #3498db;
  color: white;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  text-transform: uppercase;
}

.lb-xp {
  text-align: right;
}

.xp-num {
  font-weight: 900;
  color: #27ae60;
  font-size: 18px;
  margin-right: 4px;
}

.xp-unit {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
}

.lb-footer {
  padding: 20px 24px 30px;
  background: white;
}

.lb-btn-confirm {
  width: 100%;
  padding: 16px;
  border-radius: 20px;
  background: #2ecc71;
  color: white;
  border: none;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 5px 0 #27ae60;
  transition: all 0.1s;
}

.lb-btn-confirm:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 #27ae60;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
  /* 缩小间距 */
  flex-shrink: 0;
}

.xp-display {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 3px 10px 3px 4px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.xp-display:hover {
  border-color: #fbbf24;
  background: #fffcf0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.15);
}

.xp-display:active {
  transform: translateY(1px);
}

.xp-icon-container {
  width: 26px;
  height: 26px;
  background: #fff9db;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  font-size: 15px;
}

.xp-text {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.xp-amount {
  font-size: 14px;
  font-weight: 900;
  color: #1e293b;
}

.xp-label {
  font-size: 10px;
  font-weight: 800;
  color: #94a3b8;
  margin-top: 2px;
}

.divider-line {
  width: 1px;
  height: 24px;
  background: #e2e8f0;
}

.role-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  border: 1.5px solid transparent;
  white-space: nowrap;
}

.is-student {
  background: #f1f5f9;
  color: #64748b;
}

.is-student:hover {
  background: #e2e8f0;
  color: #475569;
}

.is-admin {
  background: #ecfdf5;
  color: #059669;
  border-color: #10b981;
}

.role-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.xp-display:hover .xp-emoji {
  animation: cup-shake 0.5s ease infinite;
}

@keyframes cup-shake {

  0%,
  100% {
    transform: rotate(0);
  }

  25% {
    transform: rotate(-15deg);
  }

  75% {
    transform: rotate(15deg);
  }
}
/* Dropdown 下拉悬浮菜单 */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(8px);
  min-width: 180px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 6px;
  box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.1);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  z-index: 1000;
}

.nav-group:hover .dropdown-menu {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(-50%) translateY(4px);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dropdown-item:hover {
  background: #f8fafc;
}

.dropdown-item.active {
  background: #f0fdf4;
}

.dropdown-item.active .title {
  color: #16a34a;
  font-weight: 700;
}

.item-icon {
  font-size: 16px;
}

.item-text {
  display: flex;
  flex-direction: column;
}

.item-text .title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.item-text .desc {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 1px;
}

/* 右侧工具栏微缩胶囊 */
.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.xp-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #fdf6d0;
  border: 1px solid #fffbeb;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.xp-badge:hover {
  transform: scale(1.03);
  background: #fef3c7;
}

.xp-icon { font-size: 14px; }
.xp-num { font-weight: 800; font-size: 14px; color: #d97706; }
.xp-unit { font-size: 10px; font-weight: 700; color: #b45309; }

/* 角色 Pill */
.role-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.role-pill.is-student {
  background: #f1f5f9;
  color: #64748b;
}

.role-pill.is-admin {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
</style>
<script setup>
import { reactive, onMounted } from 'vue'

const props = defineProps({
  student: Object,
  initialData: Object // 新增：用于接收待修改的文章数据
})

const emit = defineEmits(['save', 'cancel'])

// --- 表单状态管理 ---
const form = reactive({
  id: null,
  title: '',
  body: '',
  quizRaw: ''
})

// 初始化逻辑：如果是修改模式，填充数据
onMounted(() => {
  if (props.initialData) {
    form.id = props.initialData.id
    form.title = props.initialData.title
    form.body = props.initialData.body
    form.quizRaw = JSON.stringify(props.initialData.quiz, null, 2)
  }
})

const handleSave = () => {
  if (!form.title || !form.body || !form.quizRaw) {
    alert("Eva 老师，请填写完整内容哦 ❤️")
    return
  }

  try {
    const quizJson = JSON.parse(form.quizRaw)
    emit('save', {
      id: form.id, // 如果有 ID 则是修改，没有则是新增
      title: form.title,
      body: form.body,
      quiz: quizJson
    })
  } catch (e) {
    alert("题目 JSON 格式错误，请检查！")
  }
}
</script>

<template>
  <div class="edit-view">
    <div class="edit-container">
      <header class="edit-header">
        <div class="title-group">
          <h3>{{ form.id ? '✏️ 修改文章详情' : '📝 录入新文章' }}</h3>
          <p class="subtitle">学员：<span class="highlight">{{ student.name }}</span></p>
        </div>
        <button class="btn-close" @click="$emit('cancel')">✕</button>
      </header>

      <div class="form-body">
        <div class="input-group">
          <label>文章标题</label>
          <input v-model="form.title" class="input" placeholder="输入文章标题...">
        </div>

        <div class="input-group">
          <label>文章正文</label>
          <textarea v-model="form.body" class="textarea main-text" placeholder="输入正文内容..."></textarea>
        </div>

        <div class="input-group">
          <label>题目数据 (JSON)</label>
          <textarea v-model="form.quizRaw" class="textarea json-text" placeholder='JSON 格式题目数据...'></textarea>
        </div>

        <button class="btn-save" @click="handleSave">
          {{ form.id ? '确认更新' : '保存到云端' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-view { height: 100%; overflow-y: auto; background: #f8fafc; padding: 40px 20px; }
.edit-container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
.edit-header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; }
.highlight { color: #27ae60; font-weight: bold; }
.form-body { display: flex; flex-direction: column; gap: 20px; }
.input-group { display: flex; flex-direction: column; gap: 8px; }
.input-group label { font-size: 14px; font-weight: 600; color: #475569; }
.input, .textarea { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 15px; outline: none; }
.main-text { min-height: 200px; line-height: 1.6; }
.json-text { font-family: monospace; background: #f8fafc; font-size: 13px; min-height: 150px; }
.btn-save { background: #1e293b; color: white; border: none; height: 50px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.3s; }
.btn-save:hover { background: #27ae60; transform: translateY(-2px); }
.btn-close { background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; }
</style>
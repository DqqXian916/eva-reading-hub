<template>
  <div class="eva-film-center">
    <section v-if="canEdit" class="admin-module">
      <div class="admin-card">
        <div class="admin-grid">
          <div class="input-row">
            <input v-model="form.title" placeholder="电影名称 (中文)" class="ipt-main" />
            <input v-model="form.englishTitle" placeholder="Movie Title (English)" class="ipt-main" />
          </div>
          <input v-model="form.poster" placeholder="海报图片链接 (URL)" class="ipt-sub" />
          <textarea v-model="form.quote" placeholder="经典台词..." class="ipt-quote" rows="2"></textarea>
          <input v-model="form.translation" placeholder="中文翻译" class="ipt-sub" />
          
          <button class="btn-publish" @click="handleSave">发 布 推 送</button>
          
          <div class="batch-import-zone">
            <div class="batch-header">
              <span>批量录入 (JSON)</span>
              <button class="btn-template" @click="copyTemplate">复制 JSON 模板</button>
            </div>
            <textarea v-model="batchJson" placeholder='[{"title":"...","englishTitle":"...","poster":"...","quote":"...","translation":"..."}]' class="ipt-batch" rows="3"></textarea>
            <div class="batch-footer">
              <button class="btn-batch" @click="handleBatchSave">执行批量录入</button>
              <span v-if="errorMsg" class="error-text">{{ errorMsg }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <main v-if="latestMovie" class="display-module">
      <div class="view-wrapper">
        <div class="poster-box">
          <img :src="latestMovie.poster_url" class="poster-img" />
        </div>
        <div class="content-box">
          <h1 class="movie-title">{{ latestMovie.movie_display }}</h1>
          <p class="movie-english-title">{{ latestMovie.movie_english_title }}</p>
          <p class="quote-serif">“{{ latestMovie.quote }}”</p>
          <div class="trans-controls">
            <Transition name="fade"><p v-if="showTranslation" class="trans-text">{{ latestMovie.translation }}</p></Transition>
            <button class="btn-toggle" @click="showTranslation = !showTranslation">
              {{ showTranslation ? '隐去译文' : '对照译文' }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <div v-if="reversedHistory.length > 1" class="history-module">
      <div class="hist-title-row">往 期 影 库</div>
      <div class="hist-grid">
        <div v-for="item in reversedHistory.slice(1)" :key="item.id" class="hist-item">
          <div class="hist-item-header">{{ item.movie_display }}</div>
          <div class="hist-item-quote">“{{ item.quote }}”</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
const props = defineProps(['movies', 'canEdit'])
const emit = defineEmits(['save'])

const showTranslation = ref(true)
const form = ref({ title: '', englishTitle: '', poster: '', quote: '', translation: '' })
const batchJson = ref('')
const errorMsg = ref('')

const latestMovie = computed(() => props.movies?.[0] || null)
const reversedHistory = computed(() => [...(props.movies || [])].reverse())

const copyTemplate = () => {
  const template = JSON.stringify([{ title: "电影名", englishTitle: "English Title", poster: "URL", quote: "Quote", translation: "中文" }], null, 2);
  navigator.clipboard.writeText(template);
  alert("模板已复制到剪贴板");
};

const handleSave = () => {
  if (!form.value.title || !form.value.poster) return alert("请完整填写");
  emit('save', { 
    movie_display: form.value.title,
    movie_english_title: form.value.englishTitle,
    poster_url: form.value.poster, 
    quote: form.value.quote, 
    translation: form.value.translation 
  });
  form.value = { title: '', englishTitle: '', poster: '', quote: '', translation: '' };
};

const handleBatchSave = () => {
  errorMsg.value = '';
  try {
    const data = JSON.parse(batchJson.value);
    if (!Array.isArray(data)) throw new Error("JSON 必须是数组格式 []");
    
    data.forEach(item => {
      emit('save', { 
        student_id: item.student_id, // 关键：对应数据库列名
        movie_display: item.title, 
        movie_english_title: item.englishTitle, 
        poster_url: item.poster, 
        quote: item.quote, 
        translation: item.translation 
      });
    });
    alert("导入成功，已关联至对应学生 ID！");
    batchJson.value = '';
  } catch (e) { errorMsg.value = "导入失败: " + e.message; }
};
</script>

<style scoped>
.eva-film-center { max-width: 860px; margin: 0 auto; padding: 60px 20px; font-family: -apple-system, sans-serif; }

/* 管理员面板样式 */
.admin-card { background: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 60px; border: 1px solid #f0f0f0; }
.admin-grid { display: flex; flex-direction: column; gap: 15px; width: 100%; }
.input-row { display: flex; gap: 20px; width: 100%; }
.ipt-main { flex: 1; font-size: 18px; font-weight: 600; border: none; background: none; border-bottom: 2px solid #ddd; padding: 5px 0; }
.ipt-sub { width: 100%; border: none; border-bottom: 1px solid #e2e8f0; background: none; padding: 8px 0; }
.ipt-quote { width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-style: italic; resize: vertical; background: #fff; }
.btn-publish { align-self: flex-start; padding: 10px 25px; background: #111; color: #fff; border-radius: 6px; cursor: pointer; }

/* 批量导入样式 */
.batch-import-zone { margin-top: 20px; padding-top: 20px; border-top: 1px dashed #ddd; }
.batch-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #666; }
.btn-template { background: none; border: none; color: #4a90e2; cursor: pointer; text-decoration: underline; }
.ipt-batch { width: 100%; border: 1px solid #e2e8f0; padding: 10px; font-size: 11px; font-family: monospace; background: #f8fafc; resize: vertical; }
.btn-batch { margin-top: 10px; background: #4a90e2; color: #fff; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; }
.error-text { color: #e11d48; font-size: 12px; margin-left: 15px; }

/* 展示模块 */
.view-wrapper { display: flex; gap: 60px; align-items: start; margin-bottom: 80px; }
.poster-box { width: 300px; flex-shrink: 0; }
/* 修改后的海报样式 */
.poster-img { 
  width: 100%; 
  border-radius: 4px; 
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
  transition: transform 0.4s ease; 
  cursor: pointer;
}

.poster-img:hover {
  transform: scale(1.05); /* 放大 5% */
}
.content-box { flex: 1; }
.movie-title { font-size: 42px; font-weight: 800; margin: 0 0 30px 0; letter-spacing: -0.02em; }
.movie-english-title { font-size: 16px; color: #888; margin: -20px 0 30px 0; letter-spacing: 0.05em; font-weight: 500; }
.quote-serif { font-family: 'Georgia', serif; font-size: 24px; line-height: 1.7; color: #222; margin-bottom: 20px; }
.trans-text { color: #666; font-size: 14px; margin-bottom: 10px; }
.btn-toggle { background: #f4f4f4; border: none; padding: 3px 8px; font-size: 10px; color: #888; cursor: pointer; }

/* 历史列表 */
.history-module { border-top: 1px solid #eee; padding-top: 40px; }
.hist-title-row { font-size: 12px; font-weight: bold; color: #aaa; margin-bottom: 30px; letter-spacing: 0.1em; }
.hist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
.hist-item-header { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.hist-item-quote { font-size: 12px; color: #777; font-style: italic; }
</style>
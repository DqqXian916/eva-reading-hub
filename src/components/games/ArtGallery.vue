<template>
  <div class="gallery-container" @click="handleGlobalClick">
    <div class="bg-glow"></div>

    <div class="gallery-header">
      <div class="brand-box">
        <span class="brand-tag">- SILK & INK ART -</span>
        <h2 class="gallery-title">{{ isAdminMode ? '天工物志 · 馆藏管理' : '教研工坊 · 艺术画廊' }}</h2>
      </div>
      
      <div class="action-group">
        <button class="toggle-mode-btn" @click="isAdminMode = !isAdminMode">
          {{ isAdminMode ? "返回画廊" : "管理馆藏" }}
        </button>
      </div>
    </div>

    <div v-if="!isAdminMode" class="gallery-stage">
      <div v-if="artworks.length > 0" class="artwork-card-wrapper">
        <div class="gallery-progress">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
          <span class="progress-text">{{ currentIndex + 1 }} / {{ artworks.length }}</span>
        </div>

        <div class="artwork-main-zone">
          <button class="nav-arrow left" @click="prevArtwork" :disabled="currentIndex === 0">‹</button>

          <transition name="art-fade" mode="out-in">
            <div :key="currentIndex" class="artwork-card">
              <div class="image-frame" @mousemove="handleImageHover">
                <img :src="currentArt.url" :alt="currentArt.title" class="art-image" />
                <div class="image-overlay"></div>
                <span class="art-year-tag">{{ currentArt.year }}</span>
              </div>
              
              <div class="art-info-box">
                <h3 class="art-title">{{ currentArt.title }}</h3>
                <p class="art-author">作者：{{ currentArt.artist }}</p>
                <div class="art-tags">
                  <span v-for="tag in currentArt.tags" :key="tag" class="art-tag"># {{ tag }}</span>
                </div>
                <hr class="art-divider" />
                <p class="art-desc">{{ currentArt.description }}</p>
              </div>
            </div>
          </transition>

          <button class="nav-arrow right" @click="nextArtwork" :disabled="currentIndex === artworks.length - 1">›</button>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <p>画廊空无一物，等待馆长点墨开卷...</p>
      </div>
    </div>

    <div v-else class="admin-stage">
      <div class="admin-grid">
        <div class="admin-card form-box">
          <h3 class="panel-title">新藏品入册</h3>
          <div class="form-group">
            <label>画作名称</label>
            <input v-model="newArt.title" type="text" placeholder="例：高山流水" />
          </div>
          <div class="form-group">
            <label>创作者</label>
            <input v-model="newArt.artist" type="text" placeholder="例：伯牙" />
          </div>
          <div class="form-group">
            <label>创作年份</label>
            <input v-model="newArt.year" type="text" placeholder="例：公元前 400 年 或 2026" />
          </div>
          <div class="form-group">
            <label>图片链接 (URL)</label>
            <input v-model="newArt.url" type="text" placeholder="请输入合法的网络图片链接" />
          </div>
          <div class="form-group">
            <label>艺术标签 (逗号分隔)</label>
            <input v-model="newArt.tagsString" type="text" placeholder="例：国风,水墨,写意" />
          </div>
          <div class="form-group">
            <label>藏品传记 / 描述</label>
            <textarea v-model="newArt.description" rows="4" placeholder="描绘这件艺术品背后的故事..."></textarea>
          </div>
          <button class="submit-btn" @click="addArtwork">确认入册</button>
        </div>

        <div class="admin-card list-box">
          <h3 class="panel-title">当前馆藏名录 ({{ artworks.length }})</h3>
          <div class="inventory-list">
            <div v-for="(art, idx) in artworks" :key="art.id" class="inventory-item">
              <img :src="art.url" class="thumb-img" />
              <div class="item-meta">
                <h4>{{ art.title }}</h4>
                <p>{{ art.artist }} · {{ art.year }}</p>
              </div>
              <button class="delete-btn" @click="deleteArtwork(idx)">撤展</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="gallery-footer-strings" @mouseleave="stopRipple">
      <div 
        v-for="char in footerNotes" 
        :key="char" 
        class="string-line-wrapper"
        @mouseenter="triggerStringEffect(char)"
      >
        <div class="string-line" :class="{ 'is-active': activeNote === char }"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';

// 初始唯美艺术数据
const initialArtworks = [
  {
    id: 1,
    title: "dance /dɑːns/",
    artist: "eloise - 基础词汇 · 肢体律动 ",
    year: "eloise -  初级核心 / 基础动词",
    url: "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWU_ZqQnQQR5Q94qUa0hQhXUfZxDDPCAACFycAAv6GGFZ8V2ZKWeA6wTwE.png",
    tags: ["动词/名词", "高频交际", "过去式: danced"],
    description: "本义为因欢乐而跳跃。在写作中，除了指‘跳舞’，还常用来生动拟人，如：the index danced dynamically.（指数呈现出灵动的跳跃性增长）。"
  },
  {
    id: 2,
    title: "slept /slept/",
    artist: "eloise - 不规则动词 · 深度静息",
    year: "eloise - 基础必会 / 核心时态",
    url: "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWVC1qQnaLTuf9FfzxmyzNgHVZEHDyKQACYCcAAv6GGFYPM88PVZW8gzwE.png",
    tags: ["sleep的过去式", "静态动词", "常见搭配: slept soundly"],
    description: "sleep 的过去式与过去分词。在长难句分析中注意其‘不及物’属性，常搭配副词 soundly 或 heavily 形容‘熟睡’。借由静息意象，拓展夜间场景的叙事写作。"
  },
  {
    id: 3,
    title: "beef /biːf/",
    artist: "eloise - 生活高频 · 实物语境",
    year: "eloise - CET-4 / 日常核心词",
    url: "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWVAxqQnSVWSZPWmWdxpZ6gkdNMHgdZwACNCcAAv6GGFaEwhClLuCUHzwE.png",
    tags: ["名词", "不可数名词", "俚语: beef up (加强)"],
    description: "基础含义为‘牛肉’。高阶口语俚语中，‘have a beef with someone’ 意为‘与某人有矛盾/过节’；而在职场英语中，短语 ‘beef up’ 常用来指‘增强、强化（实力或安保）’。"
  },
  {
    id: 4,
    title: "number /ˈnʌmbə/",
    artist: "eloise - 逻辑基石 · 数值维度",
    year: "通关必备 / 学术高频",
    url: "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWVBNqQnS5r27Rkh1rw6wmhUKz4V-sowACPCcAAv6GGFbowqCvrxg-pTwE.png",
    tags: ["名词/动词", "数据图表常用", "搭配: a number of"],
    description: "除了作名词‘数字’，更需注意其动词用法‘总计、共计’（例：the students numbered 200）。此外，写作中务必区分 a number of（许多）与 the number of（……的数量）的单复数主谓一致考点。"
  },
  {
    id: 5,
    title: "meal /miːl/",
    artist: "eloise - 场景词汇 · 饮食文化",
    year: "基础日常 / 话题写作",
    url: "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWVBVqQnTRXm0qUSYTYIqWOJT_CMM2IgACPicAAv6GGFYvMe9-3SkOjTwE.png",
    tags: ["名词", "高阶写作", "近义: Fluke"],
    description: "源于童话《锡兰三太子》。原指“无意中发现珍宝的运气”。在学术写作中，常用来形容科学家在偶然试验中获得重大颠覆性发现的奇妙瞬间。"
  },
  {
    id: 6,
    title: "kick /kɪk/",
    artist: "eloise -  语动作核心 · 瞬间爆发",
    year: "基础必会 / 核心动词",
    url: "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWVBdqQnTtsOMxWMQ0Vj56c9agAXKLAQACQCcAAv6GGFYQY0B8EK4qMDwE.png",
    tags: ["动词/名词", "短语高频", "过去式: kicked"],
    description: "本义为用脚踢击。日常口语中常考短语 ‘kick off’（正式开始/开球）；而在习惯表达中，‘get a kick out of something’ 则生动地形容‘从某事中获得极大的乐趣’。"
  },
  {
    id: 7,
    title: "taught /tɔːt/",
    artist: "不规则动词 · 知识传递",
    year: "中考/高考/四级核心",
    url: "https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWVExqQniGyLgh48hS1nbj7VO2E7XLcwAChCcAAv6GGFbOajmNILFxhDwE.png",
    tags: ["teach的过去式", "双宾语动词", "发音注意: /ɔː/"],
    description: "teach（教）的过去式与过去分词。属于典型的‘授受动词’，常接双宾语结构：taught someone something。发音时注意中间的 gh 不发音，长元音需饱满。"
  }
];

// 响应式状态
const artworks = ref(initialArtworks);
const currentIndex = ref(0);
const isAdminMode = ref(false);
const activeNote = ref(null);

// 琴弦互动配置
const footerNotes = "artgallery".split("");

// 管理员表单
const newArt = reactive({
  title: '',
  artist: '',
  year: '',
  url: '',
  tagsString: '',
  description: ''
});

// 计算属性
const currentArt = computed(() => artworks.value[currentIndex.value] || {});
const progressPercentage = computed(() => {
  if (!artworks.value.length) return 0;
  return ((currentIndex.value + 1) / artworks.value.length) * 100;
});

// 翻页逻辑
const nextArtwork = () => {
  if (currentIndex.value < artworks.value.length - 1) {
    currentIndex.value++;
  }
};
const prevArtwork = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
};

// 交互特效
const handleImageHover = (e) => {
  // 可在此扩展类似视差、局部亮化等更有艺术感的3D悬停效果
};

const triggerStringEffect = (char) => {
  activeNote.value = char;
  setTimeout(() => { if (activeNote.value === char) activeNote.value = null; }, 200);
};
const stopRipple = () => { activeNote.value = null; };
const handleGlobalClick = () => { /* 保留用于未来扩展音效扩展性 */ };

// 管理员添加作品
const addArtwork = () => {
  if (!newArt.title || !newArt.url) {
    alert("请至少填写画作名称与有效的图片 URL 链接。");
    return;
  }
  
  // 处理标签
  const tags = newArt.tagsString 
    ? newArt.tagsString.split(/[,，]/).map(t => t.trim()).filter(Boolean)
    : ["当代艺术"];

  artworks.value.push({
    id: Date.now(),
    title: newArt.title,
    artist: newArt.artist || "无名匠人",
    year: newArt.year || "当代",
    url: newArt.url,
    tags: tags,
    description: newArt.description || "馆长很懒，还没有为这幅作品撰写传记..."
  });

  // 重置表单
  newArt.title = '';
  newArt.artist = '';
  newArt.year = '';
  newArt.url = '';
  newArt.tagsString = '';
  newArt.description = '';

  alert("新作品已成功入册画廊！");
};

// 删除作品
const deleteArtwork = (index) => {
  if (confirm(`确定要将《${artworks.value[index].title}》下架撤展吗？`)) {
    artworks.value.splice(index, 1);
    if (currentIndex.value >= artworks.value.length) {
      currentIndex.value = Math.max(0, artworks.value.length - 1);
    }
  }
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;500;700&family=Playfair+Display:ital,wght@1,400;1,600&display=swap');

/* 全局容器 */
.gallery-container {
  width: 100%;
  min-height: 100vh;
  background: #0a0a0a;
  color: #c9b088;
  font-family: 'Noto Serif SC', serif;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-x: hidden;
  box-sizing: border-box;
}

/* 统一盒模型，防止 padding 撑开容器 */
.gallery-container * {
  box-sizing: border-box;
}

/* 晕染背景 */
.bg-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 80% 20%, rgba(201, 176, 136, 0.06) 0%, transparent 50%),
              radial-gradient(circle at 20% 80%, rgba(139, 115, 85, 0.04) 0%, transparent 60%);
  pointer-events: none;
}

/* 1. 顶部艺术导航 */
.gallery-header {
  padding: 10px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(201, 176, 136, 0.1);
  z-index: 10;
}
.gallery-title {
  margin: 5px 0 0 0;
  font-size: 24px;
  letter-spacing: 3px;
  color: #dfc59f;
  text-shadow: 0 0 10px rgba(223, 197, 159, 0.1);
}
.brand-tag {
  font-family: 'Playfair Display', serif;
  font-size: 11px;
  letter-spacing: 4px;
  opacity: 0.5;
}
.toggle-mode-btn {
  background: transparent;
  border: 1px solid rgba(201, 176, 136, 0.4);
  color: #c9b088;
  padding: 8px 24px;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.4s ease;
  white-space: nowrap;
}
.toggle-mode-btn:hover {
  background: #c9b088;
  color: #0a0a0a;
  box-shadow: 0 0 15px rgba(201, 176, 136, 0.3);
}

/* 2. 用户端画廊舞台 */
.gallery-stage {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 25px;
  width: 100%;
}
.artwork-card-wrapper {
  width: 100%;
  max-width: 1100px;
  position: relative;
}

/* 艺术画廊流光进度条 */
.gallery-progress {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 25px;
}
.progress-fill {
  height: 2px;
  background: #dfc59f;
  box-shadow: 0 0 8px #dfc59f;
  transition: width 0.6s cubic-bezier(0.25, 1, 0.5, 1);
}
.progress-text {
  font-size: 12px;
  opacity: 0.6;
  font-family: 'Playfair Display', serif;
  letter-spacing: 1px;
}

.artwork-main-zone {
  display: flex;
  align-items: center;
  gap: 30px;
  width: 100%;
}

/* 艺术展框结构（PC端默认：图文左右交融） */
.artwork-card {
  flex: 1;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  background: rgba(18, 18, 18, 0.6);
  border: 1px solid rgba(201, 176, 136, 0.15);
  backdrop-filter: blur(10px);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  width: 100%;
}

/* 图片装裱框 */
.image-frame {
  position: relative;
  overflow: hidden;
  height: 400px;
  background: #000;
}
.art-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 1.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.image-frame:hover .art-image {
  transform: scale(1.05);
}
.image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, transparent 70%, rgba(18,18,18,0.9));
}
.art-year-tag {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(10, 10, 10, 0.75);
  border: 0.5px solid rgba(201, 176, 136, 0.3);
  padding: 4px 12px;
  font-size: 11px;
  letter-spacing: 1px;
  z-index: 2;
}

/* 艺术品文案区域 */
.art-info-box {
  padding: 45px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.art-title {
  font-size: 28px;
  color: #f3eada;
  margin: 0 0 10px 0;
  font-weight: 500;
}
.art-author {
  font-size: 14px;
  opacity: 0.7;
  margin-bottom: 20px;
}
.art-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 25px;
}
.art-tag {
  font-size: 11px;
  border: 1px solid rgba(201, 176, 136, 0.2);
  padding: 2px 10px;
  border-radius: 12px;
  opacity: 0.8;
}
.art-divider {
  border: none;
  border-top: 1px dashed rgba(201, 176, 136, 0.2);
  width: 100%;
  margin: 0 0 25px 0;
}
.art-desc {
  font-size: 14px;
  line-height: 1.8;
  color: #b3a288;
  font-weight: 300;
  text-align: justify;
}

/* 翻页箭矢 */
.nav-arrow {
  background: none;
  border: none;
  color: #c9b088;
  font-size: 40px;
  cursor: pointer;
  opacity: 0.4;
  transition: all 0.3s;
  padding: 10px;
  z-index: 5;
}
.nav-arrow:hover:not(:disabled) {
  opacity: 1;
  transform: scale(1.2);
}
.nav-arrow:disabled {
  opacity: 0.05;
  cursor: not-allowed;
}

/* 3. 管理端艺术工坊 */
.admin-stage {
  flex: 1;
  padding: 40px 60px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}
.admin-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}
.admin-card {
  background: rgba(20, 20, 20, 0.6);
  border: 1px solid rgba(201, 176, 136, 0.1);
  padding: 35px;
  border-radius: 4px;
}
.panel-title {
  font-size: 18px;
  color: #dfc59f;
  margin-top: 0;
  margin-bottom: 25px;
  border-left: 3px solid #c9b088;
  padding-left: 12px;
}
.form-group {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group label {
  font-size: 12px;
  opacity: 0.7;
}
.form-group input, .form-group textarea {
  background: #121212;
  border: 1px solid rgba(201, 176, 136, 0.2);
  color: #f3eada;
  padding: 10px 14px;
  font-family: inherit;
  font-size: 13px;
  border-radius: 2px;
  width: 100%;
}
.form-group input:focus, .form-group textarea:focus {
  outline: none;
  border-color: #c9b088;
  box-shadow: 0 0 8px rgba(201, 176, 136, 0.15);
}
.submit-btn {
  width: 100%;
  background: #c9b088;
  color: #0a0a0a;
  border: none;
  padding: 14px;
  font-size: 14px;
  letter-spacing: 2px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 10px;
  transition: opacity 0.3s;
}
.submit-btn:hover { opacity: 0.9; }

/* 馆藏目录列表 */
.inventory-list {
  max-height: 550px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding-right: 10px;
}
.inventory-list::-webkit-scrollbar { width: 3px; }
.inventory-list::-webkit-scrollbar-thumb { background: rgba(201, 176, 136, 0.2); }

.inventory-item {
  display: flex;
  align-items: center;
  gap: 20px;
  background: rgba(10, 10, 10, 0.4);
  padding: 12px;
  border: 1px solid rgba(201, 176, 136, 0.05);
}
.thumb-img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 2px;
}
.item-meta { flex: 1; }
.item-meta h4 { margin: 0 0 4px 0; font-size: 14px; color: #f3eada; }
.item-meta p { margin: 0; font-size: 11px; opacity: 0.5; }
.delete-btn {
  background: transparent;
  border: 1px solid rgba(219, 100, 100, 0.4);
  color: #db6464;
  padding: 5px 12px;
  font-size: 11px;
  cursor: pointer;
}
.delete-btn:hover { background: #db6464; color: #fff; }

/* 空态 */
.empty-state { text-align: center; opacity: 0.4; font-size: 14px; padding: 100px 0; }

/* 4. 底栏装饰 */
.gallery-footer-strings {
  height: 30px;
  display: flex;
  padding: 0 100px;
  border-top: 1px solid rgba(201, 176, 136, 0.03);
  margin-top: auto;
}
.string-line-wrapper {
  flex: 1;
  display: flex;
  justify-content: center;
  cursor: pointer;
}
.string-line {
  width: 1px;
  height: 100%;
  background: linear-gradient(to bottom, transparent, rgba(201, 176, 136, 0.06), transparent);
  transition: all 0.6s ease;
}
.string-line-wrapper:hover .string-line {
  background: #dfc59f !important;
  box-shadow: 0 0 10px #dfc59f;
  width: 1.5px;
}

/* 动效过渡 */
.art-fade-enter-from { opacity: 0; transform: translateX(15px) scale(0.99); }
.art-fade-enter-to { opacity: 1; transform: translateX(0) scale(1); }
.art-fade-leave-from { opacity: 1; transform: translateX(0); }
.art-fade-leave-to { opacity: 0; transform: translateX(-15px) scale(0.99); }
.art-fade-enter-active, .art-fade-leave-active { transition: all 0.5s ease; }


/* ==========================================================================
   ⚡ 核心响应式自适应适配 (Media Queries)
   ========================================================================== */

/* 💻 针对中型屏幕及平板电脑 (Notebooks & iPads) */
@media (max-width: 992px) {
  .gallery-header {
    padding: 10px 30px;
  }
  .gallery-title {
    font-size: 20px;
  }
  .artwork-card {
    grid-template-columns: 1fr; /* 平板端降级为上下布局 */
  }
  .image-frame {
    height: 400px; /* 降低图片框高度 */
  }
  .image-overlay {
    /* 渐变遮罩方向调整为自下而上，契合上下布局 */
    background: linear-gradient(to bottom, transparent 60%, rgba(18,18,18,0.95));
  }
  .art-info-box {
    padding: 30px;
  }
  .admin-stage {
    padding: 20px;
  }
  .admin-grid {
    grid-template-columns: 1fr; /* 后台管理页也降级为单列 */
    gap: 20px;
  }
}

/* 📱 针对狭窄的小屏幕及手机端 (Mobile Devices) */
@media (max-width: 768px) {
  .gallery-header {
    padding: 15px;
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  .toggle-mode-btn {
    width: 100%;
    padding: 6px 16px;
  }
  
  /* 移动端核心重构：将左右翻页键安全地放置于卡片下方 */
  .artwork-main-zone {
    flex-direction: column; 
    gap: 15px;
  }
  .artwork-card {
    order: 1; /* 保证卡片本身处于正中 */
  }
  .nav-arrow {
    display: none; /* 移动端在两侧的巨大箭头会把卡片挤到没地方放，直接隐藏 */
  }

  /* 替代翻页方案：如果不想隐藏箭头，可以把它们包裹进移动端底部。这里我们在底层将高度重塑 */
  .image-frame {
    height: 250px; /* 移动端图片不宜过大，保持高宽比协调 */
  }
  .art-title {
    font-size: 22px;
  }
  .art-info-box {
    padding: 20px;
  }
  .art-desc {
    font-size: 13px;
    line-height: 1.6;
  }
  
  /* 隐藏底部过于密集的拨弦装饰线 */
  .gallery-footer-strings {
    padding: 0 20px;
    display: none; /* 手机端没有 Hover，隐藏此音效线以精简视觉 */
  }
}
</style>
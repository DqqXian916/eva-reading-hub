<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  // 从 BrainBreakModule 传入的词库 (item.s 为句子, item.cn 为中文)
  wordList: {
    type: Array,
    default: () => []
  },
  student: {
    type: Object,
    default: () => ({ name: 'Student' })
  }
});

const emit = defineEmits(['complete']);

// --- 游戏状态 ---
const currentLvl = ref(0);
const currentStep = ref(0);
const isFinished = ref(false);
const showFinal = ref(false);
const isShaking = ref(false);
const isLevelCelebrating = ref(false); // 新增：关卡内的庆祝状态

// Lisa 表情状态
const eyesOpen = ref(false);
const isSmiling = ref(false);

// 核心数据
const storyData = ref([]);
const wordPool = ref([]);
const filledSlots = ref([]);

// --- 语音逻辑 ---
const speak = (t) => {
  if (!t) return;
  window.speechSynthesis.cancel();
  const m = new SpeechSynthesisUtterance(t);
  m.lang = 'en-US';
  m.rate = 0.85; // 稍微慢一点，方便听力练习
  window.speechSynthesis.speak(m);
};

// 重播按钮逻辑
const handleReplay = () => {
  const current = storyData.value[currentLvl.value];
  if (current) speak(current.full);
};

// --- 后端数据解析 ---
const prepareStory = () => {
  if (!props.wordList || props.wordList.length === 0) return;

  const parts = ['art-sun', 'art-cloud1', 'art-cloud2', 'art-grass', 'art-flowers', 'art-dress', 'art-hair', 'art-face'];
  // 优化：使用更鲜艳、具有水彩感的颜色
  const colors = ['#FFD700', '#AEEEEE', '#87CEFA', '#7CCD7C', '#FF69B4', '#FFB6C1', '#FF82AB', '#FFE4C4'];

  storyData.value = props.wordList.map((item, index) => {
    const fullSentence = item.s || item.en || "";
    // 拆分单词并去掉多余空格
    const wordsArray = fullSentence.split(' ').filter(Boolean);

    return {
      cn: item.cn || `Explore Part ${index + 1}`,
      en: wordsArray,
      target: parts[index % parts.length],
      color: colors[index % colors.length],
      full: fullSentence
    };
  });

  initLevel();
};

const initLevel = () => {
  isLevelCelebrating.value = false; // 重置关卡庆祝
  if (storyData.value.length === 0) return;
  
  if (currentLvl.value >= storyData.value.length) {
    handleGameComplete();
    return;
  }

  const level = storyData.value[currentLvl.value];
  currentStep.value = 0;
  filledSlots.value = new Array(level.en.length).fill('');
  
  // 乱序单词池
  wordPool.value = [...level.en]
    .map(w => ({ val: w, id: Math.random(), hidden: false }))
    .sort(() => Math.random() - 0.5);

  // 【核心优化】进入新关卡先自动朗读一遍
  setTimeout(() => {
    speak(level.full);
  }, 600);
};

const handleSelect = (wordObj) => {
  const targetArray = storyData.value[currentLvl.value].en;
  
  if (wordObj.val === targetArray[currentStep.value]) {
    filledSlots.value[currentStep.value] = wordObj.val;
    wordObj.hidden = true;
    currentStep.value++;
    speak(wordObj.val); // 点对一个词，读一个词

    if (currentStep.value === targetArray.length) {
      celebrate();
    }
  } else {
    isShaking.value = true;
    setTimeout(() => isShaking.value = false, 300);
    speak("Oops");
  }
};

const celebrate = () => {
  eyesOpen.value = true;
  isSmiling.value = true;
  isLevelCelebrating.value = true; // 触发 SVG 身体摇摆动画
  const s = storyData.value[currentLvl.value];
  
  // 拼完瞬间，再次完整朗读强化语感
  speak(s.full); 

  // 涂色逻辑 (通过类名控制，不再直接操作 style)
  const el = document.getElementById(s.target);
  if (el) {
    el.style.fill = s.color;
    el.classList.add('colored'); // 添加 Colored 类触发过渡
    el.style.stroke = "none";
  }

  setTimeout(() => {
    // 关卡结束，Lisa 恢复安静
    eyesOpen.value = false; 
    isSmiling.value = false;
    currentLvl.value++;
    initLevel();
  }, 2200); // 留够时间听完最后一遍朗读并欣赏动画
};

const handleGameComplete = () => {
  isFinished.value = true;
  showFinal.value = true;
  emit('complete');
};

// 监听词库更新
watch(() => props.wordList, prepareStory, { deep: true });

onMounted(prepareStory);
onUnmounted(() => window.speechSynthesis.cancel());
</script>

<template>
  <div class="studio-container">
    <div id="studio-card">
      <div id="art-box" :class="{ 'level-celebrating': isLevelCelebrating }">
        <svg viewBox="0 0 200 200" class="main-canvas">
          <circle id="art-sun" class="path-ink deco" cx="170" cy="30" r="12" />
          <path id="art-cloud1" class="path-ink deco" d="M30 40 Q40 30 50 40 T70 40" />
          <path id="art-cloud2" class="path-ink deco" d="M140 60 Q150 50 160 60 T180 60" />
          <rect id="art-grass" class="path-ink deco" x="0" y="170" width="200" height="30" rx="5" />
          <g id="art-flowers" class="path-ink deco">
             <circle cx="30" cy="165" r="3" /> <circle cx="50" cy="175" r="3" />
             <circle cx="150" cy="170" r="3" /> <circle cx="170" cy="165" r="3" />
          </g>

          <g id="lisa-body" :class="{ 'lisa-bounce': isLevelCelebrating }">
            <path id="art-hair" class="path-ink" d="M100 50 Q70 50 65 80 L135 80 Q130 50 100 50 Z" />
            <circle id="art-face" class="path-ink" cx="100" cy="90" r="25" />
            
            <g class="expressions">
              <g v-if="eyesOpen" fill="#4A4A4A">
                <circle cx="92" cy="90" r="2.8" /> <circle cx="108" cy="90" r="2.8" />
              </g>
              <g v-else fill="none" stroke="#DCDCDC" stroke-width="1.5">
                <path d="M88 90 Q92 93 96 90" /> <path d="M104 90 Q108 93 112 90" />
              </g>

              <path v-if="isSmiling" d="M92 102 Q100 108 108 102" stroke="#fb6f92" fill="none" stroke-width="2.5" stroke-linecap="round" />
            </g>
            <path id="art-dress" class="path-ink" d="M100 115 L75 170 Q100 175 125 170 Z" />
          </g>
        </svg>

        <Transition name="fade">
          <div v-if="showFinal" class="final-overlay">
            <div class="congrats-tag">✨ ARTISTIC GENIUS ✨</div>
            <h3>Masterpiece by {{ props.student?.name || 'Eva\'s Star' }}!</h3>
            <p>你也像 Lisa 一样色彩斑斓！</p>
            <button @click="currentLvl = 0; isFinished = false; showFinal = false; prepareStory()" class="re-btn">
              Create Again ✨
            </button>
          </div>
        </Transition>
      </div>

      <div v-if="!isFinished" class="interaction-area">
        <div class="progress-bar">
          <div class="progress-inner" :style="{ width: (currentLvl / storyData.length) * 100 + '%' }"></div>
        </div>

        <div class="hint-container">
          <span class="cn-text">💡 {{ storyData[currentLvl]?.cn }}</span>
          <button @click="handleReplay" class="speaker-btn ripple">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.03,19.86 21,16.28 21,12C21,7.72 18.03,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16.04C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
            </svg>
          </button>
        </div>

        <div id="sentence-slots">
          <div v-for="(word, index) in filledSlots" :key="index" :class="['slot', { active: word !== '' }]">
            {{ word || '' }}
          </div>
        </div>

        <div id="word-pool">
          <button v-for="wordObj in wordPool" :key="wordObj.id"
            @click="handleSelect(wordObj)"
            :class="['word-ball', { invisible: wordObj.hidden, shake: isShaking }]">
            {{ wordObj.val }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局变量适配 Eva Reading 系统 */
.studio-container {
  --eva-rose: #fb6f92;
  --eva-pink-light: #fff5f7;
  --eva-pink-border: #ffcad4;
  --text-grey: #5d576b;
  --ink-bg: #f8f9fa;
  --ink-stroke: #e9ecef;

  display: flex; justify-content: center; align-items: center;
  width: 100%; height: 100%; background: #fffcfd; padding: 20px;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

#studio-card {
  width: 100%; max-width: 600px; background: white; border-radius: 35px;
  padding: 30px; 
  box-shadow: 0 25px 70px rgba(251, 111, 146, 0.12), 0 10px 20px rgba(0,0,0,0.02);
  border: 1px solid #fff0f3;
}

/* --- 核心优化：画框质感的 Art-Box --- */
#art-box {
  background: white; border-radius: 28px; 
  border: 4px solid #fff0f3; /* 像个粗画框 */
  position: relative; height: 340px; display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  /* 增加了内阴影和纹理，使其看起来像凹陷的画布 */
  box-shadow: inset 0 10px 20px rgba(0,0,0,0.02), inset 0 -5px 10px rgba(251, 111, 146, 0.02);
  transition: background 0.5s;
}

/* 关卡庆祝时的背景晕染效果 */
#art-box.level-celebrating {
  background: radial-gradient(circle, #fff 50%, #fff5f7 100%);
}

#art-box::before {
  content: ''; position: absolute; inset: 0;
  background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIHZpZXdCb3g9IjAgMCA0IDQiPjxnIGZpbGw9IiNmYjZmOTIiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTEgMmgxdjFIMXpNMCAwaDF2MUgwek0yIDBoMXYxSDJ6TTMgM2gxdjFIM3pNMjAgaDF2MUgwem0wIDBoMXYxSDB6bTAgMGgxdjFIMHpNMCAwaDF2MUgwek0yIDBoMXYxSDJ6TTMgM2gxdjFIM3pNMCAwaDF2MUgwem0yIDBoMXYxSDJ6TTMgM2gxdjFIM3oiLz48L2c+PC9zdmc+');
  opacity: 0.5; /* 淡淡的帆布纹理 */
}

.main-canvas { width: 85%; height: 85%; z-index: 1; }

.path-ink { fill: var(--ink-bg); stroke: var(--ink-stroke); stroke-width: 1.5; stroke-linecap: round; transition: 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
.deco { opacity: 0.2; stroke-dasharray: 4; } /* 初始：虚线、高透明 */

/* 当被涂色时 */
.path-ink.colored {
  opacity: 1;
  stroke-dasharray: 0;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.05)); /* 增加一点点厚度 */
}

/* --- Lisa 晃动动画设置 --- */
#lisa-body {
  transform-origin: 100px 170px; /* 设置摇摆中心在裙子底部 */
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.lisa-bounce {
  animation: lisaWiggle 1.2s ease-in-out infinite;
}

@keyframes lisaWiggle {
  0%, 100% { transform: rotate(-3deg) translateY(-2px); }
  50% { transform: rotate(3deg) translateY(0px); }
}

/* --- 交互 UI 优化 --- */
.interaction-area { margin-top: 25px; }

.hint-container { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 25px; }
.cn-text { font-size: 1.15rem; font-weight: 700; color: var(--text-grey); letter-spacing: -0.3px; }

.speaker-btn {
  background: white; border: 2px solid var(--eva-pink-border); color: var(--eva-rose);
  width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.3s; 
  box-shadow: 0 6px 15px rgba(251, 111, 146, 0.12);
  outline: none;
}
.speaker-btn:hover { transform: scale(1.1); background: var(--eva-rose); color: white; border-color: var(--eva-rose); }
.speaker-btn:active { transform: scale(0.95); box-shadow: 0 2px 5px rgba(251, 111, 146, 0.2); }

/* 水波纹效果 */
.ripple { position: relative; overflow: hidden; }
.ripple::after {
  content: ""; display: block; position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none;
  background-image: radial-gradient(circle, #fff 10%, transparent 10.01%);
  background-repeat: no-repeat; background-position: 50%;
  transform: scale(10, 10); opacity: 0; transition: transform .5s, opacity 1s;
}
.ripple:active::after { transform: scale(0, 0); opacity: .3; transition: 0s; }

/* 槽位：拟物化信封样式 */
#sentence-slots { display: flex; justify-content: center; gap: 10px; margin: 15px 0 25px; min-height: 48px; flex-wrap: wrap; }
.slot {
  min-width: 55px; height: 42px; border-radius: 8px;
  background: #fdfdfd; border: 1px solid #eee;
  border-bottom: 3px solid #eee; /* 增加底部厚度 */
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; color: var(--eva-rose); font-size: 1.1rem;
  transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); padding: 0 10px;
}
.slot.active { background: #fffcfd; border-color: var(--eva-pink-border); border-bottom-color: var(--eva-pink-border); transform: translateY(-3px) scale(1.02); box-shadow: 0 5px 10px rgba(251, 111, 146, 0.05); }

/* --- 单词球：霓虹果冻质感 --- */
#word-pool { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 15px; }
.word-ball {
  padding: 10px 22px; border-radius: 25px; 
  border: 2px solid var(--eva-pink-border);
  background: white; color: var(--text-grey); font-weight: 600; font-size: 1.05rem;
  cursor: pointer; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  /* 淡淡的霓虹发光效果 */
  box-shadow: 0 4px 0 var(--eva-pink-border), 0 5px 15px rgba(251, 111, 146, 0.08);
  outline: none; position: relative; top: 0;
}

.word-ball:hover:not(.invisible) { 
  background: #fffcfd;
  color: var(--eva-rose);
  transform: translateY(-2px);
  box-shadow: 0 6px 0 var(--eva-pink-border), 0 8px 20px rgba(251, 111, 146, 0.12);
}

/* 果冻点击效果 */
.word-ball:active:not(.invisible) {
  top: 4px; /* 按下效果 */
  box-shadow: 0 0px 0 var(--eva-pink-border), 0 2px 5px rgba(251, 111, 146, 0.1);
  transform: scale(0.97);
}

.word-ball.invisible { opacity: 0; pointer-events: none; transform: scale(0.8); }

/* 进度条：扁平精致化 */
.progress-bar { width: 100%; height: 8px; background: #eee; border-radius: 4px; margin-bottom: 25px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05); }
.progress-inner { height: 100%; background: linear-gradient(90deg, #ffc2d1, var(--eva-rose)); border-radius: 4px; transition: 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); position: relative; }
/* 进度条头部的发光点 */
.progress-inner::after { content: ''; position: absolute; right: 0; top: 0; height: 100%; width: 10px; background: white; opacity: 0.5; filter: blur(2px); border-radius: 50%; }

/* 总结页：水彩晕染感 */
.final-overlay {
  position: absolute; inset: 0; 
  background: radial-gradient(circle, rgba(255,255,255,1) 30%, rgba(255,245,247,0.95) 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 30px; text-align: center; backdrop-filter: blur(10px);
}
.congrats-tag { background: #fb6f92; color: white; padding: 6px 16px; border-radius: 15px; font-size: 13px; font-weight: 800; margin-bottom: 15px; letter-spacing: 1px; box-shadow: 0 4px 10px rgba(251, 111, 146, 0.2); }
.final-overlay h3 { color: var(--text-grey); font-weight: 800; font-size: 1.5rem; margin: 0 0 10px; }
.final-overlay p { color: #888; font-size: 1.1rem; margin: 0 0 25px; }

.re-btn {
  padding: 12px 30px; background: var(--eva-rose); color: white;
  border: none; border-radius: 25px; font-weight: 800; cursor: pointer;
  box-shadow: 0 8px 20px rgba(251, 111, 146, 0.3);
  transition: 0.3s;
}
.re-btn:hover { transform: translateY(-3px); box-shadow: 0 12px 25px rgba(251, 111, 146, 0.4); }

/* 基础动画 */
.shake { animation: shake 0.4s; }
@keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px) rotate(-1deg); } 60% { transform: translateX(6px) rotate(1deg); } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.6s, transform 0.6s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: scale(0.9); }
</style>
<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { supabase } from '../../supabase';

const props = defineProps({
  wordList: { type: Array, default: () => [] },
  goal: { type: Number, default: 30 },
  canEdit: Boolean
});

const emit = defineEmits(['updateConfig']);
const lastLevel = ref(0);

// --- 1. 状态变量声明 ---
const hasChecked = ref(false); // 新增：是否已检查过答案
const isRightAnswer = ref(false); // 新增：记录当前是否正确
const words = ref([]);
const hp = ref(3);
const favor = ref(0);
const combo = ref(0);
const currentIdx = ref(0);
const mode = ref('E2C');
const userInput = ref('');
const feedbackMsg = ref('');
const msgColor = ref('#999');
const isFinished = ref(false);
const isComboAnim = ref(false);
const showAdmin = ref(false);
const configText = ref('');
const hearts = ref([]);
let heartId = 0;
let audioCtx = null;
const isShaking = ref(false);
const isProcessing = ref(false); // 新增：防抖锁
const handleSpeakClick = (e) => {
  // 阻止冒泡，防止点击反馈触发其他逻辑
  if (e) e.stopPropagation();
  // 显式打印日志，方便你在控制台看有没有触发
  speak(currentWord.value.en);
};
// --- 2. 计算等级 ---
const currentLevel = computed(() => {
  const count = favor.value;
  if (count >= 20) return 5; // 满级：光环
  if (count >= 16) return 4; // 皇冠
  if (count >= 12) return 3; // 领结
  if (count >= 8) return 2; // 眼镜
  if (count >= 4) return 1; // 铃铛
  return 0;
});
// --- 监听等级变化，触发升级特效 ---
watch(currentLevel, (newVal, oldVal) => {
  if (newVal > oldVal) {
    // 升级了！触发满屏爱心或特效
    for (let i = 0; i < 15; i++) {
      setTimeout(spawnHeart, i * 50);
    }
    // 可以播放一个特别的音效
    playUpgradeSound();
  }
});
const playUpgradeSound = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, now); // C5
  osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3); // C6
  g.gain.setValueAtTime(0.1, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(now + 0.3);
};
// --- 4. 核心游戏逻辑 ---
const handleMainBtnClick = () => {
  if (!hasChecked.value) {
    handleCheck();
  } else {
    // 只有在准备换题的时候，才清空一次之前的语音队列
    window.speechSynthesis.cancel(); 
    nextQuestion();
    // 给 DOM 和引擎一点点喘息时间（50ms）
    setTimeout(() => {
      if (currentWord.value?.en) {
        speak(currentWord.value.en);
      }
    }, 50)
  }
};

const mainBtnText = computed(() => {
  // 通关后的提示语更新
  if (isFinished.value) return "小柚吃饱了，下次再来喂他吧～";
  if (!hasChecked.value) return "检查答案";
  return "下一题";
});

const isInputEmpty = computed(() => !userInput.value.trim());

// --- 2. 计算属性 ---
const currentWord = computed(() => {
  if (!words.value || words.value.length === 0) return { en: "Loading...", cn: "加载中" };
  return words.value[currentIdx.value] || words.value[0];
});

const displayQuestion = computed(() => {
  if (!currentWord.value) return "";

  if (mode.value === 'SPELL') {
    const word = currentWord.value.en;
    const translation = currentWord.value.cn; // 获取中文意思

    // 挖空逻辑保持不变
    const hideCount = word.length <= 4 ? 1 : Math.floor(word.length * 0.4);
    let indices = [];
    let seed = word.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    while (indices.length < hideCount) {
      let idx = Math.floor((seed % 100 / 100) * word.length);
      if (!indices.includes(idx)) indices.push(idx);
      seed += 7;
    }

    const maskedWord = word.split('').map((char, i) => indices.includes(i) ? '_' : char).join(' ');

    // 关键修改：返回 “拼写：_ p p l e  (苹果)” 这种格式
    return `${maskedWord} （${translation}）`;
  }

  return mode.value === 'E2C' ? currentWord.value.en : currentWord.value.cn;
});

const currentModeName = computed(() => {
  const map = { 'E2C': '英译汉', 'C2E': '汉译英', 'SPELL': '补全拼写' };
  return map[mode.value];
});
// --- 3. 工具函数 (音频/语音) ---
const speak = (text) => {
  if (!text || typeof text !== 'string') return;
  const cleanText = text
    .replace(/_/g, '') 
    .replace(/\(.*\)/g, '') 
    .replace(/（.*）/g, '')
    .replace(/[^\x00-\xff]/g, '')
    .trim();
  if (!cleanText) return;
  const msg = new SpeechSynthesisUtterance(cleanText);
  msg.lang = 'en-US';
  msg.rate = 0.85;
  msg.volume = 1;
  // 监听报错，帮助我们定位
  msg.onerror = (e) => {
    if (e.error !== 'canceled') { // 忽略被取消的正常情况
      console.error('语音合成真正报错:', e);
    }
  };
  window.speechSynthesis.speak(msg);
};
const playMeow = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const oscillators = [
    { freq: 440, type: 'triangle', gain: 0.2 },
    { freq: 880, type: 'sine', gain: 0.1 }
  ];
  oscillators.forEach(config => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = config.type;
    osc.frequency.setValueAtTime(config.freq * 0.8, now);
    osc.frequency.exponentialRampToValueAtTime(config.freq * 1.2, now + 0.15);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(config.gain, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(now + 0.5);
  });
};

const spawnHeart = () => {
  const id = heartId++;
  const icons = ['❤️', '✨', '🌸', '🍗'];
  hearts.value.push({
    id,
    icon: icons[Math.floor(Math.random() * icons.length)],
    x: Math.random() * 60 + 20,
    y: 40
  });
  setTimeout(() => {
    hearts.value = hearts.value.filter(h => h.id !== id);
  }, 1000);
};

// --- 4. 核心游戏逻辑 ---
const nextQuestion = () => {
  if (isFinished.value || words.value.length === 0) return;
  hasChecked.value = false;
  isRightAnswer.value = false;
  userInput.value = '';
  isComboAnim.value = false;
  feedbackMsg.value = '';
  isProcessing.value = false;
  
  // 随机题目逻辑保持不变
  currentIdx.value = Math.floor(Math.random() * words.value.length);
  const modes = ['E2C', 'C2E', 'SPELL'];
  mode.value = modes[Math.floor(Math.random() * modes.length)];
};
const resetGame = () => {
  isProcessing.value = false;
  favor.value = 0;
  hp.value = 3;
  isFinished.value = false;
  combo.value = 0;
  nextQuestion();
};

const handleCheck = () => {
  if (hasChecked.value || !userInput.value.trim() || isFinished.value) return;
  // 1. 基础清洗：去掉空格、转小写，并统一中英文标点
  const normalize = (str) => {
    return str.toLowerCase().trim()
      .replace(/[（）()]/g, '') // 去掉所有括号，让“俄罗斯(人)的”变成“俄罗斯人的”
      .replace(/[.。…\s]/g, '')  // 去掉省略号和空格，让“在...之前”变成“在之前”
      .replace(/[；;，,]/g, '|'); // 统一分隔符为管道符
  };
  const val = normalize(userInput.value);
  const originalCn = currentWord.value.cn;
  let isRight = false;
  if (mode.value === 'E2C') {
    // 2. 核心逻辑：拆分库里的所有可能义项
    const cleanCn = normalize(originalCn);
    const validAnswers = cleanCn.split('|').filter(s => s.length > 0);
    // 3. 多重判定：
    isRight = validAnswers.some(ans => {
      // 学生输入的词在义项里，或者义项里包含学生输入的词（比如输入“俄罗斯人”匹配“俄罗斯人的”）
      return ans.includes(val) || val.includes(ans);
    }) || normalize(originalCn).includes(val);
  } else {
    isRight = (userInput.value.trim().toLowerCase() === currentWord.value.en.toLowerCase().trim());
  }

  hasChecked.value = true;
  isRightAnswer.value = isRight;

  // --- 后续反馈逻辑逻辑保持不变 ---
  if (isRight) {
    playMeow();
    favor.value++;
    combo.value++;
    feedbackMsg.value = `连击 x${combo.value}`;
    msgColor.value = "#b5838d";
    isComboAnim.value = true;
    setTimeout(() => { isComboAnim.value = false }, 500);
    spawnHeart();
    if (favor.value >= props.goal) isFinished.value = true;
  } else {
    combo.value = 0;
    hp.value--;
    feedbackMsg.value = originalCn; // 报错直接给原词，不带前缀
    msgColor.value = "#e5989b";
    isShaking.value = true;
    setTimeout(() => { isShaking.value = false }, 400);
    speak(currentWord.value.en);
  }
};
const saveConfig = () => {
  try {
    const newWords = JSON.parse(configText.value);
    if (!Array.isArray(newWords)) throw new Error("不是数组");
    words.value = newWords;
    emit('updateConfig', newWords);
    showAdmin.value = false;
  } catch (e) {
    alert("格式错误，请检查 JSON 格式");
  }
};

// --- 5. 监听器与生命周期 ---
watch(() => props.wordList, (newList) => {
  if (Array.isArray(newList)) {
    words.value = [...newList];
    configText.value = JSON.stringify(newList, null, 2);
    if (newList.length > 0) {
      resetGame();
    }
  }
}, { immediate: true, deep: true });

onMounted(() => {
  if (words.value.length > 0) nextQuestion();
});
</script>

<template>
  <div class="game-viewport">
    <div v-if="canEdit" class="settings-icon" @click="showAdmin = true">⚙️</div>

    <div v-if="showAdmin" class="overlay" @click="showAdmin = false"></div>
    <div v-if="showAdmin" class="admin-panel">
      <h3 style="margin-top:0">配置猫咪词库 (JSON)</h3>
      <p style="font-size: 12px; color: #666;">格式: [{"en":"word", "cn":"翻译"}]</p>
      <textarea v-model="configText"></textarea>
      <div class="modal-btns">
        <button class="btn cancel-btn" @click="showAdmin = false">取消</button>
        <button class="btn save-btn" @click="saveConfig">保存到云端</button>
      </div>
    </div>

    <div id="game-box" class="relative">
      <template v-if="words.length > 0">
        <div class="hp-bar">{{ "❤️".repeat(hp) + "🖤".repeat(3 - hp) }}</div>

        <div v-for="heart in hearts" :key="heart.id" class="floating-heart"
          :style="{ left: heart.x + '%', top: heart.y + '%' }">
          {{ heart.icon }}
        </div>

        <div :class="['cat-stage', { 'combo-bounce': isComboAnim }]">
          <div class="cat-body">
            <div v-if="currentLevel >= 2" class="decoration bell">🔔</div>
            <div v-if="currentLevel >= 3" class="decoration bow-tie">🎀</div>

            <div class="cat-head">
              <div v-if="currentLevel >= 5" class="decoration crown-gold">👑</div>
              <div v-if="currentLevel >= 4" class="decoration head-flower">🌸</div>
              <div v-if="currentLevel >= 1" class="decoration glasses">👓</div>

              <div class="ear left"></div>
              <div class="ear right"></div>
              <div class="eye left"></div>
              <div class="eye right"></div>
              <div class="nose"></div>
              <div class="blush l" :style="{ opacity: favor / goal }"></div>
              <div class="blush r" :style="{ opacity: favor / goal }"></div>
            </div>
            <div class="tail"></div>
          </div>
        </div>

        <div class="mode-tag">{{ currentModeName }}</div>
        <div class="q-text" @click="handleSpeakClick" style="cursor: pointer;">
          {{ displayQuestion }}
          <span style="font-size: 1.2rem; margin-left: 8px; opacity: 0.6;">🔊</span>
        </div>

        <div class="input-area" v-if="!isFinished">
          <input v-model="userInput" :placeholder="hasChecked ? '看猫咪反馈喵~' : '请在此输入答案...'" :class="{
            'shake-anim': isShaking,
            'input-success': hasChecked && isRightAnswer,
            'input-error': hasChecked && !isRightAnswer
          }" :disabled="hasChecked" autofocus />

          <p :style="{ color: msgColor, height: '24px', margin: '10px 0', fontWeight: 'bold', fontSize: '14px' }">
            {{ feedbackMsg }}
          </p>

          <div class="button-zone">
            <button class="btn main-action-btn"
              :class="{ 'next-mode': hasChecked, 'disabled-btn': isInputEmpty && !hasChecked }"
              @click="handleMainBtnClick" :disabled="isInputEmpty && !hasChecked">
              {{ mainBtnText }}
            </button>
          </div>
        </div>
        <div v-else class="finish-zone">
          <p style="font-size: 1.2rem; color: #b5838d; font-weight: bold; margin: 20px 0;">
            小柚吃饱了，下次再来喂他吧～
          </p>
          <button class="btn" @click="resetGame">再玩一轮</button>
        </div>
        <div class="progress-container">
          <div class="progress-bar" :style="{ width: (favor / goal * 100) + '%' }"></div>
        </div>
        <p style="font-size: 12px; color: #999;">进度: {{ favor }} / {{ goal }}</p>

      </template>

      <div v-else class="empty-words">
        <p>🐱：Eva老师还没给我准备吃的...</p>
        <button v-if="canEdit" class="btn" @click="showAdmin = true">立即配置</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-viewport {
  --maine-grey-dark: #6d6875;
  --maine-grey-mid: #b5b2be;
  --eye-brown: #7b4422;
  --accent: #ffb4a2;
  --hp-red: #ff4d6d;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  background: #f8f9fa;
}

#game-box {
  background: white;
  width: 420px;
  padding: 40px;
  border-radius: 60px;
  box-shadow: 0 30px 80px rgba(109, 104, 117, 0.15);
  text-align: center;
}

.settings-icon {
  position: absolute;
  top: 20px;
  left: 20px;
  font-size: 24px;
  cursor: pointer;
  opacity: 0.2;
  transition: 0.3s;
}

.settings-icon:hover {
  opacity: 1;
  transform: rotate(45deg);
}

.hp-bar {
  font-size: 1.2rem;
  margin-bottom: 10px;
  color: var(--hp-red);
  letter-spacing: 5px;
}

/* 猫咪绘制核心 */
.cat-stage {
  height: 180px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  margin-bottom: 25px;
}

.cat-body {
  width: 130px;
  height: 70px;
  background: var(--maine-grey-mid);
  border-radius: 70px 70px 45px 45px;
  position: relative;
  box-shadow: inset -10px -5px 20px rgba(0, 0, 0, 0.1), 0 0 20px 8px var(--maine-grey-mid);
  z-index: 2;
  /* 身体比尾巴高层级 */
}

.cat-head {
  width: 105px;
  height: 90px;
  background: var(--maine-grey-mid);
  border-radius: 50%;
  position: absolute;
  top: -70px;
  left: 12.5px;
  box-shadow: 0 0 15px 5px var(--maine-grey-mid);
}

/* 伪元素注入灵魂 */
.eye {
  width: 24px;
  height: 24px;
  background: var(--eye-brown);
  border-radius: 50%;
  position: absolute;
  top: 32px;
  border: 3px solid #fff;
}

.eye.left {
  left: 18px;
}

.eye.right {
  right: 18px;
}

.eye::after {
  content: '';
  width: 12px;
  height: 12px;
  background: #222;
  border-radius: 50%;
  position: absolute;
  top: 6px;
  left: 6px;
}

.eye::before {
  content: '';
  width: 5px;
  height: 5px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 3px;
  left: 4px;
  z-index: 2;
}

.ear {
  width: 32px;
  height: 32px;
  background: var(--maine-grey-dark);
  position: absolute;
  top: -8px;
  border-radius: 40% 60% 40% 40%;
}

.ear.left {
  left: 5px;
  transform: rotate(-20deg);
}

.ear.right {
  right: 5px;
  transform: rotate(20deg);
  border-radius: 60% 40% 40% 40%;
}

.nose {
  width: 10px;
  height: 7px;
  background: #ffafcc;
  position: absolute;
  top: 58px;
  left: 48px;
  border-radius: 50%;
}

.blush {
  width: 15px;
  height: 8px;
  background: #ffcad4;
  position: absolute;
  top: 62px;
  border-radius: 50%;
  filter: blur(3px);
}

.blush.l {
  left: 15px;
}

.blush.r {
  right: 15px;
}

.tail {
  width: 65px;
  height: 40px;
  background: var(--maine-grey-dark);
  position: absolute;
  right: -35px;
  bottom: 15px;
  border-radius: 50%;
  filter: blur(2px);
  box-shadow: 0 0 15px var(--maine-grey-dark);
  /* 确保 z-index 在 body 之下但在 stage 之上，或者直接去掉负值 */
  z-index: 1;
}

/* 装饰物 */
.crown {
  position: absolute;
  top: -35px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 32px;
}

.bow {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
}

/* UI 元素 */
.progress-container {
  width: 80%;
  height: 12px;
  background: #eee;
  border-radius: 10px;
  margin: 0 auto 5px;
  overflow: hidden;
  border: 2px solid #fff;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #ffb4a2, #ff8d8d);
  transition: width 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.badge {
  background: #f1f3f5;
  padding: 6px 18px;
  border-radius: 20px;
  font-size: 0.85rem;
  color: #6d6875;
  margin-bottom: 10px;
  display: inline-block;
}

.q-text {
  font-size: 1.8rem;
  /* 稍微调小一点点，兼容长单词+中文 */
  margin: 15px 0;
  color: #4a4e69;
  font-weight: bold;
  line-height: 1.4;
  padding: 0 10px;
  word-break: break-word;
  /* 防止长内容溢出 */
}

.mode-tag {
  opacity: 0.5;
  font-size: 0.8rem;
}

input {
  width: 80%;
  padding: 15px;
  border: 3px solid #eee;
  border-radius: 25px;
  font-size: 1.2rem;
  outline: none;
  text-align: center;
  transition: 0.3s;
}

input:focus {
  border-color: var(--accent);
}

.btn {
  margin-top: 15px;
  background: var(--accent);
  color: white;
  border: none;
  padding: 12px 60px;
  border-radius: 30px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: 0.2s;
}

.btn:hover:not(:disabled) {
  transform: scale(1.05);
  background: #ffc2b4;
}

/* 动画 */
.combo-bounce {
  animation: bounce 0.4s ease infinite;
}

@keyframes bounce {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.05) translateY(-10px);
  }
}

.floating-heart {
  position: absolute;
  font-size: 24px;
  animation: floatUp 1s forwards;
  pointer-events: none;
}

@keyframes floatUp {
  0% {
    opacity: 1;
    transform: translateY(0);
  }

  100% {
    opacity: 0;
    transform: translateY(-80px);
  }
}

/* 管理面板 */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.admin-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  max-width: 500px;
  background: white;
  padding: 30px;
  border-radius: 30px;
  z-index: 110;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.3);
}

.admin-panel textarea {
  width: 100%;
  height: 250px;
  margin-bottom: 15px;
  border-radius: 10px;
  border: 1px solid #eee;
  padding: 10px;
  font-family: monospace;
}

.shake-anim {
  animation: shake 0.4s darkred;
}

@keyframes shake {

  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-8px);
  }

  75% {
    transform: translateX(8px);
  }
}

.input-success {
  border-color: #b5838d !important;
  background-color: #fffbfa;
}

.input-error {
  border-color: #e5989b !important;
  background-color: #fff5f5;
}

.next-btn {
  background: var(--maine-grey-dark);
  box-shadow: 0 4px 15px rgba(109, 104, 117, 0.3);
}

.next-btn:hover {
  background: var(--eye-brown);
}

/* 输入框区域样式保持整洁 */
.input-area {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.button-zone {
  height: 60px;
  /* 固定高度，防止切换按钮时下方进度条跳动 */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 5px;
}

/* 让禁用状态的按钮看起来更柔和 */
.btn:disabled {
  background: #ddd;
  cursor: not-allowed;
  transform: none !important;
}

.input-success {
  border-color: #b5838d !important;
  background-color: #fff9f9;
}

.input-error {
  border-color: #ffb4a2 !important;
  background-color: #fffafa;
}

/* 主按钮基础样式 */
.main-action-btn {
  width: 220px;
  height: 54px;
  margin-top: 0;
  border-radius: 27px;
  font-weight: 600;
  letter-spacing: 1px;
  background: var(--accent);
  box-shadow: 0 8px 20px rgba(255, 180, 162, 0.4);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 处于“下一题”状态时的颜色切换 */
.main-action-btn.next-mode {
  background: var(--maine-grey-dark);
  box-shadow: 0 8px 20px rgba(109, 104, 117, 0.3);
}

/* 禁用状态 */
.disabled-btn {
  background: #e0e0e0 !important;
  box-shadow: none !important;
  cursor: not-allowed;
  transform: scale(0.98);
  opacity: 0.7;
}

/* 悬停效果 */
.main-action-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 12px 25px rgba(255, 180, 162, 0.5);
}

.main-action-btn.next-mode:hover {
  box-shadow: 0 12px 25px rgba(109, 104, 117, 0.4);
}

.button-zone {
  height: 80px;
  /* 增加一点留白，视觉更平衡 */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 输入框状态微调 */
input {
  width: 85%;
  border: 2px solid #f0f0f0;
  background: #fafafa;
  transition: all 0.3s ease;
}

input:focus {
  background: #fff;
  border-color: var(--accent);
  box-shadow: 0 5px 15px rgba(255, 180, 162, 0.1);
}

.input-success {
  border-color: #b5838d !important;
  background-color: #fffcfb !important;
}

.input-error {
  border-color: #ffb4a2 !important;
  background-color: #fffafa !important;
}

/* --- 装饰品精准定位 --- */
.decoration {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

/* 皇冠：移到头顶正中央 */
.crown-gold {
  top: -48px;
  left: 50%;
  transform: translateX(-50%) rotate(-5deg);
  font-size: 40px;
  animation: crown-float 2s ease-in-out infinite;
}

/* 眼镜：卡在眼睛位置 */
.glasses {
  top: 22px;
  /* 从 28px 上提到 22px */
  left: 50%;
  transform: translateX(-50%);
  font-size: 38px;
  /* 稍微缩小，更精致 */
  opacity: 0.85;
  z-index: 12;
}

/* 小花：插在耳朵旁边 */
.head-flower {
  top: -18px;
  right: -10px;
  font-size: 26px;
  transform: rotate(15deg);
}

/* 铃铛：挂在脖子处（body上方） */
.bell {
  top: -5px;
  /* 原本是 -15px，改为正数让它进到 body 内部 */
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));
  z-index: 15;
}

/* 领结：在身体中间 */
.bow-tie {
  bottom: 8px;
  /* 靠近腹部 */
  left: 50%;
  transform: translateX(-50%);
  font-size: 30px;
}


@keyframes crown-float {

  0%,
  100% {
    transform: translateX(-50%) rotate(-5deg) translateY(0);
  }

  50% {
    transform: translateX(-50%) rotate(5deg) translateY(-5px);
  }
}

@keyframes halo-glow {
  from {
    opacity: 0.3;
    transform: translateX(-50%) scale(0.9);
  }

  to {
    opacity: 0.7;
    transform: translateX(-50%) scale(1.1);
  }
}
</style>
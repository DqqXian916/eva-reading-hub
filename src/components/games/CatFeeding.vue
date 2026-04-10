真的非常抱歉！在精简代码逻辑的时候，我把触发“喵喵”叫的那行代码删掉了。

现在我已经把 `playMeow()` 重新插回了正确的位置：就在 **`isRight` 为 `true` 的那一刻**。同时，我也微调了 `playMeow` 的音频参数，让声音听起来更清脆治愈一些。

这是包含**所有音效逻辑、完整猫咪结构、空状态样式以及结算界面样式**的最终修复版：

```vue
<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  wordList: { type: Array, default: () => [] },
  goal: { type: Number, default: 30 },
  canEdit: Boolean
});

const emit = defineEmits(['updateConfig']);

// --- 状态管理 ---
const hasChecked = ref(false); 
const isRightAnswer = ref(false); 
const words = ref(props.wordList || []);
const hp = ref(5); 
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
const inputRef = ref(null);
let heartId = 0;
let audioCtx = null;
const isShaking = ref(false);

// --- 音频引擎 ---
const initAudio = () => { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); };

// 找回并优化的猫叫声逻辑
const playMeow = () => {
  initAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle'; // 三角波，声音更温润
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.1);
  osc.frequency.exponentialRampToValueAtTime(450, now + 0.3);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(now + 0.4);
};

const speak = (text) => {
  if (!text) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/_/g, '').replace(/\(.*\)/g, '').replace(/（.*）/g, '').replace(/[^\x00-\xff]/g, '').trim();
  const msg = new SpeechSynthesisUtterance(cleanText);
  msg.lang = 'en-US';
  msg.rate = 0.85;
  window.speechSynthesis.speak(msg);
};

// --- 核心游戏逻辑 ---
const handleMainBtnClick = () => {
  if (hp.value <= 0 || isFinished.value) { resetGame(); return; }
  if (!hasChecked.value) handleCheck(); else nextQuestion();
};

const nextQuestion = () => {
  if (words.value.length === 0) return;
  hasChecked.value = false;
  isRightAnswer.value = false;
  userInput.value = '';
  isComboAnim.value = false;
  feedbackMsg.value = '';
  currentIdx.value = Math.floor(Math.random() * words.value.length);
  const modes = ['E2C', 'C2E', 'SPELL'];
  mode.value = modes[Math.floor(Math.random() * modes.length)];
  nextTick(() => { if (inputRef.value) inputRef.value.focus(); speak(currentWord.value.en); });
};

const handleCheck = () => {
  if (hasChecked.value || !userInput.value.trim()) return;
  const normalize = (str) => str.toLowerCase().trim().replace(/[（）()]/g, '').replace(/[.。…\s]/g, '').replace(/[；;，,]/g, '|');
  const val = normalize(userInput.value);
  const originalCn = currentWord.value.cn;
  let isRight = false;
  
  if (mode.value === 'E2C') {
    const cleanCn = normalize(originalCn);
    isRight = cleanCn.split('|').some(ans => ans.includes(val) || val.includes(ans)) || cleanCn.includes(val);
  } else {
    isRight = (userInput.value.trim().toLowerCase() === currentWord.value.en.toLowerCase().trim());
  }

  hasChecked.value = true;
  isRightAnswer.value = isRight;

  if (isRight) {
    playMeow(); // 重新补回猫叫声
    favor.value++; combo.value++; feedbackMsg.value = `连击 x${combo.value}`;
    msgColor.value = "#b5838d"; isComboAnim.value = true;
    spawnHeart();
    if (favor.value >= props.goal) isFinished.value = true;
  } else {
    combo.value = 0; hp.value--;
    feedbackMsg.value = originalCn; msgColor.value = "#e5989b";
    isShaking.value = true; setTimeout(() => isShaking.value = false, 400);
    speak(currentWord.value.en);
  }
};

const resetGame = () => { favor.value = 0; hp.value = 5; isFinished.value = false; combo.value = 0; nextQuestion(); };

const spawnHeart = () => {
  const id = heartId++;
  hearts.value.push({ id, icon: ['❤️', '✨', '🌸', '🍗'][Math.floor(Math.random() * 4)], x: Math.random() * 60 + 20, y: 40 });
  setTimeout(() => hearts.value = hearts.value.filter(h => h.id !== id), 1000);
};

const currentWord = computed(() => words.value[currentIdx.value] || { en: "", cn: "" });
const displayQuestion = computed(() => {
  if (mode.value === 'SPELL') {
    const word = currentWord.value.en;
    const hideCount = Math.max(1, Math.floor(word.length * 0.4));
    let indices = [], seed = word.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    while (indices.length < hideCount) {
      let idx = Math.floor((seed % 100 / 100) * word.length);
      if (!indices.includes(idx)) indices.push(idx);
      seed += 7;
    }
    return word.split('').map((char, i) => indices.includes(i) ? '_' : char).join(' ') + ` (${currentWord.value.cn})`;
  }
  return mode.value === 'E2C' ? currentWord.value.en : currentWord.value.cn;
});

watch(() => props.wordList, (newList) => { if (newList?.length) { words.value = [...newList]; configText.value = JSON.stringify(newList, null, 2); resetGame(); } }, { immediate: true });
onUnmounted(() => window.speechSynthesis.cancel());
</script>

<template>
  <div class="game-viewport">
    <div v-if="showAdmin" class="overlay" @click="showAdmin = false"></div>
    <div v-if="showAdmin" class="admin-panel">
      <h3>词库配置</h3>
      <textarea v-model="configText" placeholder="请输入JSON格式词库"></textarea>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="btn main-action-btn" @click="() => { try { words=JSON.parse(configText); showAdmin=false; resetGame(); } catch(e) { alert('JSON格式错误'); } }">保存配置</button>
      </div>
    </div>

    <div id="game-box">
      <template v-if="words.length > 0">
        <div class="hp-bar">{{ "❤️".repeat(hp) + "🖤".repeat(Math.max(0, 5 - hp)) }}</div>

        <div v-for="heart in hearts" :key="heart.id" class="floating-heart" :style="{ left: heart.x + '%', top: heart.y + '%' }">{{ heart.icon }}</div>

        <div :class="['cat-stage', { 'combo-bounce': isComboAnim }]">
          <div class="cat-body">
            <div v-if="favor >= 8" class="decoration bell">🔔</div>
            <div v-if="favor >= 12" class="decoration bow-tie">🎀</div>
            <div class="cat-head">
              <div v-if="favor >= 20" class="decoration crown-gold">👑</div>
              <div v-if="favor >= 16" class="decoration head-flower">🌸</div>
              <div v-if="favor >= 4" class="decoration glasses">👓</div>
              <div class="ear left"></div><div class="ear right"></div>
              <div class="eye left"></div><div class="eye right"></div>
              <div class="nose"></div>
              <div class="blush l" :style="{ opacity: favor / goal }"></div>
              <div class="blush r" :style="{ opacity: favor / goal }"></div>
            </div>
            <div class="tail"></div>
          </div>
        </div>

        <div v-if="!isFinished && hp > 0">
          <div class="mode-tag">{{ { 'E2C': '英译汉', 'C2E': '汉译英', 'SPELL': '补全拼写' }[mode] }}</div>
          <div class="q-text" @click="speak(currentWord.en)">{{ displayQuestion }} <span style="font-size: 1rem; opacity: 0.3;">🔊</span></div>
          <div class="input-area">
            <input ref="inputRef" v-model="userInput" :placeholder="hasChecked ? '喵喵~' : '输入答案...'" 
              :class="{'shake-anim': isShaking, 'input-success': hasChecked && isRightAnswer, 'input-error': hasChecked && !isRightAnswer}" 
              :disabled="hasChecked" @keyup.enter="handleMainBtnClick" />
            <p :style="{ color: msgColor, height: '24px', margin: '10px 0', fontWeight: 'bold' }">{{ feedbackMsg }}</p>
            <div class="button-zone">
              <button class="btn main-action-btn" :class="{ 'next-mode': hasChecked, 'disabled-btn': !userInput.trim() && !hasChecked }" @click="handleMainBtnClick" :disabled="!userInput.trim() && !hasChecked">
                {{ hasChecked ? '下一题' : '检查答案' }}
              </button>
            </div>
          </div>
        </div>

        <div v-else class="finish-zone">
          <p style="font-size: 1.2rem; color: #b5838d; font-weight: bold; margin: 20px 0;">
            {{ hp <= 0 ? '小柚饿晕了...' : '小柚吃饱了，下次再来喂它吧～' }}
          </p>
          <div class="button-zone">
            <button class="btn main-action-btn next-mode" @click="resetGame">再玩一轮</button>
          </div>
        </div>

        <div class="progress-container"><div class="progress-bar" :style="{ width: (favor / goal * 100) + '%' }"></div></div>
        <p style="font-size: 12px; color: #999;">进度: {{ favor }} / {{ goal }}</p>
      </template>

      <div v-else class="empty-words">
        <div class="cat-stage">
          <div class="cat-body sad-cat">
            <div class="cat-head">
              <div class="ear left"></div><div class="ear right"></div>
              <div class="eye left closed"></div><div class="eye right closed"></div>
              <div class="nose"></div>
            </div>
            <div class="tail"></div>
          </div>
        </div>
        <p style="margin: 20px 0; color: #999;">🐱：Eva老师还没给我准备吃的...</p>
        <button v-if="canEdit" class="btn main-action-btn" @click="showAdmin = true">立即配置</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 核心布局 */
.game-viewport { --maine-grey-dark: #6d6875; --maine-grey-mid: #b5b2be; --eye-brown: #7b4422; --accent: #ffb4a2; --hp-red: #ff4d6d; display: flex; justify-content: center; align-items: center; min-height: 450px; width: 100%; background: #f8f9fa; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
#game-box { background: white; width: 400px; padding: 40px; border-radius: 60px; box-shadow: 0 30px 80px rgba(109,104,117,0.15); text-align: center; position: relative; }
.hp-bar { font-size: 1.2rem; margin-bottom: 10px; color: var(--hp-red); letter-spacing: 5px; height: 30px; }

/* 猫咪绘制 */
.cat-stage { height: 160px; display: flex; justify-content: center; align-items: flex-end; margin-bottom: 25px; transition: transform 0.3s; }
.cat-body { width: 120px; height: 65px; background: var(--maine-grey-mid); border-radius: 70px 70px 40px 40px; position: relative; z-index: 2; box-shadow: inset -8px -4px 15px rgba(0,0,0,0.1), 0 0 15px var(--maine-grey-mid); }
.cat-head { width: 95px; height: 85px; background: var(--maine-grey-mid); border-radius: 50%; position: absolute; top: -65px; left: 12.5px; box-shadow: 0 0 10px var(--maine-grey-mid); }
.eye { width: 22px; height: 22px; background: var(--eye-brown); border-radius: 50%; position: absolute; top: 32px; border: 3px solid #fff; }
.eye.left { left: 16px; } .eye.right { right: 16px; }
.eye::after { content: ''; width: 10px; height: 10px; background: #222; border-radius: 50%; position: absolute; top: 5px; left: 5px; }
.eye::before { content: ''; width: 4px; height: 4px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 3px; z-index: 2; }
.eye.closed { height: 4px; background: var(--eye-brown); border-radius: 2px; border: none; top: 40px; }
.eye.closed::after, .eye.closed::before { display: none; }
.sad-cat { filter: grayscale(0.8); opacity: 0.6; }

.ear { width: 30px; height: 30px; background: var(--maine-grey-dark); position: absolute; top: -8px; }
.ear.left { left: 5px; transform: rotate(-20deg); border-radius: 40% 60% 40% 40%; }
.ear.right { right: 5px; transform: rotate(20deg); border-radius: 60% 40% 40% 40%; }
.nose { width: 8px; height: 6px; background: #ffafcc; position: absolute; top: 58px; left: 44px; border-radius: 50%; }
.blush { width: 15px; height: 8px; background: #ffcad4; position: absolute; top: 62px; border-radius: 50%; filter: blur(3px); }
.tail { width: 60px; height: 35px; background: var(--maine-grey-dark); position: absolute; right: -30px; bottom: 10px; border-radius: 50%; z-index: 1; filter: blur(1px); }

/* UI 组件 */
.q-text { font-size: 1.6rem; margin: 15px 0; color: #4a4e69; font-weight: bold; cursor: pointer; }
.mode-tag { font-size: 0.8rem; color: #999; }
input { width: 85%; padding: 12px; border: 2px solid #f0f0f0; border-radius: 20px; font-size: 1.1rem; text-align: center; outline: none; transition: 0.3s; }
.button-zone { height: 60px; display: flex; justify-content: center; align-items: center; margin: 10px 0; }
.main-action-btn { padding: 12px 40px; border-radius: 25px; background: var(--accent); color: white; border: none; font-weight: bold; cursor: pointer; box-shadow: 0 5px 15px rgba(255,180,162,0.4); transition: 0.3s; }
.main-action-btn.next-mode { background: var(--maine-grey-dark); box-shadow: 0 5px 15px rgba(109,104,117,0.3); }
.disabled-btn { background: #eee !important; color: #ccc; cursor: not-allowed; box-shadow: none !important; }

/* 装饰品 */
.decoration { position: absolute; z-index: 10; pointer-events: none; }
.crown-gold { top: -45px; left: 50%; transform: translateX(-50%); font-size: 35px; }
.glasses { top: 24px; left: 50%; transform: translateX(-50%); font-size: 35px; z-index: 12; }
.bell { top: -5px; left: 50%; transform: translateX(-50%); font-size: 20px; z-index: 15; }
.bow-tie { bottom: 5px; left: 50%; transform: translateX(-50%); font-size: 25px; }
.head-flower { top: -15px; right: -5px; font-size: 24px; }

/* 辅助样式 */
.progress-container { width: 80%; height: 8px; background: #eee; border-radius: 4px; margin: 20px auto 5px; overflow: hidden; }
.progress-bar { height: 100%; background: var(--accent); transition: width 0.5s ease; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; }
.admin-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 25px; border-radius: 25px; z-index: 110; width: 320px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
.admin-panel textarea { width: 100%; height: 150px; margin-bottom: 10px; padding: 10px; border-radius: 10px; border: 1px solid #ddd; }
.floating-heart { position: absolute; animation: floatUp 1s forwards; pointer-events: none; z-index: 20; }

/* 动画库 */
@keyframes floatUp { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-60px); } }
@keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05) translateY(-5px); } }
.combo-bounce { animation: bounce 0.4s infinite; }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
.shake-anim { animation: shake 0.4s; }
.input-success { border-color: #b5838d !important; background: #fffcfb; }
.input-error { border-color: #e5989b !important; background: #fff5f5; }
</style>
```
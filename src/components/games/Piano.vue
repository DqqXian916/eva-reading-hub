<template>
  <div class="piano-game" @click="handleStart">
    <div class="vignette"></div>
    <div class="grid-bg"></div>
    <div class="ambient-glow"></div>

    <div class="hud" v-if="!isFinished && gameStarted">
      <div class="glass-panel stat-left">
        <div class="label">PROGRESS</div>
        <div class="value">{{ Math.min(finishedCount + 1, 10) }}<span>/10</span></div>
      </div>
      
      <div class="word-focus" :class="{ 'is-preparing': isPreparing }">
        <transition name="word-slide" mode="out-in">
          <div :key="currentWord?.en" class="word-card">
            <div class="en-viewer" :class="{ 'pulse-focus': isPreparing }">
              <span 
                v-for="(char, i) in currentWord?.en" 
                :key="i"
                :class="getCharClass(i)"
              >
                {{ char.toLowerCase() }}
              </span>
            </div>
            <div class="cn-sub" v-show="!isPreparing">{{ currentWord?.cn }}</div>
            <div class="ready-hint" v-show="isPreparing">LISTEN & FOCUS...</div>
          </div>
        </transition>
      </div>

      <div class="glass-panel stat-right" :class="{ 'combo-pulse': combo > 0 }">
        <div class="num">{{ combo }}</div>
        <div class="tag">COMBO</div>
      </div>
    </div>

    <div class="waterfall-container" v-if="!isFinished && !isPreparing">
      <transition-group name="note-drop">
        <div 
          v-for="note in activeNotes" 
          :key="note.id" 
          class="word-fragment"
          :style="{ left: getKeyPosition(note.letter) + '%' }"
        >
          <div class="fragment-pill">
            <div class="pill-inner">
              <span class="letter">{{ note.letter.toLowerCase() }}</span>
            </div>
          </div>
        </div>
      </transition-group>
    </div>

    <div class="piano-wrapper" v-if="gameStarted">
      <div class="piano-board">
        <div 
          v-for="key in pianoKeys" 
          :key="key"
          class="key-wrapper"
          :class="{ 
            'is-active': pressedKeys.has(key) || (isReviewing && currentReviewLetter === key),
            'is-next': !isReviewing && !isPreparing && showHint && currentTargetLetter === key 
          }"
        >
          <div class="white-key">
            <div class="key-top-surface"></div>
            <span class="key-label">{{ key.toUpperCase() }}</span>
            <div class="active-glow"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!gameStarted || isFinished" class="overlay">
      <div v-if="!gameStarted" class="glass-modal">
        <h1 class="glitch-text" data-text="RESONANCE">RESONANCE</h1>
        <p class="sub-text">慢慢来，比较快<br>先听、后看、再弹奏</p>
        <div class="start-hint">点击任意处开启学习</div>
      </div>
      
      <div v-else-if="isFinished" class="glass-modal review-card">
        <div v-if="isReviewing" class="review-player">
          <div class="review-label">SESSION REVIEW / 自动演奏回顾</div>
          <transition name="word-slide" mode="out-in">
            <div :key="reviewWord?.en" class="review-word">
              <div class="rev-en">
                <span v-for="(c, i) in reviewWord?.en" :key="i" :class="{'rev-active': i === reviewCharIndex}">
                  {{ c.toLowerCase() }}
                </span>
              </div>
              <div class="rev-cn">{{ reviewWord?.cn }}</div>
            </div>
          </transition>
        </div>

        <div v-else class="finish-state">
          <h2>MISSION COMPLETE</h2>
          <div class="final-score">{{ score }}</div>
          <div class="button-group">
            <button @click.stop="startReview" class="neon-btn secondary">REVIEW PERFORMANCE</button>
            <button @click.stop="resetGame" class="neon-btn">NEXT SESSION</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import * as Tone from 'tone';

const props = defineProps({ wordList: Array });
const pianoKeys = "asdfghjkl".split("");

// 核心状态
const score = ref(0);
const combo = ref(0);
const gameStarted = ref(false);
const isFinished = ref(false);
const isPreparing = ref(false); // 强迫看单词状态
const finishedCount = ref(0);
const pressedKeys = reactive(new Set());
const currentWordIndex = ref(0);
const charIndex = ref(0); 
const activeNotes = ref([]);
const showHint = ref(false);

// 结算复习状态
const isReviewing = ref(false);
const reviewWordIndex = ref(0);
const reviewCharIndex = ref(0);
const currentReviewLetter = ref('');

let sampler = null;
let reviewTimer = null;

// --- 计算属性 ---
const currentWord = computed(() => {
  if (!props.wordList?.length) return null;
  return props.wordList[currentWordIndex.value % props.wordList.length];
});

const currentTargetLetter = computed(() => {
  if (!currentWord.value || isFinished.value || isPreparing.value) return '';
  return currentWord.value.en[charIndex.value]?.toLowerCase();
});

const reviewWord = computed(() => isReviewing.value ? props.wordList[reviewWordIndex.value] : null);

// --- 核心方法 ---

// 修复报错的关键：定义 getCharClass
const getCharClass = (i) => {
  if (i < charIndex.value) return 'char-done';
  if (i === charIndex.value) return 'char-active';
  return 'char-pending';
};

const getKeyPosition = (letter) => {
  const index = pianoKeys.indexOf(letter);
  return ((index + 0.5) / pianoKeys.length) * 100;
};

// 单词开始前的准备：强制识记
const prepareWord = () => {
  isPreparing.value = true;
  activeNotes.value = [];
  
  // 语音播报
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(currentWord.value.en);
    utter.lang = 'en-US';
    utter.rate = 0.8;
    window.speechSynthesis.speak(utter);
  }

  // 1.2秒后才允许开始拼写
  setTimeout(() => {
    isPreparing.value = false;
    spawnNote();
  }, 1200);
};

const spawnNote = () => {
  if (isFinished.value || isPreparing.value || !currentTargetLetter.value) return;
  
  if (!pianoKeys.includes(currentTargetLetter.value)) {
    charIndex.value++;
    if (charIndex.value >= currentWord.value.en.length) nextWord();
    else spawnNote();
    return;
  }
  activeNotes.value = [{ id: Date.now(), letter: currentTargetLetter.value }];
};

const handleStart = async () => {
  if (gameStarted.value) return;
  await Tone.start();
  gameStarted.value = true;
  sampler = new Tone.Sampler({
    urls: { "C4": "https://tonejs.github.io/audio/salamander/C4.mp3" },
    release: 1.5,
  }).toDestination();
  prepareWord();
};

const playNote = (idx) => {
  if (!sampler) return;
  const notes = ["C4", "E4", "G4", "B4", "C5", "E5", "G5", "B5"];
  sampler.triggerAttackRelease(notes[idx % notes.length], "4n");
};

const checkKey = (key) => {
  if (isFinished.value || isReviewing.value || isPreparing.value) return;
  
  if (key === currentTargetLetter.value) {
    activeNotes.value = [];
    charIndex.value++;
    score.value += 100 + (combo.value * 10);
    combo.value++;
    playNote(charIndex.value);
    showHint.value = false;
    
    if (charIndex.value >= currentWord.value.en.length) {
      setTimeout(nextWord, 300);
    } else {
      spawnNote();
    }
  } else {
    combo.value = 0;
    showHint.value = true; 
  }
};

const nextWord = () => {
  finishedCount.value++;
  if (finishedCount.value >= 10) {
    isFinished.value = true;
    return;
  }
  charIndex.value = 0;
  currentWordIndex.value = (currentWordIndex.value + 1) % props.wordList.length;
  prepareWord();
};

// --- 结算自动演奏 ---
const startReview = () => {
  isReviewing.value = true;
  reviewWordIndex.value = 0;
  reviewCharIndex.value = 0;
  runReviewStep();
};

const runReviewStep = () => {
  const word = props.wordList[reviewWordIndex.value];
  const char = word.en[reviewCharIndex.value]?.toLowerCase();

  if (pianoKeys.includes(char)) {
    currentReviewLetter.value = char;
    playNote(reviewCharIndex.value);
    setTimeout(() => { currentReviewLetter.value = ''; }, 150);
  }

  reviewCharIndex.value++;

  if (reviewCharIndex.value >= word.en.length) {
    // 弹完读一遍
    const utter = new SpeechSynthesisUtterance(word.en);
    utter.lang = 'en-US';
    window.speechSynthesis.speak(utter);

    setTimeout(() => {
      reviewCharIndex.value = 0;
      reviewWordIndex.value++;
      if (reviewWordIndex.value < 10) runReviewStep();
      else isReviewing.value = false;
    }, 1200);
  } else {
    reviewTimer = setTimeout(runReviewStep, 300);
  }
};

const resetGame = () => {
  clearTimeout(reviewTimer);
  window.speechSynthesis.cancel();
  isReviewing.value = false;
  finishedCount.value = 0;
  charIndex.value = 0;
  score.value = 0;
  combo.value = 0;
  isFinished.value = false;
  currentWordIndex.value = 0;
  prepareWord();
};

// --- 生命周期 ---
onMounted(() => {
  const down = (e) => {
    const k = e.key.toLowerCase();
    if (pianoKeys.includes(k) && !pressedKeys.has(k)) {
      pressedKeys.add(k);
      checkKey(k);
    }
  };
  const up = (e) => pressedKeys.delete(e.key.toLowerCase());
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  onUnmounted(() => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    clearTimeout(reviewTimer);
  });
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@500;700&display=swap');

.piano-game { width: 100%; height: 100%; background: #050508; display: flex; flex-direction: column; overflow: hidden; position: relative; font-family: 'Rajdhani', sans-serif; user-select: none; }

/* 背景特效 */
.grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(77, 208, 225, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(77, 208, 225, 0.05) 1px, transparent 1px); background-size: 50px 50px; transform: perspective(500px) rotateX(60deg); transform-origin: center bottom; }
.vignette { position: absolute; inset: 0; background: radial-gradient(circle, transparent 20%, #050508 100%); z-index: 3; }
.ambient-glow { position: absolute; bottom: -10%; left: 50%; transform: translateX(-50%); width: 80%; height: 40%; background: radial-gradient(circle, rgba(0, 255, 234, 0.15) 0%, transparent 70%); }

/* HUD 样式 */
.hud { padding: 30px; display: grid; grid-template-columns: 180px 1fr 180px; align-items: center; z-index: 10; }
.glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); padding: 10px 20px; border-radius: 12px; color: #fff; }
.stat-left .label { font-size: 10px; color: #4dd0e1; letter-spacing: 2px; }
.stat-left .value { font-size: 24px; font-weight: 700; font-family: 'Orbitron'; }
.stat-right { text-align: right; border-right: 4px solid #ff0055; }
.stat-right .num { font-size: 30px; font-weight: 900; color: #ff0055; }

/* 单词聚焦样式 */
.word-focus { text-align: center; transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.is-preparing { transform: scale(1.15); }
.en-viewer { font-size: 56px; font-weight: 900; letter-spacing: 10px; font-family: 'Orbitron'; color: rgba(255,255,255,0.08); }
.pulse-focus { animation: pulse-glow 1.2s infinite; color: #fff; text-shadow: 0 0 20px rgba(255,255,255,0.4); }
.char-done { color: #00fff2; text-shadow: 0 0 15px #00fff2; }
.char-active { color: #fff; border-bottom: 4px solid #fff; }
.cn-sub { color: rgba(255,255,255,0.4); font-size: 18px; margin-top: 10px; letter-spacing: 4px; }
.ready-hint { font-size: 14px; color: #00fff2; letter-spacing: 5px; margin-top: 10px; font-weight: 700; }

/* 瀑布流 */
.waterfall-container { flex: 1; position: relative; z-index: 5; }
.word-fragment { position: absolute; bottom: 0; transform: translateX(-50%); animation: drop-in 0.4s ease-out forwards; }
.fragment-pill { width: 64px; height: 64px; background: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 25px rgba(255,255,255,0.4); }
.fragment-pill .letter { font-size: 32px; font-weight: 900; color: #000; font-family: 'Orbitron'; }

/* 钢琴键盘 */
.piano-wrapper { padding: 0 20px 40px; z-index: 10; }
.piano-board { height: 180px; display: flex; gap: 8px; max-width: 1000px; margin: 0 auto; }
.key-wrapper { flex: 1; position: relative; perspective: 800px; }
.white-key { height: 100%; background: #fff; border-radius: 0 0 8px 8px; position: relative; transition: 0.1s; box-shadow: 0 8px 0 #ccc, 0 15px 25px rgba(0,0,0,0.3); }
.is-active .white-key { transform: rotateX(-15deg) translateY(6px); background: #00fff2; box-shadow: 0 2px 0 #008ba3, 0 0 40px #00fff2; }
.key-label { position: absolute; bottom: 15px; width: 100%; text-align: center; color: #333; font-weight: 700; opacity: 0.3; }

/* 覆盖层 & 结算 */
.overlay { position: absolute; inset: 0; background: rgba(5,5,8,0.95); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(8px); }
.glass-modal { background: rgba(255,255,255,0.05); padding: 50px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); text-align: center; color: #fff; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
.glitch-text { font-size: 56px; font-family: 'Orbitron'; letter-spacing: 12px; margin-bottom: 20px; text-shadow: 2px 0 #ff0055, -2px 0 #00fff2; }

.review-player { padding: 20px; }
.rev-en { font-size: 64px; font-family: 'Orbitron'; font-weight: 900; margin-bottom: 10px; color: rgba(255,255,255,0.05); letter-spacing: 12px; }
.rev-active { color: #00fff2; text-shadow: 0 0 25px #00fff2; }
.rev-cn { font-size: 24px; color: #888; letter-spacing: 5px; }

.neon-btn { padding: 15px 35px; background: #00fff2; border: none; border-radius: 40px; font-family: 'Orbitron'; font-weight: 700; cursor: pointer; margin: 15px; transition: 0.3s; }
.neon-btn.secondary { background: transparent; border: 2px solid #00fff2; color: #00fff2; }
.neon-btn:hover { transform: scale(1.1); box-shadow: 0 0 30px #00fff2; }

/* 动画 */
@keyframes pulse-glow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }
@keyframes drop-in { from { transform: translateX(-50%) translateY(-50px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }

.word-slide-enter-active, .word-slide-leave-active { transition: 0.4s ease; }
.word-slide-enter-from { transform: translateY(20px); opacity: 0; }
.word-slide-leave-to { transform: translateY(-20px); opacity: 0; }
</style>
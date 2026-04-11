<template>
  <div class="guzheng-game-container" @click="handleGlobalClick">
    <div class="bg-decoration"></div>

    <div v-if="!isLoaded && words.length > 0" class="loading-overlay">
      <div class="loader"></div>
      <p class="loading-text">正在校准《将军令》曲谱...</p>
    </div>

    <div class="game-header">
      <div class="brand-box">
        <span class="brand-tag">—Guzheng Echo —</span>
        <h2 class="game-title">{{ isAutoPlaying ? '全曲弹拨中' : '拨词 · 将军令' }}</h2>
      </div>
      <div class="stat-group" v-if="!isAutoPlaying">
        <div class="stat-item highlight">
          <span class="label">SCORE</span>
          <span class="value">{{ score }}</span>
        </div>
      </div>
    </div>

    <div v-if="words.length > 0" class="word-stage">
      <div class="progress-bar-container">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <div class="progress-counter">
          {{ (isAutoPlaying ? autoPlayIndex : currentIndex) + 1 }} / {{ words.length }}
        </div>
      </div>

      <transition name="word-slide" mode="out-in">
        <div v-if="!isAutoPlaying" :key="currentIndex" class="word-card">
          <div class="word-display-wrapper">
            <div class="word-display" :class="{ 'is-word-complete': isWordComplete }">
              <span v-for="(char, index) in currentWordText" :key="index" :class="getCharClass(index)" class="char-node">{{ char }}</span>
            </div>
          </div>
          <div class="content-box">
            <transition name="fade-up" mode="out-in">
              <div v-if="!isWordComplete" class="word-translation">{{ currentWord?.cn }}</div>
              <div v-else class="sentence-reveal">
                <p class="sentence-en" v-html="highlightWord(currentWord?.s)"></p>
                <div class="action-hint">滑动琴弦“扫”出全曲</div>
              </div>
            </transition>
          </div>
        </div>

        <div v-else :key="'auto-' + autoPlayIndex" class="word-card auto-play-card">
          <div class="auto-word-tag">{{ words[autoPlayIndex]?.en }}</div>
          <div class="sentence-reveal">
            <p class="sentence-en large" v-html="highlightWord(words[autoPlayIndex]?.s, words[autoPlayIndex]?.en)"></p>
          </div>
        </div>
      </transition>
    </div>

    <div class="guzheng-board" @mouseleave="stopGlissando">
      <div 
        v-for="key in alphabet" 
        :key="key"
        class="string-wrapper"
        @mousedown="playNote(key)"
        @mouseenter="handleGlissando(key)"
      >
        <div 
          class="string" 
          :class="{ 
            'is-active': activeKey === key || (isAutoPlaying && autoActiveString === key),
            'is-green': isGreenString(key),
            'is-gliss': isGlissanding && isWordComplete
          }"
        >
          <div class="string-line"></div>
        </div>
      </div>
    </div>

    <transition name="fade">
      <div v-if="isFinished && !isAutoPlaying" class="result-overlay">
        <div class="result-card">
          <div class="result-header">合奏圆满</div>
          <div class="result-score">{{ score }}</div>
          <button class="primary-btn" @click="startFullShow">展示完整成果</button>
          <button class="secondary-btn" @click="initGame">重新练习</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as Tone from 'tone';

const props = defineProps({ wordList: Array });
const emit = defineEmits(['finish']);

const JIANG_JUN_LING = ["D3", "D3", "E3", "G3", "A3", "A3", "G3", "A3", "D4", "B3", "A3", "G3", "E3", "D3", "E3", "G3", "A3", "G3", "E3", "D3", "B2", "D3", "D3"];
const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
const words = ref([]);
const currentIndex = ref(0);
const charIndex = ref(0);
const score = ref(0);
const isFinished = ref(false);
const activeKey = ref(null);
const isLoaded = ref(false);
const isWordComplete = ref(false);
const isGlissanding = ref(false);

const isAutoPlaying = ref(false);
const autoPlayIndex = ref(0);
const autoActiveString = ref(null);

let sampler = null;
let melodyStep = 0;
let glissandoCount = 0;

const currentWord = computed(() => words.value[currentIndex.value] || {});
const currentWordText = computed(() => (currentWord.value.en || "").toLowerCase());

// --- 核心修复：支持练习模式的进度计算 ---
const progressPercentage = computed(() => {
  if (!words.value.length) return 0;
  const activeIdx = isAutoPlaying.value ? autoPlayIndex.value : currentIndex.value;
  return ((activeIdx + 1) / words.value.length) * 100;
});

const highlightWord = (s, target) => {
  if (!s) return "";
  const word = target || currentWordText.value;
  const regex = new RegExp(`(${word})`, 'gi');
  return s.replace(regex, '<span class="highlight-text">$1</span>');
};

const initAudio = () => {
  if (sampler) return;
  sampler = new Tone.Sampler({
    urls: { "A4": "https://tonejs.github.io/audio/salamander/A4.mp3" },
    release: 1.5,
    onload: () => { isLoaded.value = true; }
  }).toDestination();
};

const playNote = (key, isAuto = false) => {
  if (!isLoaded.value) return;
  if (!isAuto && !isAutoPlaying.value && isWordComplete.value) return;
  
  if (!isAuto) {
    activeKey.value = key;
    setTimeout(() => activeKey.value = null, 150);
  }

  const note = JIANG_JUN_LING[melodyStep % JIANG_JUN_LING.length];
  sampler?.triggerAttackRelease(note, "1n");
  melodyStep++;

  if (!isAutoPlaying.value) checkLetter(key);
};

const startFullShow = async () => {
  await Tone.start();
  isAutoPlaying.value = true;
  autoPlayIndex.value = 0;
  melodyStep = 0;

  for (let i = 0; i < words.value.length; i++) {
    autoPlayIndex.value = i;
    for (let j = 0; j < 2; j++) {
      const randomKey = alphabet[Math.floor(Math.random() * 26)];
      autoActiveString.value = randomKey;
      playNote(randomKey, true); 
      await new Promise(r => setTimeout(r, 450));
      autoActiveString.value = null;
    }
    await new Promise(r => setTimeout(r, 2800));
  }
  
  isAutoPlaying.value = false;
  initGame();
};

const checkLetter = (key) => {
  let targetLetter = currentWordText.value[charIndex.value];
  if (key === targetLetter) {
    charIndex.value++;
    while (charIndex.value < currentWordText.value.length && !/[a-z]/.test(currentWordText.value[charIndex.value])) {
      charIndex.value++;
    }
    if (charIndex.value >= currentWordText.value.length) {
      score.value += 10;
      isWordComplete.value = true;
      speak(currentWord.value.s); 
    }
  }
};

const handleGlissando = (key) => {
  if (!isWordComplete.value || isFinished.value || isAutoPlaying.value) return;
  isGlissanding.value = true;
  glissandoCount++;
  sampler?.triggerAttackRelease("A4", "8n", undefined, 0.1);
  if (glissandoCount > 7) proceedToNext();
};

const stopGlissando = () => { isGlissanding.value = false; };

const proceedToNext = () => {
  glissandoCount = 0;
  isWordComplete.value = false;
  charIndex.value = 0;
  if (currentIndex.value < words.value.length - 1) currentIndex.value++;
  else isFinished.value = true;
};

const speak = (text) => {
  if (isAutoPlaying.value) return; 
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.8;
  window.speechSynthesis.speak(u);
};

const initGame = () => {
  isFinished.value = false;
  isWordComplete.value = false;
  isAutoPlaying.value = false;
  currentIndex.value = 0;
  charIndex.value = 0;
  score.value = 0;
  melodyStep = 0;
  if (props.wordList?.length) {
    words.value = [...props.wordList].sort(() => Math.random() - 0.5).slice(0, 15);
  }
};

const handleGlobalClick = async () => { if (Tone.context.state !== 'running') await Tone.start(); };
const getCharClass = (index) => {
  const char = currentWordText.value[index];
  if (!/[a-z]/.test(char)) return 'char-symbol'; 
  if (index < charIndex.value) return 'char-done';
  if (index === charIndex.value) return 'char-active';
  return 'char-pending';
};
const isGreenString = (key) => (alphabet.indexOf(key) + 1) % 5 === 0;

onMounted(() => {
  initAudio();
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (alphabet.includes(key)) playNote(key);
  });
});
watch(() => props.wordList, initGame, { immediate: true });
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;600&display=swap');

.guzheng-game-container {
  width: 100%; height: 100%; background: #080808;
  display: flex; flex-direction: column; position: relative; color: #b89c6d;
  font-family: 'Noto Serif SC', serif; user-select: none; overflow: hidden;
}

.bg-decoration {
  position: absolute; top: 50%; left: 50%; width: 100vw; height: 100vw;
  background: radial-gradient(circle, rgba(184, 156, 109, 0.03) 0%, transparent 70%);
  transform: translate(-50%, -50%); pointer-events: none;
}

.game-header { padding: 30px; display: flex; justify-content: space-between; align-items: flex-end; z-index: 10; }
.game-title { margin: 0; font-size: 24px; color: #d4af37; letter-spacing: 2px; }

.word-stage { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 0 10%; text-align: center; position: relative; }

/* 进度条：常驻样式 */
.progress-bar-container {
  position: absolute; top: 10px; width: 60%; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 5;
}
.progress-track {
  width: 100%; height: 2px; background: rgba(184, 156, 109, 0.1); border-radius: 1px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: #d4af37; transition: width 0.6s ease;
  box-shadow: 0 0 10px #d4af37;
}
.progress-counter { font-size: 12px; color: #b89c6d; opacity: 0.6; letter-spacing: 1px; }

.word-display { font-size: 5rem; font-weight: 600; letter-spacing: 6px; display: flex; justify-content: center; gap: 8px; }
.word-display.is-word-complete { transform: scale(0.8); opacity: 0.4; filter: blur(2px); }

.char-active { color: #fff; transform: translateY(-5px); text-shadow: 0 0 20px #fff; }
.char-pending { opacity: 0.1; }
.char-done { color: #332b21; }
.char-symbol { opacity: 0.3; margin: 0 10px; }

.sentence-reveal { animation: slideInUp 0.8s ease-out; margin-top: 20px; }
.sentence-en { font-size: 1.5rem; line-height: 1.6; color: #eee; font-weight: 300; font-style: italic; max-width: 850px; }
.sentence-en.large { font-size: 2.2rem; color: #fff; text-shadow: 0 0 20px rgba(212, 175, 55, 0.3); line-height: 1.4; }
.highlight-text { color: #d4af37; font-weight: 600; border-bottom: 1px solid #d4af37; }

.auto-word-tag { font-size: 12px; letter-spacing: 5px; color: #d4af37; margin-bottom: 15px; opacity: 0.6; }
.auto-play-card { animation: cinematicFade 3.8s infinite; }

.guzheng-board { height: 150px; background: rgba(0,0,0,0.3); display: flex; padding: 0 40px; border-top: 1px solid rgba(184, 156, 109, 0.1); }
.string-wrapper { flex: 1; display: flex; justify-content: center; }
.string { width: 1px; height: 100%; background: linear-gradient(to bottom, transparent, rgba(184, 156, 109, 0.2), transparent); transition: 0.2s; }
.string.is-active { background: #fff; box-shadow: 0 0 15px #fff; width: 2px; }
.string.is-gliss { background: #d4af37; box-shadow: 0 0 10px #d4af37; width: 2px; }

.result-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.95); z-index: 100; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(10px); }
.result-card { text-align: center; }
.result-score { font-size: 80px; color: #fff; margin-bottom: 30px; }
.primary-btn { background: #d4af37; color: #000; border: none; padding: 15px 40px; cursor: pointer; font-size: 16px; letter-spacing: 2px; margin: 10px; }
.secondary-btn { background: none; border: 1px solid #d4af37; color: #d4af37; padding: 15px 40px; cursor: pointer; margin: 10px; }

@keyframes slideInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cinematicFade {
  0% { opacity: 0; transform: translateY(10px); filter: blur(5px); }
  15% { opacity: 1; transform: translateY(0); filter: blur(0); }
  85% { opacity: 1; transform: translateY(0); filter: blur(0); }
  100% { opacity: 0; transform: translateY(-10px); filter: blur(5px); }
}
</style>
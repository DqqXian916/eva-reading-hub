<template>
  <div class="guzheng-game-container" @click="handleGlobalClick">
    <div class="bg-decoration"></div>

    <div v-if="!isLoaded && words.length > 0" class="loading-overlay">
      <div class="loader"></div>
      <p class="loading-text">正在校准《{{ currentPiece.name }}》古法金谱...</p>
    </div>

    <div class="game-header">
      <div class="brand-box">
        <span class="brand-tag">- Guzheng echo -</span>
        <h2 class="game-title">
          {{ isAutoPlaying ? `全曲演奏中 · ${currentPiece.technique}` : `拨词 · ${currentPiece.name}` }}
        </h2>
      </div>

      <div class="header-right-controls" v-if="!isAutoPlaying">
        <!-- 考级难度/曲目选择器 -->
        <div class="level-selector-wrapper">
          <button class="level-btn" @click.stop="showLevelMenu = !showLevelMenu">
            <span class="level-badge">{{ currentPiece.levelTag }}</span>
            <span class="piece-title">{{ currentPiece.name }}</span>
            <span class="arrow-icon" :class="{ 'is-open': showLevelMenu }">▾</span>
          </button>
          
          <transition name="dropdown">
            <div v-if="showLevelMenu" class="level-dropdown-menu" @click.stop>
              <div class="menu-scroll-container">
                <div 
                  v-for="piece in PIECE_LEVELS" 
                  :key="piece.id" 
                  class="menu-item"
                  :class="{ 'is-active': piece.id === currentPiece.id }"
                  @click="changePiece(piece)"
                >
                  <div class="item-header">
                    <span class="item-level">{{ piece.levelTag }}</span>
                    <span class="item-name">{{ piece.name }}</span>
                  </div>
                  <div class="item-tech">技法：{{ piece.technique }}</div>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <div class="stat-group">
          <div class="stat-item highlight">
            <span class="label">SCORE：</span>
            <span class="value">{{ score }}</span>
          </div>
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

      <div v-if="!isAutoPlaying" class="word-card manual-mode">
        <div class="word-display-wrapper">
          <div class="word-display" :class="{ 'is-word-complete': isWordComplete }">
            <span v-for="(char, index) in currentWordText" :key="index" :class="getCharClass(index)" class="char-node">{{ char }}</span>
          </div>
        </div>
        <div class="content-box">
          <div v-if="!isWordComplete" class="technique-guide">
            <span class="word-translation">{{ currentWord?.cn }}</span>
            <div class="finger-hint">◈ 指法：{{ charIndex === currentWordText.length - 1 ? '托' : '抹' }}</div>
          </div>
          <div v-else class="sentence-reveal">
            <p class="sentence-en" v-html="highlightWord(currentWord?.s)"></p>
            <div class="action-hint">运指“刮奏” · 开启下篇</div>
          </div>
        </div>
      </div>

      <div v-else class="word-card auto-mode">
        <div class="auto-word-tag">技法：{{ currentPiece.technique }}</div>
        <transition name="fade-fast" mode="out-in">
          <div :key="'auto-word-' + autoPlayIndex" class="sentence-reveal" v-if="words[autoPlayIndex]">
             <p class="play-done">{{ words[autoPlayIndex].en.toLowerCase() }}</p>
             <p class="sentence-en large" v-html="highlightWord(words[autoPlayIndex].s, words[autoPlayIndex].en)"></p>
          </div>
        </transition>
      </div>
    </div>

    <div class="guzheng-board" @mouseleave="stopGlissando">
      <div 
        v-for="key in alphabet" 
        :key="key"
        class="string-wrapper"
        @mousedown="playNote(key, 'manual')"
        @mouseenter="handleGlissando(key)"
      >
        <div 
          class="string" 
          :class="{ 
            'is-active': activeKey === key,
            'is-vibrating': (isAutoPlaying && autoActiveString === key),
            'is-green': isGreenString(key)
          }"
        >
          <div class="string-line"></div>
        </div>
      </div>
    </div>

    <transition name="fade">
      <div v-if="isFinished && !isAutoPlaying" class="result-overlay">
        <div class="result-card">
          <div class="result-header">合奏圆满 · 《{{ currentPiece.name }}》</div>
          <div class="result-score">{{ score }}</div>
          <div class="achievement-tag">获得评价：{{ currentPiece.levelTag }}·金弦通关</div>
          <button class="primary-btn" @click="startFullShow">展示完整成果</button>
          <button class="secondary-btn" @click="initGame">重新练习</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue';
import * as Tone from 'tone';

const props = defineProps({ wordList: Array });

// 扩充后的 8 大考级曲目库（精细化调整原曲音程与节奏感）
const PIECE_LEVELS = [
  {
    id: 'lvl1_1',
    levelTag: '一级 · 入门',
    name: '沧海一声笑',
    technique: '托 / 抹 / 勾',
    notes: ["G4", "E4", "D4", "C4", "A3", "C4", "D4", "E4", "G4", "E4", "D4", "C4", "D4"]
  },
  {
    id: 'lvl1_2',
    levelTag: '一级 · 经典',
    name: '关山月',
    technique: '托劈 / 勾托',
    notes: ["G3", "C4", "D4", "E4", "G4", "E4", "D4", "C4", "A3", "C4", "D4", "E4", "D4", "C4"]
  },
  {
    id: 'lvl4_1',
    levelTag: '四级 · 基础',
    name: '高山流水',
    technique: '吟弦 / 按音',
    notes: ["D3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5", "A4", "G4", "E4", "D4", "C4", "A3", "G3"]
  },
  {
    id: 'lvl4_2',
    levelTag: '四级 · 进阶',
    name: '渔舟唱晚',
    technique: '花指 / 勾托抹托',
    notes: ["D4", "E4", "G4", "A4", "C5", "D5", "C5", "A4", "G4", "E4", "D4", "E4", "G4", "A4", "G4", "E4", "D4"]
  },
  {
    id: 'lvl6',
    levelTag: '六级 · 中阶',
    name: '寒鸦戏水',
    technique: '按颤音 / 双弹',
    notes: ["A3", "C4", "E4", "F4", "A4", "B4", "A4", "F4", "E4", "C4", "B3", "A3", "C4", "E4", "A4"]
  },
  {
    id: 'lvl7',
    levelTag: '七级 · 高阶',
    name: '战台风',
    technique: '快四点 / 扫摇',
    notes: ["D3", "D3", "E3", "G3", "A3", "C4", "D4", "D4", "E4", "D4", "C4", "A3", "G3", "E3", "D3", "E3", "G3", "A3"]
  },
  {
    id: 'lvl8',
    levelTag: '八级 · 演奏级',
    name: '将军令',
    technique: '大撮 / 连续摇指',
    notes: ["D3", "D3", "E3", "G3", "A3", "A3", "G3", "A3", "D4", "B3", "A3", "G3", "E3", "D3", "E3", "G3", "A3", "G3", "E3", "D3", "B2", "D3", "D3"]
  },
  {
    id: 'lvl10',
    levelTag: '十级 · 专业级',
    name: '雪山春晓',
    technique: '快速指序 / 轮指',
    notes: ["E4", "G4", "A4", "C5", "D5", "E5", "G5", "E5", "D5", "C5", "A4", "G4", "E4", "G4", "A4", "C5", "A4", "G4", "E4", "D4", "C4"]
  }
];

const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");

const currentPiece = ref(PIECE_LEVELS[0]);
const showLevelMenu = ref(false);

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
let isUnmounted = false;

const currentWord = computed(() => words.value[currentIndex.value] || {});
const currentWordText = computed(() => (currentWord.value.en || "").toLowerCase());
const progressPercentage = computed(() => {
  if (!words.value.length) return 0;
  const idx = isAutoPlaying.value ? autoPlayIndex.value : currentIndex.value;
  return ((idx + 1) / words.value.length) * 100;
});

const changePiece = (piece) => {
  currentPiece.value = piece;
  showLevelMenu.value = false;
  initGame();
};

const highlightWord = (s, target) => {
  if (!s) return "";
  const word = (target || currentWord.value.en || "").trim();
  if (!word) return s;
  const regex = new RegExp(`(${word})`, 'gi');
  return s.replace(regex, `<span class="word-highlight">$1</span>`);
};

const initAudio = () => {
  if (sampler) return;
  sampler = new Tone.Sampler({
    urls: { "A4": "https://tonejs.github.io/audio/salamander/A4.mp3" },
    release: 1.5,
    onload: () => { isLoaded.value = true; }
  }).toDestination();
};

const playNote = (key, mode = 'manual') => {
  if (!isLoaded.value || !sampler) return;
  const currentMelody = currentPiece.value.notes;
  const note = currentMelody[melodyStep % currentMelody.length];
  const now = Tone.now();
  if (mode === 'auto') {
    sampler.triggerAttackRelease(note, "1n", now, 0.9);
  } else {
    if (isWordComplete.value) return;
    activeKey.value = key;
    setTimeout(() => { activeKey.value = null; }, 120);
    sampler.triggerAttackRelease(note, "2n", now);
    checkLetter(key);
    melodyStep++; 
  }
};

const handleGlissando = (key) => {
  if (!isWordComplete.value || isAutoPlaying.value) return;
  isGlissanding.value = true;
  glissandoCount++;
  sampler?.triggerAttackRelease("A4", "8n", undefined, 0.05); 
  if (glissandoCount > 12) proceedToNext(); 
};

const stopGlissando = () => {
  isGlissanding.value = false;
  glissandoCount = 0;
};

const proceedToNext = () => {
  glissandoCount = 0;
  isWordComplete.value = false;
  charIndex.value = 0;
  if (currentIndex.value < words.value.length - 1) currentIndex.value++;
  else isFinished.value = true;
};

const startFullShow = async () => {
  try {
    await Tone.start();
    if (words.value.length === 0 && props.wordList?.length) {
      words.value = [...props.wordList].slice(0, 15);
    }
    melodyStep = 0;
    autoPlayIndex.value = 0;
    isAutoPlaying.value = true;
    await new Promise(r => setTimeout(r, 300));
    for (let i = 0; i < words.value.length; i++) {
      if (isUnmounted) break;
      autoPlayIndex.value = i;
      await nextTick();
      for (let j = 0; j < 3; j++) {
        if (isUnmounted) break;
        autoActiveString.value = null;
        await new Promise(r => setTimeout(r, 50)); 
        const randomKey = alphabet[Math.floor(Math.random() * 26)];
        autoActiveString.value = randomKey; 
        playNote(randomKey, 'auto');
        melodyStep++; 
        await new Promise(r => setTimeout(r, 450));
      }
      autoActiveString.value = null;
      await new Promise(r => setTimeout(r, 2200));
    }
  } catch (e) { console.error(e); } finally {
    if (!isUnmounted) { isAutoPlaying.value = false; initGame(); }
  }
};

const checkLetter = (key) => {
  if (key === currentWordText.value[charIndex.value]) {
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

const speak = (text) => {
  if (isAutoPlaying.value) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
};

const initGame = () => {
  isFinished.value = isWordComplete.value = isAutoPlaying.value = false;
  autoActiveString.value = null;
  currentIndex.value = autoPlayIndex.value = charIndex.value = score.value = melodyStep = 0;
  if (props.wordList?.length) {
    words.value = [...props.wordList].sort(() => Math.random() - 0.5).slice(0, 15);
  }
};

const handleGlobalClick = async () => { 
  if (showLevelMenu.value) showLevelMenu.value = false;
  if (Tone.context.state !== 'running') await Tone.start(); 
};

const getCharClass = (i) => {
  const c = currentWordText.value[i];
  if (!/[a-z]/.test(c)) return 'char-symbol';
  return i < charIndex.value ? 'char-done' : (i === charIndex.value ? 'char-active' : 'char-pending');
};

const isGreenString = (k) => (alphabet.indexOf(k) + 1) % 5 === 0;

onMounted(() => {
  initAudio();
  const keyHandler = (e) => {
    const k = e.key.toLowerCase();
    if (alphabet.includes(k) && !isAutoPlaying.value) playNote(k, 'manual');
  };
  window.addEventListener('keydown', keyHandler);
  onUnmounted(() => { isUnmounted = true; window.removeEventListener('keydown', keyHandler); });
});

watch(() => props.wordList, initGame, { immediate: true });
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;600&display=swap');

.guzheng-game-container { width: 100%; height: 100%; background: #050505; display: flex; flex-direction: column; position: relative; color: #b89c6d; font-family: 'Noto Serif SC', serif; overflow: hidden; }
.bg-decoration { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, rgba(184, 156, 109, 0.05) 0%, transparent 70%); pointer-events: none; }
.game-header { padding: 40px; display: flex; justify-content: space-between; align-items: flex-end; z-index: 30; }
.game-title { margin: 0; font-size: 26px; color: #d4af37; letter-spacing: 4px; text-shadow: 0 0 15px rgba(212, 175, 55, 0.2); }

.header-right-controls { display: flex; align-items: center; gap: 24px; }

.level-selector-wrapper { position: relative; }
.level-btn {
  background: rgba(184, 156, 109, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.3);
  padding: 8px 16px;
  color: #d4af37;
  font-family: 'Noto Serif SC', serif;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
}
.level-btn:hover {
  background: rgba(212, 175, 55, 0.15);
  border-color: #d4af37;
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.2);
}
.level-badge { background: #d4af37; color: #000; font-size: 11px; padding: 2px 6px; font-weight: 600; }
.piece-title { font-size: 14px; letter-spacing: 1px; }
.arrow-icon { font-size: 12px; transition: transform 0.3s ease; }
.arrow-icon.is-open { transform: rotate(180deg); }

.level-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 250px;
  background: #0a0908;
  border: 1px solid rgba(212, 175, 55, 0.4);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
  z-index: 50;
}
.menu-scroll-container {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.menu-scroll-container::-webkit-scrollbar { width: 4px; }
.menu-scroll-container::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.3); }

.menu-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(184, 156, 109, 0.1);
  cursor: pointer;
  transition: background 0.2s;
}
.menu-item:last-child { border-bottom: none; }
.menu-item:hover, .menu-item.is-active {
  background: rgba(212, 175, 55, 0.12);
}
.menu-item.is-active .item-name { color: #d4af37; }
.item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.item-level { font-size: 11px; opacity: 0.6; color: #b89c6d; }
.item-name { font-size: 14px; color: #e5e5e5; font-weight: 600; }
.item-tech { font-size: 11px; opacity: 0.5; color: #b89c6d; }

.progress-bar-container { position: absolute; top: 10px; width: 50%; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 20; left: 25%; pointer-events: none; }
.progress-track { width: 100%; height: 1px; background: rgba(184, 156, 109, 0.1); }
.progress-fill { height: 100%; background: #d4af37; transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px #d4af37; }
.progress-counter { font-size: 10px; opacity: 0.5; letter-spacing: 3px; font-weight: 300; }

.word-stage { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative; padding-top: 60px; }

.word-display { font-size: 5.5rem; font-weight: 600; letter-spacing: 12px; display: flex; gap: 5px; }
.word-display.is-word-complete { transform: scale(0.9); opacity: 0.15; filter: blur(8px); transition: 1.2s; }
.char-active { color: #fff; transform: translateY(-10px); text-shadow: 0 0 30px #fff; }
.char-done { color: #221d17; }
.char-pending { opacity: 0.05; }

.play-done {
  font-family: "Noto Serif SC", serif;
  font-size: 5rem;
  font-weight: 300;
  letter-spacing: 20px;
  margin: 0;
  color: #fdfaf2; 
  text-shadow: 
    0 0 5px rgba(212, 175, 55, 0.8),
    0 0 15px rgba(212, 175, 55, 0.4),
    0 0 35px rgba(212, 175, 55, 0.2);
  animation: goldGlowBreath 4s infinite ease-in-out;
  transition: all 1s ease-in-out;
}

@keyframes goldGlowBreath {
  0%, 100% { opacity: 0.9; text-shadow: 0 0 5px rgba(212, 175, 55, 0.8), 0 0 15px rgba(212, 175, 55, 0.4), 0 0 35px rgba(212, 175, 55, 0.2); }
  50% { opacity: 1; text-shadow: 0 0 8px rgba(212, 175, 55, 0.9), 0 0 25px rgba(212, 175, 55, 0.5), 0 0 50px rgba(212, 175, 55, 0.3); }
}

.auto-word-tag { font-size: 14px; opacity: 0.6; letter-spacing: 2px; margin-bottom: 20px; color: #d4af37; }

.sentence-reveal { margin-top: 25px; text-align: center; }
.sentence-en { font-size: 1.6rem; color: #ccc; font-weight: 300; font-style: italic; max-width: 850px; line-height: 1.8; }
.sentence-en.large { font-size: 2.2rem; color: #fff; line-height: 1.6; text-shadow: 0 0 40px rgba(212, 175, 55, 0.5); }

:deep(.word-highlight) {
  color: #d4af37 !important;
  font-weight: 600;
  border-bottom: 1.5px solid rgba(212, 175, 55, 0.8);
  padding-bottom: 2px;
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
}

.guzheng-board { height: 200px; display: flex; padding: 0 60px; border-top: 1px solid rgba(184, 156, 109, 0.05); }
.string-wrapper { flex: 1; display: flex; justify-content: center; cursor: pointer; padding: 0 5px; }
.string { 
  width: 1px; height: 100%; 
  background: linear-gradient(to bottom, transparent, rgba(184, 156, 109, 0.08), transparent); 
  position: relative; 
  transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); 
}
.string-wrapper:hover .string {
  background: #d4af37 !important;
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.8), 0 0 30px rgba(212, 175, 55, 0.4) !important;
  width: 2px !important;
  transition: all 0s;
  animation: stringGlow 1s infinite alternate;
}

.string.is-active { background: #fff !important; box-shadow: 0 0 25px #fff !important; width: 2px !important; transition: 0s; }
.string.is-vibrating { background: #ffffff !important; box-shadow: 0 0 25px #ffffff, 0 0 45px rgba(212, 175, 55, 0.4) !important; width: 3px !important; animation: stringShake 0.1s infinite alternate !important; }
.string.is-green { background: linear-gradient(to bottom, transparent, rgba(46, 139, 87, 0.15), transparent); }

@keyframes stringGlow { from { opacity: 0.8; transform: scaleX(1); } to { opacity: 1; transform: scaleX(1.8); } }
@keyframes stringShake { from { transform: translateX(-2.5px); } to { transform: translateX(2.5px); } }

.result-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.97); display: flex; justify-content: center; align-items: center; z-index: 100; }
.primary-btn { background: #d4af37; color: #000; border: none; padding: 20px 60px; font-size: 16px; cursor: pointer; margin: 15px; letter-spacing: 2px; }
.secondary-btn { background: none; border: 1px solid #d4af37; color: #d4af37; padding: 20px 60px; cursor: pointer; margin: 15px; letter-spacing: 2px; }

.dropdown-enter-active, .dropdown-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
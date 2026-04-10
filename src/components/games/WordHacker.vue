<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  wordList: { type: Array, default: () => [] },
  goal: { type: Number, default: 20 },
  canEdit: Boolean
});

const emit = defineEmits(['finish', 'updateConfig']);

// --- 1. 状态管理 ---
const words = ref([]);
const currentIndex = ref(0);
const score = ref(0);
const combo = ref(0);
const timeLeft = ref(100);
const isFinished = ref(false);
const options = ref([]);
const errorLog = ref([]);
const isShaking = ref(false);
const isComboActive = ref(false);
const currentBtnState = ref(null); 
const floatPoints = ref([]);

let timer = null;
const comboRanks = ["GOOD!", "GREAT!", "EXCELLENT!", "UNSTOPPABLE!", "GODLIKE!"];

// --- 2. 计算属性 ---
const currentWord = computed(() => words.value[currentIndex.value] || {});

const displaySentence = computed(() => {
  if (!currentWord.value.s) return 'SYSTEM SCANNING...';
  const regex = new RegExp(currentWord.value.en, 'gi');
  return currentWord.value.s.replace(regex, '_______');
});

const comboRankName = computed(() => {
  let rIdx = Math.min(Math.floor((combo.value - 2) / 2), comboRanks.length - 1);
  return comboRanks[rIdx] || "HACKING...";
});

const rankTitle = computed(() => {
  if (score.value > 2000) return "OMNIPOTENT OPERATOR";
  if (score.value > 1200) return "DATA ARCHITECT";
  if (score.value > 600) return "CORE INFILTRATOR";
  return "RECRUIT HACKER";
});

// --- 3. 核心功能 ---
const speak = (txt) => {
  if (!txt) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
};

const startTimer = () => {
  clearInterval(timer);
  timeLeft.value = 100;
  timer = setInterval(() => {
    timeLeft.value -= 1.2; 
    if (timeLeft.value <= 0) handleChoice(null);
  }, 100);
};

const endGame = () => {
  isFinished.value = true;
  clearInterval(timer);
  emit('finish', { score: score.value, errors: errorLog.value, total: words.value.length });
};

const nextQuestion = () => {
  clearInterval(timer);
  if (currentIndex.value >= words.value.length) {
    endGame();
    return;
  }
  
  let opts = [currentWord.value.en];
  const otherWords = words.value.filter(w => w.en !== currentWord.value.en);
  while (opts.length < 4 && otherWords.length > 0) {
    let r = otherWords[Math.floor(Math.random() * otherWords.length)].en;
    if (!opts.includes(r)) opts.push(r);
  }
  options.value = opts.sort(() => Math.random() - 0.5);
  currentBtnState.value = null;
  startTimer();
};

const handleChoice = (choice, event = null) => {
  if (currentBtnState.value || isFinished.value) return; 
  clearInterval(timer);
  const correct = currentWord.value.en;
  const isCorrect = choice?.toLowerCase() === correct?.toLowerCase();

  if (isCorrect) {
    speak(correct);
    combo.value++;
    const added = 10 * combo.value;
    score.value += added;
    isComboActive.value = combo.value >= 2;
    
    if (event) {
      const id = Date.now();
      // 物理弹射逻辑：随机偏移与旋转
      const randomX = (Math.random() - 0.5) * 140; 
      const randomY = (Math.random() - 0.5) * 40;
      floatPoints.value.push({ 
        id, 
        x: event.clientX + randomX, 
        y: event.clientY + randomY, 
        text: `+${added}`,
        isHigh: combo.value >= 5,
        rotation: (Math.random() - 0.5) * 40 
      });
      setTimeout(() => { floatPoints.value = floatPoints.value.filter(p => p.id !== id); }, 1000);
    }
  } else {
    if (!errorLog.value.find(e => e.en === correct)) {
      errorLog.value.push({ en: correct, cn: currentWord.value.cn });
    }
    isShaking.value = true;
    setTimeout(() => isShaking.value = false, 300);
    speak("Access Denied");
    combo.value = 0;
    isComboActive.value = false;
  }

  currentBtnState.value = { word: choice, correct: isCorrect, answer: correct };
  setTimeout(() => {
    if (!isFinished.value) {
      currentIndex.value++;
      nextQuestion();
    }
  }, 1200);
};

const initGame = () => {
  clearInterval(timer);
  isFinished.value = false;
  currentIndex.value = 0;
  score.value = 0;
  combo.value = 0;
  errorLog.value = [];
  isComboActive.value = false;
  currentBtnState.value = null;
  if (props.wordList && props.wordList.length > 0) {
    words.value = [...props.wordList].sort(() => Math.random() - 0.5).slice(0, 20);
    nextQuestion();
  }
};

// --- 4. 生命周期 ---
watch(() => props.wordList, (newList) => {
  if (Array.isArray(newList) && newList.length > 0) {
    words.value = [...newList];
    initGame();
  } else {
    words.value = [];
    clearInterval(timer);
  }
}, { immediate: true, deep: true });

onMounted(initGame);
onUnmounted(() => { clearInterval(timer); window.speechSynthesis.cancel(); });
</script>

<template>
  <div class="hacker-viewport" :class="{ 'high-combo-glow': combo >= 5 }">
    <div class="cyber-grid"></div>

    <div v-if="words.length > 0" id="terminal" :class="{ 'error-shake': isShaking }">
      <div id="combo-overlay" :class="{ 'combo-active': isComboActive }">
        <p id="combo-rank">{{ comboRankName }}</p>
        <p id="combo-text">X{{ combo }}</p>
      </div>

      <div class="status-bar">
        <span>UNIT: <b>{{ (currentIndex + 1).toString().padStart(2, '0') }}</b>/{{ words.length }}</span>
        <span>COMBO: <b>{{ combo }}</b></span>
        <span>SEC_LEVEL: <b>{{ score }}</b></span>
      </div>

      <div id="timer-wrapper"><div id="timer-bar" :style="{ width: timeLeft + '%' }"></div></div>
      <div id="progress-wrapper"><div id="progress-fill" :style="{ width: (currentIndex / words.length) * 100 + '%' }"></div></div>

      <div id="sentence-display">{{ displaySentence }}</div>
      <div id="target-word">{{ currentWord.cn || 'SYNCING' }}</div>

      <div id="options-grid">
        <button v-for="opt in options" :key="opt" class="btn-opt"
          :disabled="currentBtnState !== null"
          :class="{ 'correct': currentBtnState?.answer === opt, 'wrong': currentBtnState?.word === opt && !currentBtnState?.correct }"
          @click="handleChoice(opt, $event)">
          {{ opt }}
        </button>
      </div>
    </div>

    <div v-else id="terminal" class="empty-system">
      <div class="status-bar">
        <span>STATUS: <b style="color: #ff9f43;">IDLE</b></span>
        <span>LINK: <b style="color: #576574;">NULL</b></span>
      </div>
      <div class="empty-content">
        <div class="glitch-icon">!</div>
        <h2 class="empty-title">NO DATA PACKETS</h2>
        <div class="terminal-loader">
          <p class="typing">> Initializing scan...</p>
          <p class="typing" style="color: #ff0055;">> Error: Eva老师，题库空了！</p>
          <p class="typing">> 💻 请注入新的补丁...</p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-for="p in floatPoints" :key="p.id" 
        class="float-pts-container" 
        :style="{ left: p.x + 'px', top: p.y + 'px', transform: `rotate(${p.rotation}deg)` }">
        <div class="pts-main" :class="{ 'gold-pts': p.isHigh }">
          {{ p.text }}
          <div class="pts-shine"></div>
        </div>
      </div>
    </Teleport>

    <div v-if="isFinished" id="overlay">
      <div class="result-card">
        <h1 class="neon-text-blue">MISSION COMPLETE</h1>
        <h2 id="rank-title">{{ rankTitle }}</h2>
        
        <div class="final-stats">
            <div class="stat-item">
                <span class="stat-label">TOTAL SCORE</span>
                <span class="stat-value">{{ score }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">ACCURACY</span>
                <span class="stat-value">{{ words.length ? Math.round(((words.length - errorLog.length) / words.length) * 100) : 0 }}%</span>
            </div>
        </div>
        
        <div v-if="errorLog.length > 0" id="error-box">
          <p class="error-warn">[!] 检测到损坏数据 (需加强记忆):</p>
          <div class="error-scroll-area">
            <table class="error-table">
                <tbody>
                  <tr v-for="err in errorLog" :key="err.en">
                    <td class="err-en">{{ err.en }}</td>
                    <td class="err-cn">{{ err.cn }}</td>
                  </tr>
                </tbody>
              </table>
          </div>
        </div>
        
        <button class="btn-restart" @click="initGame">REBOOT SYSTEM</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- 基础变量 --- */
.hacker-viewport {
  --bg-color: #020408; --panel-bg: #0d1117; --neon-blue: #00f2fe; --neon-purple: #7000ff; 
  --neon-red: #ff0055; --neon-green: #00ff88; --gold: #ffcc00;
  width: 100%; height: 100%; background: var(--bg-color); color: #e6edf3; font-family: 'Consolas', monospace; 
  display: flex; justify-content: center; align-items: center; overflow: hidden; position: relative;
}

/* --- 【爆炸加分特效】 --- */
.float-pts-container {
  position: fixed; pointer-events: none; z-index: 9999;
  animation: pts-spring-blast 0.9s cubic-bezier(0.15, 0.85, 0.35, 1.2) forwards;
}
.pts-main {
  font-family: 'Impact', 'Arial Black', sans-serif;
  font-size: 3.8rem; font-weight: 900; color: #fff;
  text-shadow: 0 0 15px var(--neon-green), 0 0 30px var(--neon-green), 0 0 50px rgba(0, 255, 136, 0.6);
  position: relative; overflow: hidden; padding: 0 15px;
}
.gold-pts {
  text-shadow: 0 0 20px var(--gold), 0 0 40px var(--gold), 0 0 70px rgba(255, 204, 0, 1);
}
.pts-shine {
  position: absolute; top: 0; left: -150%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
  animation: pts-shine-move 0.4s ease-out forwards;
}
@keyframes pts-spring-blast {
  0% { transform: translate(-50%, 0) scale(0) rotate(-30deg); opacity: 0; }
  25% { transform: translate(-50%, -100%) scale(1.7) rotate(15deg); opacity: 1; }
  100% { transform: translate(-50%, -280%) scale(0.8); opacity: 0; }
}
@keyframes pts-shine-move { 100% { left: 150%; } }

/* --- 结算页面全样式 --- */
#overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.95); z-index: 100; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(15px); }
.result-card { 
    width: 90%; height:83%;max-width: 500px; text-align: center; border: 2px solid var(--neon-blue); 
    padding: 35px; background: #0d1117; box-shadow: 0 0 80px rgba(0, 242, 254, 0.25);
}
.neon-text-blue { color: var(--neon-blue); text-shadow: 0 0 15px var(--neon-blue); font-size: 2rem; margin-bottom: 5px; }
#rank-title { color: #8b949e; font-size: 1rem; letter-spacing: 3px; margin-bottom: 30px; text-transform: uppercase; }
.final-stats { display: flex; justify-content: space-around; margin: 30px 0; background: rgba(255,255,255,0.03); padding: 25px; border-radius: 4px; border: 1px solid #30363d; }
.stat-label { font-size: 11px; color: #8b949e; letter-spacing: 1px; margin-bottom: 8px; display: block; }
.stat-value { font-size: 2.2rem; color: #fff; font-weight: bold; text-shadow: 0 0 15px rgba(255,255,255,0.2); }
#error-box { background: rgba(255, 0, 85, 0.1); border-left: 4px solid var(--neon-red); padding: 5px; text-align: left; }
.error-warn { color: var(--neon-red); font-size: 13px; font-weight: bold; margin-bottom: 12px; }
.error-scroll-area { max-height: 180px; overflow-y: auto; }
.error-table { width: 100%; border-collapse: collapse; }
.error-table td { padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.err-en { color: #fff; font-weight: bold; font-size: 1.1rem; }
.err-cn { color: #8b949e; text-align: right; }
.btn-restart { background: transparent; border: 1px solid var(--neon-blue); color: var(--neon-blue); padding: 5px 50px; font-weight: bold; cursor: pointer; margin-top: 30px; transition: 0.3s; letter-spacing: 2px; }
.btn-restart:hover { background: var(--neon-blue); color: #000; box-shadow: 0 0 30px var(--neon-blue); transform: translateY(-3px); }

/* --- 终端基础样式 --- */
#terminal { background: var(--panel-bg); border: 1px solid var(--neon-blue); width: 95%; max-width: 700px; padding: 25px; position: relative; z-index: 5; box-shadow: 0 0 30px rgba(0, 242, 254, 0.1); }
.cyber-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(0, 242, 254, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 242, 254, 0.05) 1px, transparent 1px); background-size: 40px 40px; transform: perspective(500px) rotateX(45deg); opacity: 0.5; }
.high-combo-glow { animation: bg-pulse-intense 2s infinite; }
@keyframes bg-pulse-intense { 0%, 100% { box-shadow: inset 0 0 100px rgba(112, 0, 255, 0.1); } 50% { box-shadow: inset 0 0 150px rgba(112, 0, 255, 0.25); } }

/* --- 连击文本 --- */
#combo-overlay { position: absolute; top: 10%; right: 5%; pointer-events: none; opacity: 0; text-align: center; }
.combo-active { opacity: 1 !important; animation: combo-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
#combo-text { font-size: 4.5rem; color: #ffcc00; text-shadow: 0 0 20px #ffcc00; font-weight: 900; font-style: italic; margin: 0; }
@keyframes combo-pop { 0% { transform: scale(0.5); } 100% { transform: scale(1); } }

/* --- 其它 UI 组件 --- */
.status-bar { display: flex; justify-content: space-between; font-size: 12px; color: var(--neon-blue); margin-bottom: 8px; }
#timer-wrapper { width: 100%; height: 3px; background: #161b22; margin-bottom: 15px; }
#timer-bar { height: 100%; background: var(--neon-red); transition: width 0.1s linear; }
#progress-wrapper { width: 100%; height: 6px; background: #161b22; margin-bottom: 25px; }
#progress-fill { height: 100%; background: linear-gradient(90deg, var(--neon-purple), var(--neon-blue)); }
#target-word { font-size: 3.5rem; text-align: center; margin-bottom: 30px; color: #fff; text-shadow: 0 0 15px var(--neon-blue); font-weight: bold; }
#options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.btn-opt { background: rgba(255, 255, 255, 0.03); border: 1px solid #30363d; padding: 18px; font-size: 1.4rem; color: #c9d1d9; cursor: pointer; font-family: inherit; transition: 0.2s; }
.btn-opt:hover:not(:disabled) { border-color: var(--neon-blue); background: rgba(0, 242, 254, 0.1); }
.btn-opt.correct { background: rgba(0, 255, 136, 0.15) !important; border-color: var(--neon-green) !important; color: var(--neon-green); }
.btn-opt.wrong { background: rgba(255, 0, 85, 0.15) !important; border-color: var(--neon-red) !important; color: var(--neon-red); }

/* --- 空状态 --- */
.empty-system { border: 1px dashed var(--neon-red) !important; background: rgba(255, 0, 85, 0.02) !important; }
.glitch-icon { font-size: 60px; color: var(--neon-red); animation: glitch 1.5s infinite; }
@keyframes glitch { 0%, 100% { transform: translate(0); } 30% { transform: translate(-4px, 2px); } 70% { transform: translate(4px, -2px); } }
.typing { font-size: 14px; color: var(--neon-green); border-right: 2px solid; width: 0; overflow: hidden; white-space: nowrap; animation: typing 1s steps(20) forwards; margin: 5px 0; }
@keyframes typing { from { width: 0; } to { width: 100%; } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
.error-shake { animation: shake 0.2s linear; }
</style>
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

// 1. 接收父组件传入的数据
const props = defineProps({
  wordList: {
    type: Array,
    default: () => []
  },
  goal: {
    type: Number,
    default: 20
  }
});

const emit = defineEmits(['finish', 'updateConfig']);

// --- 状态变量 ---
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
const currentBtnState = ref(null); // { word: '', correct: bool, answer: '' }
const floatPoints = ref([]);

let timer = null;
const comboRanks = ["GOOD!", "GREAT!", "EXCELLENT!", "UNSTOPPABLE!", "GODLIKE!"];

// --- 计算属性 ---
const currentWord = computed(() => words.value[currentIndex.value] || {});

const comboRankName = computed(() => {
  let rIdx = Math.min(Math.floor((combo.value - 2) / 2), comboRanks.length - 1);
  return comboRanks[rIdx];
});

const rankTitle = computed(() => {
  if (score.value > 2000) return "OMNIPOTENT OPERATOR (主宰者)";
  if (score.value > 1200) return "DATA ARCHITECT (架构师)";
  if (score.value > 600) return "CORE INFILTRATOR (渗透者)";
  return "RECRUIT HACKER (初级)";
});

// --- 语音合成 ---
const speak = (txt) => {
  if (!txt) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'en-US';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
};

const initGame = () => {
  // 1. 获取源数据：如果父组件没传，使用默认占位词
  const source = props.wordList && props.wordList.length > 0 
    ? props.wordList 
    : [{ en: "system", cn: "系统", s: "Initializing the _______." }];

  // 2. 洗牌并抽取前 20 个
  // .sort(() => Math.random() - 0.5) 负责乱序
  // .slice(0, 20) 负责只取前 20 个（如果不足 20 个会自动取全部）
  words.value = [...source]
    .sort(() => Math.random() - 0.5)
    .slice(0, 20);

  // 3. 重置所有状态
  currentIndex.value = 0;
  score.value = 0;
  combo.value = 0;
  isFinished.value = false;
  errorLog.value = [];
  
  // 4. 开始第一题
  nextQuestion();
};

// 只有在没开始游戏或者已经结束时，才因为 wordList 改变而重新初始化
watch(() => props.wordList, (newVal) => {
  if (newVal && newVal.length > 0 && (words.value.length === 0 || isFinished.value)) {
    initGame();
  }
}, { deep: true });

const nextQuestion = () => {
  if (currentIndex.value >= words.value.length) {
    endGame();
    return;
  }
  
  // 生成混淆选项
  let opts = [currentWord.value.en];
  // 尝试从当前词库找干扰项
  const otherWords = words.value.filter(w => w.en !== currentWord.value.en);
  while (opts.length < 4 && otherWords.length >= 3) {
    let r = otherWords[Math.floor(Math.random() * otherWords.length)].en;
    if (!opts.includes(r)) opts.push(r);
  }
  // 如果词库太小，补齐选项
  const fallbacks = ["loading...", "error", "access", "denied"];
  let fIdx = 0;
  while (opts.length < 4) {
    opts.push(fallbacks[fIdx++]);
  }

  options.value = opts.sort(() => Math.random() - 0.5);
  currentBtnState.value = null;
  startTimer();
};

const startTimer = () => {
  clearInterval(timer);
  timeLeft.value = 100;
  timer = setInterval(() => {
    timeLeft.value -= 1.2; // 难度系数：数值越大时间越短
    if (timeLeft.value <= 0) handleChoice(null);
  }, 100);
};

const handleChoice = (choice, event = null) => {
  if (currentBtnState.value) return; // 防止重复点击
  
  clearInterval(timer);
  const correct = currentWord.value.en;
  const isCorrect = choice === correct;

  if (isCorrect) {
    speak(correct);
    combo.value++;
    const added = 10 * combo.value;
    score.value += added;
    isComboActive.value = combo.value >= 2;
    
    if (event) {
      const id = Date.now();
      floatPoints.value.push({ id, x: event.clientX, y: event.clientY, text: `+${added}` });
      setTimeout(() => {
        floatPoints.value = floatPoints.value.filter(p => p.id !== id);
      }, 800);
    }
  } else {
    // 记录错题碎片
    if (!errorLog.value.find(e => e.en === correct)) {
      errorLog.value.push({ en: correct, cn: currentWord.value.cn });
    }
    isShaking.value = true;
    setTimeout(() => isShaking.value = false, 300);
    speak("Error.");
    combo.value = 0;
    isComboActive.value = false;
  }

  currentBtnState.value = { word: choice, correct: isCorrect, answer: correct };

  setTimeout(() => {
    currentIndex.value++;
    nextQuestion();
  }, 1200);
};

const endGame = () => {
  isFinished.value = true;
  clearInterval(timer);
  // 向父组件反馈游戏结果
  emit('finish', { 
    score: score.value, 
    errors: errorLog.value,
    total: words.value.length 
  });
};

onMounted(initGame);
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="hacker-viewport" :class="{ 'high-combo-glow': combo >= 5 }">
    <div class="cyber-grid"></div>

    <div id="terminal" :class="{ 'error-shake': isShaking }">
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

      <div id="sentence-display">
        {{ currentWord.s?.replace(currentWord.en, '_______') || 'SYSTEM SCANNING...' }}
      </div>
      <div id="target-word">{{ currentWord.cn || 'SYNCING' }}</div>

      <div id="options-grid">
        <button 
          v-for="opt in options" 
          :key="opt"
          class="btn-opt"
          :disabled="currentBtnState !== null"
          :class="{
            'correct': currentBtnState?.answer === opt,
            'wrong': currentBtnState?.word === opt && !currentBtnState?.correct
          }"
          @click="handleChoice(opt, $event)"
        >
          {{ opt }}
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div 
        v-for="p in floatPoints" 
        :key="p.id" 
        class="float-pts" 
        :style="{ left: p.x + 'px', top: (p.y - 50) + 'px' }"
      >
        {{ p.text }}
      </div>
    </Teleport>

    <div v-if="isFinished" id="overlay">
      <div class="result-card">
        <h1 class="neon-text-blue">INTRUSION COMPLETE</h1>
        <h2 id="rank-title">{{ rankTitle }}</h2>
        <div class="final-stats">
            <p>TOTAL DATA RECOVERED: {{ score }}</p>
            <p>ACCURACY: {{ Math.round(((words.length - errorLog.length) / words.length) * 100) }}%</p>
        </div>
        
        <div v-if="errorLog.length > 0" id="error-box">
          <p class="error-warn">[!] 检测到损坏数据 (已加入复习列表):</p>
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
        <button class="btn-restart" @click="initGame">重新加载系统</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hacker-viewport {
  --bg-color: #020408;
  --panel-bg: #0d1117;
  --neon-blue: #00f2fe;
  --neon-purple: #7000ff;
  --neon-red: #ff0055;
  --neon-green: #00ff88;
  
  width: 100%;
  height: 100%;
  background-color: var(--bg-color);
  color: #e6edf3;
  font-family: 'Consolas', monospace;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: relative;
}

.cyber-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(0, 242, 254, 0.05) 1px, transparent 1px), 
                    linear-gradient(90deg, rgba(0, 242, 254, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  transform: perspective(500px) rotateX(45deg);
  transform-origin: bottom;
  opacity: 0.5;
}

#terminal {
  background: var(--panel-bg);
  border: 1px solid var(--neon-blue);
  width: 95%;
  max-width: 700px;
  padding: 25px;
  box-shadow: 0 0 30px rgba(0, 242, 254, 0.1);
  position: relative;
  z-index: 5;
}

/* 进度与状态 */
.status-bar {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--neon-blue);
  margin-bottom: 8px;
  letter-spacing: 1px;
}

#timer-wrapper { width: 100%; height: 3px; background: #161b22; margin-bottom: 15px; }
#timer-bar { height: 100%; background: var(--neon-red); transition: width 0.1s linear; }

#progress-wrapper { width: 100%; height: 6px; background: #161b22; border: 1px solid #30363d; margin-bottom: 25px; }
#progress-fill { height: 100%; background: linear-gradient(90deg, var(--neon-purple), var(--neon-blue)); }

/* 文本展示 */
#sentence-display { min-height: 50px; font-size: 1.1rem; color: #8b949e; text-align: center; margin-bottom: 5px; line-height: 1.4; }
#target-word { font-size: 3rem; text-align: center; margin-bottom: 30px; color: #fff; text-shadow: 0 0 10px var(--neon-blue); font-weight: bold; }

/* 选项 */
#options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.btn-opt { 
  background: rgba(255, 255, 255, 0.03); 
  border: 1px solid #30363d; 
  padding: 15px; 
  font-size: 1.3rem; 
  color: #c9d1d9; 
  cursor: pointer; 
  transition: all 0.2s;
  font-family: inherit;
}
.btn-opt:hover:not(:disabled) { border-color: var(--neon-blue); background: rgba(0, 242, 254, 0.1); }
.btn-opt.correct { background: rgba(0, 255, 136, 0.15) !important; border-color: var(--neon-green) !important; color: var(--neon-green); }
.btn-opt.wrong { background: rgba(255, 0, 85, 0.15) !important; border-color: var(--neon-red) !important; color: var(--neon-red); }

/* 连击 */
#combo-overlay { position: absolute; top: 10%; right: 5%; pointer-events: none; text-align: center; opacity: 0; }
.combo-active { opacity: 1 !important; animation: combo-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
#combo-text { font-size: 4rem; color: #ffcc00; text-shadow: 0 0 15px #ffcc00; margin: 0; font-weight: 900; }
#combo-rank { font-size: 1rem; color: var(--neon-blue); margin-top: -5px; }

@keyframes combo-pop {
  0% { transform: scale(0.5) rotate(-10deg); }
  100% { transform: scale(1) rotate(5deg); }
}

/* 结算 */
#overlay {
  position: absolute; inset: 0;
  background: rgba(2, 4, 8, 0.95);
  z-index: 100;
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(5px);
}
.result-card { width: 85%; text-align: center; }
.neon-text-blue { color: var(--neon-blue); text-shadow: 0 0 10px var(--neon-blue); margin-bottom: 5px; }
.final-stats { margin: 20px 0; color: #8b949e; font-size: 1.1rem; }
#error-box { background: rgba(255, 0, 85, 0.05); border: 1px solid rgba(255, 0, 85, 0.2); padding: 15px; border-radius: 10px; }
.error-scroll-area { max-height: 150px; overflow-y: auto; margin-top: 10px; }
.error-table { width: 100%; font-size: 0.9rem; }
.err-en { color: var(--neon-red); font-weight: bold; width: 40%; text-align: right; padding-right: 15px; }
.err-cn { color: #8b949e; text-align: left; }

.btn-restart { 
  background: var(--neon-blue); color: #000; padding: 12px 30px; 
  border: none; font-weight: bold; cursor: pointer; margin-top: 25px; border-radius: 5px;
}

.float-pts { position: fixed; color: var(--neon-green); font-weight: bold; font-size: 1.5rem; pointer-events: none; z-index: 2000; animation: float-up 0.8s ease-out forwards; }
@keyframes float-up { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-60px); opacity: 0; } }

.error-shake { animation: shake 0.2s linear; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
</style>
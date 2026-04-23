<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  wordList: { type: Array, default: () => [] },
  goal: { type: Number, default: 10 },
  canEdit: Boolean
});

const emit = defineEmits(['finish', 'updateConfig']);

// --- 游戏状态 ---
const gameWords = ref([]);
const currentIndex = ref(0);
const p1Hp = ref(100);
const p2Hp = ref(100);
const combo = ref(0);
const isFinished = ref(false);
const options = ref([]);
const errorLog = ref([]);

// --- 单词答错计数器 ---
const wrongCountMap = ref({}); 

// --- 视觉动画状态 ---
const p1State = ref('idle'); 
const p2State = ref('idle');
const isShaking = ref(false);
const showHitSparks = ref(false);

const currentWord = computed(() => gameWords.value[currentIndex.value] || {});

// --- 句子挖空处理 (适配字段 s) ---
const clozeSentence = computed(() => {
  const sentence = currentWord.value.s; 
  if (!sentence) return "No context available.";
  const word = currentWord.value.en;
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  return sentence.replace(regex, ' ______ ');
});

// --- 游戏流程 ---
const initGame = () => {
  currentIndex.value = 0;
  p1Hp.value = 100;
  p2Hp.value = 100;
  combo.value = 0;
  isFinished.value = false;
  errorLog.value = [];
  wrongCountMap.value = {}; // 重置错误计数
  
  gameWords.value = [...props.wordList]
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);
    
  loadQuestion();
};

const loadQuestion = () => {
  // 检查是否全过完单词，或者 Boss 已经倒下
  if (currentIndex.value >= gameWords.value.length || p2Hp.value <= 0 || p1Hp.value <= 0) {
    isFinished.value = true;
    return;
  }

  let choices = [currentWord.value.cn];
  const pool = props.wordList.filter(w => w.cn !== currentWord.value.cn);
  
  while (choices.length < 4 && pool.length > 0) {
    const randomCn = pool[Math.floor(Math.random() * pool.length)].cn;
    if (!choices.includes(randomCn)) choices.push(randomCn);
  }
  options.value = choices.sort(() => Math.random() - 0.5);
};

const handleAnswer = (answer) => {
  if (p1State.value !== 'idle' || isFinished.value) return;

  const isCorrect = answer === currentWord.value.cn;

  if (isCorrect) {
    p1State.value = 'attack';
    showHitSparks.value = true; 
    setTimeout(() => {
      p2State.value = 'hit';
      p2Hp.value = Math.max(0, p2Hp.value - 10);
      combo.value++;
      isShaking.value = true;
      setTimeout(() => isShaking.value = false, 150);
      setTimeout(() => showHitSparks.value = false, 300);
    }, 150);

    const utter = new SpeechSynthesisUtterance(currentWord.value.en);
    utter.lang = 'en-US';
    window.speechSynthesis.speak(utter);

    setTimeout(() => {
      p1State.value = 'idle';
      p2State.value = 'idle';
      currentIndex.value++;
      loadQuestion();
    }, 700);
  } else {
    // 答错逻辑
    p2State.value = 'attack';
    setTimeout(() => {
      p1State.value = 'hit';
      p1Hp.value = Math.max(0, p1Hp.value - 20); // 玩家掉血
      combo.value = 0;
      
      // 记录错词
      if (!errorLog.value.find(x => x.en === currentWord.value.en)) {
        errorLog.value.push(currentWord.value);
      }

      // 单词重试逻辑：单词错3次自动跳过
      const wordEn = currentWord.value.en;
      wrongCountMap.value[wordEn] = (wrongCountMap.value[wordEn] || 0) + 1;

      if (p1Hp.value <= 0) {
        // 玩家被打死了，延迟一下进入结算
        setTimeout(() => { isFinished.value = true; }, 500);
      } else if (wrongCountMap.value[wordEn] >= 3) {
        // 错满3次，虽然没死，但强制换下一题
        setTimeout(() => {
          currentIndex.value++;
          loadQuestion();
        }, 800);
      }
    }, 150);

    setTimeout(() => {
      p1State.value = 'idle';
      p2State.value = 'idle';
    }, 700);
  }
};

onMounted(initGame);
</script>

<template>
  <div class="kof-stage-improved" :class="{ 'screen-shake': isShaking }">
    <div class="scanlines"></div>

    <header class="tactical-hud">
      <div class="health-block p1-block">
        <div class="char-id">P1 // PLAYER</div>
        <div class="hp-track" :class="{ 'low-hp': p1Hp <= 20 }">
          <div class="hp-drain hp-fill" :style="{ width: p1Hp + '%' }"></div>
          <div class="hp-main hp-fill" :style="{ width: p1Hp + '%' }"></div>
        </div>
      </div>
      
      <div class="ko-badge-improved">
        <div class="ko-text">K.O</div>
      </div>

      <div class="health-block p2-block">
        <div class="char-id">// BOSS</div>
        <div class="hp-track enemy-side">
          <div class="hp-drain hp-fill boss-fill" :style="{ width: p2Hp + '%' }"></div>
          <div class="hp-main hp-fill boss-fill" :style="{ width: p2Hp + '%' }"></div>
        </div>
      </div>
    </header>

    <section class="battle-arena">
      <div class="character p1-char" :class="p1State">
        🥋
        <div v-if="combo > 1" class="combo-pop">{{ combo }} Hits!</div>
      </div>
      <div v-if="showHitSparks" class="hit-sparks-fx">💥</div>
      <div class="character p2-char" :class="p2State">👹</div>
    </section>

    <footer class="interaction-hud">
      <div class="question-monitor">
        <div class="question-header">
          <div class="label-box">TARGET WORD</div>
          <h1 class="target-word-glow">{{ currentWord.en }}</h1>
          <div v-if="wrongCountMap[currentWord.en] > 0" class="wrong-warning">
            Mistakes: {{ wrongCountMap[currentWord.en] }} / 3
          </div>
        </div>
        <div class="sentence-display">
          <p class="sentence-cloze">" {{ clozeSentence }} "</p>
        </div>
      </div>

      <div class="options-grid">
        <button v-for="opt in options" :key="opt" class="kof-btn-improved" @click="handleAnswer(opt)">
          <span class="btn-skew-box">{{ opt }}</span>
        </button>
      </div>
    </footer>

    <Transition name="kof-zoom">
      <div v-if="isFinished" class="tactical-settlement">
        <div class="result-board-improved">
          <h2 class="result-title" :class="{ 'game-over': p1Hp <= 0 }">
            {{ p1Hp <= 0 ? 'GAME OVER' : 'MISSION CLEAR' }}
          </h2>
          <div class="medal-rank" :class="{'s-rank-improved': errorLog.length === 0 && p1Hp > 0}">
            {{ p1Hp <= 0 ? 'F' : (errorLog.length === 0 ? 'S' : errorLog.length < 3 ? 'A' : 'B') }}
          </div>
          <div class="final-score">
            Accuracy: {{ (10 - errorLog.length) * 10 }}%
          </div>
          <div v-if="errorLog.length > 0" class="error-intel">
            <p>Need Review:</p>
            <div class="intel-chips">
              <span v-for="w in errorLog" :key="w.en">{{ w.en }}</span>
            </div>
          </div>
          <button class="action-btn-improved" @click="initGame">RETRY</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 引入 Black Ops One 字体增加格斗感 (如果无法加载，会使用兜底 system-ui) */
@import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap');

.kof-stage-improved {
  width: 100%; height: 100%; 
  /* 径向渐变背景增加舞台感 */
  background: radial-gradient(circle at center, #1e2a6c 0%, #000 100%);
  color: #fff;
  display: flex; flex-direction: column; position: relative; overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* 霓虹发光配色常量 */
.kof-stage-improved {
  --neon-green: #00ff88;
  --neon-red: #ff3300;
  --neon-gold: #f1c40f;
  --neon-blue: #00ccff;
}

/* 扫描线效果 */
.scanlines {
  position: absolute; inset: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%),
              linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
  background-size: 100% 3px, 3px 100%;
  pointer-events: none;
  z-index: 100; opacity: 0.6;
}

/* 顶部血条 HUD (重磅升级) */
.tactical-hud { display: flex; justify-content: space-between; padding: 25px 50px; align-items: flex-start; position: relative; z-index: 10; }

.health-block { display: flex; flex-direction: column; gap: 5px; }
.char-id { font-size: 10px; color: #666; font-family: monospace; letter-spacing: 1px; }

/* 几何切割血条轨道 */
.hp-track { 
  width: 280px; height: 22px; 
  background: #111; border: 2px solid #fff; 
  clip-path: polygon(0 0, 100% 0, 95% 100%, 0% 100%);
  position: relative; overflow: hidden;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
}
.enemy-side { clip-path: polygon(5% 0, 100% 0, 100% 100%, 0% 100%); }

.hp-fill { position: absolute; height: 100%; top: 0; transition: width 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28); }

/* 红实血层 */
.hp-main { background: linear-gradient(180deg, #2ecc71 0%, #27ae60 100%); z-index: 3; }
/* 白血缓冲层 */
.hp-drain { background: #fff; z-index: 2; transition: width 1s cubic-bezier(0.55, 0.05, 0.675, 0.19); } /* 缓冲更久 */

.boss-fill.hp-main { background: linear-gradient(180deg, #e74c3c 0%, #c0392b 100%); right: 0; }
.boss-fill.hp-drain { background: #fff; right: 0; }

/* 血条末端发光效果 */
.hp-glow {
  position: absolute; top: 0; right: 0; width: 20px; height: 100%;
  background: radial-gradient(circle, rgba(46, 204, 113, 0.8) 0%, transparent 70%);
  z-index: 4; animation: hp-pulse 1s infinite alternate;
}
.boss-glow { background: radial-gradient(circle, rgba(231, 76, 60, 0.8) 0%, transparent 70%); left: 0; }

@keyframes hp-pulse { from { opacity: 0.5; } to { opacity: 1; } }

/* KO 核心计时器 (霓虹化) */
.ko-badge-improved {
  position: relative; width: 80px; height: 80px;
  background: #000; border: 4px solid var(--neon-gold);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 20px rgba(241, 196, 15, 0.5);
  animation: ko-glow-anim 2s infinite alternate;
}

.ko-text { font-size: 36px; color: var(--neon-gold); font-weight: 900; font-style: italic; text-shadow: 0 0 15px var(--neon-gold); }
.ko-glow { position: absolute; inset: 0; background: radial-gradient(circle, var(--neon-gold) 0%, transparent 70%); opacity: 0.3; animation: flicker 1s infinite; }

@keyframes ko-glow-anim { from { border-color: #ffcc00; box-shadow: 0 0 10px #ffcc0055; } to { border-color: #fff; box-shadow: 0 0 25px var(--neon-gold); } }
@keyframes flicker { 0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 0.3; } 20%, 24%, 55% { opacity: 0.1; } }

/* 竞技舞台 */
.battle-arena { flex: 1; display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: 20px; position: relative; }
/* 舞台地面 */
.stage-floor { position: absolute; bottom: -10px; width: 80%; height: 50px; background: rgba(255,255,255,0.05); clip-path: polygon(0 20%, 100% 20%, 90% 100%, 10% 100%); filter: blur(2px); }
/* 竞技场地面光圈 */
.arena-glow { position: absolute; bottom: -30px; width: 60%; height: 100px; background: radial-gradient(ellipse, rgba(0, 204, 255, 0.2) 0%, transparent 70%); }

.character { font-size: 100px; filter: drop-shadow(0 15px 15px rgba(0,0,0,0.6)); transition: transform 0.15s ease-out; position: relative; }
.p1-char.attack { transform: translateX(120px) scale(1.1) rotate(5deg); }
.p2-char.attack { transform: translateX(-120px) scale(1.1) rotate(-5deg); }
.hit { animation: p2-hit-blink 0.1s infinite; }

@keyframes p2-hit-blink { 0% { opacity: 1; filter: brightness(2) contrast(1.5); } 100% { opacity: 0.6; filter: brightness(1); } }

/* 粒子火星特效 */
.hit-sparks-fx { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); font-size: 140px; filter: hue-rotate(45deg); animation: spark-explode 0.3s forwards; pointer-events: none; }
@keyframes spark-explode { from { transform: translate(-50%, -50%) scale(0.3); opacity: 1; } to { transform: translate(-50%, -50%) scale(1.5) rotate(180deg); opacity: 0; } }

/* 连击提示 (更醒目) */
.combo-pop { 
  position: absolute; top: -50px; left: 50%; transform: translateX(-50%) rotate(-10deg);
  font-size: 32px; color: var(--neon-gold); font-weight: 900; 
  text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 15px var(--neon-red);
  animation: combo-in 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
}
.combo-suffix { font-size: 16px; color: var(--neon-red); }
@keyframes combo-in { from { transform: translateX(-50%) scale(0); opacity: 0; } to { transform: translateX(-50%) scale(1) rotate(-10deg); opacity: 1; } }

/* 题目交互区 (霓虹化) */
.interaction-hud { background: rgba(0,0,0,0.92); border-top: 3px solid var(--neon-blue); padding: 15px 30px 25px; box-shadow: 0 -10px 30px rgba(0, 204, 255, 0.1); }

.question-monitor { text-align: center; margin-bottom: 15px; }
.question-header { margin-bottom: 15px; position: relative; display: inline-block; }
.label-box { font-size: 10px; color: #555; letter-spacing: 2px; text-transform: uppercase; position: relative; }
.scanner-line { position: absolute; width: 100%; height: 1px; background: rgba(0, 204, 255, 0.3); top: -5px; left: 0; animation: scan 1.5s infinite; }
@keyframes scan { 0% { top: -5px; } 100% { top: 15px; } }

/* 目标单词霓虹光 */
.target-word-glow { 
  font-size: 40px; font-weight: 800; margin: 0; 
  color: #fff; text-shadow: 0 0 10px var(--neon-blue), 0 0 20px #fff, 0 0 30px var(--neon-blue);
}

.sentence-display { 
  background: rgba(255,255,255,0.03); padding: 12px; border-radius: 6px; 
  min-height: 55px; display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.05);
}
.sentence-cloze { font-size: 18px; color: var(--neon-gold); font-style: italic; }

/* 选项按钮 (街机感) */
.options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 750px; margin: 0 auto; }
.kof-btn-improved { 
  background: linear-gradient(180deg, #1a1a1a 0%, #000 100%); 
  border: 1px solid #444; color: #fff; padding: 16px; 
  cursor: pointer; transform: skewX(-10deg); transition: 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28); font-size: 18px;
}
.kof-btn-improved:hover { background: var(--neon-gold); color: #000; border-color: #fff; transform: skewX(-10deg) translateY(-2px); box-shadow: 0 5px 15px rgba(241, 196, 15, 0.4); }
.btn-skew-box { transform: skewX(10deg); display: inline-block; font-weight: 600; }

/* 结算屏 (硬核战报感) */
.tactical-settlement { position: absolute; inset: 0; background: rgba(0,0,0,0.96); display: flex; align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(5px); }
.result-board-improved { background: #000; border: 4px solid var(--neon-gold); padding: 40px; width: 340px; text-align: center; border-radius: 2px; box-shadow: 0 0 50px rgba(241, 196, 15, 0.4); }
.result-title { font-size: 30px; color: var(--neon-gold); font-weight: 900; letter-spacing: 2px; text-shadow: 0 0 10px var(--neon-gold); margin-bottom: 20px; }
.medal-rank { font-size: 100px; font-weight: 900; color: #fff; line-height: 1; margin: 25px 0; }
.s-rank-improved { color: var(--neon-gold); text-shadow: 0 0 30px var(--neon-gold), 0 0 60px #fff; animation: s-medal-pulse 1s infinite cubic-bezier(0.18, 0.89, 0.32, 1.28); }

@keyframes s-medal-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); filter: brightness(1.2); } }

.miss-tags { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 10px; }
.miss-tags span { background: #333; padding: 2px 8px; font-size: 11px; font-family: monospace; }
.action-btn-improved { margin-top: 30px; width: 100%; padding: 14px; background: var(--neon-gold); border: none; font-weight: 900; cursor: pointer; letter-spacing: 1px; font-size: 16px; }
.action-btn-improved:hover { background: #fff; color: #000; }

/* 全局屏幕震动 */
.screen-shake { animation: HARD-SHAKE 0.18s linear; }
@keyframes HARD-SHAKE { 0%,100% { transform: translate(0,0) scale(1); } 25% { transform: translate(8px,8px) scale(1.02); } 75% { transform: translate(-8px,-8px) scale(0.98); } }

/* 结算zoom */
.kof-zoom-enter-active { animation: zoom-in-kof 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
@keyframes zoom-in-kof { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
.low-hp { border-color: #ff3300 !important; animation: low-hp-flash 0.5s infinite alternate; }
@keyframes low-hp-flash { from { box-shadow: 0 0 5px transparent; } to { box-shadow: 0 0 15px #ff3300; } }

.wrong-warning { font-size: 12px; color: #ff3300; font-weight: bold; margin-top: 5px; }
.game-over { color: #ff3300 !important; text-shadow: 0 0 10px #ff3300 !important; }

/* 之前的 CSS 样式... (为节省篇幅未重复粘贴，请沿用上一版即可) */
@import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap');
.kof-stage-improved { width: 100%; height: 100%; background: radial-gradient(circle at center, #1e2a6c 0%, #000 100%); color: #fff; display: flex; flex-direction: column; position: relative; overflow: hidden; }
.scanlines { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%); background-size: 100% 3px; pointer-events: none; z-index: 100; opacity: 0.6; }
.tactical-hud { display: flex; justify-content: space-between; padding: 25px 50px; align-items: flex-start; position: relative; z-index: 10; }
.hp-track { width: 280px; height: 22px; background: #111; border: 2px solid #fff; clip-path: polygon(0 0, 100% 0, 95% 100%, 0% 100%); position: relative; overflow: hidden; }
.enemy-side { clip-path: polygon(5% 0, 100% 0, 100% 100%, 0% 100%); }
.hp-fill { position: absolute; height: 100%; top: 0; transition: width 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
.hp-main { background: linear-gradient(180deg, #2ecc71 0%, #27ae60 100%); z-index: 3; }
.hp-drain { background: #fff; z-index: 2; transition: width 1s cubic-bezier(0.55, 0.05, 0.675, 0.19); }
.boss-fill.hp-main { background: linear-gradient(180deg, #e74c3c 0%, #c0392b 100%); right: 0; }
.boss-fill.hp-drain { background: #fff; right: 0; }
.ko-badge-improved { position: relative; width: 80px; height: 80px; background: #000; border: 4px solid #f1c40f; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); display: flex; align-items: center; justify-content: center; }
.ko-text { font-size: 36px; color: #f1c40f; font-weight: 900; }
.battle-arena { flex: 1; display: flex; justify-content: space-around; align-items: flex-end; padding-bottom: 20px; position: relative; }
.character { font-size: 100px; transition: transform 0.15s ease-out; }
.p1-char.attack { transform: translateX(120px) scale(1.1); }
.p2-char.attack { transform: translateX(-120px) scale(1.1); }
.hit { animation: flash 0.1s infinite; }
@keyframes flash { from { opacity: 1; filter: brightness(2); } to { opacity: 0.5; } }
.interaction-hud { background: rgba(0,0,0,0.92); border-top: 3px solid #00ccff; padding: 15px 30px 25px; }
.target-word-glow { font-size: 40px; text-shadow: 0 0 10px #00ccff; }
.sentence-cloze { font-size: 18px; color: #f1c40f; font-style: italic; }
.options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 750px; margin: 0 auto; }
.kof-btn-improved { background: #1a1a1a; border: 1px solid #444; color: #fff; padding: 16px; transform: skewX(-10deg); cursor: pointer; }
.kof-btn-improved:hover { background: #f1c40f; color: #000; }
.btn-skew-box { transform: skewX(10deg); display: inline-block; }
.tactical-settlement { position: absolute; inset: 0; background: rgba(0,0,0,0.96); display: flex; align-items: center; justify-content: center; z-index: 200; }
.result-board-improved { background: #000; border: 4px solid #f1c40f; padding: 40px; width: 340px; text-align: center; }
.medal-rank { font-size: 100px; font-weight: 900; color: #fff; }
.s-rank-improved { color: #f1c40f; text-shadow: 0 0 20px #f1c40f; }
.intel-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.intel-chips span { background: #333; padding: 2px 8px; font-size: 11px; }
.action-btn-improved { margin-top: 30px; width: 100%; padding: 14px; background: #f1c40f; border: none; font-weight: 900; cursor: pointer; }
.screen-shake { animation: shake 0.2s linear; }
@keyframes shake { 0%,100% { transform: translate(0,0); } 25% { transform: translate(5px,5px); } 75% { transform: translate(-5px,-5px); } }
</style>
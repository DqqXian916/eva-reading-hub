<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  wordList: { type: Array, default: () => [] },
  goal: { type: Number, default: 20 },
  canEdit: Boolean
});

const emit = defineEmits(['finish', 'updateConfig']);

// --- 状态管理 ---
const words = ref([]);
const currentIndex = ref(0);
const score = ref(0);
const combo = ref(0);
const timeLeft = ref(100);
const isFinished = ref(false);
const options = ref([]);
const errorLog = ref([]);
const isShaking = ref(false);
const isDamageActive = ref(false); 
const currentBtnState = ref(null);
const isFlashing = ref(false);

const muzzleFlashes = ref([]);
const bulletHoles = ref([]);

let timer = null;

const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    if (type === 'shot') {
        // --- 1. 冲击波瞬态 (The "Explosion") ---
        // 增加失真感，模拟大口径火炮
        const distortion = ctx.createWaveShaper();
        function makeDistortionCurve(amount) {
            let k = typeof amount === 'number' ? amount : 50,
                n_samples = 44100,
                curve = new Float32Array(n_samples),
                deg = Math.PI / 180, i = 0, x;
            for ( ; i < n_samples; ++i ) {
                x = i * 2 / n_samples - 1;
                curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
            }
            return curve;
        };
        distortion.curve = makeDistortionCurve(400);

        // --- 2. 核心火药层 (Brown Noise + Highpass) ---
        const fireBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const fireData = fireBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < fireData.length; i++) {
            let white = Math.random() * 2 - 1;
            fireData[i] = (lastOut + (0.02 * white)) / 1.02; // Brown noise 算法
            lastOut = fireData[i];
            // 在开头 0.01s 加入过载冲击
            if(i < 500) fireData[i] *= (10 + Math.random() * 10); 
        }
        
        const fireSource = ctx.createBufferSource();
        fireSource.buffer = fireBuffer;
        
        const fireFilter = ctx.createBiquadFilter();
        fireFilter.type = 'lowpass';
        fireFilter.frequency.setValueAtTime(1200, now); // 宽频响保证冲击力
        fireFilter.Q.setValueAtTime(10, now); // 增加共振感

        const fireGain = ctx.createGain();
        fireGain.gain.setValueAtTime(0, now);
        fireGain.gain.linearRampToValueAtTime(2.0, now + 0.005); // 瞬间推到最大音量
        fireGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        fireSource.connect(distortion);
        distortion.connect(fireFilter);
        fireFilter.connect(fireGain);
        fireGain.connect(ctx.destination);

        // --- 3. 震耳欲聋的低音炮 (The "Sub-Thump") ---
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine'; // 纯净低频
        subOsc.frequency.setValueAtTime(250, now);
        subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.15); // 极速下潜

        subGain.gain.setValueAtTime(1.0, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        subOsc.connect(subGain);
        subGain.connect(ctx.destination);

        // 触发
        fireSource.start(now);
        subOsc.start(now);
        subOsc.stop(now + 0.3);

    } else if (type === 'hit') {
        // 命中声改为更有质感的重金属撞击
        const hOsc = ctx.createOscillator();
        const hG = ctx.createGain();
        hOsc.type = 'triangle';
        hOsc.frequency.setValueAtTime(300, now);
        hOsc.frequency.linearRampToValueAtTime(50, now + 0.1);
        hG.gain.setValueAtTime(0.4, now);
        hG.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        hOsc.connect(hG);
        hG.connect(ctx.destination);
        hOsc.start(now);
        hOsc.stop(now + 0.15);
    }
  } catch(e) {}
};
// --- 核心逻辑 ---
const currentWord = computed(() => words.value[currentIndex.value] || {});

const getRankInfo = () => {
  const acc = (words.value.length - errorLog.value.length) / words.value.length;
  if (acc >= 0.95) return { rank: 'S', class: 'rank-s' };
  if (acc >= 0.8) return { rank: 'A', class: 'rank-a' };
  if (acc >= 0.6) return { rank: 'B', class: 'rank-b' };
  return { rank: 'C', class: 'rank-c' };
};

const comboRank = computed(() => {
  const ranks = ["ROOKIE", "ELITE", "VETERAN", "MASTER", "LEGEND", "ACE"];
  return ranks[Math.min(Math.floor(combo.value / 3), ranks.length - 1)] || "RECRUIT";
});

const speak = (txt) => {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'en-US';
  u.rate = 1.0;
  window.speechSynthesis.speak(u);
};

const nextQuestion = () => {
  if (currentIndex.value >= words.value.length) {
    isFinished.value = true;
    clearInterval(timer);
    return;
  }
  let opts = [currentWord.value.cn];
  const others = words.value.filter(w => w.cn !== currentWord.value.cn);
  while (opts.length < 4 && others.length > 0) {
    let r = others[Math.floor(Math.random() * others.length)].cn;
    if (!opts.includes(r)) opts.push(r);
  }
  options.value = opts.sort(() => Math.random() - 0.5);
  currentBtnState.value = null;
  timeLeft.value = 100;
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft.value -= 2.0; 
    if (timeLeft.value <= 0) handleChoice(null);
  }, 100);
};

const handleChoice = (choice, event = null) => {
  if (currentBtnState.value || isFinished.value) return;
  isFlashing.value = true;
  setTimeout(() => isFlashing.value = false, 100); // 100毫秒后关闭，形成闪烁感
  const isCorrect = choice === currentWord.value.cn;
  // 播放合成后的“PENG”音效
  playSound('shot');
  if (isCorrect) setTimeout(() => playSound('hit'), 30);

  if (event) {
    const id = Date.now();
    muzzleFlashes.value.push({ id, x: event.clientX, y: event.clientY });
    bulletHoles.value.push({ id, x: event.clientX, y: event.clientY, rotate: Math.random()*360 });
    // 快速清理特效，保持流畅
    setTimeout(() => muzzleFlashes.value = muzzleFlashes.value.filter(f => f.id !== id), 90);
  }

  if (isCorrect) {
    speak(currentWord.value.en);
    combo.value++;
    score.value += (10 + combo.value * 5);
  } else {
    isShaking.value = true;
    isDamageActive.value = true;
    setTimeout(() => { isShaking.value = false; isDamageActive.value = false; }, 300);
    combo.value = 0;
    if (currentWord.value.en && !errorLog.value.find(e => e.en === currentWord.value.en)) {
      errorLog.value.push({ en: currentWord.value.en, cn: currentWord.value.cn });
    }
  }

  currentBtnState.value = { word: choice, correct: isCorrect, answer: currentWord.value.cn };
  clearInterval(timer);
  setTimeout(() => { if (!isFinished.value) { currentIndex.value++; nextQuestion(); } }, 600);
};

const initGame = () => {
  isFinished.value = false; currentIndex.value = 0; score.value = 0; combo.value = 0; errorLog.value = [];
  if (props.wordList?.length > 0) {
    words.value = [...props.wordList].sort(() => Math.random() - 0.5).slice(0, 20);
    nextQuestion();
  }
};

const updateCursor = (e) => {
  const ch = document.getElementById('cf-crosshair');
  if (ch) { ch.style.left = `${e.clientX}px`; ch.style.top = `${e.clientY}px`; }
};

onMounted(() => { initGame(); window.addEventListener('mousemove', updateCursor); });
onUnmounted(() => { clearInterval(timer); window.removeEventListener('mousemove', updateCursor); });
</script>

<template>
  <div class="war-viewport" :class="{ 'shake': isShaking, 'damage-fx': isDamageActive , 'flash-white': isFlashing}">
    <div class="metal-texture"></div>
    
    <div id="cf-crosshair" class="crosshair">
      <div class="dot"></div>
      <div class="aim-h"></div><div class="aim-v"></div>
    </div>

    <div v-for="f in muzzleFlashes" :key="f.id" class="flash-wrapper" :style="{ left: f.x + 'px', top: f.y + 'px' }">
        <div class="muzzle-fire-irregular"></div>
        <div class="sparks-fx">
            <div class="spark s1"></div><div class="spark s2"></div>
            <div class="spark s3"></div><div class="spark s4"></div>
        </div>
        <div class="muzzle-glow-soft"></div>
    </div>
    
    <div v-for="b in bulletHoles" :key="b.id" class="hole-fx" :style="{ left: b.x + 'px', top: b.y + 'px', transform: `rotate(${b.rotate}deg)` }"></div>

    <div class="hud-bar">
      <div class="hud-section">
        <div class="tag">RANK</div>
        <div class="val rank-text">{{ comboRank }}</div>
      </div>
      <div class="hud-section center">
        <div class="tag">SYNC_PROGRESS</div>
        <div class="hp-track"><div class="hp-fill" :style="{ width: timeLeft + '%' }"></div></div>
      </div>
      <div class="hud-section end">
        <div class="tag">GP_SCORE</div>
        <div class="val gold">{{ score }}</div>
      </div>
    </div>

    <div class="battle-main">
      <div class="word-monitor">
        <div class="scanner-line"></div>
        <div class="corner-frame t-l"></div><div class="corner-frame b-r"></div>
        <div class="target-label">IDENTIFIED_TARGET:</div>
        <h1 class="target-text">{{ currentWord.en ? currentWord.en.toLowerCase() : 'searching' }}</h1>
        <div class="combo-tag" v-if="combo > 0">
          <span class="num">{{ combo }}</span> <span class="txt">KILLS</span>
        </div>
      </div>

      <div class="options-container">
        <div v-for="opt in options" :key="opt" 
             class="war-btn" 
             :class="{ 'hit': currentBtnState?.answer === opt && currentBtnState?.correct, 
                       'miss': currentBtnState?.word === opt && !currentBtnState?.correct,
                       'dim': currentBtnState && currentBtnState.answer !== opt }"
             @click="handleChoice(opt, $event)">
          <div class="btn-skew-box">
             <span class="btn-text">{{ opt }}</span>
          </div>
          <div class="btn-glow"></div>
        </div>
      </div>
    </div>

<Transition name="zoom">
      <div v-if="isFinished" class="tactical-results">
        <div class="modal-scanline"></div>
        <div class="results-header">
           <div class="title-main">COMBAT EVALUATION</div>
           <div class="title-sub">MISSION TERMINATED // 2026-MISSION-01</div>
        </div>

        <div class="results-body">
           <div class="rank-container">
              <div class="rank-letter" :class="getRankInfo().class">{{ getRankInfo().rank }}</div>
              <div class="rank-label">OPERATOR STATUS</div>
           </div>

           <div class="stats-panel">
              <div class="stat-row">
                 <span class="s-label">TOTAL SCORE</span>
                 <span class="s-value gold">{{ score }}</span>
              </div>
              <div class="stat-row">
                 <span class="s-label">ACCURACY</span>
                 <span class="s-value">{{ Math.round(((words.length-errorLog.length)/words.length)*100) }}%</span>
              </div>
              <div class="stat-row">
                 <span class="s-label">NEUTRALIZED</span>
                 <span class="s-value">{{ words.length - errorLog.length }} / {{ words.length }}</span>
              </div>
           </div>
        </div>

        <div v-if="errorLog.length" class="intel-report">
           <div class="report-tag">FAILED INTELLIGENCE:</div>
           <div class="error-grid">
              <div v-for="e in errorLog" :key="e.en" class="error-chip">
                 <span class="e-word">{{ e.en.toUpperCase() }}</span>
                 <span class="e-trans">{{ e.cn }}</span>
              </div>
           </div>
        </div>

        <div class="results-footer">
           <button class="re-engage-btn" @click="initGame">
             <span class="btn-glitch">RE-ENGAGE SYSTEM</span>
           </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.war-viewport {
  --neon-orange: #ff9d00; --neon-blue: #00e1ff; --neon-red: #ff3c00;
  position: relative; width: 100%; height: 100%; background: #080a0c; color: #fff;
  font-family: 'Arial Black', sans-serif; overflow: hidden; cursor: none;
}
.metal-texture { position: absolute; inset: 0; background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png'); opacity: 0.15; pointer-events: none; }

/* 准星 */
.crosshair { position: fixed; width: 40px; height: 40px; z-index: 1000; transform: translate(-50%, -50%); pointer-events: none; }
.dot { position: absolute; left: 50%; top: 50%; width: 2px; height: 2px; background: #0f0; transform: translate(-50%,-50%); box-shadow: 0 0 5px #0f0; }
.aim-h { position: absolute; top: 50%; width: 100%; height: 1px; background: rgba(0,255,0,0.5); }
.aim-v { position: absolute; left: 50%; height: 100%; width: 1px; background: rgba(0,255,0,0.5); }

/* HUD */
.hud-bar { display: flex; justify-content: space-between; padding: 20px 40px; background: linear-gradient(to bottom, #111, transparent); border-bottom: 1px solid rgba(255,255,255,0.05); }
.tag { font-size: 10px; color: var(--neon-blue); letter-spacing: 2px; }
.val { font-size: 24px; font-weight: 900; }
.gold { color: var(--neon-orange); text-shadow: 0 0 10px rgba(255,157,0,0.5); }
.hp-track { width: 250px; height: 8px; background: #222; margin-top: 8px; transform: skewX(-20deg); border: 1px solid #444; }
.hp-fill { height: 100%; background: var(--neon-blue); transition: width 0.1s linear; box-shadow: 0 0 10px var(--neon-blue); }

/* 核心监视器 */
.battle-main { margin-top: 40px; display: flex; flex-direction: column; align-items: center; }
.word-monitor {
  background: rgba(0,0,0,0.85); padding: 30px 80px; position: relative;
  border-left: 4px solid var(--neon-orange); box-shadow: inset 0 0 30px rgba(255,157,0,0.2);
  overflow: hidden; isolation: isolate;
}
.scanner-line {
    position: absolute; left: 0; top: -10%; width: 100%; height: 3px;
    background: linear-gradient(to right, transparent, var(--neon-orange), transparent);
    box-shadow: 0 0 15px var(--neon-orange);
    animation: scanMove 2.5s infinite linear; z-index: 1; pointer-events: none;
}
@keyframes scanMove { 0% { top: -10%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { top: 110%; opacity: 0; } }
.corner-frame { position: absolute; width: 20px; height: 20px; border: 2px solid var(--neon-orange); z-index: 5; pointer-events: none; }
.corner-frame.t-l { top: 0; left: 0; border-right: none; border-bottom: none; }
.corner-frame.b-r { bottom: 0; right: 0; border-left: none; border-top: none; }
.target-label { font-size: 12px; color: var(--neon-orange); opacity: 0.8; position: relative; z-index: 2; }
.target-text { font-size: 78px; font-style: italic; margin: 5px 0; letter-spacing: -1px; line-height: 1.1; position: relative; z-index: 2; }
.combo-tag { position: absolute; bottom: -5px; right: 10px; background: var(--neon-orange); color: #000; padding: 5px 15px; transform: skewX(-15deg); font-weight: 900; z-index: 10; }

/* 按钮 */
.options-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 25px; margin-top: 50px; width: 750px; }
.war-btn {
  position: relative; height: 75px; background: #1a1e22; border: 1px solid #3a3f45;
  transform: skewX(-15deg); cursor: pointer; overflow: hidden; transition: 0.1s;
}
.war-btn:hover { background: #23282e; border-color: var(--neon-orange); }
.btn-skew-box { height: 100%; display: flex; align-items: center; justify-content: center; transform: skewX(15deg); }
.btn-text { font-size: 26px; color: #bbb; font-weight: bold; }
.hit { background: rgba(255, 157, 0, 0.2) !important; border-color: var(--neon-orange) !important; }
.hit .btn-text { color: var(--neon-orange); }
.miss { background: rgba(255, 60, 0, 0.2) !important; border-color: var(--neon-red) !important; }
.dim { opacity: 0.3; }

/* 结算窗 */
.tactical-modal {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 440px; background: rgba(10,12,15,0.98); border: 1px solid #444;
  backdrop-filter: blur(10px); z-index: 2000; box-shadow: 0 0 100px #000;
}
.modal-line { height: 4px; background: var(--neon-orange); width: 100%; }
.modal-inner { padding: 30px; }
.mission-title { font-size: 20px; color: var(--neon-orange); margin-bottom: 25px; border-bottom: 1px solid #333; padding-bottom: 10px; }
.result-grid { display: flex; align-items: center; gap: 30px; margin-bottom: 30px; }
.big-rank { font-size: 100px; font-style: italic; color: var(--neon-orange); line-height: 1; }
.data-item { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; color: #888; }
.data-item b { color: #fff; font-size: 20px; }
.action-btn { width: 100%; background: var(--neon-orange); border: none; padding: 15px; font-weight: 900; font-size: 18px; cursor: pointer; }

/* 【深度优化】枪火与不规则火星 (非五角星) */
.flash-wrapper { position: fixed; transform: translate(-50%, -50%); pointer-events: none; z-index: 999; }

.muzzle-fire-irregular {
    width: 90px; height: 90px;
    background: #fff;
    /* 【修改】使用不规则的多边形，模拟爆裂的火光，而非五角星 */
    clip-path: polygon(50% 10%, 65% 35%, 100% 45%, 75% 60%, 85% 95%, 50% 75%, 15% 95%, 25% 60%, 0% 45%, 35% 35%);
    filter: blur(1px);
    animation: fireExplode 0.09s ease-out forwards;
}

/* 火星散射特效 */
.sparks-fx { position: absolute; inset: 0; }
.spark {
    position: absolute; background: #ffcc00; border-radius: 50%;
    opacity: 0; animation: sparkScatter 0.1s ease-out forwards;
}
/* 随机化火星的大小、位置和形状 (模拟碎片) */
.spark.s1 { width: 6px; height: 8px; left: 40%; top: 40%; border-radius: 30% 70%; animation-delay: 0.01s; }
.spark.s2 { width: 8px; height: 5px; left: 55%; top: 50%; border-radius: 70% 30%; animation-delay: 0.02s; }
.spark.s3 { width: 5px; height: 9px; left: 48%; top: 60%; border-radius: 50% 20%; animation-delay: 0.03s; }
.spark.s4 { width: 7px; height: 7px; left: 60%; top: 35%; border-radius: 20% 80%; animation-delay: 0.015s; }

.muzzle-glow-soft {
    position: absolute; left: 50%; top: 50%; width: 160px; height: 160px;
    background: radial-gradient(circle, rgba(255,157,0,0.8) 0%, transparent 70%);
    transform: translate(-50%, -50%); opacity: 0.6; animation: glowFade 0.1s forwards;
}

/* 特效动画 */
@keyframes fireExplode { 0% { transform: scale(0.3) rotate(0deg); opacity: 1; } 100% { transform: scale(1.6) rotate(15deg); opacity: 0; } }
@keyframes sparkScatter {
    0% { transform: translate(0, 0) scale(1); opacity: 1; background: #fff; }
    100% { transform: translate(var(--tw-translate-x), var(--tw-translate-y)) scale(0.2); opacity: 0; background: #ffaa00; }
}
/* 为每个火星设置随机散射方向 */
.spark.s1 { --tw-translate-x: -40px; --tw-translate-y: -30px; }
.spark.s2 { --tw-translate-x: 50px; --tw-translate-y: -20px; }
.spark.s3 { --tw-translate-x: -10px; --tw-translate-y: 50px; }
.spark.s4 { --tw-translate-x: 30px; --tw-translate-y: -40px; }

@keyframes glowFade { 0% { opacity: 0.6; } 100% { opacity: 0; } }

.hole-fx { position: fixed; width: 16px; height: 16px; background: #000; border: 1px solid #333; border-radius: 50%; opacity: 0.8; pointer-events: none; }
.shake { animation: s 0.15s infinite; }
@keyframes s { 0% { transform:translate(2px,2px); } 50% { transform:translate(-2px,-2px); } 100% { transform:translate(2px,-2px); } }
.damage-fx { box-shadow: inset 0 0 100px rgba(255, 60, 0, 0.5); }
.zoom-enter-active { transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
.zoom-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
.flash-white {
  animation: flashWhiteAnim 0.1s ease-out;
}
@keyframes flashWhiteAnim {
  0% { background-color: rgba(255,255,255,0.4); }
  100% { background-color: transparent; }
}
/* --- 战术结算页深度优化 --- */
.tactical-results {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 500px; background: rgba(5, 7, 10, 0.95);
  border: 2px solid #333; border-top: 4px solid var(--neon-orange);
  padding: 30px; z-index: 2000; box-shadow: 0 0 50px rgba(0,0,0,0.8);
  clip-path: polygon(0 0, 100% 0, 100% 90%, 90% 100%, 0 100%);
}

.modal-scanline {
  position: absolute; inset: 0; 
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), 
              linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
  background-size: 100% 4px, 3px 100%; pointer-events: none; opacity: 0.3;
}

.results-header { border-bottom: 1px dashed #444; margin-bottom: 25px; padding-bottom: 10px; }
.title-main { font-size: 24px; letter-spacing: 4px; color: var(--neon-orange); font-weight: 900; }
.title-sub { font-size: 10px; color: #666; font-family: monospace; }

.results-body { display: flex; gap: 30px; align-items: center; margin-bottom: 25px; }

.rank-container { text-align: center; flex: 1; }
.rank-letter { font-size: 110px; font-weight: 900; line-height: 1; font-style: italic; text-shadow: 0 0 20px currentColor; }
.rank-label { font-size: 10px; color: #888; margin-top: 5px; letter-spacing: 1px; }

/* 等级颜色 */
.rank-s { color: #ff00ff; }
.rank-a { color: var(--neon-orange); }
.rank-b { color: var(--neon-blue); }
.rank-c { color: #888; }

.stats-panel { flex: 1.5; display: flex; flex-direction: column; gap: 15px; }
.stat-row { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #222; }
.s-label { color: #666; font-size: 12px; }
.s-value { font-size: 24px; font-weight: bold; }

.intel-report { background: rgba(255, 0, 0, 0.05); padding: 15px; border-radius: 4px; margin-bottom: 25px; max-height: 150px; overflow-y: auto; }
.report-tag { font-size: 11px; color: var(--neon-red); margin-bottom: 10px; font-weight: bold; }
.error-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.error-chip { display: flex; flex-direction: column; padding: 5px; border-left: 2px solid var(--neon-red); background: rgba(0,0,0,0.3); }
.e-word { font-size: 13px; color: #fff; }
.e-trans { font-size: 11px; color: #777; }

.re-engage-btn {
  width: 100%; padding: 18px; background: transparent; border: 1px solid var(--neon-orange);
  color: var(--neon-orange); font-weight: 900; letter-spacing: 2px; cursor: pointer;
  position: relative; overflow: hidden; transition: 0.3s;
}
.re-engage-btn:hover { background: var(--neon-orange); color: #000; box-shadow: 0 0 20px var(--neon-orange); }

/* 入场动画保持 zoom */
.zoom-enter-active { transition: all 0.4s cubic-bezier(0.15, 0.85, 0.35, 1.2); }
.zoom-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(0.7) rotate(-5deg); }
/* --- 战术滚动条美化 --- */

/* 1. 定义滚动条整体宽度（极细设计） */
.intel-report::-webkit-scrollbar {
  width: 4px;               /* 纵向滚动条宽度 */
  height: 4px;              /* 横向滚动条高度 */
}

/* 2. 滚动条轨道（底色） */
.intel-report::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
}

/* 3. 滚动条滑块（类似雷达扫描线的橙色细条） */
.intel-report::-webkit-scrollbar-thumb {
  background: var(--neon-orange);
  border-radius: 10px;
  /* 加入微弱的发光效果 */
  box-shadow: 0 0 8px var(--neon-orange);
  transition: background 0.3s;
}

/* 4. 鼠标悬停时滑块变亮 */
.intel-report::-webkit-scrollbar-thumb:hover {
  background: #ffcc00; /* 比原橙色稍亮 */
  box-shadow: 0 0 12px #ffcc00;
}

/* 5. 针对 Firefox 的兼容性（虽然只支持基础色） */
.intel-report {
  scrollbar-width: thin;
  scrollbar-color: var(--neon-orange) rgba(0, 0, 0, 0.3);
}

.intel-report {
  background: rgba(255, 0, 0, 0.05);
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 25px;
  max-height: 150px;
  overflow-y: auto;
  /* 新增：内阴影增强深度感 */
  box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
</style>
<template>
  <div class="f1-game-container" :class="{ 'hyper-drive': isTurbo, 'crash-shake': isShaking }">

    <template v-if="!showResult">
      <div class="game-hud">
        <div class="hud-card">
          <div class="stat-label">COMBO</div>
          <div class="stat-value gold">{{ comboCount }}</div>
        </div>

        <div class="hud-center">
          <div class="race-track">
            <div class="progress-bar" :style="{ width: (Math.min(currentIndex, 10) / 10) * 100 + '%' }"></div>
            <div class="car-mini-icon" :style="{ left: (Math.min(currentIndex, 10) / 10) * 100 + '%' }">🏎️</div>
          </div>
          <div class="sector-text">SECTOR: {{ currentIndex + 1 }} / 10</div>
        </div>

        <div class="hud-card speed-panel">
          <div class="stat-label">SPEED</div>
          <div class="speed-container">
            <span class="stat-value">{{ currentSpeed }}</span>
            <span class="unit">KM/H</span>
          </div>
        </div>
      </div>

      <div class="viewport-3d">
        <div class="horizon-streamer"></div>

        <div class="environment-container">
          <div class="scenery-side left" :style="sceneryAnimationStyle"></div>
          <div class="scenery-side right" :style="sceneryAnimationStyle"></div>
        </div>

        <div class="highway-container">
          <div class="road-surface" :style="roadAnimationStyle">
            <div class="lane-markings" :style="roadAnimationStyle"></div>
            <div class="side-neon left" :style="roadAnimationStyle"></div>
            <div class="side-neon right" :style="roadAnimationStyle"></div>
          </div>
        </div>

        <div class="sign-board-layer">
          <div v-for="(opt, index) in options" :key="currentIndex + '-' + index" class="sign-wrapper"
            :style="{ '--lane': index }">
            <div class="neon-sign" :class="{ 'focused': currentLane === index && !isLocked }">
              <div class="sign-content-box">
                <div class="sign-cn">{{ opt }}</div>
              </div>
              <div class="lane-id">LANE {{ index + 1 }}</div>
            </div>
          </div>
        </div>

        <div class="player-unit" :style="carPositionStyle">
          <div class="target-word-bubble">
            {{ currentWord.en ? currentWord.en.toLowerCase() : '' }}
          </div>

          <div class="f1-car-pro" :class="{ 'turbo-active': isTurbo }">
            <div class="f1-rear-wing"></div>
            <div class="f1-body">
              <div class="f1-cockpit"></div>
              <div class="f1-intake"></div>
            </div>
            <div class="f1-front-wing"></div>
            <div class="wheel fl"></div>
            <div class="wheel fr"></div>
            <div class="wheel bl"></div>
            <div class="wheel br"></div>
            <div class="exhaust-flame" v-if="isTurbo || currentSpeed > 200"></div>
          </div>
        </div>
      </div>

      <div class="game-footer">
        <span class="key-hint">A / LEFT</span>
        <span class="main-action">PRESS [ SPACE ] TO BOOST</span>
        <span class="key-hint">RIGHT / D</span>
      </div>
    </template>

  <div v-else class="result-overlay">
  <div class="result-card">
    <div class="result-header">
      <div class="finish-flag">🏁</div>
      <h2 class="finish-tag">RACE FINISHED</h2>
      <div class="rank-badge">
        <div class="rank-tag">{{ rankTitle }}</div>
      </div>
    </div>
    
    <div class="stats-grid">
      <div class="grid-item">
        <div class="label">MAX SPEED</div>
        <div class="val">{{ maxSpeed }} <span class="unit-small">KM/H</span></div>
      </div>
      <div class="grid-item">
        <div class="label">BEST COMBO</div>
        <div class="val">{{ maxCombo }} <span class="unit-small">PTS</span></div>
      </div>
      <div class="grid-item full-width">
        <div class="label">MISSION PROGRESS</div>
        <div class="val">{{ currentIndex }} / 10 <span class="unit-small">WORDS COMPLETED</span></div>
      </div>
    </div>

    <div v-if="wrongWords.length > 0" class="review-section">
      <div class="review-title">
        <span class="icon-wrench">🛠️</span> NEEDS TUNING (MISTAKES)
      </div>
      <div class="wrong-list-container">
        <div v-for="word in wrongWords" :key="word.en" class="wrong-item">
          <div class="item-left">
            <span class="w-en">{{ word.en }}</span>
          </div>
          <div class="item-right">
            <span class="w-cn">{{ word.cn }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="perfect-badge">
      🏆 PERFECT RUN! ENGINE OPTIMIZED.
    </div>

    <button class="restart-btn" @click="resetGame">
      <span class="btn-text">RESTART RACE</span>
    </button>
  </div>
</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  wordList: {
    type: Array, default: () => [
      { en: 'potential', cn: '潜力' }, { en: 'mechanism', cn: '机制' },
      { en: 'consistent', cn: '一致的' }, { en: 'ambulance', cn: '救护车' }
    ]
  }
});

const words = ref([]);
const currentIndex = ref(0);
const comboCount = ref(0);
const maxCombo = ref(0);
const currentSpeed = ref(120);
const maxSpeed = ref(120);
const options = ref([]);
const currentLane = ref(1);
const isTurbo = ref(false);
const isShaking = ref(false);
const isLocked = ref(false);
const isCharging = ref(false);
const showResult = ref(false);
const wrongWords = ref([]); // 存储错题对象 { en, cn }

const currentWord = computed(() => {
  if (!words.value || !words.value[currentIndex.value]) {
    return { en: '', cn: '' }; // 返回默认结构，防止 toLowerCase() 崩溃
  }
  return words.value[currentIndex.value];
});
const engineSound = new Audio('/audio/engine-boost.mp3');
engineSound.loop = false;

// 结算评价逻辑（针对 10 个词微调）
const rankTitle = computed(() => {
  if (maxCombo.value >= 8) return 'SPEED DEMON';
  if (maxCombo.value >= 5) return 'PRO RACER';
  return 'ROOKIE DRIVER';
});

const roadAnimationStyle = computed(() => {
  // 速度越快，动画周期越短
  const duration = Math.max(0.1, 1.2 - currentSpeed.value / 350);
  return {
    animationName: 'roadRolling', // 改用专门的滚动关键帧
    animationDuration: `${duration}s`,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear'
  };
});

const sceneryAnimationStyle = computed(() => ({
  animation: `sceneryMove ${Math.max(0.15, 1.8 - currentSpeed.value / 250)}s infinite linear`
}));

const carPositionStyle = computed(() => ({
  left: ['20%', '50%', '80%'][currentLane.value],
  transform: `translateX(-50%) translateY(${isCharging.value ? '-280px' : '0'}) scale(${isCharging.value ? 0.6 : 1})`,
  transition: isCharging.value ? 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), left 0.2s' : 'left 0.2s, transform 0.3s'
}));

const handleKey = (e) => {
  if (isLocked.value || showResult.value) return;
  if (e.key === 'a' || e.key === 'ArrowLeft') currentLane.value = Math.max(0, currentLane.value - 1);
  if (e.key === 'd' || e.key === 'ArrowRight') currentLane.value = Math.min(2, currentLane.value + 1);
  if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); triggerBoost(); }
};

const setupStage = () => {
  // 1. 优先判断是否结束，增加 words.value 的存在性检查
  if (currentIndex.value >= 10 || (words.value && currentIndex.value >= words.value.length)) {
    showResult.value = true;
    return;
  }
  // 2. 关键防御：如果当前单词还没准备好，直接返回，不跑后面的 pool 逻辑
  if (!currentWord.value || !currentWord.value.cn) return;
  let pool = [currentWord.value.cn];
  // 3. 增加 filter 防御
  const others = props.wordList.filter(w => w && w.cn !== currentWord.value.cn);
  while (pool.length < 3 && others.length > 0) {
    let r = others[Math.floor(Math.random() * others.length)].cn;
    if (!pool.includes(r)) pool.push(r);
  }
  options.value = pool.sort(() => Math.random() - 0.5);
  isLocked.value = false;
  isCharging.value = false;
};

const triggerBoost = () => {
  isLocked.value = true; isCharging.value = true;
  engineSound.pause();
  engineSound.currentTime = 0;
  setTimeout(() => {
    if (options.value[currentLane.value] === currentWord.value.cn) {
      comboCount.value++;
      if (comboCount.value > maxCombo.value) maxCombo.value = comboCount.value;
      currentSpeed.value = 140 + (comboCount.value * 15);
      if (currentSpeed.value > maxSpeed.value) maxSpeed.value = currentSpeed.value;

      engineSound.volume = 0.5;
      engineSound.play().catch(() => { });
      isTurbo.value = true;
      setTimeout(() => { isTurbo.value = false; next(); }, 500);
    } else {
      // --- 记录错题逻辑 ---
      const exists = wrongWords.value.some(w => w.en === currentWord.value.en);
      if (!exists) {
        wrongWords.value.push({
          en: currentWord.value.en,
          cn: currentWord.value.cn
        });
      }
      comboCount.value = 0;
      currentSpeed.value = 80;
      isShaking.value = true;
      setTimeout(() => { isShaking.value = false; next(); }, 400);
    }
  }, 300);
};

const next = () => {
  currentIndex.value++;
  // 延迟一丁点触发 setup，给动画一点缓冲时间，防止瞬间切换导致的卡顿
  setTimeout(() => {
    setupStage();
  }, 50);
};

const resetGame = () => {
  currentIndex.value = 0;
  comboCount.value = 0;
  maxCombo.value = 0;
  currentSpeed.value = 120;
  maxSpeed.value = 120;
  showResult.value = false;
  wrongWords.value = [];
  // 关键：确保 props.wordList 长度足够，否则 slice(0, 10) 拿不到 10 个
  const pool = props.wordList.length > 0 ? props.wordList : [{ en: 'error', cn: '错误' }];
  words.value = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
  // 必须在 words 赋值后再 setup
  setupStage();
};

onMounted(() => {
  resetGame();
  window.addEventListener('keydown', handleKey);
});
onUnmounted(() => window.removeEventListener('keydown', handleKey));
</script>

<style scoped>
.f1-game-container {
  --neon-cyan: #00d2ff;
  --neon-gold: #fbc531;
  --road-grey: #1a1a1a;
  position: relative;
  width: 100%;
  height: 750px;
  background: #000;
  overflow: hidden;
  font-family: 'Orbitron', sans-serif;
}

/* HUD 样式 */
.game-hud {
  position: absolute;
  top: 15px;
  width: 96%;
  left: 2%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
}

.hud-card {
  background: rgba(0, 0, 0, 0.6);
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
}

.speed-panel {
  min-width: 170px;
  text-align: right;
}

.speed-container {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
}

.stat-label {
  font-size: 10px;
  color: #888;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 38px;
  font-weight: 900;
  color: #fff;
  font-style: italic;
  line-height: 1;
}

.stat-value.gold {
  color: var(--neon-gold);
  text-shadow: 0 0 15px rgba(251, 197, 49, 0.5);
}

.unit {
  color: #888;
  font-size: 14px;
  margin-left: 5px;
  font-weight: 800;
}

.race-track {
  width: 300px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  position: relative;
}

.progress-bar {
  height: 100%;
  background: var(--neon-cyan);
  box-shadow: 0 0 10px var(--neon-cyan);
}

.car-mini-icon {
  position: absolute;
  top: -12px;
  font-size: 18px;
  transition: left 0.3s;
}

.viewport-3d {
  position: relative;
  width: 100%;
  height: 100%;
  perspective: 1200px;
}

.highway-container {
  position: absolute;
  bottom: -200px;
  /* 往下拉一点，防止看到路面边缘 */
  left: 50%;
  width: 2500px;
  /* 宽度加大，产生延展感 */
  height: 2000px;
  /* 关键点：角度一定要够斜 (85deg)，perspective 也要配合 */
  transform: translateX(-50%) rotateX(85deg);
  transform-origin: bottom center;
}

/* 霓虹灯带：这是产生速度感的关键 */
.side-neon {
  position: absolute;
  top: 0;
  width: 8px;
  height: 100%;
  background: linear-gradient(to bottom,
      transparent 0%,
      var(--neon-cyan) 20%,
      var(--neon-cyan) 80%,
      transparent 100%);
  /* 让侧边的光束断断续续，产生更强的动态感 */
  background-size: 100% 400px;
  filter: blur(4px) drop-shadow(0 0 20px var(--neon-cyan));
  animation: inherit;
  /* 强制跟路面同步 */
}

.side-neon.left {
  left: 20%;
}

.side-neon.right {
  right: 20%;
}

.road-surface {
  width: 100%;
  height: 100%;
  background: #111;
  /* 增加路面的深色质感纹理 */
  background-image:
    /* 1. 细微的路面颗粒感 */
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    /* 2. 核心横向滚动纹（模拟路面接缝） */
    linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 2px, transparent 2px);
  background-size: 40px 40px, 100% 240px;
  /* 240px 是关键位移参考 */
  background-repeat: repeat;
  border-left: 15px solid #444;
  border-right: 15px solid #444;
  box-shadow: 0 0 50px rgba(0, 0, 0, 1) inset;
}

@keyframes roadRolling {
  0% {
    background-position: 0 0;
  }

  100% {
    /* 移动 720px，这是 120, 180, 240 的公倍数，能完美衔接不闪烁 */
    background-position: 0 720px;
  }
}

.lane-markings {
  position: absolute;
  left: 50%;
  width: 10px;
  height: 100%;
  transform: translateX(-50%);
  /* 制作白色虚线：40%实线，60%透明 */
  background-image: linear-gradient(to bottom,
      #fff 40%,
      transparent 40%);
  background-size: 100% 180px;
  /* 这个 180px 必须和下方 keyframes 的移动距离一致 */
  background-repeat: repeat-y;
  /* 强制继承父级的 animation 属性（即 JS 计算出的那个） */
  animation: inherit;
  background-image: linear-gradient(to bottom, #fff 50%, transparent 50%);
  background-size: 100% 180px;
  opacity: 0.8;
  filter: drop-shadow(0 0 5px #fff);
  animation: inherit;
}

/* 修改原有的 @keyframes roadMove */
@keyframes roadMove {
  from {
    background-position: 0 0;
  }

  to {
    /* 180px 是虚线的 size，800px 是灯带的 size */
    /* 统一取一个较大的公倍数，确保所有层都顺滑向下滚动 */
    background-position: 0 3600px;
  }
}

/* 单词看板 */
.sign-board-layer {
  position: absolute;
  top: 150px;
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 40px;
}

.neon-sign {
  width: 240px;
  height: 140px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  transition: all 0.3s;
  overflow: hidden;
}

.sign-content-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 15px;
}

.sign-cn {
  font-size: 30px;
  font-weight: 700;
  color: #fff;
  line-height: 1.1;
  text-align: center;
  word-break: break-all;
}

.lane-id {
  font-size: 12px;
  color: #666;
  padding-bottom: 10px;
  text-align: center;
}

.neon-sign.focused {
  border-color: var(--neon-cyan);
  box-shadow: 0 0 40px rgba(0, 210, 255, 0.4);
  transform: translateY(-15px);
  background: rgba(0, 210, 255, 0.12);
}

/* F1 赛车细节 */
.f1-car-pro {
  position: relative;
  width: 68px;
  height: 115px;
  margin: 0 auto;
}

.f1-body {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 85px;
  background: #e10600;
  border-radius: 10px 10px 4px 4px;
  z-index: 2;
  box-shadow: inset 0 5px 15px rgba(0, 0, 0, 0.4);
}

.f1-cockpit {
  position: absolute;
  top: 32px;
  left: 3px;
  width: 14px;
  height: 22px;
  background: #111;
  border-radius: 50% 50% 30% 30%;
}

.f1-rear-wing {
  position: absolute;
  bottom: 5px;
  left: -12px;
  width: 92px;
  height: 12px;
  background: #222;
  border-radius: 2px;
}

.f1-front-wing {
  position: absolute;
  top: 8px;
  left: -1px;
  width: 70px;
  height: 8px;
  background: #222;
  border-radius: 2px;
}

.wheel {
  position: absolute;
  background: #2b37b7;
  border-radius: 4px;
  border: 1px solid #1a1a1a;
}

.wheel.fl {
  top: 18px;
  left: -15px;
  width: 16px;
  height: 28px;
}

.wheel.fr {
  top: 18px;
  right: -15px;
  width: 16px;
  height: 28px;
}

.wheel.bl {
  bottom: 15px;
  left: -22px;
  width: 24px;
  height: 38px;
}

.wheel.br {
  bottom: 15px;
  right: -22px;
  width: 24px;
  height: 38px;
}

/* 结算层 */
.result-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(12px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-card {
  width: 580px;
  background: linear-gradient(145deg, #0f0f0f 0%, #1a1a1a 100%);
  border: 1px solid rgba(0, 210, 255, 0.3);
  box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(0, 210, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  position: relative;
}

.rank-badge {
  position: relative;
  display: inline-block;
  margin: 10px 0 20px;
}

.finish-tag {
  color: orange;
}

.rank-tag {
  background: var(--neon-gold);
  color: #000;
  font-weight: 900;
  padding: 3px 24px;
  border-radius: 4px;
  font-size: 18px;
  letter-spacing: 2px;
  box-shadow: 0 0 15px rgba(251, 197, 49, 0.4);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
}

/* 数据网格微调 */
.grid-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px;
}
.grid-item .val {
  font-family: 'Orbitron', sans-serif;
  font-size: 32px;
  color: #00d2ff;
}
.unit-small {
  font-size: 12px;
  color: #666;
  margin-left: 4px;
}

.grid-item.full-width {
  grid-column: span 2;
}

.grid-item .label {
  font-size: 10px;
  color: #888;
  margin-bottom: 5px;
}

.restart-btn {
  width: 100%;
  padding: 15px;
  background: var(--neon-cyan);
  color: #000;
  border: none;
  border-radius: 10px;
  font-weight: 900;
  font-size: 16px;
  cursor: pointer;
}

/* 通用样式 */
.player-unit {
  position: absolute;
  bottom: 60px;
  width: 160px;
  z-index: 50;
}

.target-word-bubble {
  font-size: 42px;
  font-weight: 900;
  color: #fff;
  margin-bottom: 30px;
  text-align: center;
  text-shadow: 0 0 15px var(--neon-cyan);
}

.game-footer {
  position: absolute;
  bottom: 30px;
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 60px;
  color: #444;
  font-size: 12px;
  font-weight: 800;
}

.main-action {
  color: #fff;
  border: 1px solid #444;
  padding: 4px 15px;
  border-radius: 4px;
}

/* --- 动画核心关键帧 --- */

/* 路面无限滚动：数值 180px 需对应 background-size 的高度 */
@keyframes roadMove {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 0 180px;
  }
}

/* 氮气/高速时的尾焰效果 */
.exhaust-flame {
  position: absolute;
  bottom: -45px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 60px;
  background: linear-gradient(to bottom, var(--neon-cyan), transparent);
  filter: blur(4px);
  opacity: 0.8;
  z-index: 1;
  animation: flameFlicker 0.1s infinite alternate;
}

@keyframes flameFlicker {
  from {
    height: 50px;
    opacity: 0.6;
  }

  to {
    height: 70px;
    opacity: 0.9;
  }
}

/* 车身微颤（高速感） */
.player-unit {
  /* ...原有样式... */
  animation: carShake 0.2s infinite ease-in-out;
}

@keyframes carShake {
  0% {
    transform: translateX(-50%) translate(0, 0);
  }

  50% {
    transform: translateX(-50%) translate(0.5px, 0.5px);
  }

  100% {
    transform: translateX(-50%) translate(-0.5px, -0.5px);
  }
}

/* 涡轮加速时的整体画面震动 */
.hyper-drive .viewport-3d {
  animation: screenShake 0.1s infinite;
}

@keyframes screenShake {
  0% {
    transform: translate(1px, 1px);
  }

  50% {
    transform: translate(-1px, -1px);
  }

  100% {
    transform: translate(1px, -1px);
  }
}

/* 错题回顾区重构 */
.review-section {
  margin-top: 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 20px;
}

.review-title {
  color: #ff0055;
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wrong-list-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
}

.wrong-item {
  background: rgba(255, 255, 255, 0.04);
  border-left: 4px solid #ff0055; /* 只有侧边红线 */
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.wrong-item:hover {
  background: rgba(255, 0, 85, 0.1);
  transform: translateX(5px);
}

.w-en {
  font-weight: 700;
  color: #fff;
  font-size: 15px;
}

.w-cn {
  color: #888;
  font-size: 13px;
}

/* 完美通关 */
.perfect-badge {
  color: #00f3ff;
  font-weight: 900;
  padding: 20px;
  text-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
}

/* 按钮优化 */
.restart-btn {
  margin-top: 30px;
  background: transparent;
  border: 1px solid var(--neon-cyan);
  color: var(--neon-cyan);
  padding: 12px;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 2px;
  transition: all 0.3s;
}

.restart-btn:hover {
  background: var(--neon-cyan);
  color: #000;
  box-shadow: 0 0 20px rgba(0, 210, 255, 0.4);
}

/* 自定义滚动条让它更 Cyber */
.wrong-list-container::-webkit-scrollbar {
  width: 4px;
}

.wrong-list-container::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 2px;
}

.wrong-item {
  background: rgba(255, 255, 255, 0.03); /* 取消深红底 */
  border-left: 4px solid #FF0055;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05); /* 增加横向分隔感 */
  padding: 12px;
  transition: transform 0.2s;
}

.wrong-item:hover {
  transform: translateX(5px); /* 悬停时的小动效 */
  background: rgba(255, 0, 85, 0.08);
}

.w-en {
  color: #fff;
  font-weight: 700;
}

.w-divider {
  color: #FF0055;
  opacity: 0.5;
  margin: 0 5px;
}

.w-cn {
  color: #888;
}

.perfect-badge {
  margin: 30px 0;
  color: #00F3FF;
  /* 电光青 */
  font-size: 14px;
  font-weight: 800;
  text-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
}
</style>
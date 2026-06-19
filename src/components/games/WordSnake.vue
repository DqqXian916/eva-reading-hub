<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useGameStore } from '../../stores/gameStore'; 

const props = defineProps({
  canEdit: Boolean
});

const emit = defineEmits(['updateConfig', 'saveConfig']);
const gameStore = useGameStore();

// --- 状态管理 ---
const score = ref(0);
const highScore = ref(0);
const hp = ref(5);
const gameOver = ref(false);
const isFinished = ref(false);
const deathReason = ref('');

// 管理员面板
const showAdmin = ref(false);
const configText = ref('');

// Canvas 引用与游戏循环变量
const canvasRef = ref(null);
let ctx = null;
let gameInterval = null;

// 贪吃蛇核心物理状态
const gridSize = 30; 
let tileCountX = 18;
let tileCountY = 12;
let snake = [];
let currentDx = gridSize;
let currentDy = 0;
let inputQueue = []; 
let animationFrameCounter = 0;

// 当前题目与食物数据
const currentQuestion = ref({});
const correctFood = ref({});
const wrongFood = ref({});

// --- 8-Bit 晶体管音效引擎 (Web Audio API) ---
let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
};

const playArcadeSound = (type) => {
  try {
    initAudio();
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    
    if (type === 'eat') {
      // 经典街机吃豆：向上滑动的双音级联
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle'; // 三角波，带有复古FC的醇厚感
      
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5 极速滑音
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } 
    else if (type === 'wrong') {
      // 经典街机受击：金属撞击下沉音
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth'; // 锯齿波，带来硬核撕裂感
      
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.25); // 频率极速下坠
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    console.warn("音频引擎调制失败:", e);
  }
};

// --- 核心游戏逻辑 ---
const resetGame = () => {
  score.value = 0;
  hp.value = 5;
  gameOver.value = false;
  isFinished.value = false;
  deathReason.value = '';
  
  // 初始化蛇身位置
  snake = [{ x: 3 * gridSize, y: 5 * gridSize }];
  currentDx = gridSize;
  currentDy = 0;
  inputQueue = [];
  
  nextQuestion();
  
  if (gameInterval) clearInterval(gameInterval);
  // 每秒 7-8 帧，平衡了吃豆人的操作走位反馈感
  gameInterval = setInterval(updateGame, 130); 
};

const nextQuestion = () => {
  if (!gameStore.wordList || gameStore.wordList.length === 0) return;
  
  const randIdx = Math.floor(Math.random() * gameStore.wordList.length);
  const targetWord = gameStore.wordList[randIdx];
  
  let wrongWord = "bug";
  if (gameStore.wordList.length > 1) {
    let wrongIdx;
    do {
      wrongIdx = Math.floor(Math.random() * gameStore.wordList.length);
    } while (wrongIdx === randIdx);
    wrongWord = gameStore.wordList[wrongIdx].en;
  }

  currentQuestion.value = {
    ch: targetWord.cn,
    word: targetWord.en.trim(),
    wrong: wrongWord.trim()
  };
  
  correctFood.value = getRandomPosition();
  correctFood.value.text = currentQuestion.value.word;
  
  do {
    wrongFood.value = getRandomPosition();
  } while(wrongFood.value.x === correctFood.value.x && wrongFood.value.y === correctFood.value.y);
  wrongFood.value.text = currentQuestion.value.wrong;
};

const getRandomPosition = () => {
  let x, y, inSnake;
  do {
    inSnake = false;
    x = Math.floor(Math.random() * (tileCountX - 4) + 2) * gridSize;
    y = Math.floor(Math.random() * (tileCountY - 2) + 1) * gridSize;
    for (let cell of snake) {
      if (cell.x === x && cell.y === y) inSnake = true;
    }
  } while (inSnake);
  return { x, y };
};

const updateGame = () => {
  if (gameOver.value || isFinished.value) return;

  // 精准输入缓冲机制
  if (inputQueue.length > 0) {
    const nextMove = inputQueue.shift();
    currentDx = nextMove.dx;
    currentDy = nextMove.dy;
  }

  const head = { x: snake[0].x + currentDx, y: snake[0].y + currentDy };

  // 撞墙判定
  if (head.x < 0 || head.x >= canvasRef.value.width || head.y < 0 || head.y >= canvasRef.value.height) {
    handleHpLoss("一头撞在像素外墙上！");
    return;
  }

  // 撞身体判定
  for (let i = 0; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      handleHpLoss("咬到了自己的数据尾巴！");
      return;
    }
  }

  snake.unshift(head);

  // 食物吞噬判定
  if (head.x === correctFood.value.x && head.y === correctFood.value.y) {
    score.value++;
    if (score.value > highScore.value) highScore.value = score.value;
    playArcadeSound('eat'); // 触发清脆吃豆声
    
    if (score.value >= gameStore.goal) {
      isFinished.value = true;
      clearInterval(gameInterval);
    } else {
      nextQuestion();
    }
  } else if (head.x === wrongFood.value.x && head.y === wrongFood.value.y) {
    handleHpLoss(`吞下了错词！"${currentQuestion.value.ch}" 应该吃 "${currentQuestion.value.word}"`);
  } else {
    snake.pop();
  }

  animationFrameCounter++;
  drawGame();
};

const handleHpLoss = (reason) => {
  hp.value--;
  playArcadeSound('wrong'); // 触发硬核重击音效
  
  if (hp.value <= 0) {
    gameOver.value = true;
    deathReason.value = reason;
    clearInterval(gameInterval);
  } else {
    // 扣血保护：原地回档重置，防止连续撞墙死
    snake = [{ x: 3 * gridSize, y: 5 * gridSize }];
    currentDx = gridSize;
    currentDy = 0;
    inputQueue = [];
    nextQuestion();
  }
};

// --- Canvas 绘图 ---
const drawGame = () => {
  if (!ctx || !canvasRef.value) return;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);

  if (correctFood.value.text) drawPixelFood(correctFood.value, "#00ff00");
  if (wrongFood.value.text) drawPixelFood(wrongFood.value, "#ff0000");

  snake.forEach((part, index) => {
    if (index === 0) {
      ctx.save();
      ctx.translate(part.x + gridSize / 2, part.y + gridSize / 2);
      
      let angle = 0;
      if (currentDx > 0) angle = 0;
      else if (currentDx < 0) angle = Math.PI;
      else if (currentDy > 0) angle = Math.PI / 2;
      else if (currentDy < 0) angle = -Math.PI / 2;
      ctx.rotate(angle);

      let isOpenMouth = (animationFrameCounter % 2 === 0);
      let mouthSize = isOpenMouth ? 0.25 * Math.PI : 0.02 * Math.PI;

      ctx.fillStyle = "#ffff00"; 
      ctx.beginPath();
      ctx.arc(0, 0, gridSize / 2 - 2, mouthSize, 2 * Math.PI - mouthSize);
      ctx.lineTo(0, 0);
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.fillRect(2, -6, 4, 4);
      ctx.restore();
    } else {
      ctx.fillStyle = (index % 2 === 0) ? "#ffffff" : "#ff0000";
      ctx.fillRect(part.x + 2, part.y + 2, gridSize - 4, gridSize - 4);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(part.x + 2, part.y + 2, gridSize - 4, gridSize - 4);
    }
  });
};

const drawPixelFood = (food, blockColor) => {
  ctx.save();
  // 根据单词长度动态适配包裹宽度
  let boxWidth = gridSize + (food.text.length * 8);
  let boxX = food.x + gridSize / 2 - boxWidth / 2;

  // 1. 绘制最底层白色复古外框
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(boxX - 2, food.y + 1, boxWidth + 4, gridSize - 2);

  // 2. 绘制内层纯黑衬底
  ctx.fillStyle = "#000000";
  ctx.fillRect(boxX, food.y + 3, boxWidth, gridSize - 6);

  // 3. 绘制核心提示色块（红/绿）
  ctx.fillStyle = blockColor;
  ctx.fillRect(boxX + 3, food.y + 6, boxWidth - 6, gridSize - 12);
  
  // 4. 渲染文本 - 核心优化：增加强力黑边
  ctx.font = "bold 13px 'Courier New', Courier, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // 先绘制 3px 宽的黑色外描边，压住红绿背景
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.strokeText(food.text, food.x + gridSize / 2, food.y + gridSize / 2);
  
  // 再填充核心白色文本，形成高对比度反差
  ctx.fillStyle = "#ffffff";
  ctx.fillText(food.text, food.x + gridSize / 2, food.y + gridSize / 2);
  
  ctx.restore();
};
// --- 精准按键响应与默认事件拦截 ---
const handleKeyDown = (e) => {
  initAudio(); // 用户按下任意键时自动激活 AudioContext 策略
  
  // 识别需要被拦截的街机控制键
  const trackedKeys = ["ArrowLeft", "a", "ArrowUp", "w", "ArrowRight", "d", "ArrowDown", "s"];
  if (trackedKeys.includes(e.key)) {
    e.preventDefault(); // 强力阻止页面因方向键滚动
  }

  const lastInput = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : { dx: currentDx, dy: currentDy };
  
  if ((e.key === "ArrowLeft" || e.key === "a") && lastInput.dx === 0) {
    inputQueue.push({ dx: -gridSize, dy: 0 });
  } else if ((e.key === "ArrowUp" || e.key === "w") && lastInput.dy === 0) {
    inputQueue.push({ dx: 0, dy: -gridSize });
  } else if ((e.key === "ArrowRight" || e.key === "d") && lastInput.dx === 0) {
    inputQueue.push({ dx: gridSize, dy: 0 });
  } else if ((e.key === "ArrowDown" || e.key === "s") && lastInput.dy === 0) {
    inputQueue.push({ dx: 0, dy: gridSize });
  }
};

const triggerMobileDir = (dir) => {
  initAudio();
  const lastInput = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : { dx: currentDx, dy: currentDy };
  if (dir === 'L' && lastInput.dx === 0) inputQueue.push({ dx: -gridSize, dy: 0 });
  if (dir === 'U' && lastInput.dy === 0) inputQueue.push({ dx: 0, dy: -gridSize });
  if (dir === 'R' && lastInput.dx === 0) inputQueue.push({ dx: gridSize, dy: 0 });
  if (dir === 'D' && lastInput.dy === 0) inputQueue.push({ dx: 0, dy: gridSize });
};

const handleSaveConfig = () => {
  try {
    const newWords = JSON.parse(configText.value);
    gameStore.updateConfig(newWords, gameStore.goal);
    emit('updateConfig', newWords); 
    showAdmin.value = false;
    resetGame();
  } catch (e) {
    alert('JSON格式错误: ' + e.message);
  }
};

const padZero = (num) => String(num).padStart(5, '0');

watch(
  () => gameStore.wordList, 
  (newList) => {
    if (newList && newList.length > 0) {
      configText.value = JSON.stringify(newList, null, 2);
      nextTick(() => { resetGame(); });
    }
  }, 
  { immediate: true, deep: true } 
);

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext("2d");
    tileCountX = canvasRef.value.width / gridSize;
    tileCountY = canvasRef.value.height / gridSize;
  }
  window.addEventListener("keydown", handleKeyDown, { passive: false });
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  if (gameInterval) clearInterval(gameInterval);
});
</script>

<template>
  <div class="game-viewport" @click="initAudio">
    <!-- 开发后台配置面板 -->
    <div v-if="showAdmin" class="overlay" @click="showAdmin = false"></div>
    <div v-if="showAdmin" class="admin-panel">
      <h3>像素词库配置</h3>
      <textarea v-model="configText" placeholder="请输入JSON格式词库"></textarea>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="btn admin-save-btn" @click="handleSaveConfig">保存配置</button>
      </div>
    </div>

    <div id="game-container">
      <!-- 8-Bit 经典上端计分面板 -->
      <div id="ui-panel">
        <div id="score-board">
          <div>
            <span class="score-lbl">1P SCORE</span>
            <span class="score-val">{{ padZero(score) }}</span>
          </div>
          <div>
            <span class="score-lbl">HP LIFE</span>
            <span class="hp-hearts">{{ "❤️".repeat(hp) + "🖤".repeat(Math.max(0, 5 - hp)) }}</span>
          </div>
          <div>
            <span class="score-lbl">HI-SCORE</span>
            <span class="score-val">{{ padZero(highScore) }}</span>
          </div>
        </div>
        
        <div id="question-box">
          <div id="hint-title">GOAL PROGRESS: {{ score }} / {{ gameStore.goal }}</div>
          <div v-if="gameStore.wordList.length > 0" id="question">
            【 {{ currentQuestion.ch }} 】
          </div>
          <div v-else id="question" style="font-size:12px; color:#ff0000;">
            👾 无可用词库，请先前往后台配置
          </div>
        </div>
      </div>
      
      <!-- 主画布及弹框组件区 -->
      <div id="canvas-wrapper">
        <canvas ref="canvasRef" width="540" height="360"></canvas>
        
        <!-- 遮罩黑幕：用于烘托弹窗层次 -->
        <div v-if="gameOver || isFinished" class="modal-backdrop"></div>

        <!-- 死亡弹窗 GAME OVER -->
        <div v-if="gameOver" class="pixel-modal game-over-view">
          <h2>GAME OVER</h2>
          <div class="reason-text">{{ deathReason }}</div>
          <div class="stats-box">
            <p>FINAL SCORE: <span class="highlight">{{ padZero(score) }}</span></p>
          </div>
          <button class="restart-btn" @click="resetGame">INSERT COIN / CONTINUE</button>
        </div>

        <!-- 通关弹窗 STAGE CLEAR -->
        <div v-if="isFinished" class="pixel-modal stage-clear-view">
          <h2 class="clear-title">STAGE CLEAR</h2>
          <div class="reason-text text-success">完美达标！你已成功击破本次核心词汇库！</div>
          <div class="stats-box">
            <p>HI-SCORE: <span class="highlight-green">{{ padZero(score) }}</span></p>
          </div>
          <button class="restart-btn clear-btn" @click="resetGame">REPLAY / NEXT STAGE</button>
        </div>
      </div>

      <!-- 十字街机按键（移动端自动激活） -->
      <div id="controls">
        <div class="btn" id="btn-up" @touchstart.prevent="triggerMobileDir('U')">U</div>
        <div class="btn" id="btn-left" @touchstart.prevent="triggerMobileDir('L')">L</div>
        <div class="btn" id="btn-right" @touchstart.prevent="triggerMobileDir('R')">R</div>
        <div class="btn" id="btn-down" @touchstart.prevent="triggerMobileDir('D')">D</div>
      </div>

      <div v-if="canEdit" class="admin-trigger-zone">
        <button class="dev-config-btn" @click="showAdmin = true">🔧 像素词库开发配置</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

.game-viewport {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  background-color: #111111;
  padding: 20px 10px;
  box-sizing: border-box;
  font-family: 'Press Start 2P', 'Courier New', Courier, monospace, sans-serif;
  user-select: none;
}

#game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 560px;
}

#ui-panel {
  width: 100%;
  background: #000000;
  border: 4px solid #ffffff;
  border-bottom: none;
  padding: 15px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#score-board {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  letter-spacing: 1px;
  align-items: center;
}

.score-lbl {
  color: #ff3e3e;
  margin-bottom: 5px;
  display: block;
}
.score-val {
  color: #ffffff;
  font-weight: bold;
}
.hp-hearts {
  font-size: 11px;
  letter-spacing: 1px;
}

#question-box {
  border-top: 4px dashed #ffffff;
  padding-top: 12px;
  text-align: center;
}

#hint-title {
  font-size: 9px;
  color: #55ff55;
  margin-bottom: 6px;
}

#question {
  font-size: 16px;
  color: #ffff55;
  line-height: 1.4;
  font-family: sans-serif;
  font-weight: bold;
}

#canvas-wrapper {
  position: relative;
  width: 100%;
}

canvas {
  display: block;
  width: 100%;
  height: auto;
  border: 4px solid #ffffff;
  background-color: #000000;
}

/* 遮罩背景 */
.modal-backdrop {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  z-index: 5;
}

/* 优化升级版：街机红白机质感像素弹窗 */
.pixel-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #000000;
  border: 4px solid #ff3e3e;
  color: #ffffff;
  padding: 30px 20px;
  text-align: center;
  width: 85%;
  max-width: 380px;
  z-index: 10;
  box-shadow: 0px 0px 20px rgba(255, 62, 62, 0.4);
}

.stage-clear-view {
  border-color: #55ff55 !important;
  box-shadow: 0px 0px 20px rgba(85, 255, 85, 0.4) !important;
}

.pixel-modal h2 {
  margin-top: 0;
  font-size: 20px;
  letter-spacing: 2px;
}
.game-over-view h2 {
  color: #ff3e3e;
  animation: blink 0.6s infinite steps(1, start);
}
.clear-title {
  color: #55ff55;
  animation: blink 1s infinite steps(1, start);
}

@keyframes blink { 50% { opacity: 0; } }

.reason-text {
  font-size: 12px;
  line-height: 1.6;
  margin: 15px 0;
  font-family: sans-serif;
  font-weight: bold;
  color: #e0e0e0;
}
.text-success {
  color: #55ff55 !important;
}

.stats-box {
  background: #111111;
  border: 2px dashed #ffffff;
  padding: 10px;
  margin-bottom: 25px;
  font-size: 11px;
}
.highlight { color: #ffff55; }
.highlight-green { color: #55ff55; }

button.restart-btn {
  background: #ff3e3e;
  color: #ffffff;
  border: 3px solid #ffffff;
  padding: 12px 18px;
  font-family: inherit;
  font-size: 10px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 4px 4px 0px #ffffff;
  width: 100%;
}
.clear-btn {
  background: #55ff55 !important;
  color: #000000 !important;
  box-shadow: 4px 4px 0px #000000 !important;
  border-color: #000000 !important;
}
button.restart-btn:active {
  transform: translate(3px, 3px);
  box-shadow: 1px 1px 0px #ffffff;
}
.clear-btn:active {
  box-shadow: 1px 1px 0px #000000 !important;
}

/* 摇杆 */
#controls {
  display: grid;
  grid-template-columns: repeat(3, 62px);
  grid-template-rows: repeat(3, 62px);
  gap: 10px;
  margin-top: 25px;
}
@media (min-width: 768px) {
  #controls { display: none; } 
}

.btn {
  background: #222222;
  border: 3px solid #ffffff;
  color: #ffffff;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 3px 3px 0px #ffffff;
}
.btn:active {
  background: #ffffff;
  color: #000000;
  box-shadow: 0px 0px 0px #ffffff;
  transform: translate(3px, 3px);
}
#btn-up { grid-column: 2; }
#btn-left { grid-column: 1; grid-row: 2; }
#btn-right { grid-column: 3; grid-row: 2; }
#btn-down { grid-column: 2; grid-row: 3; }

.admin-trigger-zone { margin-top: 20px; }
.dev-config-btn {
  background: transparent;
  border: 1px dashed #555;
  color: #666;
  padding: 6px 12px;
  font-size: 10px;
  cursor: pointer;
}
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; }
.admin-panel { 
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
  background: #000000; border: 4px solid #ffffff; padding: 25px; z-index: 110; width: 320px; color: white;
}
.admin-panel h3 { font-size: 12px; margin-top: 0; color: #ffff55; }
.admin-panel textarea { 
  width: 100%; height: 180px; margin-bottom: 10px; padding: 10px; background: #111;
  color: #55ff55; font-family: monospace; box-sizing: border-box; border: 2px solid #fff;
}
.admin-save-btn { background: #55ff55 !important; color: black !important; font-family: inherit; font-size: 10px; padding: 8px 16px; }
</style>
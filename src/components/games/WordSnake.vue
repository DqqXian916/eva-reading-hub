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
const showAdmin = ref(false);
const configText = ref('');
const feedback = ref({ text: '', show: false });
let mouseDir = { dx: gridSize, dy: 0 }; // 1. 必须给初始值，防止崩溃
const controlMode = ref('keyboard'); // 新增：控制模式
let forceDirection = null; // 用于存储键盘强制覆盖的方向
const isOpposite = (newDx, newDy) => (newDx !== 0 && newDx === -currentDx) || (newDy !== 0 && newDy === -currentDy);

// Canvas 引用与游戏循环变量
const canvasRef = ref(null);
let previewPath = [];
let isDrawing = false; // 是否处于按下鼠标状态
let ctx = null;
let gameInterval = null;
// 贪吃蛇核心物理状态
const gridSize = 30;
let tileCountX = 24;
let tileCountY = 16;
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
const colorMap = ref({ correct: "#00ff00", wrong: "#ff0000" });
// 触发反馈的函数
const triggerFeedback = (word, ch) => {
  feedback.value = { text: `✅ ${word} = ${ch}`, show: true };
  setTimeout(() => { feedback.value.show = false; }, 1500); // 1.5秒后消失
};
// 在 drawGame 函数的最后添加：
const drawMouseAnchor = () => {
  if (controlMode.value !== 'mouse') return;
  // 注意：需要确保 mouseX/Y 是全局或作用域内可访问的，我们可以利用 mouseDir 还原坐标
  // 或者在 handleMouseMove 中记录全局鼠标位置
  if (!window.currentMousePos) return;
  ctx.save();
  ctx.strokeStyle = "#ffff00"; // 显眼的亮黄色
  ctx.lineWidth = 2;
  ctx.beginPath();
  // 绘制十字准星
  ctx.moveTo(window.currentMousePos.x - 10, window.currentMousePos.y);
  ctx.lineTo(window.currentMousePos.x + 10, window.currentMousePos.y);
  ctx.moveTo(window.currentMousePos.x, window.currentMousePos.y - 10);
  ctx.lineTo(window.currentMousePos.x, window.currentMousePos.y + 10);
  ctx.stroke();
  // 绘制一个小圆圈表示锚点核心
  ctx.arc(window.currentMousePos.x, window.currentMousePos.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffff00";
  ctx.fill();
  ctx.restore();
};

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
  score.value = 0; hp.value = 5; gameOver.value = false; isFinished.value = false;
  deathReason.value = '';
  snake = [{ x: 3 * gridSize, y: 5 * gridSize }];
  currentDx = gridSize; currentDy = 0; inputQueue = [];
  nextQuestion();
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(updateGame, 130);
};

const nextQuestion = () => {
  if (!gameStore.wordList || gameStore.wordList.length === 0) return;
 // 随机化：对的单词不一定总是绿色
  colorMap.value = {
    correct: "#00ff00",
    wrong: "#00ff00"
  };
  const randIdx = Math.floor(Math.random() * gameStore.wordList.length);
  const targetWord = gameStore.wordList[randIdx];
  let wrongWord = gameStore.wordList.length > 1 ? gameStore.wordList[Math.floor(Math.random() * gameStore.wordList.length)].en : "bug";
  currentQuestion.value = { ch: targetWord.cn, word: targetWord.en.trim(), wrong: wrongWord.trim() };
 // 1. 生成正确食物
  correctFood.value = getRandomPosition();
  correctFood.value.text = currentQuestion.value.word;

  // 2. 生成错误食物，并确保与正确食物有足够距离
  do {
    wrongFood.value = getRandomPosition();
  } while (
    Math.abs(wrongFood.value.x - correctFood.value.x) < gridSize * 2 && 
    Math.abs(wrongFood.value.y - correctFood.value.y) < gridSize * 2
  );
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
// 当鼠标按下时开启绘制
const handleMouseDown = (e) => {
  isDrawing = true;
  updatePreviewPath(e);
};

// 鼠标松开时清理
const handleMouseUp = () => {
  isDrawing = false;
  previewPath = [];
};

const updatePreviewPath = (e) => {
  if (!isDrawing) return;
  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  // 简易逻辑：轨迹就是从蛇头到鼠标的连线
  previewPath = [{ x: snake[0].x, y: snake[0].y }, { x: mouseX, y: mouseY }];
  // 同时更新 mouseDir，让蛇向这个方向靠拢
  const dx = mouseX - snake[0].x;
  const dy = mouseY - snake[0].y;
  mouseDir = Math.abs(dx) > Math.abs(dy)
    ? { dx: dx > 0 ? gridSize : -gridSize, dy: 0 }
    : { dx: 0, dy: dy > 0 ? gridSize : -gridSize };
};
const drawPathPreview = () => {
  if (!isDrawing || previewPath.length < 2) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 0, 0.5)"; // 半透明黄色预览线
  ctx.setLineDash([5, 5]); // 虚线效果
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(previewPath[0].x + gridSize / 2, previewPath[0].y + gridSize / 2);
  ctx.lineTo(previewPath[1].x, previewPath[1].y);
  ctx.stroke();
  ctx.restore();
};
const handleMouseMove = (e) => {
  if (controlMode.value !== 'mouse') return;
  const rect = canvasRef.value.getBoundingClientRect();
  
  // 核心：直接获取鼠标在 canvas 中的精确位置
  const mouseX = (e.clientX - rect.left) * (canvasRef.value.width / rect.width);
  const mouseY = (e.clientY - rect.top) * (canvasRef.value.height / rect.height);
  
  window.currentMousePos = { x: mouseX, y: mouseY };

  // 转向逻辑：只要鼠标方向与蛇头中心偏移超过 10 像素就转向
  const dx = mouseX - (snake[0].x + gridSize / 2);
  const dy = mouseY - (snake[0].y + gridSize / 2);
  
  if (Math.abs(dx) > Math.abs(dy)) {
    const nextDir = { dx: dx > 0 ? gridSize : -gridSize, dy: 0 };
    if (!isOpposite(nextDir.dx, nextDir.dy)) mouseDir = nextDir;
  } else {
    const nextDir = { dx: 0, dy: dy > 0 ? gridSize : -gridSize };
    if (!isOpposite(nextDir.dx, nextDir.dy)) mouseDir = nextDir;
  }
};
const updateGame = () => {
  // 增加安全检查：如果 canvas 已不存在，直接停止定时器并返回
  if (!canvasRef.value) {
    if (gameInterval) clearInterval(gameInterval);
    return;
  }
  if (gameOver.value || isFinished.value) return;
  // 边缘缓冲逻辑：如果蛇头在边缘，自动偏向中心
  const buffer = gridSize * 2;
  if (controlMode.value === 'mouse') {
      if (snake[0].x < buffer && currentDx < 0) mouseDir = { dx: 0, dy: -gridSize };
      if (snake[0].x > (tileCountX * gridSize - buffer) && currentDx > 0) mouseDir = { dx: 0, dy: gridSize };
  }
  // 锚点逻辑：如果键盘有操作，优先级最高
  if (forceDirection) {
    currentDx = forceDirection.dx;
    currentDy = forceDirection.dy;
    mouseDir = { ...forceDirection }; // 同时同步给鼠标跟随方向，实现“锚点效果”
    forceDirection = null;
  } else if (controlMode.value === 'mouse') {
    if (!isOpposite(mouseDir.dx, mouseDir.dy)) {
      currentDx = mouseDir.dx;
      currentDy = mouseDir.dy;
    }
  } else if (inputQueue.length > 0) {
    const nextMove = inputQueue.shift();
    currentDx = nextMove.dx; currentDy = nextMove.dy;
  }
  // 1. 计算下一帧的预期坐标
  const nextHead = { x: snake[0].x + currentDx, y: snake[0].y + currentDy };

  // 2. === 在这里插入代码：防撞强制修正 ===
  // 必须使用 canvasRef.value.width/height 确保获取到最新的画布尺寸
  const canvasWidth = canvasRef.value.width;
  const canvasHeight = canvasRef.value.height;

  if (nextHead.x < 0) currentDx = gridSize;           // 撞左墙，强制向右
  else if (nextHead.x >= canvasWidth) currentDx = -gridSize; // 撞右墙，强制向左
  
  if (nextHead.y < 0) currentDy = gridSize;           // 撞上墙，强制向下
  else if (nextHead.y >= canvasHeight) currentDy = -gridSize; // 撞下墙，强制向上
  // ======================================
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
    triggerFeedback(currentQuestion.value.word, currentQuestion.value.ch)
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
  playArcadeSound('wrong');
  if (hp.value <= 0) {
    gameOver.value = true;
    deathReason.value = reason;
    clearInterval(gameInterval);
  } else {
    // 关键改变：不再重置整个地图，只缩短蛇身，让游戏继续进行
    if (snake.length > 3) snake.splice(0, Math.floor(snake.length / 2));
    nextQuestion(); 
  }
};


// --- Canvas 绘图 ---
const drawGame = () => {
  if (!ctx || !canvasRef.value) return;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  drawPathPreview();
  if (correctFood.value.text) drawPixelFood(correctFood.value, colorMap.value.correct);
  if (wrongFood.value.text) drawPixelFood(wrongFood.value, colorMap.value.wrong);

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
      ctx.arc(0, 0, (gridSize * 0.8) / 2, mouthSize, 2 * Math.PI - mouthSize);
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
  drawMouseAnchor();
  // --- 新增反馈绘制逻辑 ---
  if (feedback.value.show) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 0, 0.9)"; // 亮黄色字体
    ctx.font = "bold 20px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.fillText(feedback.value.text, canvasRef.value.width / 2, canvasRef.value.height / 2);
    ctx.restore();
  }
};

const drawPixelFood = (food, blockColor) => {
  ctx.save();
  // 放大背景块
  ctx.font = "bold 16px 'Courier New', Courier, monospace";
  const textWidth = ctx.measureText(food.text).width;
  const boxWidth = textWidth + 40; // 左右留白更多
  const boxHeight = gridSize + 14; // 上下高度增加
  const boxX = food.x + gridSize / 2 - boxWidth / 2;
  const boxY = food.y + gridSize / 2 - boxHeight / 2;

  // 绘制带有立体感的边框
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(boxX - 2, boxY - 2, boxWidth + 4, boxHeight + 4);
  ctx.fillStyle = "#000000";
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.fillStyle = blockColor;
  ctx.fillRect(boxX + 3, boxY + 3, boxWidth - 6, boxHeight - 6);

  // 文字加粗描边
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 5;
  ctx.strokeText(food.text, food.x + gridSize / 2, food.y + gridSize / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(food.text, food.x + gridSize / 2, food.y + gridSize / 2);
  ctx.restore();
};
// --- 精准按键响应与默认事件拦截 ---
const handleKeyDown = (e) => {
  initAudio();
  const keyMap = {
    ArrowLeft: { dx: -gridSize, dy: 0 }, a: { dx: -gridSize, dy: 0 },
    ArrowRight: { dx: gridSize, dy: 0 }, d: { dx: gridSize, dy: 0 },
    ArrowUp: { dx: 0, dy: -gridSize }, w: { dx: 0, dy: -gridSize },
    ArrowDown: { dx: 0, dy: gridSize }, s: { dx: 0, dy: gridSize }
  };

  if (keyMap[e.key]) {
    e.preventDefault();
    // 核心逻辑：无论何种模式，键盘按键直接重置强制方向
    forceDirection = keyMap[e.key];
    // 同步更新鼠标跟随的目标，防止键盘按完后鼠标移动又跳回去
    mouseDir = { ...forceDirection };
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
  ctx = canvasRef.value.getContext("2d");
  window.addEventListener("keydown", handleKeyDown);
  canvasRef.value.addEventListener("mousemove", handleMouseMove);
  canvasRef.value.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mouseup", handleMouseUp); // 用 window 监听可以防止松开鼠标时移出 canvas 导致无法停止绘制
  resetGame();
});

onUnmounted(() => {
  // 1. 彻底清除定时器，这是防止内存泄漏和空指针的关键
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }
  // 2. 移除所有事件监听
  window.removeEventListener("keydown", handleKeyDown);
  if (canvasRef.value) {
    canvasRef.value.removeEventListener("mousemove", handleMouseMove);
    canvasRef.value.removeEventListener("mousedown", handleMouseDown);
  }
  window.removeEventListener("mouseup", handleMouseUp);
});
</script>

<template>
  <div class="game-viewport" @click="initAudio">
    <div class="mode-selector">
      <button :class="{ active: controlMode === 'keyboard' }" @click="controlMode = 'keyboard'">⌨️ 键盘</button>
      <button :class="{ active: controlMode === 'mouse' }" @click="controlMode = 'mouse'">🖱️ 鼠标跟随</button>
    </div>
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
   <canvas ref="canvasRef" 
  :width="tileCountX * gridSize" 
  :height="tileCountY * gridSize" 
  :style="{ width: '100%', height: 'auto', cursor: controlMode==='mouse' ? 'none' : 'default'}">
</canvas>

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

@keyframes blink {
  50% {
    opacity: 0;
  }
}

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

.highlight {
  color: #ffff55;
}

.highlight-green {
  color: #55ff55;
}

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
  #controls {
    display: none;
  }
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

#btn-up {
  grid-column: 2;
}

#btn-left {
  grid-column: 1;
  grid-row: 2;
}

#btn-right {
  grid-column: 3;
  grid-row: 2;
}

#btn-down {
  grid-column: 2;
  grid-row: 3;
}

.admin-trigger-zone {
  margin-top: 20px;
}

.dev-config-btn {
  background: transparent;
  border: 1px dashed #555;
  color: #666;
  padding: 6px 12px;
  font-size: 10px;
  cursor: pointer;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
}

.admin-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #000000;
  border: 4px solid #ffffff;
  padding: 25px;
  z-index: 110;
  width: 320px;
  color: white;
}

.admin-panel h3 {
  font-size: 12px;
  margin-top: 0;
  color: #ffff55;
}

.admin-panel textarea {
  width: 100%;
  height: 180px;
  margin-bottom: 10px;
  padding: 10px;
  background: #111;
  color: #55ff55;
  font-family: monospace;
  box-sizing: border-box;
  border: 2px solid #fff;
}

.admin-save-btn {
  background: #55ff55 !important;
  color: black !important;
  font-family: inherit;
  font-size: 10px;
  padding: 8px 16px;
}

.mode-selector {
  margin-bottom: 15px;
  display: flex;
  gap: 10px;
}

.mode-selector button {
  background: #222;
  border: 2px solid #fff;
  color: #fff;
  padding: 6px 12px;
  cursor: pointer;
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
}

.mode-selector button.active {
  background: #fff;
  color: #000;
}
</style>

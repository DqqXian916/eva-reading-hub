<template>
  <div class="game-wrapper">
    <div id="game-view">
      <div v-if="!gameState.roleSelected" id="start-overlay">
        <div class="start-content">
          <h1 class="title-main">摸金行动</h1>
          <div class="role-selector">
            <div class="role-card" :class="{ active: gameState.currentRole === 'alice' }"
              @click="gameState.currentRole = 'alice'">
              <div class="role-preview alice-box"></div>
              <div class="role-info">
                <span class="role-name">ALICE</span>
                <span class="role-tag">均衡型</span>
              </div>
            </div>
            <div class="role-card" :class="{ active: gameState.currentRole === 'allen' }"
              @click="gameState.currentRole = 'allen'">
              <div class="role-preview allen-box"></div>
              <div class="role-info">
                <span class="role-name">ALLEN</span>
                <span class="role-tag">敏捷型</span>
              </div>
            </div>
            <div class="role-card" :class="{ active: gameState.currentRole === 'lily' }"
              @click="gameState.currentRole = 'lily'">
              <div class="role-preview lily-box"></div>
              <div class="role-info">
                <span class="role-name">LILY</span>
                <span class="role-tag">感知型</span>
              </div>
            </div>
          </div>
          <button class="start-action-btn" @click="confirmRole">确认出发</button>
        </div>
      </div>
      <div id="world" :style="{ transform: `translateX(${gameState.wx}px)` }">
        <div class="floor-line"></div>
        <div v-for="(item, index) in treasures" :key="index" class="treasure" :style="{
          left: item.x + 'px',
          transform: `translateY(${item.y}px)`,
          opacity: item.collected ? 0 : 1
        }">

          <div v-if="item.y < 0" class="float-platform"></div>

          <div class="relic-visual-box" :class="{ 'is-broken': item.broken }"
            :style="{ '--glow-color': item.broken ? '#333' : item.rarityColor }">
            <div class="relic-icon">{{ item.broken ? '💨' : item.icon }}</div>
            <div v-if="!item.broken" class="relic-aura"></div>
          </div>

          <div v-if="gameState.nearItem === item && !gameState.showTerminal" class="interact-hint">
            <span class="key-box">SPACE</span> 鉴定
          </div>
        </div>
        <div v-for="(m, index) in monsters" :key="'m' + index" class="monster" :style="{
          left: m.x + 'px',
          transform: `translateY(${m.y}px)`,
          opacity: m.defeated ? 0 : 1
        }">
          <div class="monster-visual">
            <div class="monster-eye"></div>
            <div class="monster-core">👾</div>
            <div class="monster-smoke"></div>
          </div>
          <div class="monster-label">LV.{{ index + 1 }} 守护灵</div>
        </div>
      </div>
      <div id="alice-sprite" v-if="gameState.active && !gameState.finished" :style="{
        left: (gameState.px + gameState.wx) + 'px',
        bottom: (18 + (gameState.py * -0.1)) + '%',
        /* 核心修改：同时控制水平翻转和垂直压缩 */
        transform: `scaleX(${gameState.facingLeft ? -1 : 1}) scaleY(${gameState.isCrouching ? 0.88 : 1})`,
        /* 确保压缩时是贴地压缩，而不是中心压缩 */
        transformOrigin: 'bottom'
      }" :class="{
        'walking': gameState.moving && !gameState.isJumping,
        'jumping': gameState.isJumping,
        'crouching': gameState.isCrouching
      }">
        <div class="alice-tank-pixel"></div>
        <template v-if="gameState.currentRole === 'alice'">
          <div class="alice-hair-flow"></div>
          <div class="alice-body-pixel"></div>
        </template>
        <template v-else-if="gameState.currentRole === 'allen'">
          <div class="allen-hair-pixel"></div>
          <div class="allen-body-pixel"></div>
        </template>
        <template v-else-if="gameState.currentRole === 'lily'">
          <div class="lily-hair-pixel"></div>
          <div class="lily-blindfold-pixel"></div>
          <div class="lily-dress-pixel"></div>
          <div class="bubu-bunny-pixel"></div>
        </template>
      </div>
      <transition name="pop">
        <div v-if="gameState.showTerminal" id="terminal-overlay">
          <div class="terminal-card">
            <div class="scan-line"></div>
            <div class="relic-header">
              <div class="relic-status-tag">
                {{ gameState.isBattle ? 'BATTLE: GUARDIAN INTERCEPTED' : 'SYSTEM: IDENTIFYING ANTIQUITY...' }}
              </div>
              <div class="relic-main-display">
                <h2 class="relic-cn">{{ gameState.isBattle ? gameState.currentTarget?.en : gameState.currentTarget?.cn
                  }}</h2>
                <div v-if="!gameState.isBattle" class="relic-name-badge">{{ gameState.currentTarget?.relicName }}</div>
              </div>
              <div class="relic-divider"></div>
            </div>
            <div class="input-area">
              <div v-if="gameState.isBattle" class="battle-options">
                <button v-for="(opt, idx) in gameState.options" :key="idx" @click="handleSelect(opt)"
                  class="option-btn">
                  <span class="option-index">{{ idx === 0 ? 'A' : 'B' }}</span>
                  {{ opt.text }}
                </button>
              </div>

              <div v-else>
                <div class="input-label">请输入同步密钥 (EN)</div>
                <input ref="wordInput" v-model="userInput" @keyup.enter="checkWord" placeholder="TYPE SYNC KEY..."
                  autocomplete="off" :class="{ 'input-error-shake': gameState.inputError }">
              </div>
            </div>
            <div class="cancel-text">
              <span class="esc-key">ESC</span> 断开量子连接
            </div>
          </div>
        </div>
      </transition>
      <div v-if="!gameState.active && !gameState.finished" id="start-overlay">
        <div class="start-content">
          <h1 class="title-main">摸金行动</h1>
          <button class="start-action-btn" @click="startGame">开始摸金</button>
        </div>
      </div>
      <div v-if="gameState.finished" id="finish-screen">
        <div class="status-tag">MISSION ACCOMPLISHED</div>
        <div class="inventory-box">
          <h1 class="inv-title">上交清单</h1>
          <div class="word-list-scroll gold-scroll">
            <div v-for="(word, i) in inventory" :key="i" class="word-item">
              <span class="word-id">{{ (i + 1).toString().padStart(2, '0') }}</span>
              <span class="word-cn">{{ word.cn }}</span>
              <span class="word-en">{{ word.en }}</span>
              <span class="word-relic" :style="{ color: word.rarityColor }">{{ word.relicName }}</span>
              <div class="secured-tag">SECURED</div>
            </div>
          </div>

          <div class="rank-section">
            <div class="rank-box">
              <div class="rank-label">最终评级</div>
              <div class="rank-value gold-glow">{{ calculateRank() }}</div>
            </div>
            <div class="rank-details">
              <div class="rank-stat">回收进度: {{ inventory.length }} / 10</div>
              <div class="alice-credit">摸金校尉成功将珍宝带回现代</div>
            </div>
          </div>
          <button class="retry-btn-fancy" @click="resetGame">再次进入地宫</button>
        </div>
      </div>
            <div v-if="gameState.active && !gameState.finished" id="hud">
        <div class="hud-item" :class="{ 'ox-hurt-flash': gameState.oxHurt }"
          :style="{ color: gameState.roleStats[gameState.currentRole].theme, textShadow: `0 0 8px ${gameState.roleStats[gameState.currentRole].theme}` }">
          AGENT: {{ gameState.roleStats[gameState.currentRole].name }} | O2: {{ Math.floor(gameState.ox) }}%
        </div>
        <div class="hud-item gold-glow">圣物回收: {{ gameState.count }} / 10</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted } from 'vue';

const props = defineProps({ wordList: { type: Array, default: () => [] } });
const treasures = ref([]);
const inventory = ref([]);
const userInput = ref("");
const wordInput = ref(null);
const keys = {};
const monsters = ref([]);
const gameState = reactive({
  px: 400, wx: 0, ox: 100, count: 0,
  active: false,
  roleSelected: false,
  finished: false,
  moving: false,
  facingLeft: false,
  showTerminal: false,
  nearItem: null,
  currentTarget: null,
  inputError: false,
  attempts: 0,
  currentRole: 'alice',
  py: 0,        // 新增：角色的 Y 轴偏移 (0 为地面)
  vy: 0,        // 新增：垂直速度
  isJumping: false,
  isCrouching: false, // 必须在这里声明，否则 Vue 无法追踪其变化
  oxHurt: false, // 新增：用于控制氧气条闪红
  roleStats: {
    alice: { name: 'ALICE', speed: 6.5, jumpPower: -15, oxRate: 0.008, theme: '#4a90e2' },
    allen: { name: 'ALLEN', speed: 8.5, jumpPower: -18, oxRate: 0.012, theme: '#94a3b8' },// 艾伦跳得更高
    lily: { name: 'LILY', speed: 5.5, jumpPower: -14, oxRate: 0.005, theme: '#2d6a4f' } // 莉莉更省氧
  },
  isBattle: false,      // 是否正在战斗
  options: [],          // 存放两个选项 [{text: '正确', isCorrect: true}, ...]
});
const soundCollect = new Audio('https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3');
const soundWrong = new Audio('https://assets.mixkit.co/active_storage/sfx/2873/2873-preview.mp3');

const confirmRole = () => {
  gameState.roleSelected = true;
  startGame();
};

const relicMeta = [
  { name: "英语卷子", icon: "📜", color: "#4deeea" }, // 新增：带有浅蓝色科技感的试卷
  { name: "飞天神龙像", icon: "🐉", color: "#bc13fe" }, // 新增：紫色神龙
  { name: "祈愿圣杯", icon: "🏆", color: "#ffee00" }, // 新增：祈愿圣杯
  { name: "大内金樽", icon: "🏺", color: "#ffd700" },
  { name: "焦尾古琴", icon: "🪕", color: "#d4a373" },
  { name: "足金元宝", icon: "💰", color: "#ffcc00" },
  { name: "长信宫灯", icon: "🏮", color: "#ff4d4d" },
  { name: "羊脂玉扳指", icon: "💍", color: "#e0f2f1" },
  { name: "宫廷流苏", icon: "🧧", color: "#ff1744" },
  { name: "越洋炸鸡桶", icon: "🍗", color: "#ffa726" },
  { name: "象牙梳", icon: "🪮", color: "#fff9c4" },
  { name: "调兵虎符", icon: "🐅", color: "#8d6e63" },
  { name: "龙纹玉佩", icon: "💠", color: "#4db6ac" }
];

// 动态评级逻辑
const calculateRank = () => {
  const count = inventory.value.length; // 这里只算成功收集的
  if (count >= 10) return "SSS";
  if (count >= 7) return "S";  // 允许坏掉 3 个拿 S
  if (count >= 5) return "A";
  return "B";
};
// 统一封装播放逻辑，重置 currentTime 是消除延迟的关键
const playSound = (audio) => {
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Audio play blocked"));
};
const playCollectSound = () => playSound(soundCollect);
const playWrongSound = () => playSound(soundWrong);

// 2. 修改触发战斗的函数
const triggerBattle = (monster) => {
  gameState.currentTarget = monster;
  gameState.isBattle = true; // 关键：告诉 UI 现在是战斗模式
  gameState.showTerminal = true;
  gameState.inputError = false;
  // 1. 准备正确答案
  const correctOpt = { text: monster.cn, isCorrect: true };
  // 2. 准备干扰项（从词库里随便抓一个不一样的）
  const otherWords = props.wordList.filter(w => w.cn !== monster.cn);
  const wrongWord = otherWords.length > 0
    ? otherWords[Math.floor(Math.random() * otherWords.length)].cn
    : "未知领域"; // 保底干扰项
  const wrongOpt = { text: wrongWord, isCorrect: false };
  // 3. 随机排序 A/B 选项
  gameState.options = [correctOpt, wrongOpt].sort(() => Math.random() - 0.5);
};

// 修改 handleSelect 处理战斗点击
const handleSelect = (option) => {
  if (option.isCorrect) {
    playCollectSound();
    gameState.currentTarget.defeated = true;
    closeTerminal();
  } else {
    playWrongSound(); // 这里的 soundWrong 已经预加载了
    // 强化反馈逻辑
    gameState.ox -= 15;
    gameState.oxHurt = true; // 开启氧气闪红
    gameState.inputError = true;
    setTimeout(() => {
      gameState.inputError = false;
      gameState.oxHurt = false; // 0.5秒后恢复
    }, 500);
  }
};

// 确保 closeTerminal 重置所有状态
const closeTerminal = () => {
  gameState.showTerminal = false;
  gameState.isBattle = false; // 必须重置
  gameState.options = [];     // 清空选项
  userInput.value = "";
};
// 2. 初始化小怪 (在 initTreasures 之后调用)
const initMonsters = () => {
  const source = props.wordList.length > 0 ? props.wordList : [{ en: 'Ghost', cn: '幽灵' }];
  monsters.value = source.slice(0, 5).map((w, i) => ({
    ...w,
    x: 1200 + i * 1500 + Math.random() * 500, // 分散在圣物之间
    y: -80 - Math.random() * 100, // 在空中漂浮
    defeated: false,
    floatOffset: Math.random() * Math.PI * 2 // 随机相位
  }));
};

// 更新后的洗牌与初始化逻辑
// 修改 initTreasures 函数
const initTreasures = () => {
  const source = props.wordList.length > 0 ? props.wordList : Array.from({ length: 10 }, (_, i) => ({ en: `Artifact${i}`, cn: `古物${i}` }));
  const shuffledWords = [...source].sort(() => Math.random() - 0.5);
  // 分离稀有度：神级（神龙、圣杯）与其他
  const godTier = relicMeta.filter(m => m.name === "飞天神龙像" || m.name === "祈愿圣杯");
  const normalTier = relicMeta.filter(m => m.name !== "飞天神龙像" && m.name !== "祈愿圣杯");
  treasures.value = shuffledWords.slice(0, 10).map((w, i) => {
    // 85% 概率出普通，15% 概率出稀有（神龙或圣杯）
    const isRare = Math.random() < 0.15;
    const metaPool = isRare ? godTier : normalTier;
    const meta = metaPool[Math.floor(Math.random() * metaPool.length)];
    const isHigh = Math.random() > 0.5;
    return {
      ...w,
      relicName: meta.name,
      icon: meta.icon,
      rarityColor: meta.color,
      x: 800 + i * (600 + Math.random() * 200),
      y: isHigh ? -150 : 0,
      collected: false
    };
  });
};
// 3. 在 gameLoop 中增加怪物动画和碰撞检测
const updateMonsters = () => {
  monsters.value.forEach(m => {
    if (m.defeated) return;
    // 漂浮动画
    m.y += Math.sin(Date.now() / 500 + m.floatOffset) * 0.5;
    // 碰撞检测
    const dist = Math.sqrt(Math.pow(gameState.px - m.x, 2) + Math.pow(gameState.py - m.y, 2));
    // --- 修改这里：调用刚才写的 triggerBattle 函数 ---
    if (dist < 50 && !gameState.showTerminal) {
      triggerBattle(m); // 这里的函数会自动设置 isBattle 为 true 并生成选项
    }
  });
};
const startGame = () => { gameState.active = true; requestAnimationFrame(gameLoop); };
const resetGame = () => location.reload();

const gameLoop = () => {
  updateMonsters();
  if (!gameState.active || gameState.finished) return;
  const stats = gameState.roleStats[gameState.currentRole];
  // 下蹲检测
  gameState.isCrouching = (keys['KeyS'] || keys['ArrowDown']) && !gameState.isJumping;
  let currentSpeed = gameState.isCrouching ? stats.speed * 0.5 : stats.speed;
  // --- 横向移动控制 ---
  gameState.moving = (keys['KeyD'] || keys['ArrowRight'] || keys['KeyA'] || keys['ArrowLeft']) && !gameState.showTerminal;
  if (!gameState.showTerminal) {
    if (keys['KeyD'] || keys['ArrowRight']) { gameState.px += stats.speed; gameState.facingLeft = false; }
    if (keys['KeyA'] || keys['ArrowLeft']) { gameState.px -= stats.speed; gameState.facingLeft = true; }

    // --- 跳跃控制 (按下 W 或 上箭头，且不在空中) ---
    if ((keys['KeyW'] || keys['ArrowUp']) && !gameState.isJumping) {
      gameState.vy = stats.jumpPower;
      gameState.isJumping = true;
    }
  }

  // --- 垂直物理引擎 ---
  gameState.vy += 0.8; // 重力加速度
  gameState.py += gameState.vy;
  if (gameState.py >= 0) { // 触地检测
    gameState.py = 0;
    gameState.vy = 0;
    gameState.isJumping = false;
  }
  // 视角跟随
  gameState.wx = Math.min(0, -gameState.px + 400);
  // 氧气消耗
  gameState.ox -= stats.oxRate;
  if (gameState.ox <= 0) { gameState.finished = true; gameState.ox = 0; }
  // 碰撞/交互检测 (增加 Y 轴高度判断，防止在空中也能交互)
  gameState.nearItem = treasures.value.find(t =>
    !t.collected &&
    !t.broken &&
    Math.abs(gameState.px - t.x) < 70 &&
    Math.abs(gameState.py - t.y) < 60 // 玩家的 Y 坐标必须接近圣物的 Y 坐标
  ) || null;
  // 莉莉的感知范围加成 (70 -> 110)
  const senseRange = gameState.currentRole === 'lily' ? 110 : 70;
  gameState.nearItem = treasures.value.find(t =>
    !t.collected && !t.broken &&
    Math.abs(gameState.px - t.x) < senseRange &&
    Math.abs(gameState.py - t.y) < 60
  ) || null;
  requestAnimationFrame(gameLoop);
};

const checkWord = () => {
  const isCorrect = userInput.value.toLowerCase().trim() === gameState.currentTarget.en.toLowerCase();
  if (isCorrect) {
    playCollectSound();
    // 判断是圣物还是怪物
    if (gameState.currentTarget.relicName) {
      gameState.currentTarget.collected = true;
      inventory.value.push({ ...gameState.currentTarget });
      gameState.count++;
    } else {
      gameState.currentTarget.defeated = true; // 打败怪物
    }
    gameState.showTerminal = false;
    userInput.value = "";
    checkGameEnd();
  } else {
    // 失败扣氧气更狠，因为是“战斗”
    gameState.ox -= 15;
    gameState.inputError = true;
    setTimeout(() => { gameState.inputError = false; }, 500);
  }
};
onMounted(() => {
  initTreasures();
  initMonsters();
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' && gameState.nearItem && !gameState.showTerminal) {
      // 修改判断条件：增加 !gameState.nearItem.broken
      if (gameState.nearItem.broken) return;

      e.preventDefault();
      gameState.currentTarget = gameState.nearItem;
      gameState.showTerminal = true;
      gameState.attempts = 0; // 进入时重置计数
      nextTick(() => wordInput.value?.focus());
    }
    if (e.code === 'Escape') gameState.showTerminal = false;
  });
  window.addEventListener('keyup', (e) => keys[e.code] = false);
});
</script>

<style scoped>
.game-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  font-family: 'JetBrains Mono', monospace;
}

#game-view {
  width: 1000px;
  aspect-ratio: 2/1;
  position: relative;
  background: #080808;
  border: 1px solid #222;
  overflow: hidden;
}

/* HUD */
#hud {
  position: absolute;
  top: 15px;
  width: 100%;
  padding: 0 30px;
  display: flex;
  justify-content: space-between;
  z-index: 1000;
  box-sizing: border-box;
}

.cyan-glow {
  color: #00ffcc;
  text-shadow: 0 0 8px #00ffcc;
}

.gold-glow {
  color: #ffcc00;
  font-weight: bold;
  text-shadow: 0 0 10px #ffcc00;
}

/* 详情页与鉴定卡片 */
#terminal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
}

.terminal-card {
  width: 440px;
  padding: 45px;
  background: #0a0a0a;
  border: 1px solid #00ffcc;
  box-shadow: 0 0 30px rgba(0, 255, 204, 0.2);
  text-align: center;
  position: relative;
  overflow: hidden;
}

.relic-status-tag {
  color: #00ffcc;
  font-size: 10px;
  letter-spacing: 2px;
  margin-bottom: 15px;
  opacity: 0.8;
}

.relic-cn {
  color: #ffcc00;
  font-size: 42px;
  margin: 0;
  font-weight: 900;
}

.relic-name-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 2px 12px;
  border: 1px solid #ffcc00;
  color: #ffcc00;
  font-size: 14px;
}

.relic-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #00ffcc, transparent);
  margin: 25px auto;
  width: 80%;
}

input {
  width: 100%;
  background: rgba(0, 255, 204, 0.05);
  border: none;
  border-bottom: 2px solid #00ffcc;
  color: #fff;
  padding: 15px;
  font-size: 22px;
  text-align: center;
  outline: none;
}

/* 极简开始页 */
#start-overlay {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.start-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
}

.title-main {
  color: #ffcc00;
  font-size: 48px;
  font-weight: 900;
  letter-spacing: 10px;
  text-shadow: 0 0 20px rgba(255, 204, 0, 0.4);
  margin: 0;
}

.start-action-btn {
  padding: 15px 60px;
  background: transparent;
  border: 2px solid #ffcc00;
  color: #ffcc00;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 4px;
}

/* 针对试卷颜色的特殊光晕效果 */
.relic-visual-box[style*="#4deeea"] .relic-aura {
  border-radius: 4px;
  /* 让光晕方一点，更像纸张 */
  box-shadow: 0 0 15px #4deeea;
  animation: paper-scan 2s infinite alternate;
}

@keyframes paper-scan {
  0% {
    clip-path: inset(0 0 80% 0);
    /* 模拟扫描线从上往下 */
    opacity: 0.2;
  }

  100% {
    clip-path: inset(0 0 0 0);
    opacity: 0.6;
  }
}

.start-action-btn:hover {
  background: #ffcc00;
  color: #000;
  transform: scale(1.05);
}

/* 高级结算页样式 (找回区) */
#finish-screen {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 6000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.status-tag {
  color: #00ffcc;
  letter-spacing: 5px;
  font-size: 14px;
  margin-bottom: 15px;
  text-shadow: 0 0 10px rgba(0, 255, 204, 0.5);
}

.inventory-box {
  width: 800px;
  padding: 40px;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-top: 4px solid #ffcc00;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.inv-title {
  color: #ffcc00;
  text-align: center;
  font-size: 28px;
  margin-bottom: 30px;
  letter-spacing: 2px;
}

.word-list-scroll {
  max-height: 220px;
  overflow-y: auto;
  padding-right: 15px;
}

.word-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #1a1a1a;
}

.word-id {
  color: #444;
  width: 40px;
  font-size: 12px;
}

.word-relic {
  width: 150px;
  font-weight: bold;
}

.word-en {
  color: #00ffcc;
  flex: 1;
  font-weight: 800;
  font-size: 18px;
  margin: 0 20px;
}

.word-cn {
  color: #888;
}

.secured-tag {
  color: #00ffcc;
  border: 1px solid #00ffcc;
  font-size: 10px;
  padding: 1px 4px;
  opacity: 0.6;
}

.rank-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 35px;
  border-top: 1px solid #222;
  padding-top: 25px;
}

.rank-box {
  text-align: left;
}

.rank-label {
  color: #666;
  font-size: 12px;
  text-transform: uppercase;
}

.rank-value {
  font-size: 72px;
  font-weight: 900;
  line-height: 1;
  margin-top: 5px;
}

.rank-details {
  text-align: right;
}

.rank-stat {
  color: #ccc;
  font-size: 18px;
  margin-bottom: 5px;
}

.alice-credit {
  color: #444;
  font-size: 13px;
  font-style: italic;
}

.retry-btn-fancy {
  padding: 6px 30px;
  background: transparent;
  border: 1px solid #ffcc00;
  color: #ffcc00;
  cursor: pointer;
  font-weight: bold;
  margin-top: 25px;
  transition: 0.3s;
}

.retry-btn-fancy:hover {
  background: #ffcc00;
  color: #000;
}

/* 角色与世界 */
#alice-sprite {
  position: absolute;
  bottom: 18%;
  width: 44px;
  height: 80px;
  z-index: 500;
}

.alice-hair-flow {
  position: absolute;
  width: 4px;
  height: 4px;
  left: 0;
  top: 12px;
  box-shadow: 0px 0px #d4a373, 4px 0px #d4a373, 8px 0px #d4a373, 0px 8px #d4a373, 4px 8px #d4a373, 0px 16px #d4a373, 4px 16px #d4a373, 0px 24px #d4a373;
}

.alice-body-pixel {
  position: absolute;
  width: 4px;
  height: 4px;
  left: 16px;
  box-shadow: 0px 4px #4a90e2, 4px 4px #4a90e2, 0px 12px #ffe0bd, 4px 12px #ffe0bd, 0px 20px #4a90e2, 4px 20px #4a90e2, 0px 32px #333, 4px 32px #333;
}

.relic-visual-box {
  position: relative;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.relic-icon {
  font-size: 38px;
  z-index: 2;
  filter: drop-shadow(0 0 10px var(--glow-color));
}

.relic-aura {
  position: absolute;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--glow-color);
  opacity: 0.3;
  animation: breathe 3s infinite alternate;
}

#world {
  position: absolute;
  inset: 0;
  width: 10000px;
}

.floor-line {
  position: absolute;
  bottom: 18%;
  width: 100%;
  height: 1px;
  background: #222;
}

.treasure {
  position: absolute;
  bottom: 20%;
  width: 60px;
  height: 60px;
}

.interact-hint {
  position: absolute;
  top: -55px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  color: #fff;
  font-size: 13px;
}

.key-box {
  background: #ffcc00;
  color: #000;
  padding: 2px 6px;
  font-weight: bold;
  border-radius: 3px;
}

@keyframes breathe {
  from {
    transform: scale(0.9);
    opacity: 0.2;
  }

  to {
    transform: scale(1.1);
    opacity: 0.5;
  }
}

@keyframes scan {
  from {
    top: 0;
  }

  to {
    top: 100%;
  }
}

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: rgba(0, 255, 204, 0.3);
  animation: scan 3s linear infinite;
}

.walking {
  animation: bob-move 0.15s infinite alternate;
}

@keyframes bob-move {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(-5px);
  }
}

.gold-scroll::-webkit-scrollbar {
  width: 4px;
}

.gold-scroll::-webkit-scrollbar-thumb {
  background: #ffcc00;
}

/* 错误输入框交互 */
input.input-error-shake {
  border-bottom: 2px solid #ff4d4d !important;
  color: #ff4d4d !important;
  background: rgba(255, 77, 77, 0.1);
  animation: shake 0.4s cubic-bezier(.36, .07, .19, .97) both;
}

@keyframes shake {

  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }

  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }

  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }

  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

.relic-visual-box.broken {
  filter: grayscale(1);
  opacity: 0.4;
}

.role-selector {
  display: flex;
  gap: 30px;
  margin-bottom: 40px;
}

.role-card {
  width: 150px;
  padding: 20px;
  background: #111;
  border: 2px solid #333;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.role-card.active {
  border-color: #ffcc00;
  box-shadow: 0 0 15px rgba(255, 204, 0, 0.3);
  transform: scale(1.1);
}

.role-info {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
}

.role-name {
  color: #fff;
  font-weight: 800;
  letter-spacing: 1px;
}

.role-tag {
  color: #666;
  font-size: 10px;
  margin-top: 4px;
}

/* 角色像素样式 */
.alice-box {
  width: 30px;
  height: 40px;
  background: #4a90e2;
  margin: 0 auto;
}

/* --- 艾伦专属外观：西装与银发 --- */

/* 1. 银灰色短发 - 层次感设计 */
.allen-hair-pixel {
  position: absolute;
  width: 4px;
  height: 4px;
  left: 16px;
  top: 0px;
  /* 使用不同深度的灰色模拟发型轮廓 */
  box-shadow:
    0px 0px #cbd5e1, 4px 0px #f8fafc, 8px 0px #94a3b8,
    /* 顶层发丝 */
    0px 4px #cbd5e1, 4px 4px #cbd5e1, 8px 4px #94a3b8,
    /* 中层 */
    -4px 4px #94a3b8;
  /* 侧边鬓角 */
}

/* 2. 深色西装 - 重点在于中间的白衬衫 V 字区 */
.allen-body-pixel {
  position: absolute;
  width: 4px;
  height: 4px;
  left: 16px;
  box-shadow:
    /* 脸部/颈部 */
    0px 8px #ffe0bd, 4px 8px #ffe0bd,

    /* 西装外套与白衬衫 (白衬衫在 4px 12px 处体现) */
    -4px 12px #1e293b, 0px 12px #ffffff, 4px 12px #ffffff, 8px 12px #1e293b,
    -4px 16px #1e293b, 0px 16px #1e293b, 4px 16px #1e293b, 8px 16px #1e293b,

    /* 躯干 */
    -4px 20px #1e293b, 0px 20px #1e293b, 4px 20px #1e293b, 8px 20px #1e293b,
    0px 24px #1e293b, 4px 24px #1e293b,

    /* 西装裤 */
    0px 32px #0f172a, 4px 32px #0f172a,
    0px 36px #000, 4px 36px #000;
  /* 皮鞋 */
}

/* 3. 修改选择界面预览框的颜色 */
.allen-box {
  width: 30px;
  height: 40px;
  background: #1e293b;
  /* 深蓝灰色西装基调 */
  border-top: 8px solid #cbd5e1;
  /* 银发顶端 */
  margin: 0 auto;
  position: relative;
}

.allen-box::after {
  content: "";
  position: absolute;
  top: 15px;
  left: 11px;
  width: 8px;
  height: 6px;
  background: white;
  /* 预览图里的衬衫细节 */
}

/* 移除在空中时的走路摇晃动画 */
.walking:not(.jumping) {
  animation: bob-move 0.15s infinite alternate;
}

/* 跳跃时的姿态微调（可选） */
.jumping .alice-body-pixel,
.jumping .allen-body-pixel {
  transform: translateY(-2px);
}

/* 调整精灵图原始定位，确保 transform 生效 */
#alice-sprite {
  position: absolute;
  bottom: 18%;
  /* 地面基准线 */
  width: 44px;
  height: 80px;
  z-index: 500;
  transition: transform 0.05s linear;
  /* 极短的过渡让物理位移更平滑 */
}

.float-platform {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 4px;
  background: linear-gradient(90deg, transparent, #444, transparent);
}

/* 让高空的圣物有一点上下漂浮的动画感 */
.treasure[style*="translateY(-"] {
  animation: float-hover 2s infinite ease-in-out;
}

@keyframes float-hover {

  0%,
  100% {
    margin-top: 0;
  }

  50% {
    margin-top: -10px;
  }
}

/* 为神龙像增加特殊的紫色光晕 */
.relic-visual-box[style*="#bc13fe"] .relic-aura {
  border: 2px solid #bc13fe;
  box-shadow: 0 0 20px #bc13fe;
  animation: dragon-breathe 1.5s infinite alternate;
  /* 呼吸频率更快 */
}

@keyframes dragon-breathe {
  from {
    transform: scale(0.8);
    opacity: 0.3;
    filter: hue-rotate(0deg);
  }

  to {
    transform: scale(1.3);
    opacity: 0.7;
    filter: hue-rotate(45deg);
    /* 产生微小的颜色偏移，更有灵动感 */
  }
}

/* 莉莉的视觉细节 */
.lily-box {
  width: 30px;
  height: 40px;
  background: #2d6a4f;
  margin: 0 auto;
  border-top: 6px solid #4a3728;
  position: relative;
}

.lily-box::after {
  content: "";
  position: absolute;
  top: 10px;
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  /* 预览图眼罩 */
}

/* 像素点阵：短发与眼罩 */
.lily-hair-pixel {
  position: absolute;
  width: 4px;
  height: 4px;
  left: 16px;
  box-shadow: 0px 0px #4a3728, 4px 0px #4a3728, 8px 0px #4a3728, -4px 4px #4a3728, 12px 4px #4a3728;
}

.lily-blindfold-pixel {
  position: absolute;
  width: 4px;
  height: 4px;
  left: 16px;
  top: 8px;
  box-shadow: -4px 0px #e5e7eb, 0px 0px #e5e7eb, 4px 0px #e5e7eb, 8px 0px #e5e7eb;
}

/* 青绿色连衣裙 */
.lily-dress-pixel {
  position: absolute;
  width: 4px;
  height: 4px;
  left: 16px;
  top: 16px;
  box-shadow:
    -4px 0px #2d6a4f, 0px 0px #2d6a4f, 4px 0px #2d6a4f, 8px 0px #2d6a4f,
    -8px 4px #2d6a4f, -4px 4px #2d6a4f, 0px 4px #2d6a4f, 4px 4px #2d6a4f, 8px 4px #2d6a4f, 12px 4px #2d6a4f,
    0px 12px #2d6a4f, 4px 12px #2d6a4f;
}

/* 兔子玩偶布布 (位于怀中，颜色亮一点) */
.bubu-bunny-pixel {
  position: absolute;
  width: 4px;
  height: 4px;
  left: 20px;
  top: 20px;
  box-shadow: 0px 0px #f3f4f6, 0px -4px #f3f4f6, 4px -4px #f3f4f6;
  /* 小兔子耳朵和身体 */
}

/* 下蹲动画效果 */
.crouching {
  transform: translateY(10px) scaleY(0.88) !important;
}

.crouching .lily-dress-pixel {
  box-shadow: -8px 0px #2d6a4f, -4px 0px #2d6a4f, 0px 0px #2d6a4f, 4px 0px #2d6a4f, 8px 0px #2d6a4f, 12px 0px #2d6a4f;
}

/* 全局角色下蹲缩放 */
#alice-sprite.crouching {
  transform-origin: bottom center;
  /* 这里的 scaleX 会和模板里的 scaleX 冲突，所以我们通过 scaleY 来实现 */
  height: 50px !important;
  /* 强制压缩高度 */
}

/* 莉莉专属下蹲修正 */
.crouching .lily-dress-pixel {
  top: 10px;
  /* 下蹲时裙子位置微调 */
  box-shadow:
    -8px 0px #2d6a4f, -4px 0px #2d6a4f, 0px 0px #2d6a4f, 4px 0px #2d6a4f, 8px 0px #2d6a4f, 12px 0px #2d6a4f;
}

.crouching .bubu-bunny-pixel {
  top: 14px;
  /* 兔子也要跟着沉下去 */
}

/* 移除之前 .crouching 里的 transform，改用这个来微调内部元素 */
.crouching .lily-dress-pixel {
  /* 稍微调整阴影，让裙子看起来更“堆叠”在地上 */
  box-shadow: -8px 0px #2d6a4f, -4px 0px #2d6a4f, 0px 0px #2d6a4f, 4px 0px #2d6a4f, 8px 0px #2d6a4f, 12px 0px #2d6a4f !important;
}

.crouching .bubu-bunny-pixel {
  transform: translateY(3px);
  /* 兔子稍微下移 */
}

/* 走路动画在下蹲时减弱 */
.walking.crouching {
  animation-duration: 0.3s;
  /* 蹲着走比较慢，动画也变慢 */
}

/* 针对祈愿圣杯的专属圣光特效 */
.relic-visual-box[style*="#ffee00"] .relic-aura {
  border: 2px solid #ffee00;
  box-shadow: 0 0 25px #ffee00, inset 0 0 15px #ffffff;
  animation: holy-grail-glow 2s infinite ease-in-out;
}

/* 增加圣杯底部的粒子上升感（模拟效果） */
.relic-visual-box[style*="#ffee00"]::after {
  content: "✨";
  position: absolute;
  font-size: 12px;
  animation: sparkle-up 1.5s infinite;
  opacity: 0;
}

@keyframes holy-grail-glow {
  0% {
    transform: scale(0.8) rotate(0deg);
    opacity: 0.4;
    box-shadow: 0 0 10px #ffee00;
  }

  50% {
    transform: scale(1.4) rotate(180deg);
    opacity: 0.8;
    box-shadow: 0 0 40px #fff700, 0 0 60px rgba(255, 255, 255, 0.4);
  }

  100% {
    transform: scale(0.8) rotate(360deg);
    opacity: 0.4;
    box-shadow: 0 0 10px #ffee00;
  }
}

@keyframes sparkle-up {
  0% {
    transform: translateY(20px) scale(0.5);
    opacity: 0;
  }

  50% {
    opacity: 1;
  }

  100% {
    transform: translateY(-30px) scale(1.2);
    opacity: 0;
  }
}

.monster {
  position: absolute;
  bottom: 20%;
  width: 50px;
  height: 50px;
  z-index: 400;
  transition: opacity 0.3s;
}

.monster-visual {
  position: relative;
  font-size: 30px;
  filter: drop-shadow(0 0 10px #ff00ff);
  animation: monster-vibe 0.5s infinite alternate;
}

.monster-label {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  color: #ff4d4d;
  font-size: 10px;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 5px;
}

/* 怪物核心动画 */
@keyframes monster-vibe {
  from {
    transform: scale(1) skewX(-5deg);
  }

  to {
    transform: scale(1.1) skewX(5deg);
  }
}

/* 战斗时的终端样式微调 */
#terminal-overlay.is-battle {
  background: rgba(40, 0, 0, 0.9);
  /* 战斗时背景泛红 */
  border: 2px solid #ff4d4d;
}

/* 怪物眼睛闪烁 */
.monster-eye {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 4px;
  height: 4px;
  background: red;
  box-shadow: 0 0 5px red;
  z-index: 10;
}

/* 战斗模式下的红色预警 */
.is-battle .terminal-card {
  border-color: #ff4d4d;
  box-shadow: 0 0 30px rgba(255, 77, 77, 0.3);
}

.is-battle .relic-cn {
  color: #fff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.battle-options {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 20px;
}

.option-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #444;
  color: #fff;
  padding: 15px 20px;
  font-size: 18px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.option-btn:hover {
  background: rgba(255, 77, 77, 0.2);
  border-color: #ff4d4d;
  transform: translateX(10px);
}

.option-index {
  background: #ff4d4d;
  color: #000;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 15px;
  font-size: 14px;
}

/* 错误时的震动效果也复用到按钮上 */
.input-error-shake .option-btn {
  border-color: #ff4d4d;
}

/* 氧气受击闪红效果 */
.ox-hurt-flash {
  color: #ff4d4d !important;
  text-shadow: 0 0 20px #ff4d4d !important;
  transform: scale(1.1);
  /* 稍微放大一点增加冲击感 */
  transition: all 0.1s;
}

/* 增强战斗终端的受击反馈 */
.is-battle.input-error-shake .terminal-card {
  background: rgba(100, 0, 0, 0.4) !important;
  /* 背景变红 */
  border-color: #ff0000 !important;
}
/* HUD - 强化层级，确保在最顶层 */
#hud {
  position: absolute;
  top: 15px;
  width: 100%;
  padding: 0 30px;
  display: flex;
  justify-content: space-between;
  
  /* ======================================================== */
  /* [核心修改] 极高层级，确保覆盖全屏弹窗 */
  /* ======================================================== */
  z-index: 9999; 
  
  box-sizing: border-box;
  
  /* 可选：增加一个淡淡的黑色背景或阴影，
     当它覆盖在白色的“选项按钮”上时，保证清晰可读 */
  background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%);
  padding-top: 10px;
  padding-bottom: 20px;
  pointer-events: none; /* 确保 HUD 区域不会阻挡下方的点击事件 */
}

/* 确保 HUD 内部的文字是可读的 */
.hud-item {
  pointer-events: auto; /* 让文字部分重新接收事件（如果需要点击） */
}

/* 之前添加的闪红效果继续保留 */
.ox-hurt-flash {
  color: #ff4d4d !important;
  text-shadow: 0 0 20px #ff4d4d !important;
  transform: scale(1.1);
  transition: all 0.1s;
}
</style>
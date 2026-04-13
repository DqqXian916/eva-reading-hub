<template>
  <div class="game-wrapper">
    <div id="game-view">
      <div v-if="gameState.active && !gameState.finished" id="hud">
        <div class="hud-item cyan-glow">探员: ALICE | O2: {{ Math.floor(gameState.ox) }}%</div>
        <div class="hud-item gold-glow">圣物回收: {{ gameState.count }} / 10</div>
      </div>

      <div id="world" :style="{ transform: `translateX(${gameState.wx}px)` }">
        <div class="floor-line"></div>
        <div v-for="(item, index) in treasures" :key="index" class="treasure" :style="{ left: item.x + 'px', opacity: item.collected ? 0 : 1 }">
          <div class="relic-item">
            <svg viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="22" fill="none" stroke="#ffd700" stroke-width="4" stroke-dasharray="6 4" opacity="0.8"/>
            </svg>
          </div>
          <div v-if="gameState.nearItem === item && !gameState.showTerminal" class="interact-hint">
            <span class="key-box">SPACE</span> 同步圣物
          </div>
        </div>
      </div>

      <div id="alice-sprite" v-if="gameState.active && !gameState.finished"
        :style="{ left: (gameState.px + gameState.wx) + 'px', transform: `scaleX(${gameState.facingLeft ? -1 : 1})` }"
        :class="{ 'walking': gameState.moving }">
        <div class="alice-hair-flow"></div> <div class="alice-body-pixel"></div> <div class="alice-tank-pixel"></div> </div>
      
      <transition name="pop">
        <div v-if="gameState.showTerminal" id="terminal-overlay">
          <div class="terminal-card">
            <div class="scan-line"></div>
            <div class="relic-header">
              <h2 class="relic-cn">{{ gameState.currentTarget?.cn }}</h2>
              <span class="relic-sub">「{{ gameState.currentTarget?.relicName }}」</span>
            </div>
            <div class="input-area">
              <input ref="wordInput" v-model="userInput" @keyup.enter="checkWord" placeholder="SYNC ENGLISH KEY..." autocomplete="off">
            </div>
            <div class="cancel-text">按 ESC 取消同步系统</div>
          </div>
        </div>
      </transition>

      <div v-if="!gameState.active && !gameState.finished" id="start-overlay">
        <div class="title-main">摸金行动：ALICE</div>
        <button class="terminal-btn-primary" @click="startGame">启动同步系统</button>
      </div>

      <div v-if="gameState.finished" id="finish-screen">
        <div class="accomplished-header">MISSION ACCOMPLISHED</div>
        <div class="inv-card">
          <h1 class="main-title">地宫圣物上缴清单</h1>
          <div class="list-container gold-scroll">
            <div v-for="(word, i) in inventory" :key="i" class="list-item">
              <span class="id-tag">{{ (i+1).toString().padStart(2, '0') }}</span>
              <span class="relic-type">{{ word.relicName }}</span>
              <span class="relic-en">{{ word.en }}</span>
              <span class="relic-zh">{{ word.cn }}</span>
            </div>
          </div>
          <div class="final-rank">
            <div class="rank-label">最终评级</div>
            <div class="rank-val">SSS</div>
            <div class="alice-credit">校尉 Alice 成功回收全部圣物</div>
          </div>
          <button class="retry-btn" @click="resetGame">重新摸金</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted } from 'vue';

const props = defineProps({ wordList: { type: Array, default: () => [] } });
const gameState = reactive({ px: 400, wx: 0, ox: 100, count: 0, active: false, finished: false, moving: false, facingLeft: false, showTerminal: false, nearItem: null, currentTarget: null });
const treasures = ref([]);
const inventory = ref([]);
const userInput = ref("");
const wordInput = ref(null);
const keys = {};

const initTreasures = () => {
  const words = [...props.wordList].sort(() => Math.random() - 0.5).slice(0, 10);
  const names = ["黄金面具", "青铜神树", "鬼玺", "白玉如意", "金杖", "龙纹璧"];
  treasures.value = words.map((w, i) => ({
    ...w, relicName: names[i % names.length], x: 800 + i * 500, collected: false
  }));
};

const startGame = () => { gameState.active = true; requestAnimationFrame(gameLoop); };
const resetGame = () => location.reload();

const gameLoop = () => {
  if (!gameState.active || gameState.finished) return;
  gameState.moving = (keys['KeyD'] || keys['ArrowRight'] || keys['KeyA'] || keys['ArrowLeft']) && !gameState.showTerminal;
  if (!gameState.showTerminal) {
    if (keys['KeyD'] || keys['ArrowRight']) { gameState.px += 6.5; gameState.facingLeft = false; }
    if (keys['KeyA'] || keys['ArrowLeft']) { gameState.px -= 6.5; gameState.facingLeft = true; }
  }
  gameState.wx = Math.min(0, -gameState.px + 400);
  gameState.ox -= 0.008;
  gameState.nearItem = treasures.value.find(t => !t.collected && Math.abs(gameState.px - t.x) < 70) || null;
  requestAnimationFrame(gameLoop);
};

const checkWord = () => {
  if (userInput.value.toLowerCase().trim() === gameState.currentTarget.en.toLowerCase()) {
    gameState.currentTarget.collected = true;
    inventory.value.push({...gameState.currentTarget});
    gameState.count++; gameState.showTerminal = false; userInput.value = "";
    if (gameState.count >= 10) gameState.finished = true;
  } else { gameState.ox -= 10; userInput.value = ""; }
};

onMounted(() => {
  initTreasures();
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' && gameState.nearItem && !gameState.showTerminal) {
      e.preventDefault();
      gameState.currentTarget = gameState.nearItem;
      gameState.showTerminal = true;
      nextTick(() => wordInput.value?.focus());
    }
    if (e.code === 'Escape') gameState.showTerminal = false;
  });
  window.addEventListener('keyup', (e) => keys[e.code] = false);
});
</script>

<style scoped>
.game-wrapper { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #000; font-family: 'Courier New', monospace; }
#game-view { width: 1000px; aspect-ratio: 2/1; position: relative; background: #050505; border: 1px solid #222; overflow: hidden; }

/* HUD 优化：防止溢出 */
#hud { position: absolute; top: 15px; width: 100%; padding: 0 30px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; }
.cyan-glow { color: #00ffcc; text-shadow: 0 0 5px rgba(0,255,204,0.5); }
.gold-glow { color: #ffcc00; font-weight: bold; text-shadow: 0 0 5px rgba(255,204,0,0.5); }

/* Alice 形象进化 */
#alice-sprite { position: absolute; bottom: 18%; width: 44px; height: 80px; z-index: 500; }
.alice-hair-flow {
  position: absolute; width: 4px; height: 4px; left: 0; top: 12px;
  box-shadow: 0px 0px #d4a373, 4px 0px #d4a373, 8px 0px #d4a373, 12px 0px #d4a373,
    0px 8px #d4a373, 4px 8px #d4a373, 8px 8px #d4a373, 12px 8px #d4a373,
    0px 16px #d4a373, 4px 16px #d4a373, 0px 24px #d4a373, 4px 24px #d4a373, 0px 32px #d4a373;
}
.alice-body-pixel {
  position: absolute; width: 4px; height: 4px; left: 16px;
  box-shadow: 0px 4px #4a90e2, 4px 4px #4a90e2, /* 蓝色发带 */
    0px 12px #ffe0bd, 4px 12px #ffe0bd, /* 脸 */
    0px 20px #4a90e2, 4px 20px #4a90e2, /* 身体 */
    0px 32px #333, 4px 32px #333; /* 腿 */
}
.alice-tank-pixel {
  position: absolute; width: 4px; height: 4px; left: 12px; top: 32px;
  background: #ffcc00; box-shadow: 0px 4px #ffcc00; /* 黄色气罐 */
}

/* 首页按钮样式 */
.terminal-btn-primary {
  position: absolute; top: 80px; left: 40px; padding: 8px 20px;
  background: #ffffff !important; color: #000 !important;
  border: 1px solid #666; font-weight: bold; cursor: pointer;
}

/* 交互提示 */
.interact-hint { position: absolute; top: -40px; left: 50%; transform: translateX(-50%); white-space: nowrap; color: #fff; font-size: 12px; }
.key-box { background: #ffcc00; color: #000; padding: 2px 5px; font-weight: bold; border-radius: 2px; }

/* 弹窗文案加固 */
#terminal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 5000; }
.terminal-card { width: 400px; padding: 40px; border: 1px solid #00ffcc; background: #0a0a0a; text-align: center; }
.relic-cn { color: #ffcc00; font-size: 32px; margin: 0; display: block; }
.relic-sub { color: #666; font-size: 14px; display: block; margin-top: 10px; }
input { width: 100%; background: transparent; border: none; border-bottom: 2px solid #00ffcc; color: #fff; padding: 12px; font-size: 20px; text-align: center; outline: none; margin-top: 30px; }

/* 其他样式 */
.walking { animation: bob-run 0.15s infinite alternate; }
@keyframes bob-run { from { transform: translateY(0); } to { transform: translateY(-5px); } }
#world { position: absolute; inset: 0; width: 10000px; }
.floor-line { position: absolute; bottom: 18%; width: 100%; height: 1px; background: #222; }
.treasure { position: absolute; bottom: 20%; width: 50px; height: 50px; }
</style>
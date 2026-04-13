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
          <div class="relic-visual-box" :style="{ '--glow-color': item.rarityColor }">
            <div class="relic-icon">{{ item.icon }}</div>
            <div class="relic-texture-overlay"></div>
            <div class="relic-aura"></div>
          </div>
          <div v-if="gameState.nearItem === item && !gameState.showTerminal" class="interact-hint">
            <span class="key-box">SPACE</span> 鉴定「{{ item.relicName }}」
          </div>
        </div>
      </div>

      <div id="alice-sprite" v-if="gameState.active && !gameState.finished"
        :style="{ left: (gameState.px + gameState.wx) + 'px', transform: `scaleX(${gameState.facingLeft ? -1 : 1})` }"
        :class="{ 'walking': gameState.moving }">
        <div class="alice-hair-flow"></div>
        <div class="alice-body-pixel"></div>
        <div class="alice-tank-pixel"></div> 
      </div>
      
      <transition name="pop">
        <div v-if="gameState.showTerminal" id="terminal-overlay">
          <div class="terminal-card">
            <div class="scan-line"></div>
            <div class="relic-header">
              <div class="relic-status-tag">SYSTEM: IDENTIFYING ANTIQUITY...</div>
              <div class="relic-main-display">
                <h2 class="relic-cn">{{ gameState.currentTarget?.cn }}</h2>
                <div class="relic-name-badge">{{ gameState.currentTarget?.relicName }}</div>
              </div>
              <div class="relic-divider"></div>
            </div>
            <div class="input-area">
              <div class="input-label">请输入同步密钥 (EN)</div>
              <input ref="wordInput" v-model="userInput" @keyup.enter="checkWord" placeholder="TYPE SYNC KEY..." autocomplete="off">
            </div>
            <div class="cancel-text">
              <span class="esc-key">ESC</span> 断开量子连接
            </div>
          </div>
        </div>
      </transition>

      <div v-if="!gameState.active && !gameState.finished" id="start-overlay">
        <div class="start-content">
          <h1 class="title-main">摸金行动：ALICE</h1>
          <button class="start-action-btn" @click="startGame">开始行动</button>
        </div>
      </div>

      <div v-if="gameState.finished" id="finish-screen">
        <div class="status-tag">MISSION ACCOMPLISHED</div>
        <div class="inventory-box">
          <h1 class="inv-title">上交清单</h1>
          <div class="word-list-scroll gold-scroll">
            <div v-for="(word, i) in inventory" :key="i" class="word-item">
              <span class="word-id">{{ (i+1).toString().padStart(2, '0') }}</span>
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

const relicMeta = [
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
  const count = inventory.value.length;
  if (count >= 10) return "SSS";
  if (count >= 8) return "S";
  if (count >= 6) return "A";
  return "B";
};

const initTreasures = () => {
  const source = props.wordList.length > 0 ? props.wordList : Array.from({length: 10}, (_, i) => ({en: `Artifact${i}`, cn: `古物${i}`}));
  const words = [...source].sort(() => Math.random() - 0.5).slice(0, 10);
  treasures.value = words.map((w, i) => {
    const meta = relicMeta[i % relicMeta.length];
    return { ...w, relicName: meta.name, icon: meta.icon, rarityColor: meta.color, x: 800 + i * 600, collected: false };
  });
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
  if (gameState.ox <= 0) { gameState.finished = true; gameState.ox = 0; }
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
.game-wrapper { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #000; font-family: 'JetBrains Mono', monospace; }
#game-view { width: 1000px; aspect-ratio: 2/1; position: relative; background: #080808; border: 1px solid #222; overflow: hidden; }

/* HUD */
#hud { position: absolute; top: 15px; width: 100%; padding: 0 30px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; }
.cyan-glow { color: #00ffcc; text-shadow: 0 0 8px #00ffcc; }
.gold-glow { color: #ffcc00; font-weight: bold; text-shadow: 0 0 10px #ffcc00; }

/* 详情页与鉴定卡片 */
#terminal-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 5000; }
.terminal-card { width: 440px; padding: 45px; background: #0a0a0a; border: 1px solid #00ffcc; box-shadow: 0 0 30px rgba(0, 255, 204, 0.2); text-align: center; position: relative; overflow: hidden; }
.relic-status-tag { color: #00ffcc; font-size: 10px; letter-spacing: 2px; margin-bottom: 15px; opacity: 0.8; }
.relic-cn { color: #ffcc00; font-size: 42px; margin: 0; font-weight: 900; }
.relic-name-badge { display: inline-block; margin-top: 8px; padding: 2px 12px; border: 1px solid #ffcc00; color: #ffcc00; font-size: 14px; }
.relic-divider { height: 1px; background: linear-gradient(90deg, transparent, #00ffcc, transparent); margin: 25px auto; width: 80%; }
input { width: 100%; background: rgba(0, 255, 204, 0.05); border: none; border-bottom: 2px solid #00ffcc; color: #fff; padding: 15px; font-size: 22px; text-align: center; outline: none; }

/* 极简开始页 */
#start-overlay { position: absolute; inset: 0; background: #000; z-index: 5000; display: flex; align-items: center; justify-content: center; text-align: center; }
.start-content { display: flex; flex-direction: column; align-items: center; gap: 40px; }
.title-main { color: #ffcc00; font-size: 48px; font-weight: 900; letter-spacing: 10px; text-shadow: 0 0 20px rgba(255, 204, 0, 0.4); margin: 0; }
.start-action-btn { padding: 15px 60px; background: transparent; border: 2px solid #ffcc00; color: #ffcc00; font-size: 20px; font-weight: bold; cursor: pointer; transition: all 0.3s; letter-spacing: 4px; }
.start-action-btn:hover { background: #ffcc00; color: #000; transform: scale(1.05); }

/* 高级结算页样式 (找回区) */
#finish-screen { position: absolute; inset: 0; background: #000; z-index: 6000; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.status-tag { color: #00ffcc; letter-spacing: 5px; font-size: 14px; margin-bottom: 15px; text-shadow: 0 0 10px rgba(0,255,204,0.5); }
.inventory-box { width: 800px; padding: 40px; background: #0a0a0a; border: 1px solid #1a1a1a; border-top: 4px solid #ffcc00; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.inv-title { color: #ffcc00; text-align: center; font-size: 28px; margin-bottom: 30px; letter-spacing: 2px; }
.word-list-scroll { max-height: 220px; overflow-y: auto; padding-right: 15px; }
.word-item { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #1a1a1a; }
.word-id { color: #444; width: 40px; font-size: 12px; }
.word-relic { width: 150px; font-weight: bold; }
.word-en { color: #00ffcc; flex: 1; font-weight: 800; font-size: 18px; margin: 0 20px; }
.word-cn { color: #888; }
.secured-tag { color: #00ffcc; border: 1px solid #00ffcc; font-size: 10px; padding: 1px 4px; opacity: 0.6; }

.rank-section { display: flex; align-items: center; justify-content: space-between; margin-top: 35px; border-top: 1px solid #222; padding-top: 25px; }
.rank-box { text-align: left; }
.rank-label { color: #666; font-size: 12px; text-transform: uppercase; }
.rank-value { font-size: 72px; font-weight: 900; line-height: 1; margin-top: 5px; }
.rank-details { text-align: right; }
.rank-stat { color: #ccc; font-size: 18px; margin-bottom: 5px; }
.alice-credit { color: #444; font-size: 13px; font-style: italic; }

.retry-btn-fancy { padding: 12px 30px; background: transparent; border: 1px solid #ffcc00; color: #ffcc00; cursor: pointer; font-weight: bold; margin-top: 25px; transition: 0.3s; }
.retry-btn-fancy:hover { background: #ffcc00; color: #000; }

/* 角色与世界 */
#alice-sprite { position: absolute; bottom: 18%; width: 44px; height: 80px; z-index: 500; }
.alice-hair-flow { position: absolute; width: 4px; height: 4px; left: 0; top: 12px; box-shadow: 0px 0px #d4a373, 4px 0px #d4a373, 8px 0px #d4a373, 0px 8px #d4a373, 4px 8px #d4a373, 0px 16px #d4a373, 4px 16px #d4a373, 0px 24px #d4a373; }
.alice-body-pixel { position: absolute; width: 4px; height: 4px; left: 16px; box-shadow: 0px 4px #4a90e2, 4px 4px #4a90e2, 0px 12px #ffe0bd, 4px 12px #ffe0bd, 0px 20px #4a90e2, 4px 20px #4a90e2, 0px 32px #333, 4px 32px #333; }
.relic-visual-box { position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; }
.relic-icon { font-size: 38px; z-index: 2; filter: drop-shadow(0 0 10px var(--glow-color)); }
.relic-aura { position: absolute; width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--glow-color); opacity: 0.3; animation: breathe 3s infinite alternate; }
#world { position: absolute; inset: 0; width: 10000px; }
.floor-line { position: absolute; bottom: 18%; width: 100%; height: 1px; background: #222; }
.treasure { position: absolute; bottom: 20%; width: 60px; height: 60px; }
.interact-hint { position: absolute; top: -55px; left: 50%; transform: translateX(-50%); white-space: nowrap; color: #fff; font-size: 13px; }
.key-box { background: #ffcc00; color: #000; padding: 2px 6px; font-weight: bold; border-radius: 3px; }
@keyframes breathe { from { transform: scale(0.9); opacity: 0.2; } to { transform: scale(1.1); opacity: 0.5; } }
@keyframes scan { from { top: 0; } to { top: 100%; } }
.scan-line { position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: rgba(0, 255, 204, 0.3); animation: scan 3s linear infinite; }
.walking { animation: bob-move 0.15s infinite alternate; }
@keyframes bob-move { from { transform: translateY(0); } to { transform: translateY(-5px); } }
.gold-scroll::-webkit-scrollbar { width: 4px; }
.gold-scroll::-webkit-scrollbar-thumb { background: #ffcc00; }
</style>
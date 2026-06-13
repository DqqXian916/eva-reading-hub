<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useGameStore } from '../../stores/gameStore'; 

const props = defineProps({
  canEdit: Boolean
});

const emit = defineEmits(['updateConfig', 'saveConfig']);
const gameStore = useGameStore();

// --- 状态管理 ---
const hp = ref(5); 
const favor = ref(0); 
const currentRound = ref(1); 
const totalRounds = 5;
const isFinished = ref(false);
const isComboAnim = ref(false);
const showAdmin = ref(false);
const configText = ref('');
const hearts = ref([]);
let heartId = 0;
const isShaking = ref(false);

// 连连看核心选中状态
const selectedEnglish = ref(null); 
const selectedChinese = ref(null); 
const matchedUids = ref([]); 

// 单词池
const gameWordsPool = ref([]);
const currentRoundWords = ref([]); 
const englishCards = ref([]); 
const chineseCards = ref([]); 

// --- 换装系统控制 ---
const activeBodyOutfit = ref('default'); 
const isHairAccEquipped = ref(false);
const isEarringsEquipped = ref(false);
const isBagEquipped = ref(false);
const isCrownEquipped = ref(false);

// --- 全量衣橱配置储备库 ---
const allClothesPool = [
  { name: '缎带法夹', icon: '🎀', type: 'hair-acc' },
  { name: '橙色休闲短袖', icon: '👕', type: 'casual-orange' },
  { name: '紫色瑜伽服', icon: '🧘‍♀️', type: 'yoga-purple' },
  { name: '珍珠耳坠', icon: '💎', type: 'earrings' },
  { name: '黑白跆拳道服', icon: '🥋', type: 'taekwondo' },
  { name: '绿色校服', icon: '🏫', type: 'school-green' },
  { name: '粉蓝芭蕾服', icon: '🩰', type: 'ballet' },
  { name: '热情拉丁舞蹈裙', icon: '💃', type: 'dance-red' },
  { name: '丹宁牛仔休闲装', icon: '👖', type: 'casual-denim' },
  { name: '粉色羽绒服', icon: '🧥', type: 'down-jacket' },
  { name: '奢雅兔包', icon: '👜', type: 'bag' },
  { name: '流金一字肩晚礼服', icon: '👗', type: 'evening-gold' },
  { name: '清凉海风泳装', icon: '👙', type: 'swimsuit' },
  { name: '元气百褶网球装', icon: '🎾', type: 'tennis' },
  { name: '璀璨皇冠', icon: '👑', type: 'crown' }
];

// 本局随机生成的 5 件高定配置
const clothesConfig = ref([]);

const clothesTypes = [
  'casual-orange', 'yoga-purple', 'taekwondo', 'school-green', 'ballet', 
  'down-jacket', 'dance-red', 'casual-denim', 'evening-gold', 'swimsuit', 'tennis'
];

const selectOutfit = (item) => {
  if (favor.value < item.level) return;
  playDressUpSound();

  if (clothesTypes.includes(item.type)) {
    activeBodyOutfit.value = activeBodyOutfit.value === item.type ? 'default' : item.type;
  } else if (item.type === 'hair-acc') {
    isHairAccEquipped.value = !isHairAccEquipped.value;
  } else if (item.type === 'earrings') {
    isEarringsEquipped.value = !isEarringsEquipped.value;
  } else if (item.type === 'bag') {
    isBagEquipped.value = !isBagEquipped.value;
  } else if (item.type === 'crown') {
    isCrownEquipped.value = !isCrownEquipped.value;
  }
};

const autoEquipLatest = (unlockedLevel) => {
  const item = clothesConfig.value.find(c => c.level === unlockedLevel);
  if (!item) return;
  if (clothesTypes.includes(item.type)) {
    activeBodyOutfit.value = item.type;
  } else if (item.type === 'hair-acc') {
    isHairAccEquipped.value = true;
  } else if (item.type === 'earrings') {
    isEarringsEquipped.value = true;
  } else if (item.type === 'bag') {
    isBagEquipped.value = true;
  } else if (item.type === 'crown') {
    isCrownEquipped.value = true;
  }
};

const shuffleArray = (array) => {
  return array.map(value => ({ value, sort: Math.random() }))
              .sort((a, b) => a.sort - b.sort)
              .map(({ value }) => value);
};

const speak = (text) => {
  if (!text) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/_/g, '').replace(/\(.*\)/g, '').replace(/（.*）/g, '').replace(/[^\x00-\xff]/g, '').trim();
  const msg = new SpeechSynthesisUtterance(cleanText);
  msg.lang = 'en-US';
  msg.rate = 0.85;
  window.speechSynthesis.speak(msg);
};

const playUnlockSound = () => {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, ctx.currentTime); 
  osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); 
  osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); 
  osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.36); 
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.6);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.6);
};

const playDressUpSound = () => {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(698.46, ctx.currentTime); 
  osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.08); 
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
};

const playErrorSound = () => {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, ctx.currentTime); 
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

const handleSaveConfig = () => {
  try {
    const newWords = JSON.parse(configText.value);
    gameStore.updateConfig(newWords, 5); 
    emit('updateConfig', newWords); 
    showAdmin.value = false;
    resetGame();
  } catch (e) {
    alert('JSON格式错误: ' + e.message);
  }
};

const initGamePool = () => {
  const sourceList = gameStore.wordList && gameStore.wordList.length > 0 
    ? gameStore.wordList 
    : [{ en: "pink", cn: "粉色" }, { en: "dress", cn: "连衣裙" }, { en: "crown", cn: "皇冠" }]; 

  let tempPool = [...sourceList];
  while (tempPool.length < 15) {
    tempPool = tempPool.concat(sourceList);
  }
  
  const shuffled = shuffleArray(tempPool).slice(0, 15);
  gameWordsPool.value = shuffled.map((word, index) => ({
    ...word,
    uid: index 
  }));
};

// 核心改动：开启新一季时，完全随机筛选并绑定5身新衣服
const initRandomWardrobe = () => {
  const randomSet = shuffleArray([...allClothesPool]).slice(0, 5);
  clothesConfig.value = randomSet.map((item, index) => ({
    ...item,
    level: index + 1 // 分配本局的 1 至 5 级解锁门槛
  }));
};

const startRound = () => {
  if (gameWordsPool.value.length === 0) return;
  
  selectedEnglish.value = null;
  selectedChinese.value = null;
  matchedUids.value = [];

  const startIdx = (currentRound.value - 1) * 3;
  const wordsForRound = gameWordsPool.value.slice(startIdx, startIdx + 3);
  currentRoundWords.value = wordsForRound;

  const enCards = wordsForRound.map(w => ({ uid: w.uid, text: w.en, type: 'en' }));
  const cnCards = wordsForRound.map(w => ({ uid: w.uid, text: w.cn, type: 'cn' }));

  englishCards.value = shuffleArray(enCards);
  chineseCards.value = shuffleArray(cnCards);
};

const selectCard = (card) => {
  if (matchedUids.value.includes(card.uid)) return;

  if (card.type === 'en') {
    if (selectedEnglish.value?.uid === card.uid) {
      selectedEnglish.value = null; 
    } else {
      selectedEnglish.value = card;
      speak(card.text); 
    }
  } else {
    if (selectedChinese.value?.uid === card.uid) {
      selectedChinese.value = null;
    } else {
      selectedChinese.value = card;
    }
  }

  if (selectedEnglish.value && selectedChinese.value) {
    if (selectedEnglish.value.uid === selectedChinese.value.uid) {
      matchedUids.value.push(selectedEnglish.value.uid);
      spawnHeart();
      
      selectedEnglish.value = null;
      selectedChinese.value = null;

      if (matchedUids.value.length === 3) {
        setTimeout(() => {
          completeRound();
        }, 600);
      }
    } else {
      playErrorSound();
      isShaking.value = true;
      hp.value--;

      if (hp.value <= 0) {
        isFinished.value = true;
      }

      setTimeout(() => {
        isShaking.value = false;
        selectedEnglish.value = null;
        selectedChinese.value = null;
      }, 600);
    }
  }
};

const completeRound = () => {
  playUnlockSound();
  const nextLevel = favor.value + 1;
  
  favor.value = Math.min(5, favor.value + 1); // 5轮连连看，每轮通关精确解锁1件
  isComboAnim.value = true;

  setTimeout(() => {
    autoEquipLatest(nextLevel);
  }, 100);
  
  setTimeout(() => {
    isComboAnim.value = false;
    if (currentRound.value < totalRounds) {
      currentRound.value++;
      startRound();
    } else {
      isFinished.value = true;
    }
  }, 1000);
};

const resetGame = () => { 
  favor.value = 0; 
  hp.value = 5; 
  currentRound.value = 1;
  isFinished.value = false; 
  matchedUids.value = [];
  activeBodyOutfit.value = 'default';
  isHairAccEquipped.value = false;
  isEarringsEquipped.value = false;
  isBagEquipped.value = false;
  isCrownEquipped.value = false;
  initGamePool();
  initRandomWardrobe(); // 新一季重置时随机刷新衣橱
  startRound();
};

const spawnHeart = () => {
  const id = heartId++;
  hearts.value.push({ id, icon: ['✨', '💎', '🌟', '💖'][Math.floor(Math.random() * 4)], x: Math.random() * 40 + 30, y: 35 });
  setTimeout(() => hearts.value = hearts.value.filter(h => h.id !== id), 1200);
};

watch(
  () => gameStore.wordList, 
  (newList) => {
    if (newList && newList.length > 0) {
      configText.value = JSON.stringify(newList, null, 2);
      resetGame();
    }
  }, 
  { immediate: true, deep: true } 
);

onMounted(() => {
  resetGame();
});

onUnmounted(() => window.speechSynthesis.cancel());
</script>

<template>
  <div class="game-viewport">
    <div v-if="showAdmin" class="overlay" @click="showAdmin = false"></div>
    <div v-if="showAdmin" class="admin-panel">
      <h3>Atelier 词库管理</h3>
      <textarea v-model="configText" placeholder="请输入JSON格式词库"></textarea>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="btn main-action-btn" @click="handleSaveConfig">保存配置</button>
      </div>
    </div>

    <div id="game-box">
      <template v-if="gameStore.wordList && gameStore.wordList.length > 0">
        
        <!-- 高级轻奢标题区 -->
        <header class="atelier-header">
          <div class="header-brand">PRÉCIEUX ATELIER</div>
          <div class="header-sub">高定换装沙龙</div>
          <div class="hp-pendant">
            <span v-for="n in 5" :key="n" class="crystal-heart" :class="{ 'depleted': n > hp }">✦</span>
          </div>
        </header>

        <div v-for="heart in hearts" :key="heart.id" class="floating-heart" :style="{ left: heart.x + '%', top: heart.y + '%' }">{{ heart.icon }}</div>

        <!-- 主内容区 -->
        <div class="salon-layout">
          
          <!-- ================= 左栏：高定试衣镜港湾 ================= -->
          <div class="atelier-mirror-zone">
            <div class="mirror-frame" :class="{ 'combo-bounce': isComboAnim }">
              <div class="gilded-arch"></div>
              
              <!-- ================= 核心：全新高保真 SVG 绘图引擎 ================= -->
              <svg viewBox="0 0 200 270" class="princess-vector-doll">
                <defs>
                  <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fff6f0" />
                    <stop offset="100%" stop-color="#ffdcb8" />
                  </linearGradient>
                  <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#5a4136" />
                    <stop offset="50%" stop-color="#3b251c" />
                    <stop offset="100%" stop-color="#21120b" />
                  </linearGradient>
                  <linearGradient id="denimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#5b8bb3" />
                    <stop offset="100%" stop-color="#3c6182" />
                  </linearGradient>
                  <linearGradient id="balletGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="rgba(162, 210, 255, 0.9)" />
                    <stop offset="100%" stop-color="rgba(114, 182, 245, 0.5)" />
                  </linearGradient>
                  <linearGradient id="goldDressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f3e5ab" />
                    <stop offset="50%" stop-color="#d4af37" />
                    <stop offset="100%" stop-color="#aa7c11" />
                  </linearGradient>
                  <linearGradient id="latinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#ff4d4d" />
                    <stop offset="100%" stop-color="#b30000" />
                  </linearGradient>
                  <linearGradient id="swimsuitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#4ae3e4" />
                    <stop offset="100%" stop-color="#00a8cc" />
                  </linearGradient>
                </defs>

                <!-- LAYER 1: 后置披肩长发 -->
                <path d="M 100,28 C 80,28 64,50 64,80 C 64,115 58,155 70,190 C 78,205 122,205 130,190 C 142,155 136,115 136,80 C 136,50 120,28 100,28 Z" fill="url(#hairGrad)" />

                <!-- LAYER 2: 纤细双腿 -->
                <rect x="85" y="145" width="9" height="105" rx="4" fill="url(#skinGrad)" />
                <rect x="106" y="145" width="9" height="105" rx="4" fill="url(#skinGrad)" />

                <!-- LAYER 3: 优雅手臂 -->
                <path d="M 75,85 C 60,95 56,110 80,122" fill="none" stroke="url(#skinGrad)" stroke-width="7.5" stroke-linecap="round" />
                <path d="M 125,85 C 132,102 130,122 122,142" fill="none" stroke="url(#skinGrad)" stroke-width="7.5" stroke-linecap="round" />

                <!-- LAYER 4: 优雅直角肩躯干与天鹅颈 -->
                <path d="M 75,85 L 125,85 C 122,110 115,120 112,145 L 88,145 C 85,120 78,110 75,85 Z" fill="url(#skinGrad)" />
                <rect x="94" y="65" width="12" height="25" rx="2" fill="url(#skinGrad)" />

                <!-- LAYER 5: 鹅蛋脸与精美妆容 -->
                <circle cx="100" cy="54" r="21" fill="url(#skinGrad)" />
                <path d="M 87,46 Q 91,44 95,47" stroke="#3a2312" stroke-width="1.2" fill="none" stroke-linecap="round" />
                <path d="M 105,47 Q 109,44 113,46" stroke="#3a2312" stroke-width="1.2" fill="none" stroke-linecap="round" />

                <g class="anime-eyes">
                  <ellipse cx="91" cy="54" rx="4" ry="5.5" fill="#2c1a11" />
                  <ellipse cx="91" cy="55.5" rx="3.2" ry="4" fill="#604235" />
                  <ellipse cx="91" cy="54" rx="2" ry="2.5" fill="#150b07" />
                  <circle cx="89.5" cy="52" r="1.5" fill="#ffffff" />
                  <circle cx="92.5" cy="56" r="0.8" fill="#ffffff" />
                  <path d="M 87,51 Q 91,47 95,51" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" />

                  <ellipse cx="109" cy="54" rx="4" ry="5.5" fill="#2c1a11" />
                  <ellipse cx="109" cy="55.5" rx="3.2" ry="4" fill="#604235" />
                  <ellipse cx="109" cy="54" rx="2" ry="2.5" fill="#150b07" />
                  <circle cx="107.5" cy="52" r="1.5" fill="#ffffff" />
                  <circle cx="110.5" cy="56" r="0.8" fill="#ffffff" />
                  <path d="M 105,51 Q 109,47 113,51" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" />
                </g>

                <ellipse cx="88" cy="59" rx="4" ry="2" fill="#ffb8b8" opacity="0.6" />
                <ellipse cx="112" cy="59" rx="4" ry="2" fill="#ffb8b8" opacity="0.6" />
                <circle cx="100" cy="58" r="1" fill="#e5c1b3" />
                <path d="M 98,62 Q 100,64 102,62" stroke="#e06262" stroke-width="1.5" fill="none" stroke-linecap="round" />
                
                <!-- LAYER 6: 飘逸空气刘海 & 垂胸立体鬓角 -->
                <path d="M 77,50 C 75,28 125,28 123,50 C 114,46 107,46 100,49 C 93,46 86,46 77,50 Z" fill="url(#hairGrad)" />
                <path d="M 78,48 C 74,68 73,95 78,115 C 81,115 81,95 81,75 Z" fill="url(#hairGrad)" />
                <path d="M 122,48 C 126,68 127,95 122,115 C 119,115 119,95 119,75 Z" fill="url(#hairGrad)" />
                <ellipse cx="100" cy="38" rx="14" ry="2" fill="rgba(255,255,255,0.22)" />


                <!-- ================= LAYER 7: 服装判定显隐舱 ================= -->
                
                <g v-if="activeBodyOutfit === 'default'" class="svg-outfit">
                  <path d="M 75,85 L 125,85 C 120,105 115,115 112,130 L 88,130 C 85,115 80,105 75,85 Z" fill="#ffffff" opacity="0.95" stroke="#f0d5cc" stroke-width="1" />
                  <line x1="84" y1="85" x2="84" y2="72" stroke="#ffffff" stroke-width="1.5" />
                  <line x1="116" y1="85" x2="116" y2="72" stroke="#ffffff" stroke-width="1.5" />
                </g>

                <g v-if="activeBodyOutfit === 'casual-orange'" class="svg-outfit">
                  <path d="M 74,84 L 126,84 C 122,102 115,108 112,114 L 88,114 C 85,108 78,102 74,84 Z" fill="#f26a36" />
                  <path d="M 75,85 C 56,92 58,102 72,106" fill="#f26a36" />
                  <path d="M 125,85 C 144,92 142,102 128,106" fill="#f26a36" />
                  <path d="M 88,116 L 112,116 L 115,138 L 85,138 Z" fill="url(#denimGrad)" />
                </g>

                <g v-if="activeBodyOutfit === 'yoga-purple'" class="svg-outfit">
                  <path d="M 77,85 L 123,85 C 120,100 115,102 112,108 L 88,108 C 85,102 80,100 77,85 Z" fill="#b39ddb" />
                  <line x1="86" y1="85" x2="94" y2="72" stroke="#7e57c2" stroke-width="2.5" />
                  <line x1="114" y1="85" x2="106" y2="72" stroke="#7e57c2" stroke-width="2.5" />
                  <path d="M 88,122 L 112,122 L 114,235 L 105,235 L 100,145 L 95,235 L 86,235 Z" fill="#7e57c2" />
                </g>

                <g v-if="activeBodyOutfit === 'taekwondo'" class="svg-outfit">
                  <path d="M 87,130 L 113,130 L 115,225 L 105,225 L 100,145 L 95,225 L 85,225 Z" fill="#ffffff" stroke="#e0e0e0" stroke-width="1" />
                  <path d="M 73,83 L 127,83 C 122,108 116,120 113,135 L 87,135 C 84,120 78,108 73,83 Z" fill="#ffffff" stroke="#e0e0e0" stroke-width="1" />
                  <path d="M 93,83 L 100,94 L 107,83" fill="none" stroke="#222222" stroke-width="3" />
                  <rect x="83" y="125" width="34" height="6" rx="1" fill="#231b15" />
                </g>

                <g v-if="activeBodyOutfit === 'school-green'" class="svg-outfit">
                  <path d="M 73,84 L 127,84 C 122,110 116,115 113,126 L 87,126 C 84,115 78,110 73,84 Z" fill="#0f4c3a" />
                  <path d="M 94,84 L 100,92 L 106,84 Z" fill="#ffffff" />
                  <path d="M 87,126 L 113,126 L 117,148 L 83,148 Z" fill="#1b634e" />
                </g>

                <g v-if="activeBodyOutfit === 'ballet'" class="svg-outfit">
                  <path d="M 77,85 L 123,85 C 120,105 115,112 112,122 L 88,122 C 85,112 80,105 77,85 Z" fill="#fcd5ce" stroke="#fbc3bc" stroke-width="1" />
                  <ellipse cx="100" cy="122" rx="34" ry="11" fill="url(#balletGrad)" stroke="rgba(162, 210, 255, 0.6)" stroke-width="1" />
                </g>

                <g v-if="activeBodyOutfit === 'dance-red'" class="svg-outfit">
                  <path d="M 76,85 L 124,85 L 112,125 L 88,125 Z" fill="url(#latinGrad)" />
                  <path d="M 76,85 L 100,105 L 124,85" fill="none" stroke="#ffe5e5" stroke-width="1.5" />
                  <path d="M 88,125 Q 65,150 75,175 Q 100,165 125,180 Q 135,145 112,125 Z" fill="url(#latinGrad)" />
                </g>

                <g v-if="activeBodyOutfit === 'casual-denim'" class="svg-outfit">
                  <path d="M 73,85 L 127,85 L 122,128 L 78,128 Z" fill="url(#denimGrad)" stroke="#c5a059" stroke-width="1" />
                  <path d="M 75,85 C 55,95 56,115 65,125" fill="none" stroke="url(#denimGrad)" stroke-width="8" stroke-linecap="round" />
                  <path d="M 94,85 L 100,95 L 106,85 Z" fill="#ffffff" />
                  <path d="M 87,128 L 113,128 L 115,235 L 102,235 L 100,145 L 98,235 L 85,235 Z" fill="#222222" />
                </g>

                <g v-if="activeBodyOutfit === 'down-jacket'" class="svg-outfit">
                  <path d="M 71,83 L 129,83 C 126,112 120,125 115,138 L 85,138 C 80,125 74,112 71,83 Z" fill="#ffb3c1" stroke="#ffa2b4" stroke-width="1" />
                  <path d="M 82,82 C 90,72 110,72 118,82 C 110,88 90,88 82,82 Z" fill="#ffffff" />
                </g>

                <g v-if="activeBodyOutfit === 'evening-gold'" class="svg-outfit">
                  <path d="M 70,92 C 85,86 115,86 130,92 L 120,128 L 80,128 Z" fill="url(#goldDressGrad)" />
                  <path d="M 80,128 L 120,128 C 135,180 155,225 160,250 L 40,250 C 45,225 65,180 80,128 Z" fill="url(#goldDressGrad)" />
                </g>

                <g v-if="activeBodyOutfit === 'swimsuit'" class="svg-outfit">
                  <path d="M 84,98 Q 92,98 96,108 Q 88,114 84,98 Z" fill="url(#swimsuitGrad)" />
                  <path d="M 116,98 Q 108,98 104,108 Q 112,114 116,98 Z" fill="url(#swimsuitGrad)" />
                  <path d="M 96,108 L 100,75 L 104,108" fill="none" stroke="#00a8cc" stroke-width="1.5" />
                  <path d="M 86,134 L 114,134 L 118,152 L 82,152 Z" fill="url(#swimsuitGrad)" />
                </g>

                <g v-if="activeBodyOutfit === 'tennis'" class="svg-outfit">
                  <path d="M 77,85 L 123,85 L 114,124 L 86,124 Z" fill="#ffffff" stroke="#eeeeee" stroke-width="1" />
                  <path d="M 86,124 L 114,124 L 120,150 L 80,150 Z" fill="#ffffff" stroke="#3ca6ff" stroke-width="1" />
                  <line x1="91" y1="124" x2="87" y2="150" stroke="#3ca6ff" stroke-width="1.5" />
                  <line x1="103" y1="124" x2="105" y2="150" stroke="#3ca6ff" stroke-width="1.5" />
                </g>


                <!-- ================= LAYER 8: 配饰舱 ================= -->
                <g v-if="isCrownEquipped" class="svg-accessory">
                  <path d="M 86,33 L 89,22 L 95,28 L 100,16 L 105,28 L 111,22 L 114,33 Z" fill="#e5c1b3" stroke="#d4af37" stroke-width="1.5" />
                  <circle cx="100" cy="15" r="2" fill="#d4af37" />
                </g>

                <g v-if="isHairAccEquipped" class="svg-accessory">
                  <path d="M 112,38 C 113,32 120,32 121,38 C 120,44 113,44 112,38 Z" fill="#ffa2b4" />
                  <path d="M 121,38 C 122,32 129,32 130,38 C 129,44 122,44 121,38 Z" fill="#ffa2b4" />
                  <circle cx="121" cy="38" r="3" fill="#ffffff" />
                </g>

                <g v-if="isEarringsEquipped" class="svg-accessory">
                  <line x1="77" y1="58" x2="77" y2="67" stroke="#d4af37" stroke-width="1" />
                  <circle cx="77" cy="68" r="2" fill="#ffffff" stroke="#ddd" stroke-width="0.5" />
                  <line x1="123" y1="58" x2="123" y2="67" stroke="#d4af37" stroke-width="1" />
                  <circle cx="123" cy="68" r="2" fill="#ffffff" stroke="#ddd" stroke-width="0.5" />
                </g>

                <g v-if="isBagEquipped" class="svg-accessory">
                  <path d="M 124,142 C 122,126 142,126 140,142" fill="none" stroke="#d4af37" stroke-width="2.5" />
                  <rect x="122" y="142" width="22" height="18" rx="4" fill="#ffffff" stroke="#e5989b" stroke-width="1.5" />
                </g>
              </svg>

            </div>
          </div>

          <!-- ================= 右栏：配对棋盘沙龙 ================= -->
          <div class="atelier-game-zone">
            <div v-if="!isFinished && hp > 0" class="game-board-container">
              <div class="round-badge">COLLECTION • 第 {{ currentRound }} / {{ totalRounds }} 组</div>
              
              <div :class="['luxury-matching-board', { 'shake-anim': isShaking }]">
                <div class="card-column">
                  <button 
                    v-for="card in englishCards" 
                    :key="'en-' + card.uid"
                    :class="['luxury-card', { 'selected': selectedEnglish?.uid === card.uid }, { 'matched': matchedUids.includes(card.uid) }]"
                    @click="selectCard(card)"
                  >
                    <span class="card-text">{{ card.text }}</span>
                    <span class="card-dot"></span>
                  </button>
                </div>

                <div class="card-column">
                  <button 
                    v-for="card in chineseCards" 
                    :key="'cn-' + card.uid"
                    :class="['luxury-card', { 'selected': selectedChinese?.uid === card.uid }, { 'matched': matchedUids.includes(card.uid) }]"
                    @click="selectCard(card)"
                  >
                    <span class="card-text">{{ card.text }}</span>
                    <span class="card-dot"></span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 结算面板 -->
            <div v-else class="atelier-settlement">
              <div class="settlement-symbol">{{ hp <= 0 ? '✦' : '✧' }}</div>
              <h4 class="settlement-title">{{ hp <= 0 ? 'COUTURE PAUSED' : 'ATELIER PERFECT' }}</h4>
              <p class="settlement-desc">
                {{ hp <= 0 ? '星光有些黯淡了。别担心，重新叩响高定沙龙的大门吧。' : '绝美连线！你用智慧点亮了整座衣橱，本季5款精选高定礼服已成功解锁。' }}
              </p>
              <button class="btn luxury-action-btn" @click="resetGame">
                {{ hp <= 0 ? '重置衣橱' : '开启新一季' }}
              </button>
            </div>
          </div>

        </div>

        <!-- ================= 底部：本季精选 5 身衣橱 ================= -->
        <footer class="atelier-wardrobe-footer">
          <div class="wardrobe-progress">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: (favor / 5 * 100) + '%' }"></div>
            </div>
            <div class="progress-stats">
              <span>本季已珍藏设计 : {{ favor }} / 5</span>
              <span class="guide-tip">✦ 开启新一季将重新随机抽取5件 ✦</span>
            </div>
          </div>

          <div class="wardrobe-grid">
            <div 
              v-for="item in clothesConfig" 
              :key="item.level" 
              :class="[
                'wardrobe-slot',
                { 'locked': favor < item.level },
                { 'active-wearing': activeBodyOutfit === item.type || (item.type === 'hair-acc' && isHairAccEquipped) || (item.type === 'earrings' && isEarringsEquipped) || (item.type === 'bag' && isBagEquipped) || (item.type === 'crown' && isCrownEquipped) }
              ]"
              @click="selectOutfit(item)"
            >
              <div class="slot-name-tag" v-if="favor >= item.level">{{ item.name }}</div>
              <div class="slot-icon">{{ item.icon }}</div>
              <div class="slot-glow"></div>
            </div>
          </div>
        </footer>

      </template>

      <!-- 词库为空 -->
      <div v-else class="empty-words">
        <div class="empty-seal">✦</div>
        <p class="empty-text">Atelier 目前空无一人，请等待 Eva 老师置入珍贵的单词图纸...</p>
        <button v-if="canEdit" class="btn luxury-action-btn" @click="showAdmin = true">配置图纸</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ================= 全局轻奢变量 ================= */
.game-viewport { 
  --gold-primary: #d4af37;
  --gold-light: #e5c1b3;
  --ivory: #faf7f2;
  --charcoal: #2c2a29;
  --rose-mist: #f5ebe6;
  --accent-depleted: #d1cbc4;
  
  display: flex; 
  justify-content: center; 
  align-items: center; 
  min-height: 540px; 
  width: 100%; 
  background: #fdfbf7; 
  font-family: 'Times New Roman', 'Georgia', 'PingFang SC', serif; 
}

#game-box { 
  margin-top: 10px; 
  background: var(--ivory); 
  width: 660px; 
  padding: 24px 28px; 
  border-radius: 4px; 
  box-shadow: 0 20px 60px rgba(44, 42, 41, 0.06); 
  position: relative; 
  border: 1px solid rgba(212, 175, 55, 0.25);
}

/* ================= Header ================= */
.atelier-header {
  border-bottom: 1px solid rgba(44, 42, 41, 0.06);
  padding-bottom: 12px;
  margin-bottom: 20px;
  text-align: center;
}
.header-brand {
  font-size: 1.15rem;
  letter-spacing: 6px;
  color: var(--charcoal);
  font-weight: 700;
}
.header-sub {
  font-size: 0.65rem;
  letter-spacing: 3px;
  color: #8a8580;
  margin-top: 3px;
}
.hp-pendant {
  margin-top: 6px;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.crystal-heart {
  font-size: 1.1rem;
  color: var(--gold-primary);
  text-shadow: 0 0 4px rgba(212, 175, 55, 0.2);
}
.crystal-heart.depleted {
  color: var(--accent-depleted);
  text-shadow: none;
}

/* ================= 布局 ================= */
.salon-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 24px;
  align-items: center;
}

/* ================= 左栏：高定试衣镜拱门 ================= */
.atelier-mirror-zone {
  display: flex;
  justify-content: center;
}
.mirror-frame {
  width: 200px;
  height: 290px;
  background: linear-gradient(180deg, #ffffff 0%, #fcfbf9 100%);
  border: 1px solid rgba(212, 175, 55, 0.35);
  box-shadow: inset 0 0 20px rgba(212, 175, 55, 0.04), 0 10px 30px rgba(0,0,0,0.02);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: 12px;
  overflow: hidden;
}
.gilded-arch {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-top: 3px solid var(--gold-primary);
  border-radius: 50% / 15% 15% 0 0; 
  pointer-events: none;
  opacity: 0.5;
}

.princess-vector-doll {
  width: 180px;
  height: 260px;
  filter: drop-shadow(0 5px 15px rgba(84, 61, 52, 0.12)); 
}

.svg-outfit, .svg-accessory {
  animation: dressFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* ================= 右栏：配对棋盘 ================= */
.atelier-game-zone {
  flex: 1;
}
.round-badge {
  font-size: 0.65rem;
  letter-spacing: 3px;
  color: var(--gold-primary);
  font-weight: 700;
  margin-bottom: 12px;
  text-transform: uppercase;
}
.luxury-matching-board {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  min-height: 180px;
}
.luxury-card {
  background: #ffffff;
  border: 1px solid rgba(44, 42, 41, 0.08);
  border-radius: 0px; 
  padding: 14px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 5px rgba(0,0,0,0.01);
  position: relative;
  font-family: inherit;
  outline: none;
  width: 100%;
}
.luxury-card .card-text {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--charcoal);
}
.luxury-card .card-dot {
  width: 5px;
  height: 5px;
  background: var(--gold-light);
  border-radius: 50%;
}
.luxury-card:hover:not(.matched) {
  border-color: var(--gold-primary);
  background: #fffdfa;
}
.luxury-card.selected {
  border-color: var(--gold-primary);
  background: var(--rose-mist);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.1);
}
.luxury-card.matched {
  border-color: transparent;
  background: transparent;
  cursor: default;
}
.luxury-card.matched .card-text {
  color: #c5c0ba;
  text-decoration: line-through;
}
.luxury-card.matched .card-dot {
  background: #e0deda;
}
.card-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ================= 底部 5 格精致衣橱 ================= */
.atelier-wardrobe-footer {
  margin-top: 24px;
  border-top: 1px solid rgba(44, 42, 41, 0.06);
  padding-top: 16px;
}
.wardrobe-progress {
  margin-bottom: 12px;
}
.progress-track {
  height: 2px;
  background: #e8e5e0;
  width: 100%;
  position: relative;
}
.progress-fill {
  height: 100%;
  background: var(--gold-primary);
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: #8a8580;
  margin-top: 6px;
  letter-spacing: 1px;
}
.guide-tip {
  color: var(--gold-primary);
}
.wardrobe-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr); /* 5件对齐，展示更大气舒适 */
  gap: 16px;
  max-width: 500px;
  margin: 0 auto;
}
.wardrobe-slot {
  background: #ffffff;
  border: 1px solid rgba(44, 42, 41, 0.06);
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}
.wardrobe-slot .slot-icon {
  font-size: 1.6rem;
  transition: transform 0.2s ease;
}
.slot-name-tag {
  position: absolute;
  bottom: 4px;
  font-size: 0.55rem;
  color: #8a8580;
  transform: scale(0.9);
  white-space: nowrap;
}
.wardrobe-slot.locked {
  background: #f2efea;
  cursor: not-allowed;
}
.wardrobe-slot.locked .slot-icon {
  filter: blur(2px) grayscale(1);
  opacity: 0.4;
}
.wardrobe-slot.locked::after {
  content: '🔒';
  position: absolute;
  font-size: 0.6rem;
  bottom: 4px;
  right: 4px;
  opacity: 0.6;
}
.wardrobe-slot:not(.locked):hover {
  border-color: var(--gold-primary);
}
.wardrobe-slot:not(.locked):hover .slot-icon {
  transform: scale(1.12);
}
.wardrobe-slot.active-wearing {
  border-color: var(--gold-primary);
  background: var(--rose-mist);
}
.wardrobe-slot.active-wearing::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 4px;
  height: 4px;
  background: var(--gold-primary);
  border-radius: 50%;
}

/* ================= 结算面板与动画 ================= */
.atelier-settlement {
  text-align: center;
  padding: 30px 10px;
}
.settlement-symbol {
  font-size: 2rem;
  color: var(--gold-primary);
  margin-bottom: 8px;
}
.settlement-title {
  font-size: 1.05rem;
  letter-spacing: 4px;
  color: var(--charcoal);
  margin-bottom: 8px;
}
.settlement-desc {
  font-size: 0.8rem;
  color: #7a7570;
  line-height: 1.6;
  max-width: 280px;
  margin: 0 auto 20px;
}
.btn {
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 2px;
  font-size: 0.75rem;
  transition: all 0.2s;
}
.luxury-action-btn {
  background: var(--charcoal);
  color: #ffffff;
}
.luxury-action-btn:hover {
  background: #423f3e;
}
.empty-words {
  text-align: center;
  padding: 60px 0;
}
.empty-seal {
  font-size: 2rem;
  color: var(--gold-primary);
  margin-bottom: 12px;
}
.empty-text {
  font-size: 0.85rem;
  color: #8a8580;
  margin-bottom: 20px;
}
.admin-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #ffffff;
  border: 1px solid var(--gold-primary);
  padding: 20px;
  z-index: 100;
  width: 80%;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}
.admin-panel textarea {
  width: 100%;
  height: 150px;
  margin-top: 10px;
  font-family: monospace;
}
.overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.2);
  z-index: 99;
}

/* --- 动态动效集锦 --- */
@keyframes dressFade {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.combo-bounce {
  animation: bounce 0.5s ease;
}
@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
.shake-anim {
  animation: shake 0.4s ease;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.floating-heart {
  position: absolute;
  font-size: 1.2rem;
  pointer-events: none;
  animation: floatUp 1.2s cubic-bezier(0.075, 0.82, 0.165, 1) forwards;
  z-index: 10;
}
@keyframes floatUp {
  0% { transform: translateY(0) scale(0.5); opacity: 1; }
  100% { transform: translateY(-60px) scale(1.2); opacity: 0; }
}
</style>
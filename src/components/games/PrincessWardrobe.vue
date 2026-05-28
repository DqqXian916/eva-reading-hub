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
const activeBodyOutfit = ref('default'); // default, casual-orange, yoga-purple, taekwondo, school-green, ballet, down-jacket
const isHairAccEquipped = ref(false);
const isEarringsEquipped = ref(false);
const isBagEquipped = ref(false);
const isCrownEquipped = ref(false);

// --- 衣柜配置 ---
const clothesConfig = [
  { level: 1, name: '缎带法夹', icon: '🎀', type: 'hair-acc' },
  { level: 2, name: '橙色休闲短袖', icon: '👕', type: 'casual-orange' },
  { level: 3, name: '紫色瑜伽服', icon: '🧘‍♀️', type: 'yoga-purple' },
  { level: 4, name: '珍珠耳坠', icon: '💎', type: 'earrings' },
  { level: 5, name: '黑白跆拳道服', icon: '🥋', type: 'taekwondo' },
  { level: 6, name: '绿色校服', icon: '🏫', type: 'school-green' },
  { level: 7, name: '粉蓝芭蕾服', icon: '🩰', type: 'ballet' },
  { level: 8, name: '粉色羽绒服', icon: '🧥', type: 'down-jacket' },
  { level: 9, name: '奢雅兔包', icon: '👜', type: 'bag' },
  { level: 10, name: '璀璨皇冠', icon: '👑', type: 'crown' }
];

const selectOutfit = (item) => {
  if (favor.value < item.level) return;
  playDressUpSound();

  if (['casual-orange', 'yoga-purple', 'taekwondo', 'school-green', 'ballet', 'down-jacket'].includes(item.type)) {
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
  const item = clothesConfig.find(c => c.level === unlockedLevel);
  if (!item) return;
  if (['casual-orange', 'yoga-purple', 'taekwondo', 'school-green', 'ballet', 'down-jacket'].includes(item.type)) {
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
    gameStore.updateConfig(newWords, 10); 
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
  const item1Level = favor.value + 1;
  const item2Level = favor.value + 2;
  
  favor.value += 2; 
  isComboAnim.value = true;

  setTimeout(() => {
    autoEquipLatest(item1Level);
    autoEquipLatest(item2Level);
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
                  <!-- 柔和细腻的肤色渐变 -->
                  <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fff6f0" />
                    <stop offset="100%" stop-color="#ffdcb8" />
                  </linearGradient>
                  <!-- 极具丝滑质感的栗色秀发渐变 -->
                  <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#5a4136" />
                    <stop offset="50%" stop-color="#3b251c" />
                    <stop offset="100%" stop-color="#21120b" />
                  </linearGradient>
                  <!-- 牛仔渐变 -->
                  <linearGradient id="denimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#5b8bb3" />
                    <stop offset="100%" stop-color="#3c6182" />
                  </linearGradient>
                  <!-- 芭蕾舞裙粉蓝色渐变 -->
                  <linearGradient id="balletGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="rgba(162, 210, 255, 0.9)" />
                    <stop offset="100%" stop-color="rgba(114, 182, 245, 0.5)" />
                  </linearGradient>
                </defs>

                <!-- LAYER 1: 完美收束的温婉后置披肩长发 (不再分叉，比例自然) -->
                <path d="M 100,28 C 80,28 64,50 64,80 C 64,115 58,155 70,190 C 78,205 122,205 130,190 C 142,155 136,115 136,80 C 136,50 120,28 100,28 Z" fill="url(#hairGrad)" />

                <!-- LAYER 2: 纤细双腿 -->
                <rect x="85" y="145" width="9" height="105" rx="4" fill="url(#skinGrad)" />
                <rect x="106" y="145" width="9" height="105" rx="4" fill="url(#skinGrad)" />

                <!-- LAYER 3: 优雅手臂 (左手经典叉腰，右手微拂垂落) -->
                <!-- 左臂叉腰 -->
                <path d="M 75,85 C 60,95 56,110 80,122" fill="none" stroke="url(#skinGrad)" stroke-width="7.5" stroke-linecap="round" />
                <!-- 右臂舒展下垂 -->
                <path d="M 125,85 C 132,102 130,122 122,142" fill="none" stroke="url(#skinGrad)" stroke-width="7.5" stroke-linecap="round" />

                <!-- LAYER 4: 优雅直角肩躯干 -->
                <path d="M 75,85 L 125,85 C 122,110 115,120 112,145 L 88,145 C 85,120 78,110 75,85 Z" fill="url(#skinGrad)" />
                <!-- 纤细天鹅颈 -->
                <rect x="94" y="65" width="12" height="25" rx="2" fill="url(#skinGrad)" />

                <!-- LAYER 5: 鹅蛋脸与精美妆容 -->
                <circle cx="100" cy="54" r="21" fill="url(#skinGrad)" />
                
                <!-- 精致微卷眉毛 -->
                <path d="M 87,46 Q 91,44 95,47" stroke="#3a2312" stroke-width="1.2" fill="none" stroke-linecap="round" />
                <path d="M 105,47 Q 109,44 113,46" stroke="#3a2312" stroke-width="1.2" fill="none" stroke-linecap="round" />

                <!-- 灵动双层高光星眸 -->
                <g class="anime-eyes">
                  <!-- 左眼 -->
                  <ellipse cx="91" cy="54" rx="4" ry="5.5" fill="#2c1a11" />
                  <ellipse cx="91" cy="55.5" rx="3.2" ry="4" fill="#604235" />
                  <ellipse cx="91" cy="54" rx="2" ry="2.5" fill="#150b07" />
                  <circle cx="89.5" cy="52" r="1.5" fill="#ffffff" />
                  <circle cx="92.5" cy="56" r="0.8" fill="#ffffff" />
                  <path d="M 87,51 Q 91,47 95,51" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" />
                  <!-- 右眼 -->
                  <ellipse cx="109" cy="54" rx="4" ry="5.5" fill="#2c1a11" />
                  <ellipse cx="109" cy="55.5" rx="3.2" ry="4" fill="#604235" />
                  <ellipse cx="109" cy="54" rx="2" ry="2.5" fill="#150b07" />
                  <circle cx="107.5" cy="52" r="1.5" fill="#ffffff" />
                  <circle cx="110.5" cy="56" r="0.8" fill="#ffffff" />
                  <path d="M 105,51 Q 109,47 113,51" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" />
                </g>

                <!-- 桃子粉腮红、小巧鼻尖与蜜桃唇 -->
                <ellipse cx="88" cy="59" rx="4" ry="2" fill="#ffb8b8" opacity="0.6" />
                <ellipse cx="112" cy="59" rx="4" ry="2" fill="#ffb8b8" opacity="0.6" />
                <circle cx="100" cy="58" r="1" fill="#e5c1b3" />
                <path d="M 98,62 Q 100,64 102,62" stroke="#e06262" stroke-width="1.5" fill="none" stroke-linecap="round" />
                
                <!-- LAYER 6: 飘逸空气刘海 & 垂胸立体鬓角 (彻底告别生硬线条) -->
                <!-- 柔和W型轻盈刘海 -->
                <path d="M 77,50 C 75,28 125,28 123,50 C 114,46 107,46 100,49 C 93,46 86,46 77,50 Z" fill="url(#hairGrad)" />
                <!-- 柔美微卷鬓角，自然贴脸 -->
                <path d="M 78,48 C 74,68 73,95 78,115 C 81,115 81,95 81,75 Z" fill="url(#hairGrad)" />
                <path d="M 122,48 C 126,68 127,95 122,115 C 119,115 119,95 119,75 Z" fill="url(#hairGrad)" />
                <!-- 头顶柔和天使光环高光 -->
                <ellipse cx="100" cy="38" rx="14" ry="2" fill="rgba(255,255,255,0.22)" />


                <!-- ================= LAYER 7: 完美量身的高定服装 ================= -->
                
                <!-- A. 默认：白丝蕾丝吊带打底衣 -->
                <g v-if="activeBodyOutfit === 'default'" class="svg-outfit">
                  <path d="M 75,85 L 125,85 C 120,105 115,115 112,130 L 88,130 C 85,115 80,105 75,85 Z" fill="#ffffff" opacity="0.95" stroke="#f0d5cc" stroke-width="1" />
                  <line x1="84" y1="85" x2="84" y2="72" stroke="#ffffff" stroke-width="1.5" />
                  <line x1="116" y1="85" x2="116" y2="72" stroke="#ffffff" stroke-width="1.5" />
                  <path d="M 88,130 Q 94,133 100,130 Q 106,133 112,130" fill="none" stroke="#ebd5cc" stroke-width="1.5" />
                </g>

                <!-- B. 橙色休闲短袖 -->
                <g v-if="activeBodyOutfit === 'casual-orange'" class="svg-outfit">
                  <path d="M 74,84 L 126,84 C 122,102 115,108 112,114 L 88,114 C 85,108 78,102 74,84 Z" fill="#f26a36" />
                  <!-- 泡泡短袖完美贴合叉腰手臂 -->
                  <path d="M 75,85 C 56,92 58,102 72,106" fill="#f26a36" />
                  <path d="M 125,85 C 144,92 142,102 128,106" fill="#f26a36" />
                  <path d="M 88,116 L 112,116 L 115,138 L 85,138 Z" fill="url(#denimGrad)" />
                </g>

                <!-- C. 紫色瑜伽服 -->
                <g v-if="activeBodyOutfit === 'yoga-purple'" class="svg-outfit">
                  <path d="M 77,85 L 123,85 C 120,100 115,102 112,108 L 88,108 C 85,102 80,100 77,85 Z" fill="#b39ddb" />
                  <line x1="86" y1="85" x2="94" y2="72" stroke="#7e57c2" stroke-width="2.5" />
                  <line x1="114" y1="85" x2="106" y2="72" stroke="#7e57c2" stroke-width="2.5" />
                  <path d="M 88,122 L 112,122 L 114,235 L 105,235 L 100,145 L 95,235 L 86,235 Z" fill="#7e57c2" />
                  <rect x="83" y="235" width="13" height="11" rx="2" fill="#ffffff" stroke="#ddd" stroke-width="1" />
                  <rect x="104" y="235" width="13" height="11" rx="2" fill="#ffffff" stroke="#ddd" stroke-width="1" />
                </g>

                <!-- D. 黑白跆拳道服 -->
                <g v-if="activeBodyOutfit === 'taekwondo'" class="svg-outfit">
                  <path d="M 87,130 L 113,130 L 115,225 L 105,225 L 100,145 L 95,225 L 85,225 Z" fill="#ffffff" stroke="#e0e0e0" stroke-width="1" />
                  <path d="M 73,83 L 127,83 C 122,108 116,120 113,135 L 87,135 C 84,120 78,108 73,83 Z" fill="#ffffff" stroke="#e0e0e0" stroke-width="1" />
                  <path d="M 93,83 L 100,94 L 107,83" fill="none" stroke="#222222" stroke-width="3" />
                  <!-- 宽松道服袖 -->
                  <path d="M 75,85 C 54,95 56,112 70,116" fill="#ffffff" stroke="#e0e0e0" stroke-width="1" />
                  <path d="M 125,85 C 141,100 141,120 133,135" fill="#ffffff" stroke="#e0e0e0" stroke-width="1" />
                  <rect x="83" y="125" width="34" height="6" rx="1" fill="#231b15" />
                  <path d="M 96,131 L 93,148 L 98,148 Z" fill="#231b15" />
                </g>

                <!-- E. 绿色校服 -->
                <g v-if="activeBodyOutfit === 'school-green'" class="svg-outfit">
                  <path d="M 73,84 L 127,84 C 122,110 116,115 113,126 L 87,126 C 84,115 78,110 73,84 Z" fill="#0f4c3a" />
                  <path d="M 75,85 C 55,95 55,112 71,114" fill="#0f4c3a" />
                  <path d="M 125,85 C 139,102 139,118 132,130" fill="#0f4c3a" />
                  <path d="M 94,84 L 100,92 L 106,84 Z" fill="#ffffff" />
                  <path d="M 98,90 L 102,90 L 101,105 L 99,105 Z" fill="#a31d1d" />
                  <path d="M 87,126 L 113,126 L 117,148 L 83,148 Z" fill="#1b634e" />
                  <line x1="92" y1="126" x2="90" y2="148" stroke="#0f4c3a" stroke-width="1.5" />
                  <line x1="100" y1="126" x2="100" y2="148" stroke="#0f4c3a" stroke-width="1.5" />
                  <line x1="108" y1="126" x2="110" y2="148" stroke="#0f4c3a" stroke-width="1.5" />
                </g>

                <!-- F. 粉蓝芭蕾服 -->
                <g v-if="activeBodyOutfit === 'ballet'" class="svg-outfit">
                  <path d="M 77,85 L 123,85 C 120,105 115,112 112,122 L 88,122 C 85,112 80,105 77,85 Z" fill="#fcd5ce" stroke="#fbc3bc" stroke-width="1" />
                  <line x1="84" y1="85" x2="84" y2="74" stroke="#fcd5ce" stroke-width="1.5" />
                  <line x1="116" y1="85" x2="116" y2="74" stroke="#fcd5ce" stroke-width="1.5" />
                  <ellipse cx="100" cy="122" rx="34" ry="11" fill="url(#balletGrad)" stroke="rgba(162, 210, 255, 0.6)" stroke-width="1" />
                  <ellipse cx="100" cy="124" rx="28" ry="8" fill="rgba(255,255,255,0.3)" />
                  <g transform="translate(0, 3)">
                    <path d="M 84,238 L 96,238 L 96,248 L 84,248 Z" fill="#fcd5ce" />
                    <line x1="84" y1="238" x2="96" y2="248" stroke="#f7cbd2" stroke-width="1.5" />
                    <line x1="96" y1="238" x2="84" y2="248" stroke="#f7cbd2" stroke-width="1.5" />
                    <path d="M 104,238 L 116,238 L 116,248 L 104,248 Z" fill="#fcd5ce" />
                    <line x1="104" y1="238" x2="116" y2="248" stroke="#f7cbd2" stroke-width="1.5" />
                    <line x1="116" y1="238" x2="104" y2="248" stroke="#f7cbd2" stroke-width="1.5" />
                  </g>
                </g>

                <!-- G. 粉色羽绒服 -->
                <g v-if="activeBodyOutfit === 'down-jacket'" class="svg-outfit">
                  <path d="M 71,83 L 129,83 C 126,112 120,125 115,138 L 85,138 C 80,125 74,112 71,83 Z" fill="#ffb3c1" stroke="#ffa2b4" stroke-width="1" />
                  <path d="M 75,85 C 50,95 50,112 68,118" fill="#ffb3c1" stroke="#ffa2b4" stroke-width="1.5" />
                  <path d="M 125,85 C 145,95 145,115 134,132" fill="#ffb3c1" stroke="#ffa2b4" stroke-width="1.5" />
                  <path d="M 75,102 Q 100,105 125,102" fill="none" stroke="#ffa2b4" stroke-width="1.5" />
                  <path d="M 80,120 Q 100,123 120,120" fill="none" stroke="#ffa2b4" stroke-width="1.5" />
                  <path d="M 82,82 C 90,72 110,72 118,82 C 110,88 90,88 82,82 Z" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.05))" />
                  <path d="M 82,232 L 98,232 L 98,248 L 82,248 Z" fill="#e0a96d" rx="2" />
                  <path d="M 102,232 L 118,232 L 118,248 L 102,248 Z" fill="#e0a96d" rx="2" />
                </g>


                <!-- ================= LAYER 8: 高奢配饰 (定位绝对精准，无漂浮感) ================= -->
                
                <!-- A. 璀璨皇冠 -->
                <g v-if="isCrownEquipped" class="svg-accessory">
                  <path d="M 86,33 L 89,22 L 95,28 L 100,16 L 105,28 L 111,22 L 114,33 Z" fill="#e5c1b3" stroke="#d4af37" stroke-width="1.5" />
                  <circle cx="100" cy="15" r="2" fill="#d4af37" />
                  <circle cx="89" cy="21" r="1.5" fill="#d4af37" />
                  <circle cx="111" cy="21" r="1.5" fill="#d4af37" />
                </g>

                <!-- B. 别致蝴蝶结发夹 (精准定位在右侧秀发分界线) -->
                <g v-if="isHairAccEquipped" class="svg-accessory">
                  <!-- 左侧蝴蝶结环 -->
                  <path d="M 112,38 C 113,32 120,32 121,38 C 120,44 113,44 112,38 Z" fill="#ffa2b4" />
                  <!-- 右侧蝴蝶结环 -->
                  <path d="M 121,38 C 122,32 129,32 130,38 C 129,44 122,44 121,38 Z" fill="#ffa2b4" />
                  <!-- 中心珍珠纽扣 -->
                  <circle cx="121" cy="38" r="3" fill="#ffffff" />
                  <!-- 灵动丝带飘带 -->
                  <path d="M 119,39 L 115,48 L 120,45 Z" fill="#ffa2b4" />
                  <path d="M 123,39 L 127,48 L 122,45 Z" fill="#ffa2b4" />
                </g>

                <!-- C. 珍珠吊坠耳环 -->
                <g v-if="isEarringsEquipped" class="svg-accessory">
                  <line x1="77" y1="58" x2="77" y2="67" stroke="#d4af37" stroke-width="1" />
                  <circle cx="77" cy="68" r="2" fill="#ffffff" stroke="#ddd" stroke-width="0.5" />
                  <line x1="123" y1="58" x2="123" y2="67" stroke="#d4af37" stroke-width="1" />
                  <circle cx="123" cy="68" r="2" fill="#ffffff" stroke="#ddd" stroke-width="0.5" />
                </g>

                <!-- D. 奢雅兔包 -->
                <g v-if="isBagEquipped" class="svg-accessory">
                  <path d="M 124,142 C 122,126 142,126 140,142" fill="none" stroke="#d4af37" stroke-width="2.5" />
                  <rect x="122" y="142" width="22" height="18" rx="4" fill="#ffffff" stroke="#e5989b" stroke-width="1.5" />
                  <circle cx="133" cy="151" r="2" fill="#d4af37" />
                </g>

              </svg>

            </div>
          </div>

          <!-- ================= 右栏：魔法配对沙龙 ================= -->
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
                {{ hp <= 0 ? '星光有些黯淡了。别担心，整理一下思绪，重新叩响高定沙龙的大门吧。' : '绝美连线！你用智慧点亮了整座衣橱，10款年度高定礼服已尽数归档。' }}
              </p>
              <button class="btn luxury-action-btn" @click="resetGame">
                {{ hp <= 0 ? '重置衣橱' : '开启新一季' }}
              </button>
            </div>
          </div>

        </div>

        <!-- ================= 底部：换装衣橱面板 ================= -->
        <footer class="atelier-wardrobe-footer">
          <div class="wardrobe-progress">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: (favor / 10 * 100) + '%' }"></div>
            </div>
            <div class="progress-stats">
              <span>已珍藏设计 : {{ favor }} / 10</span>
              <span class="guide-tip">✦ 点击已解锁卡片自由试衣 ✦</span>
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

/* ================= SVG 矢量美少女试衣核心样式 ================= */
.princess-vector-doll {
  width: 180px;
  height: 260px;
  filter: drop-shadow(0 5px 15px rgba(84, 61, 52, 0.12)); /* 让纸娃娃具有手办级阴影立体感 */
}

/* 换装淡入动画 */
.svg-outfit, .svg-accessory {
  animation: dressFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* ================= 右栏：极简轻奢配对棋盘 ================= */
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
  background: var(--rose-mist);
}
.luxury-card.selected {
  background: var(--charcoal);
  border-color: var(--charcoal);
}
.luxury-card.selected .card-text {
  color: #ffffff;
}
.luxury-card.selected .card-dot {
  background: var(--gold-primary);
}
.luxury-card.matched {
  background: #fcfcfc;
  border-color: #f0f0f0;
  cursor: default;
  opacity: 0.45;
}

/* 结算区 */
.atelier-settlement {
  text-align: center;
  padding: 20px 0;
}
.settlement-symbol {
  font-size: 2rem;
  color: var(--gold-primary);
  margin-bottom: 10px;
}
.settlement-title {
  font-size: 1.1rem;
  letter-spacing: 4px;
  color: var(--charcoal);
  margin-bottom: 8px;
}
.settlement-desc {
  font-size: 0.8rem;
  color: #7a7570;
  line-height: 1.6;
  max-width: 280px;
  margin: 0 auto 16px auto;
}

/* ================= 底部：高定衣柜多宫格 ================= */
.wardrobe-progress {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid rgba(44, 42, 41, 0.06);
}
.progress-track {
  width: 100%;
  height: 2px;
  background: #eae5df;
}
.progress-fill {
  height: 100%;
  background: var(--gold-primary);
  transition: width 0.5s ease;
}
.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--charcoal);
  font-weight: 600;
  margin-top: 6px;
}
.guide-tip {
  color: var(--gold-primary);
}

.wardrobe-grid {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.wardrobe-slot {
  width: 46px;
  height: 46px;
  background: #ffffff;
  border: 1px solid rgba(44, 42, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  cursor: pointer;
  position: relative;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.wardrobe-slot:hover:not(.locked) {
  border-color: var(--gold-primary);
  transform: translateY(-2px);
}
.wardrobe-slot.locked {
  filter: grayscale(1) opacity(0.15);
  background: #f7f5f2;
  cursor: not-allowed;
}
.wardrobe-slot.active-wearing {
  border-color: var(--charcoal);
  background: var(--rose-mist);
}

/* ================= 动画效果 ================= */
@keyframes dressFade {
  from { opacity: 0; transform: translateY(4px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
.shake-anim { animation: shake 0.3s; }
.combo-bounce { animation: dressFade 0.4s ease-in-out; }
.overlay { position: fixed; inset: 0; background: rgba(44,42,41,0.5); z-index: 100; backdrop-filter: blur(2px); }
.admin-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #ffffff; padding: 25px; z-index: 110; width: 320px; border: 1px solid var(--gold-primary); }
.admin-panel textarea { width: 100%; height: 150px; margin-bottom: 10px; padding: 10px; }
.luxury-action-btn { background: var(--charcoal); color: #ffffff; border: none; padding: 8px 30px; font-size: 0.75rem; letter-spacing: 2px; cursor: pointer; }
.floating-heart { position: absolute; animation: floatUp 1.2s forwards; pointer-events: none; z-index: 20; font-size: 1.2rem; }
@keyframes floatUp { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-60px); } }
</style>
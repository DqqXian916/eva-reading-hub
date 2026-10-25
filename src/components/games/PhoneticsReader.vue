<template>
  <div class="phonetics-container">
    <!-- 一级 Tab：元音 / 辅音 -->
    <div class="main-tabs">
      <button 
        :class="['tab-btn', { active: mainTab === 'vowel' }]" 
        @click="switchMainTab('vowel')"
      >
        元音
      </button>
      <button 
        :class="['tab-btn', { active: mainTab === 'consonant' }]" 
        @click="switchMainTab('consonant')"
      >
        辅音
      </button>
    </div>

    <!-- 二级 Tab：元音子分类 (单元音/双元音) 或 辅音子分类 (清辅音/浊辅音) -->
    <div class="sub-tabs">
      <template v-if="mainTab === 'vowel'">
        <button 
          :class="['sub-tab-btn', { active: subTab === 'monophthong' }]" 
          @click="subTab = 'monophthong'"
        >
          单元音
        </button>
        <button 
          :class="['sub-tab-btn', { active: subTab === 'diphthong' }]" 
          @click="subTab = 'diphthong'"
        >
          双元音
        </button>
      </template>
      <template v-else>
        <button 
          :class="['sub-tab-btn', { active: subTab === 'voiceless' }]" 
          @click="subTab = 'voiceless'"
        >
          清辅音
        </button>
        <button 
          :class="['sub-tab-btn', { active: subTab === 'voiced' }]" 
          @click="subTab = 'voiced'"
        >
          浊辅音
        </button>
      </template>
    </div>

    <!-- 音标列表内容区 -->
    <div class="phonetics-content">
      <div 
        v-for="(group, gIndex) in currentGroups" 
        :key="gIndex" 
        class="group-section"
      >
        <!-- 分类小标头（带绿条） -->
        <div class="group-title">
          <span class="indicator-bar"></span>
          <span class="title-text">{{ group.title }}</span>
        </div>

        <!-- 音标网格卡片 -->
        <div class="cards-grid">
          <div 
            v-for="(item, iIndex) in group.items" 
            :key="iIndex" 
            class="phonetic-card"
            @click="playPhoneticSound(item)"
          >
            <!-- 鼠标移入时显示的弹词气泡 -->
            <div class="tooltip">
              <span class="tooltip-word">{{ item.word }}</span>
              <span class="tooltip-desc">{{ item.meaning }}</span>
            </div>

            <span class="symbol">[{{ item.symbol }}]</span>
            <!-- 右下角发音图标 -->
            <svg class="audio-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const mainTab = ref('vowel') // 'vowel' | 'consonant'
const subTab = ref('monophthong') // 元音时: 'monophthong'/'diphthong' | 辅音时: 'voiceless'/'voiced'

// 切换一级 Tab 时重置对应的默认二级 Tab
const switchMainTab = (tab) => {
  mainTab.value = tab
  if (tab === 'vowel') {
    subTab.value = 'monophthong'
  } else {
    subTab.value = 'voiceless'
  }
}

// 48个国际音标完整分类数据
const phoneticsData = {
  // 元音部分
  monophthongs: [
    {
      title: '前元音',
      items: [
        { symbol: 'i:', word: 'see', meaning: '看见' },
        { symbol: 'ɪ', word: 'sit', meaning: '坐' },
        { symbol: 'e', word: 'bed', meaning: '床' },
        { symbol: 'æ', word: 'cat', meaning: '猫' }
      ]
    },
    {
      title: '中元音',
      items: [
        { symbol: 'ɜ:', word: 'bird', meaning: '鸟' },
        { symbol: 'ə', word: 'teacher', meaning: '老师' },
        { symbol: 'ʌ', word: 'cup', meaning: '杯子' }
      ]
    },
    {
      title: '后元音',
      items: [
        { symbol: 'u:', word: 'too', meaning: '也' },
        { symbol: 'ʊ', word: 'put', meaning: '放' },
        { symbol: 'ɔ:', word: 'ball', meaning: '球' },
        { symbol: 'ɒ', word: 'not', meaning: '不' },
        { symbol: 'ɑ:', word: 'car', meaning: '汽车' }
      ]
    }
  ],
  diphthongs: [
    {
      title: '合口双元音',
      items: [
        { symbol: 'eɪ', word: 'say', meaning: '说' },
        { symbol: 'aɪ', word: 'my', meaning: '我的' },
        { symbol: 'ɔɪ', word: 'boy', meaning: '男孩' },
        { symbol: 'aʊ', word: 'now', meaning: '现在' },
        { symbol: 'əʊ', word: 'go', meaning: '去' }
      ]
    },
    {
      title: '集中双元音',
      items: [
        { symbol: 'ɪə', word: 'here', meaning: '这里' },
        { symbol: 'eə', word: 'hair', meaning: '头发' },
        { symbol: 'ʊə', word: 'sure', meaning: '确信' }
      ]
    }
  ],
  
  // 辅音部分（按 清辅音 / 浊辅音 组织，内部按发音部位分类）
  voiceless: [
    {
      title: '爆破音',
      items: [
        { symbol: 'p', word: 'pen', meaning: '钢笔' },
        { symbol: 't', word: 'tea', meaning: '茶' },
        { symbol: 'k', word: 'cat', meaning: '猫' }
      ]
    },
    {
      title: '摩擦音',
      items: [
        { symbol: 'f', word: 'fish', meaning: '鱼' },
        { symbol: 's', word: 'sun', meaning: '太阳' },
        { symbol: 'ʃ', word: 'shoe', meaning: '鞋' },
        { symbol: 'θ', word: 'three', meaning: '三' },
        { symbol: 'h', word: 'hat', meaning: '帽子' }
      ]
    },
    {
      title: '破擦音',
      items: [
        { symbol: 'tʃ', word: 'chair', meaning: '椅子' },
        { symbol: 'tr', word: 'tree', meaning: '树' },
        { symbol: 'ts', word: 'cats', meaning: '猫(复数)' }
      ]
    }
  ],
  voiced: [
    {
      title: '爆破音',
      items: [
        { symbol: 'b', word: 'book', meaning: '书' },
        { symbol: 'd', word: 'dog', meaning: '狗' },
        { symbol: 'g', word: 'girl', meaning: '女孩' }
      ]
    },
    {
      title: '摩擦音',
      items: [
        { symbol: 'v', word: 'vest', meaning: '背心' },
        { symbol: 'z', word: 'zoo', meaning: '动物园' },
        { symbol: 'ʒ', word: 'vision', meaning: '视力' },
        { symbol: 'ð', word: 'this', meaning: '这个' },
        { symbol: 'r', word: 'red', meaning: '红色' }
      ]
    },
    {
      title: '破擦音',
      items: [
        { symbol: 'dʒ', word: 'jump', meaning: '跳' },
        { symbol: 'dr', word: 'driver', meaning: '司机' },
        { symbol: 'dz', word: 'beds', meaning: '床(复数)' }
      ]
    },
    {
      title: '鼻音',
      items: [
        { symbol: 'm', word: 'moon', meaning: '月亮' },
        { symbol: 'n', word: 'nose', meaning: '鼻子' },
        { symbol: 'ŋ', word: 'sing', meaning: '唱歌' }
      ]
    },
    {
      title: '似拼音 / 半元音 / 流音',
      items: [
        { symbol: 'l', word: 'lion', meaning: '狮子' },
        { symbol: 'w', word: 'water', meaning: '水' },
        { symbol: 'j', word: 'yes', meaning: '是' }
      ]
    }
  ]
}

// 根据当前选中的一级与二级 Tab 动态计算展示的组
const currentGroups = computed(() => {
  if (mainTab.value === 'vowel') {
    return subTab.value === 'monophthong' 
      ? phoneticsData.monophthongs 
      : phoneticsData.diphthongs
  } else {
    return subTab.value === 'voiceless'
      ? phoneticsData.voiceless
      : phoneticsData.voiced
  }
})

// 点击朗读例词
const playPhoneticSound = (item) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(item.word)
    utterance.lang = 'en-US'
    utterance.rate = 0.75 
    window.speechSynthesis.speak(utterance)
  }
}
</script>

<style scoped>
.phonetics-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #f7faf9;
  height: 100%;
  max-height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.main-tabs {
  display: flex;
  background-color: #ebf3f0;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
}

.tab-btn {
  flex: 1;
  padding: 14px 0;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 600;
  color: #7a8b85;
  cursor: pointer;
  transition: all 0.25s ease;
}

.tab-btn.active {
  background-color: #ffffff;
  color: #2bbd88;
  border-radius: 16px 16px 0 0;
  position: relative;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  background-color: #2bbd88;
  border-radius: 2px;
}

.sub-tabs {
  display: flex;
  gap: 12px;
  margin: 16px 0 20px 0;
}

.sub-tab-btn {
  padding: 8px 18px;
  border-radius: 20px;
  border: none;
  background-color: #eaeaea;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sub-tab-btn.active {
  background-color: #2bbd88;
  color: #ffffff;
}

.group-section {
  margin-bottom: 24px;
}

.group-title {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.indicator-bar {
  width: 4px;
  height: 16px;
  background-color: #2bbd88;
  border-radius: 2px;
  margin-right: 8px;
}

.title-text {
  font-size: 15px;
  font-weight: 600;
  color: #4a5568;
}

.cards-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

/* 音标卡片样式 */
.phonetic-card {
  width: 72px;
  height: 90px;
  background-color: #ffffff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.phonetic-card:active {
  transform: scale(0.95);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.symbol {
  font-size: 24px;
  font-weight: 500;
  color: #2d3748;
}

.audio-icon {
  width: 12px;
  height: 12px;
  color: #a0aec0;
  position: absolute;
  right: 8px;
  bottom: 8px;
}

/* --- 悬浮气泡弹窗样式 (Tooltip) --- */
.tooltip {
  position: absolute;
  bottom: 102%; 
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  background-color: #1a202c;
  color: #ffffff;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s cubic-bezier(0.165, 0.84, 0.44, 1);
  z-index: 10;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px;
  border-style: solid;
  border-color: #1a202c transparent transparent transparent;
}

.tooltip-word {
  font-weight: 700;
  color: #4ade80; 
}

.tooltip-desc {
  color: #cbd5e1;
  font-size: 11px;
}

.phonetic-card:hover .tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
</style>
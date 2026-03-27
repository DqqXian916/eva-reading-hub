<script setup>
import { ref } from 'vue'

const props = defineProps({
  gamePath: String,
  gameName: String
})

const gameIframe = ref(null)

const reloadGame = () => {
  if (gameIframe.value) {
    // 强制刷新 iframe
    const currentSrc = gameIframe.value.src
    gameIframe.value.src = ''
    setTimeout(() => {
      gameIframe.value.src = currentSrc
    }, 10)
  }
}
</script>

<template>
  <div class="legacy-wrapper">

    <div class="iframe-container">
      <iframe 
        ref="gameIframe" 
        :src="gamePath" 
        frameborder="0" 
        class="game-frame" 
        allow="autoplay; fullscreen"
      ></iframe>
    </div>
  </div>
</template>

<style scoped>
.legacy-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%; /* 继承父级 .game-card 的高度 */
  width: 100%;
  overflow: hidden;
  background: white;
}

.game-header {
  height: 48px;
  min-height: 48px; /* 确保高度不被挤压 */
  background: #ffffff;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.live-dot {
  width: 6px;
  height: 6px;
  background: #2ecc71;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(46, 204, 113, 0.4);
}

.playing-tag {
  font-size: 13px;
  color: #64748b;
}

/* 关键修复：iframe 容器 */
.iframe-container {
  flex: 1;
  width: 100%;
  position: relative; /* 必须加这一句，否则 iframe 会飘到外层去 */
  min-height: 0; /* 允许内部元素收缩，防止撑破容器 */
}

.game-frame {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  /* 解决 iframe 在某些浏览器下的微小边距问题 */
  display: block;
}

.refresh-btn {
  border: 1px solid #e2e8f0;
  background: white;
  color: #3b82f6;
  padding: 4px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: #f1f7ff;
  border-color: #3b82f6;
}
</style>
<script setup>
import { ref, nextTick } from 'vue'
import LegacyGameModule from './LegacyGameModule.vue'

const props = defineProps(['student'])

const games = ref([
    { id: 'breakfast', name: '公主/王子的早餐', path: '/games/breakfast.html', icon: '🍳', color: '#4ec0ca' },
    { id: 'colors', name: '调色盘', path: '/games/colors.html', icon: '🎨', color: '#2ecc71' },
    { id: 'miaw', name: '小柚又饿了', path: '/games/miaw.html', icon: '🐱', color: '#f1c40f' },
    { id: 'vowels', name: '元音扫雷', path: '/games/vowels.html', icon: '🔍', color: '#95a5a6' },
    { id: 'sticker', name: '貼紙薄', path: '/games/sticker.html', icon: '🎀', color: '#95a5a6' },
    { id: 'hacker', name: '单词黑客', path: '/games/hacker.html', icon: '💻', color: '#95a5a6' }
])

const activeGame = ref(null)

const selectGame = (game) => {
    activeGame.value = null
    nextTick(() => {
        activeGame.value = game
    })
}
</script>

<template>
    <div class="brain-break-viewport">
        <div class="brain-break-layout">

            <aside class="game-sidebar">
                <div class="sidebar-header">
                    <div class="header-tag">✨ BRAIN BREAK</div>
                    <div class="user-greeting">
                        <span class="greeting-text">Hi, {{ student?.name || '同学' }} 👋</span>
                    </div>
                    <p class="sub-quote">休息一会，是为了更好地出发</p>
                </div>

                <div class="game-list-container">
                    <div v-for="game in games" :key="game.id"
                        :class="['game-item', { active: activeGame?.id === game.id }]" @click="selectGame(game)">

                        <div class="game-icon-box" :style="{ background: `${game.color}15` }">
                            <span class="game-icon">{{ game.icon }}</span>
                        </div>

                        <div class="game-info">
                            <span class="game-name">{{ game.name }}</span>
                            <span class="game-status" v-if="activeGame?.id === game.id">Playing</span>
                        </div>
                    </div>
                </div>

                <div class="sidebar-footer" v-if="activeGame">
                    <button @click="activeGame = null" class="exit-button">返回大厅</button>
                </div>
            </aside>

            <main class="game-main">
                <div class="game-card">
                    <template v-if="activeGame">
                        <LegacyGameModule :key="activeGame.id" :gamePath="activeGame.path"
                            :gameName="activeGame.name" />
                    </template>
                    <div v-else class="empty-state">
                        <div class="empty-icon">🎨</div>
                        <h2>学习累了吗？</h2>
                        <p>选个游戏，给大脑充充电吧</p>
                    </div>
                </div>
            </main>
        </div>
    </div>
</template>

<style scoped>
/* 核心修复：这个容器决定了是否会挤掉一级菜单 */
.brain-break-viewport {
    width: 100%;
    height: 100%;
    /* 绝对不要写 100vh */
    min-height: 0;
    display: flex;
    overflow: hidden;
    /* 这一步锁死了布局，不让它乱动 */
}

.brain-break-layout {
    display: flex;
    flex: 1;
    width: 100%;
    height: 100%;
    background: #f8fafc;
}

/* 侧边栏：确保它永远存在 */
.game-sidebar {
    width: 260px;
    flex-shrink: 0;
    /* 关键：禁止被压扁 */
    background: white;
    border-right: 1px solid #eef2f6;
    display: flex;
    flex-direction: column;
    height: 100%;
}

.sidebar-header {
    padding: 24px;
}

.header-tag {
    font-size: 10px;
    color: #3b82f6;
    font-weight: 800;
    margin-bottom: 4px;
}

.sidebar-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #1e293b;
}

/* 列表滚动区 */
.game-list-container {
    flex: 1;
    padding: 10px;
    overflow-y: auto;
    /* 只有这里能滚动 */
}

.game-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 16px;
    cursor: pointer;
    margin-bottom: 8px;
    transition: 0.2s;
}

.game-item:hover {
    background: #f8fafc;
}

.game-item.active {
    background: #f1f7ff;
}

.game-icon-box {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.game-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: #334155;
}

.game-status {
    font-size: 10px;
    color: #3b82f6;
    font-weight: 800;
    display: block;
}

.sidebar-footer {
    padding: 20px;
    border-top: 1px solid #f1f5f9;
}

.exit-button {
    width: 100%;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: white;
    color: #64748b;
    font-weight: 600;
    cursor: pointer;
}

/* 右侧内容：确保圆角和阴影 */
.game-main {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.game-card {
    flex: 1;
    background: white;
    border-radius: 24px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.empty-icon {
    font-size: 50px;
    margin-bottom: 16px;
}

.sidebar-header {
    padding: 32px 24px 20px;
    position: relative;
    overflow: hidden;
}

/* 装饰背景：一个小圆圈，增加层次感 */
.sidebar-header::before {
    content: '';
    position: absolute;
    top: -20px;
    right: -20px;
    width: 80px;
    height: 80px;
    background: radial-gradient(circle, #3b82f610 0%, transparent 70%);
    border-radius: 50%;
}

.user-greeting {
    margin-top: 8px;
}

.greeting-text {
    display: block;
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
    margin-bottom: 2px;
}

.sidebar-header h3 {
    margin: 0;
    font-size: 1.4rem;
    /* 稍微加大一点，更有品牌感 */
    color: #1e293b;
    font-weight: 800;
    letter-spacing: -0.5px;
}

.sub-quote {
    margin: 8px 0 0;
    font-size: 11px;
    color: #94a3b8;
    font-style: italic;
}

/* 优化游戏项选中的视觉反馈 */
.game-item.active .game-name {
    color: #3b82f6;
}

.game-item.active .game-icon-box {
    transform: scale(1.1);
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>
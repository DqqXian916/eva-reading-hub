<script setup>
import { ref, watch, nextTick } from 'vue'
import { supabase } from '../supabase'
import LegacyGameModule from './LegacyGameModule.vue'
import CatFeedingGame from './games/CatFeeding.vue'
import WordHackerGame from './games/WordHacker.vue'

// 1. 接收 canEdit 权限
const props = defineProps(['student', 'canEdit'])
const emit = defineEmits(['saveConfig'])

const games = ref([
    { id: 'breakfast', name: '公主的早餐', path: '/games/breakfast.html', icon: '🍳', color: '#4ec0ca' },
    { id: 'colors', name: '调色盘', path: '/games/colors.html', icon: '🎨', color: '#2ecc71' },
    {
        id: 'miaw',
        name: '小柚又饿了',
        isVue: true, // 关键：标识这是一个 Vue 组件
        icon: '🐱',
        color: '#f1c40f',
        config: {
            wordList: [],// 初始空，等后端注入
            goal: 20
        }
    },
    { id: 'vowels', name: '元音扫雷', path: '/games/vowels.html', icon: '🔍', color: '#95a5a6' },
    { id: 'sticker', name: '貼紙薄', path: '/games/sticker.html', icon: '🎀', color: '#95a5a6' },
     {
        id: 'hacker',
        name: '单词黑客',
        isVue: true, // 关键：标识这是一个 Vue 组件
        icon: '💻',
        color: '#95a5a6',
        config: {
            wordList: [],// 初始空，等后端注入
            goal: 20
        }
    },
    { id: 'adventure of lisa', name: '涂鸦日记', path: '/games/fill.html', icon: '🖌️', color: '#95a5a6' }
])

const activeGame = ref(null)
const isLoading = ref(false)

// --- 数据库交互：获取学生配置 ---
const fetchStudentConfig = async () => {
    if (!props.student?.id) return
    isLoading.value = true
    try {
        const { data, error } = await supabase
            .from('student_configs')
            .select('current_word_list, game_goal')
            .eq('student_id', props.student.id)
            .maybeSingle()
        if (error) throw error
        console.log("数据库返回原始数据:", data) // 检查这里 data 是否为 null
        if (data) {
            // 找到对应的游戏
            const miawGame = games.value.find(g => g.id === 'miaw')
            if (miawGame) {
                // 重点：确保字段名 current_word_list 与数据库完全一致
                miawGame.config.wordList = data.current_word_list || []
                miawGame.config.goal = data.game_goal || 20
                console.log("父组件：miaw 游戏配置已更新", miawGame.config.wordList);
            }
        }
    } catch (e) {
        console.error("加载配置异常:", e)
    } finally {
        isLoading.value = false
    }
}

// 监听学生 ID 变化，切换学生时自动重新读取数据库
watch(() => props.student?.id, () => {
    fetchStudentConfig()
}, { immediate: true })

// --- 管理员配置相关状态 ---
const showAdminModal = ref(false)
const editingGame = ref(null)
const configJsonStr = ref('')

const selectGame = (game) => {
    // 如果点击的是当前正在运行的游戏，不做操作
    if (activeGame.value?.id === game.id) return
    activeGame.value = game
}

const openConfig = (game) => {
    // 强制先从最新的 games 数组里找一遍，确保拿到的是 fetch 后的数据
    const latestGameData = games.value.find(g => g.id === game.id)
    editingGame.value = latestGameData || game
    
    console.log("准备打开配置，当前内存中的 wordList:", editingGame.value.config.wordList)
    
    // 如果还是空，可能是 JSON 序列化的问题，确保数据存在
    configJsonStr.value = JSON.stringify(editingGame.value.config?.wordList || [], null, 2)
    showAdminModal.value = true
}

// 保存配置
const saveGameConfig = () => {
    try {
        const newWordList = JSON.parse(configJsonStr.value)
        if (!Array.isArray(newWordList)) throw new Error("必须是数组格式")
        console.log("当前编辑的游戏配置:", editingGame.value.config)    
        // 本地立即更新
        editingGame.value.config.wordList = newWordList

        // 向上抛出，参数对应你数据库的字段
        emit('saveConfig', {
            studentId: props.student.id,
            wordList: newWordList,
            goal: editingGame.value.config.goal
        })
        showAdminModal.value = false
    } catch (e) {
        alert("❌ JSON 格式有误: " + e.message);
    }
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
                        <div v-if="canEdit && game.isVue" class="admin-edit-btn" @click.stop="openConfig(game)">
                            ⚙️
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
                        <template v-if="activeGame.isVue">
                            <CatFeedingGame v-if="activeGame.id === 'miaw'" :wordList="activeGame.config.wordList"
                                :goal="activeGame.config.goal" :canEdit="canEdit" @updateConfig="(newWords) => $emit('saveConfig', {
                                    studentId: props.student.id,
                                    wordList: newWords,
                                    goal: activeGame.config.goal
                                })" />
                            <WordHackerGame v-if="activeGame.id === 'hacker'" :wordList="activeGame.config.wordList"  
                                    :goal="activeGame.config.goal" :canEdit="canEdit" @updateConfig="(newWords) => $emit('saveConfig', {
                                studentId: props.student.id,
                                wordList: newWords,
                                goal: activeGame.config.goal
                            })" />
                        </template>

                        <template v-else>
                            <LegacyGameModule :key="activeGame.id" :gamePath="activeGame.path"
                                :gameName="activeGame.name" />
                        </template>

                    </template>
                    <div v-else class="empty-state">
                        <div class="empty-icon">🎨</div>
                        <h2>学习累了吗？</h2>
                        <p>选个游戏，给大脑充充电吧</p>
                    </div>
                </div>
            </main>
        </div>
        <Transition name="fade">
            <div v-if="showAdminModal" class="admin-modal-overlay" @click.self="showAdminModal = false">
                <div class="admin-modal-content">
                    <div class="modal-header">
                        <h3>🛠️ 配置游戏词库：{{ editingGame?.name }}</h3>
                        <p>请编辑下方的 JSON 配置（需符合格式）</p>
                    </div>
                    <div class="modal-body">
                        <textarea v-model="configJsonStr" class="config-textarea"></textarea>
                    </div>
                    <div class="modal-footer">
                        <button @click="showAdminModal = false" class="btn-cancel">取消</button>
                        <button @click="saveGameConfig" class="btn-save">保存并应用</button>
                    </div>
                </div>
            </div>
        </Transition>
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

.brain-break-viewport {
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    overflow: hidden;
    position: relative;
}

/* 新增：管理员编辑小按钮 */
.admin-edit-btn {
    margin-left: auto;
    padding: 5px;
    opacity: 0.3;
    transition: 0.3s;
    cursor: pointer;
}

.admin-edit-btn:hover {
    opacity: 1;
    transform: rotate(45deg);
}

/* 新增：配置弹窗样式 */
.admin-modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.admin-modal-content {
    background: white;
    width: 90%;
    max-width: 500px;
    padding: 25px;
    border-radius: 20px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.config-textarea {
    width: 100%;
    height: 250px;
    font-family: monospace;
    font-size: 13px;
    padding: 12px;
    border: 2px solid #f1f5f9;
    border-radius: 12px;
    outline: none;
    transition: 0.3s;
}

.config-textarea:focus {
    border-color: #3b82f6;
}

.modal-footer {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.modal-footer button {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    border: none;
    font-weight: 600;
    cursor: pointer;
}

.btn-cancel {
    background: #f1f5f9;
    color: #64748b;
}

.btn-save {
    background: #3b82f6;
    color: white;
}

/* 基础布局样式重复项省略... */
.brain-break-layout {
    display: flex;
    flex: 1;
    width: 100%;
    height: 100%;
    background: #f8fafc;
}

.game-sidebar {
    width: 260px;
    flex-shrink: 0;
    background: white;
    border-right: 1px solid #eef2f6;
    display: flex;
    flex-direction: column;
    height: 100%;
}

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

.game-list-container {
    flex: 1;
    padding: 10px;
    overflow-y: auto;
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
</style>
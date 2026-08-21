<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useGameStore } from '../../stores/gameStore'

const props = defineProps({
    wordList: { type: Array, default: () => [] },
    goal: { type: Number, default: 10 },
    canEdit: { type: Boolean, default: false }
})

const gameStore = useGameStore()
const canvasRef = ref(null)

const activeWordList = computed(() => {
    return props.wordList && props.wordList.length > 0
        ? props.wordList
        : gameStore.currentWordList || []
})

// 进度与得分管理
const GROUP_SIZE = 10
const wordHistory = ref([])
const playerScore = ref(0)
const aiScore = ref(0)
const gameWinner = ref(null)

const currentWord = ref(null)
const options = ref([])
const isTargeting = ref(false)
const roundLock = ref(false)
const currentMoveType = ref('smash')

// 斩杀与 QTE 交互状态
const isQTEActive = ref(false)
const qteCount = ref(0)
const QTE_GOAL = 10
const qteTimeLeft = ref(100)
const isUltimateKO = ref(false)
const koParticleList = ref([])

let ctx = null
let animationFrameId = null
let qteTimer = null
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 450

// ----------------------------------------------------
// Web Audio API 音效系统
// ----------------------------------------------------
let audioCtx = null

const initAudio = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
}

const playHitSound = (type = 'smash') => {
    if (!audioCtx) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    if (type === 'smash') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(340, now)
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2)
        gain.gain.setValueAtTime(1.0, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    } else {
        osc.type = 'square'
        osc.frequency.setValueAtTime(240, now)
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15)
        gain.gain.setValueAtTime(0.5, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    }

    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + 0.2)
}

const playQTESound = () => {
    if (!audioCtx) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400 + qteCount.value * 50, now)
    osc.frequency.exponentialRampToValueAtTime(800 + qteCount.value * 50, now + 0.08)
    gain.gain.setValueAtTime(0.8, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + 0.08)
}

const playKOBoomSound = () => {
    if (!audioCtx) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(20, now + 1.2)
    gain.gain.setValueAtTime(1.0, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + 1.2)
}

// ----------------------------------------------------
// 角色与发球机状态
// ----------------------------------------------------
const keys = { left: false, right: false }

const player = {
    x: 180,
    y: 310,
    baseY: 310,
    speed: 4.8,
    vy: 0,
    gravity: 0.65,
    isJumping: false,
    swinging: false,
    armAngle: 0,
    walkFrame: 0,
    effectFrame: 0,
    minX: 50,
    maxX: 360
}

// 羽毛球发球机
const machine = { 
    x: 680, 
    y: 300, 
    recoil: 0, 
    isBroken: false,
    glowAngle: 0
}

const shuttlecock = {
    x: 680,
    y: 280,
    startX: 680,
    startY: 280,
    targetX: 200,
    targetY: 310,
    progress: 0,
    arcHeight: 140,
    active: false,
    quizTriggered: false
}

// 发球
const launchShuttle = () => {
    if (activeWordList.value.length === 0) return

    if (wordHistory.value.length >= GROUP_SIZE) {
        gameWinner.value = playerScore.value >= 6 ? 'player' : 'ai'
        return
    }

    roundLock.value = false
    isTargeting.value = false
    isUltimateKO.value = false
    isQTEActive.value = false

    const randomIndex = Math.floor(Math.random() * activeWordList.value.length)
    const target = activeWordList.value[randomIndex]
    currentWord.value = target

    const wrongPool = activeWordList.value
        .filter((_, idx) => idx !== randomIndex)
        .map(item => item.meaning || item.cn || item.translation)
        .sort(() => 0.5 - Math.random())

    const correctMeaning = target.meaning || target.cn || target.translation

    const rawOptions = [
        { text: correctMeaning, isCorrect: true },
        { text: wrongPool[0] || '其他释义', isCorrect: false },
        { text: wrongPool[1] || '其他意思', isCorrect: false }
    ].sort(() => 0.5 - Math.random())

    const zonePositions = [
        { x: 490, y: 330, areaName: '前场短球 [1]' },
        { x: 610, y: 260, areaName: '中场平抽 [2]' },
        { x: 710, y: 340, areaName: '后场底线 [3]' }
    ]

    options.value = rawOptions.map((opt, idx) => ({
        ...opt,
        targetX: zonePositions[idx].x,
        targetY: zonePositions[idx].y,
        areaName: zonePositions[idx].areaName
    }))

    machine.recoil = 18
    shuttlecock.startX = machine.x - 40
    shuttlecock.startY = machine.y - 20
    shuttlecock.targetX = 120 + Math.random() * 180
    shuttlecock.targetY = player.baseY
    shuttlecock.progress = 0
    shuttlecock.arcHeight = 120 + Math.random() * 40
    shuttlecock.quizTriggered = false
    shuttlecock.active = true
}

const triggerMidAirQuiz = () => {
    if (shuttlecock.quizTriggered) return
    shuttlecock.quizTriggered = true
    isTargeting.value = true
}

// 答题与击球逻辑
const selectMoveAndAnswer = (moveType, opt) => {
    initAudio()
    if (roundLock.value) return
    roundLock.value = true
    isTargeting.value = false
    currentMoveType.value = moveType

    // 触发 QTE 斩杀判断（第 10 词且前面全对且答对）
    const isPerfectRun = (wordHistory.value.length === GROUP_SIZE - 1) && (playerScore.value === GROUP_SIZE - 1) && opt.isCorrect

    if (isPerfectRun) {
        startQTEPhase()
        return
    }

    player.swinging = true
    player.effectFrame = 15

    if (moveType === 'smash') {
        player.vy = -12
        player.isJumping = true
    }

    if (opt.isCorrect) {
        playerScore.value++
        wordHistory.value.push('correct')
        playHitSound(moveType)

        shuttlecock.startX = shuttlecock.x
        shuttlecock.startY = shuttlecock.y
        shuttlecock.targetX = opt.targetX
        shuttlecock.targetY = opt.targetY
        shuttlecock.progress = 0
        shuttlecock.arcHeight = moveType === 'smash' ? 15 : 40

        setTimeout(() => {
            shuttlecock.active = false
            setTimeout(launchShuttle, 400)
        }, 450)
    } else {
        aiScore.value++
        wordHistory.value.push('wrong')

        shuttlecock.startX = shuttlecock.x
        shuttlecock.startY = shuttlecock.y
        shuttlecock.targetX = player.x - 30
        shuttlecock.targetY = player.baseY + 10
        shuttlecock.progress = 0
        shuttlecock.arcHeight = 10

        setTimeout(() => {
            shuttlecock.active = false
            setTimeout(launchShuttle, 600)
        }, 450)
    }
}

// ----------------------------------------------------
// 🔥 QTE 斩杀互动逻辑
// ----------------------------------------------------
const startQTEPhase = () => {
    isQTEActive.value = true
    qteCount.value = 0
    qteTimeLeft.value = 100

    player.vy = -14
    player.isJumping = true

    qteTimer = setInterval(() => {
        qteTimeLeft.value -= 3.5
        if (qteTimeLeft.value <= 0) {
            clearInterval(qteTimer)
            triggerUltimateKO()
        }
    }, 50)
}

const handleQTEClick = () => {
    if (!isQTEActive.value) return
    initAudio()
    qteCount.value++
    playQTESound()

    player.swinging = true
    player.effectFrame = 10
    player.y = player.baseY - 90 + (Math.random() - 0.5) * 10

    if (qteCount.value >= QTE_GOAL) {
        clearInterval(qteTimer)
        triggerUltimateKO()
    }
}

const triggerUltimateKO = () => {
    isQTEActive.value = false
    isUltimateKO.value = true
    playKOBoomSound()

    playerScore.value++
    wordHistory.value.push('correct')

    shuttlecock.startX = shuttlecock.x
    shuttlecock.startY = shuttlecock.y
    shuttlecock.targetX = machine.x
    shuttlecock.targetY = machine.y
    shuttlecock.progress = 0

    machine.isBroken = true

    // 生成大量爆破粒子
    koParticleList.value = Array.from({ length: 45 }).map(() => ({
        x: machine.x,
        y: machine.y,
        vx: (Math.random() - 0.5) * 22,
        vy: (Math.random() - 0.5) * 22,
        color: ['#ef4444', '#facc15', '#38bdf8', '#ffffff', '#a855f7'][Math.floor(Math.random() * 5)],
        size: Math.random() * 10 + 4,
        life: 1.0
    }))

    setTimeout(() => {
        shuttlecock.active = false
        gameWinner.value = 'player'
    }, 1500)
}

// 键盘事件
const handleKeyDown = (e) => {
    if (isQTEActive.value && (e.key === ' ' || e.key === 'Enter' || e.key === 'j' || e.key === 'J')) {
        handleQTEClick()
        return
    }

    if (e.key === 'j' || e.key === 'J') currentMoveType.value = 'smash'
    if (e.key === 'k' || e.key === 'K') currentMoveType.value = 'drop'
    if (e.key === 'l' || e.key === 'L') currentMoveType.value = 'drive'

    if (isTargeting.value) {
        if (e.key === '1' && options.value[0]) selectMoveAndAnswer(currentMoveType.value, options.value[0])
        if (e.key === '2' && options.value[1]) selectMoveAndAnswer(currentMoveType.value, options.value[1])
        if (e.key === '3' && options.value[2]) selectMoveAndAnswer(currentMoveType.value, options.value[2])
        return
    }

    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.left = true
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.right = true
}

const handleKeyUp = (e) => {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.left = false
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.right = false
}

// 渲染场地
const drawCourtBackground = () => {
    ctx.fillStyle = isUltimateKO.value ? '#090d16' : '#1e293b'
    ctx.fillRect(0, 0, CANVAS_WIDTH, 180)

    ctx.fillStyle = '#0f172a'
    for (let x = 10; x < CANVAS_WIDTH; x += 25) {
        for (let y = 50; y < 160; y += 22) {
            ctx.beginPath()
            ctx.arc(x, y, 8, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    ctx.fillStyle = '#94a3b8'
    ctx.fillRect(0, 160, CANVAS_WIDTH, 30)

    ctx.fillStyle = isUltimateKO.value ? '#450a0a' : '#d97706'
    ctx.fillRect(0, 190, CANVAS_WIDTH, 260)

    ctx.fillStyle = isUltimateKO.value ? '#14532d' : '#15803d'
    ctx.beginPath()
    ctx.moveTo(40, 230)
    ctx.lineTo(CANVAS_WIDTH - 40, 230)
    ctx.lineTo(CANVAS_WIDTH - 10, 420)
    ctx.lineTo(10, 420)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.strokeRect(50, 240, CANVAS_WIDTH - 100, 170)
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH / 2, 240)
    ctx.lineTo(CANVAS_WIDTH / 2, 410)
    ctx.stroke()

    ctx.fillStyle = '#334155'
    ctx.fillRect(CANVAS_WIDTH / 2 - 4, 180, 8, 140)

    // 落点显示
    if (isTargeting.value) {
        options.value.forEach((opt, idx) => {
            ctx.save()
            ctx.beginPath()
            ctx.ellipse(opt.targetX, opt.targetY + 15, 45, 18, 0, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)'
            ctx.fill()
            ctx.lineWidth = 2
            ctx.strokeStyle = '#facc15'
            ctx.setLineDash([4, 4])
            ctx.stroke()

            const cardWidth = 110
            const cardHeight = 36
            const cardX = opt.targetX - cardWidth / 2
            const cardY = opt.targetY - 25

            ctx.setLineDash([])
            ctx.fillStyle = '#0f172a'
            ctx.strokeStyle = '#38bdf8'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = '#facc15'
            ctx.font = 'bold 12px sans-serif'
            ctx.fillText(`[${idx + 1}]`, cardX + 8, cardY + 22)

            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 14px sans-serif'
            ctx.fillText(opt.text, cardX + 30, cardY + 22)

            ctx.restore()
        })
    }
}

// 绘制角色
const drawPlayerCharacter = (p) => {
    ctx.save()
    ctx.translate(p.x, p.y)

    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(0, 5, 18, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    if (keys.left || keys.right) p.walkFrame += 0.2
    else p.walkFrame = 0
    const legOffset = Math.sin(p.walkFrame) * 10

    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-6, -20)
    ctx.lineTo(-6 - legOffset, 0)
    ctx.moveTo(6, -20)
    ctx.lineTo(6 + legOffset, 0)
    ctx.stroke()

    ctx.fillStyle = '#dc2626'
    ctx.fillRect(-10 - legOffset, -2, 10, 5)
    ctx.fillRect(4 + legOffset, -2, 10, 5)

    ctx.fillStyle = '#1e293b'
    ctx.fillRect(-10, -32, 20, 14)

    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(-9, -58, 18, 28)

    ctx.fillStyle = '#78350f'
    ctx.beginPath()
    ctx.arc(0, -70, 11, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(0, -74, 11, Math.PI, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(3, -72, 3, 3)

    ctx.save()
    ctx.translate(4, -50)
    let targetAngle = p.swinging ? -Math.PI / 1.1 : Math.PI / 6
    p.armAngle += (targetAngle - p.armAngle) * 0.35
    ctx.rotate(p.armAngle)

    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(16, -5)
    ctx.stroke()

    ctx.strokeStyle = '#e11d48'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(16, -5)
    ctx.lineTo(30, -10)
    ctx.stroke()

    ctx.beginPath()
    ctx.ellipse(38, -12, 12, 7, 0.3, 0, Math.PI * 2)
    ctx.strokeStyle = '#f8fafc'
    ctx.stroke()

    if (p.effectFrame > 0) {
        p.effectFrame--
        ctx.strokeStyle = isUltimateKO.value ? '#a855f7' : '#ef4444'
        ctx.lineWidth = isUltimateKO.value ? 10 : 4
        ctx.beginPath()
        ctx.arc(38, -12, 20 + (15 - p.effectFrame) * 3, 0, Math.PI * 2)
        ctx.stroke()
    }

    ctx.restore()
    ctx.restore()
}

// ----------------------------------------------------
// 🤖 经典羽毛球发球机绘制（匹配原版游戏视觉风格）
// ----------------------------------------------------
const drawCyberTurret = (m) => {
    ctx.save()
    ctx.translate(m.x + m.recoil, m.y)

    if (m.recoil > 0) m.recoil *= 0.82

    // 1. 阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.ellipse(0, 20, 36, 8, 0, 0, Math.PI * 2)
    ctx.fill()

    // 2. 灰色后车轮
    ctx.fillStyle = '#475569'
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(22, 14, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#94a3b8'
    ctx.beginPath()
    ctx.arc(22, 14, 4, 0, Math.PI * 2)
    ctx.fill()

    // 3. 白色核心主体框架
    ctx.fillStyle = m.isBroken ? '#64748b' : '#f8fafc'
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-35, 18)
    ctx.lineTo(28, 18)
    ctx.lineTo(28, -15)
    ctx.lineTo(-10, -25)
    ctx.lineTo(-35, -5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // 4. 鲜艳橙色侧面装甲盖板
    ctx.fillStyle = m.isBroken ? '#7f1d1d' : '#ea580c'
    ctx.beginPath()
    ctx.moveTo(-32, 14)
    ctx.lineTo(20, 14)
    ctx.lineTo(20, -8)
    ctx.lineTo(-8, -16)
    ctx.lineTo(-32, -2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // 5. 侧面白色方向指示箭头 (指向左上方发射方向)
    if (!m.isBroken) {
        ctx.fillStyle = '#f8fafc'
        ctx.beginPath()
        ctx.moveTo(-18, 4)
        ctx.lineTo(-4, 4)
        ctx.lineTo(-4, -2)
        ctx.lineTo(6, -2)
        ctx.lineTo(-11, -12)
        ctx.lineTo(-11, -2)
        ctx.lineTo(-18, -2)
        ctx.closePath()
        ctx.fill()
    }

    // 6. 黑色发球斜面板与管口
    ctx.fillStyle = '#1e293b'
    ctx.beginPath()
    ctx.roundRect(-24, -26, 20, 12, 3)
    ctx.fill()
    ctx.stroke()

    // 7. 发射管指示灯/发光的发射口
    ctx.fillStyle = m.isBroken ? '#ef4444' : '#facc15'
    ctx.beginPath()
    ctx.arc(-20, -20, 4, 0, Math.PI * 2)
    ctx.fill()

    // 8. 报废烟雾效果
    if (m.isBroken) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)'
        ctx.beginPath()
        ctx.arc(0, -15, Math.random() * 15 + 10, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.restore()
}

// 主渲染循环
const render = () => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    drawCourtBackground()

    if (!isTargeting.value && !isQTEActive.value) {
        if (keys.left) player.x = Math.max(player.minX, player.x - player.speed)
        if (keys.right) player.x = Math.min(player.maxX, player.x + player.speed)

        if (player.isJumping) {
            player.vy += player.gravity
            player.y += player.vy
            if (player.y >= player.baseY) {
                player.y = player.baseY
                player.vy = 0
                player.isJumping = false
                player.swinging = false
            }
        }
    }

    drawCyberTurret(machine)
    drawPlayerCharacter(player)

    // 斩杀粒子
    if (koParticleList.value.length > 0) {
        koParticleList.value.forEach(pt => {
            pt.x += pt.vx
            pt.y += pt.vy
            pt.life -= 0.025
            ctx.fillStyle = pt.color
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, Math.max(0, pt.size * pt.life), 0, Math.PI * 2)
            ctx.fill()
        })
    }

    if (shuttlecock.active) {
        const step = isUltimateKO.value ? 0.08 : (isTargeting.value || isQTEActive.value ? 0.001 : 0.015)
        shuttlecock.progress += step
        if (shuttlecock.progress > 1) shuttlecock.progress = 1

        if (shuttlecock.progress >= 0.4 && !shuttlecock.quizTriggered) {
            triggerMidAirQuiz()
        }

        const p = shuttlecock.progress
        shuttlecock.x = shuttlecock.startX + (shuttlecock.targetX - shuttlecock.startX) * p
        shuttlecock.y = shuttlecock.startY + (shuttlecock.targetY - shuttlecock.startY) * p - Math.sin(p * Math.PI) * shuttlecock.arcHeight

        // 斩杀激光束
        if (isUltimateKO.value) {
            ctx.strokeStyle = '#facc15'
            ctx.shadowColor = '#ef4444'
            ctx.shadowBlur = 15
            ctx.lineWidth = 12
            ctx.beginPath()
            ctx.moveTo(shuttlecock.startX, shuttlecock.startY)
            ctx.lineTo(shuttlecock.x, shuttlecock.y)
            ctx.stroke()
            ctx.shadowBlur = 0
        }

        ctx.save()
        ctx.translate(shuttlecock.x, shuttlecock.y)
        ctx.fillStyle = isUltimateKO.value ? '#ef4444' : '#ffffff'
        ctx.beginPath()
        ctx.arc(0, 0, isUltimateKO.value ? 12 : 6, 0, Math.PI * 2)
        ctx.fill()

        if (currentWord.value && !isUltimateKO.value) {
            ctx.fillStyle = '#facc15'
            ctx.font = '900 20px monospace'
            ctx.textAlign = 'center'
            ctx.shadowColor = 'black'
            ctx.shadowBlur = 5
            ctx.fillText(currentWord.value.word || currentWord.value.en, 0, -18)
        }
        ctx.restore()
    }

    animationFrameId = requestAnimationFrame(render)
}

const handleCanvasClick = (e) => {
    if (isQTEActive.value) {
        handleQTEClick()
        return
    }

    if (!isTargeting.value || !canvasRef.value) return
    const rect = canvasRef.value.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const scaleY = CANVAS_HEIGHT / rect.height
    const clickX = (e.clientX - rect.left) * scaleX
    const clickY = (e.clientY - rect.top) * scaleY

    options.value.forEach(opt => {
        const dist = Math.hypot(clickX - opt.targetX, clickY - opt.targetY)
        if (dist < 55) {
            selectMoveAndAnswer(currentMoveType.value, opt)
        }
    })
}

const restartGame = () => {
    if (qteTimer) clearInterval(qteTimer)
    playerScore.value = 0
    aiScore.value = 0
    wordHistory.value = []
    gameWinner.value = null
    machine.isBroken = false
    launchShuttle()
}

onMounted(() => {
    if (canvasRef.value) {
        ctx = canvasRef.value.getContext('2d')
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        launchShuttle()
        render()
    }
})

onUnmounted(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    if (qteTimer) clearInterval(qteTimer)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
})

watch(() => props.wordList, restartGame, { deep: true })
</script>

<template>
    <div class="power-game-container">
        <!-- 顶部招式选择与比分 -->
        <div class="top-header">
            <div class="power-top-bar">
                <div class="score-box blue">{{ playerScore }}</div>
                
                <div class="inline-move-tabs">
                    <span class="move-label">当前击球招式:</span>
                    <button 
                        class="move-tab smash" 
                        :class="{ active: currentMoveType === 'smash' }"
                        @click="currentMoveType = 'smash'"
                    >
                        💥 重扣 <span class="key-hint">(J)</span>
                    </button>
                    <button 
                        class="move-tab drop" 
                        :class="{ active: currentMoveType === 'drop' }"
                        @click="currentMoveType = 'drop'"
                    >
                        🎾 吊球 <span class="key-hint">(K)</span>
                    </button>
                    <button 
                        class="move-tab drive" 
                        :class="{ active: currentMoveType === 'drive' }"
                        @click="currentMoveType = 'drive'"
                    >
                        ⚡ 平抽 <span class="key-hint">(L)</span>
                    </button>
                </div>

                <div class="score-box orange">{{ aiScore }}</div>
            </div>

            <!-- 10 词组进度条 -->
            <div class="progress-bar-10">
                <div 
                    v-for="i in GROUP_SIZE" 
                    :key="i" 
                    class="progress-dot"
                    :class="{
                        'correct': wordHistory[i - 1] === 'correct',
                        'wrong': wordHistory[i - 1] === 'wrong',
                        'current': wordHistory.length === i - 1
                    }"
                >
                    {{ i }}
                </div>
            </div>
        </div>

        <!-- 游戏画布 -->
        <div class="canvas-viewport" :class="{ 'ko-shake': isUltimateKO }">
            <canvas 
                ref="canvasRef" 
                :width="CANVAS_WIDTH" 
                :height="CANVAS_HEIGHT"
                @click="handleCanvasClick"
            ></canvas>

            <!-- 慢动作提示条 -->
            <div v-if="isTargeting" class="aim-action-banner">
                <span class="aim-text">🎯 打向对应落点！</span>
            </div>

            <!-- 🔥 QTE 斩杀互动浮层 -->
            <div v-if="isQTEActive" class="qte-interactive-overlay" @click="handleQTEClick">
                <div class="qte-title">🔥 触发 10连胜 满血灭世斩杀！</div>
                <div class="qte-prompt">连续狂按【空格键】或【点击屏幕】！</div>
                
                <!-- 充能进度条 -->
                <div class="qte-energy-bar">
                    <div class="qte-energy-fill" :style="{ width: (qteCount / QTE_GOAL * 100) + '%' }"></div>
                </div>
                <div class="qte-counter">{{ qteCount }} / {{ QTE_GOAL }} POWER</div>

                <!-- 倒计时条 -->
                <div class="qte-timer-bar">
                    <div class="qte-timer-fill" :style="{ width: qteTimeLeft + '%' }"></div>
                </div>
            </div>

            <!-- 斩杀成功大字幕 -->
            <div v-if="isUltimateKO" class="ko-overlay-banner">
                <div class="ko-title">🔥 PERFECT K.O. FINISH! 🔥</div>
                <div class="ko-sub">裂空斩杀！全对大满贯爆破！</div>
            </div>

            <!-- 通关结算弹窗 -->
            <div v-if="gameWinner" class="quiz-overlay">
                <div class="result-card" :class="{ 'perfect-card': playerScore === GROUP_SIZE }">
                    <h2>{{ playerScore === GROUP_SIZE ? '👑 完美大满贯胜利！' : (gameWinner === 'player' ? '🏆 本组通关成功！' : '💪 继续加油！') }}</h2>
                    <p>正确率: {{ playerScore }} / {{ GROUP_SIZE }}</p>
                    <button class="btn-restart" @click="restartGame">下一组测试</button>
                </div>
            </div>
        </div>

        <!-- 底部控制按键 -->
        <div class="footer-controls">
            <div class="key-group">
                <button 
                    class="ctrl-btn" 
                    @touchstart.prevent="keys.left = true" 
                    @touchend.prevent="keys.left = false"
                    @mousedown="keys.left = true"
                    @mouseup="keys.left = false"
                >
                    <span class="key-badge">A / ⬅️</span> 向左移动
                </button>
                <button 
                    class="ctrl-btn" 
                    @touchstart.prevent="keys.right = true" 
                    @touchend.prevent="keys.right = false"
                    @mousedown="keys.right = true"
                    @mouseup="keys.right = false"
                >
                    <span class="key-badge">D / ➡️</span> 向右移动
                </button>
            </div>
            <div class="move-tip">💡  1/2/3 选落点击球，J/K/L 切招式</div>
        </div>
    </div>
</template>

<style scoped>
.power-game-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #0f172a;
    padding: 12px;
    box-sizing: border-box;
    user-select: none;
}

.top-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.power-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e293b;
    border: 2px solid #334155;
    border-radius: 10px;
    padding: 6px 16px;
}

.score-box {
    width: 44px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 900;
    color: white;
    border-radius: 6px;
    border: 2px solid #ffffff;
}
.score-box.blue { background: #0284c7; }
.score-box.orange { background: #ea580c; }

.inline-move-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0f172a;
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid #334155;
}

.move-label {
    color: #94a3b8;
    font-size: 12px;
}

.move-tab {
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 4px 10px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
}

.move-tab .key-hint {
    font-size: 10px;
    opacity: 0.6;
}

.move-tab.smash.active { background: #dc2626; color: white; }
.move-tab.drop.active { background: #0284c7; color: white; }
.move-tab.drive.active { background: #d97706; color: white; }

/* 10 词进度条 */
.progress-bar-10 {
    display: flex;
    gap: 6px;
    justify-content: center;
}

.progress-dot {
    flex: 1;
    height: 18px;
    background: #334155;
    border: 1px solid #475569;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    color: #94a3b8;
    transition: all 0.2s;
}

.progress-dot.current {
    border-color: #facc15;
    color: #facc15;
    box-shadow: 0 0 8px rgba(250, 204, 21, 0.5);
}

.progress-dot.correct {
    background: #10b981;
    border-color: #34d399;
    color: white;
}

.progress-dot.wrong {
    background: #ef4444;
    border-color: #f87171;
    color: white;
}

.canvas-viewport {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
    margin: 4px 0;
}

.canvas-viewport.ko-shake {
    animation: koShake 0.4s ease-in-out;
}

@keyframes koShake {
    0%, 100% { transform: translate(0, 0); }
    20% { transform: translate(-8px, 6px); }
    40% { transform: translate(8px, -6px); }
    60% { transform: translate(-5px, -4px); }
    80% { transform: translate(5px, 4px); }
}

canvas {
    width: 100%;
    max-width: 800px;
    border-radius: 12px;
    border: 3px solid #334155;
    box-shadow: 0 12px 24px rgba(0,0,0,0.6);
    cursor: pointer;
}

/* 🔥 QTE 斩杀互动浮层样式 */
.qte-interactive-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 12px;
}

.qte-title {
    font-size: 26px;
    font-weight: 900;
    color: #facc15;
    text-shadow: 0 0 12px #ef4444;
    animation: pulse 0.8s infinite;
}

.qte-prompt {
    font-size: 16px;
    font-weight: bold;
    color: #ffffff;
    margin-top: 6px;
}

.qte-energy-bar {
    width: 60%;
    height: 22px;
    background: #1e293b;
    border: 2px solid #38bdf8;
    border-radius: 12px;
    overflow: hidden;
    margin-top: 16px;
}

.qte-energy-fill {
    height: 100%;
    background: linear-gradient(90deg, #facc15, #ef4444);
    transition: width 0.1s ease-out;
}

.qte-counter {
    color: #facc15;
    font-size: 20px;
    font-weight: 900;
    margin-top: 6px;
}

.qte-timer-bar {
    width: 40%;
    height: 6px;
    background: #334155;
    border-radius: 3px;
    overflow: hidden;
    margin-top: 12px;
}

.qte-timer-fill {
    height: 100%;
    background: #ef4444;
    transition: width 0.05s linear;
}

.ko-overlay-banner {
    position: absolute;
    top: 35%;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    animation: koBannerIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.ko-title {
    font-size: 38px;
    font-weight: 900;
    color: #facc15;
    font-style: italic;
    text-shadow: 0 0 20px #ef4444, 0 4px 0 #7f1d1d;
    letter-spacing: 2px;
}

.ko-sub {
    font-size: 16px;
    font-weight: bold;
    color: #ffffff;
    background: #ef4444;
    padding: 2px 14px;
    border-radius: 12px;
    margin-top: 4px;
}

@keyframes koBannerIn {
    0% { transform: scale(0.3); opacity: 0; }
    100% { transform: scale(1.1); opacity: 1; }
}

.aim-action-banner {
    position: absolute;
    top: 16px;
    background: rgba(2, 132, 199, 0.9);
    border: 2px solid #38bdf8;
    padding: 6px 20px;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    animation: pulse 1.2s infinite;
}

.aim-text {
    color: #ffffff;
    font-size: 14px;
    font-weight: 900;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
}

.quiz-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    backdrop-filter: blur(4px);
}

.result-card {
    background: white;
    padding: 24px 36px;
    border-radius: 16px;
    text-align: center;
    color: #0f172a;
}

.result-card.perfect-card {
    border: 3px solid #facc15;
    box-shadow: 0 0 24px rgba(250, 204, 21, 0.6);
}

.btn-restart {
    margin-top: 12px;
    background: #10b981;
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
}

.footer-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e293b;
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid #334155;
}

.key-group {
    display: flex;
    gap: 10px;
}

.ctrl-btn {
    background: #334155;
    color: white;
    border: 1px solid #475569;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
}

.key-badge {
    background: #0f172a;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    color: #38bdf8;
}

.move-tip {
    color: #94a3b8;
    font-size: 12px;
}
</style>
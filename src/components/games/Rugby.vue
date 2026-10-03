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
const currentMoveType = ref('pass') // pass (短传), rush (冲锋), touchdown (达阵轰炸)

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

const playHitSound = (type = 'pass') => {
    if (!audioCtx) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    if (type === 'touchdown') {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(450, now)
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.3)
        gain.gain.setValueAtTime(1.0, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    } else if (type === 'rush') {
        osc.type = 'square'
        osc.frequency.setValueAtTime(280, now)
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.2)
        gain.gain.setValueAtTime(0.8, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    } else {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(320, now)
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.15)
        gain.gain.setValueAtTime(0.6, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
    }

    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + 0.3)
}

const playQTESound = () => {
    if (!audioCtx) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(350 + qteCount.value * 60, now)
    osc.frequency.exponentialRampToValueAtTime(750 + qteCount.value * 60, now + 0.08)
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
    osc.frequency.setValueAtTime(500, now)
    osc.frequency.exponentialRampToValueAtTime(15, now + 1.4)
    gain.gain.setValueAtTime(1.0, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.4)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + 1.4)
}

// ----------------------------------------------------
// 角色与发球机（发球塔/发球机）状态
// ----------------------------------------------------
const keys = { left: false, right: false }

const player = {
    x: 160,
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

// 橄榄球发球塔
const machine = { 
    x: 690, 
    y: 300, 
    recoil: 0, 
    isBroken: false
}

const football = {
    x: 690,
    y: 280,
    startX: 690,
    startY: 280,
    targetX: 200,
    targetY: 310,
    progress: 0,
    arcHeight: 120,
    active: false,
    quizTriggered: false,
    rotation: 0
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
        { x: 480, y: 330, areaName: '左路区域 [1]' },
        { x: 600, y: 260, areaName: '中路突破 [2]' },
        { x: 710, y: 340, areaName: '右路达阵 [3]' }
    ]

    options.value = rawOptions.map((opt, idx) => ({
        ...opt,
        targetX: zonePositions[idx].x,
        targetY: zonePositions[idx].y,
        areaName: zonePositions[idx].areaName
    }))

    machine.recoil = 18
    football.startX = machine.x - 30
    football.startY = machine.y - 20
    football.targetX = 120 + Math.random() * 180
    football.targetY = player.baseY
    football.progress = 0
    football.arcHeight = 110 + Math.random() * 40
    football.quizTriggered = false
    football.active = true
}

const triggerMidAirQuiz = () => {
    if (football.quizTriggered) return
    football.quizTriggered = true
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

    if (moveType === 'touchdown') {
        player.vy = -12
        player.isJumping = true
    }

    if (opt.isCorrect) {
        playerScore.value++
        wordHistory.value.push('correct')
        playHitSound(moveType)

        football.startX = football.x
        football.startY = football.y
        football.targetX = opt.targetX
        football.targetY = opt.targetY
        football.progress = 0
        football.arcHeight = moveType === 'touchdown' ? 140 : (moveType === 'rush' ? 20 : 60)

        setTimeout(() => {
            football.active = false
            setTimeout(launchShuttle, 400)
        }, 450)
    } else {
        aiScore.value++
        wordHistory.value.push('wrong')

        football.startX = football.x
        football.startY = football.y
        football.targetX = player.x - 30
        football.targetY = player.baseY + 10
        football.progress = 0
        football.arcHeight = 15

        setTimeout(() => {
            football.active = false
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

    football.startX = football.x
    football.startY = football.y
    football.targetX = machine.x
    football.targetY = machine.y
    football.progress = 0

    machine.isBroken = true

    // 生成大量爆破粒子
    koParticleList.value = Array.from({ length: 45 }).map(() => ({
        x: machine.x,
        y: machine.y,
        vx: (Math.random() - 0.5) * 22,
        vy: (Math.random() - 0.5) * 22,
        color: ['#16a34a', '#facc15', '#ea580c', '#ffffff', '#dc2626'][Math.floor(Math.random() * 5)],
        size: Math.random() * 10 + 4,
        life: 1.0
    }))

    setTimeout(() => {
        football.active = false
        gameWinner.value = 'player'
    }, 1500)
}

// 键盘事件
const handleKeyDown = (e) => {
    if (isQTEActive.value && (e.key === ' ' || e.key === 'Enter' || e.key === 'j' || e.key === 'J')) {
        handleQTEClick()
        return
    }

    if (e.key === 'j' || e.key === 'J') currentMoveType.value = 'pass'
    if (e.key === 'k' || e.key === 'K') currentMoveType.value = 'rush'
    if (e.key === 'l' || e.key === 'L') currentMoveType.value = 'touchdown'

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

// 渲染橄榄球场
const drawCourtBackground = () => {
    // 1. 夜空/看台
    ctx.fillStyle = isUltimateKO.value ? '#051207' : '#0f172a'
    ctx.fillRect(0, 0, CANVAS_WIDTH, 170)

    // 看台灯光/观众颗粒
    ctx.fillStyle = '#1e293b'
    for (let x = 10; x < CANVAS_WIDTH; x += 25) {
        for (let y = 40; y < 150; y += 20) {
            ctx.beginPath()
            ctx.arc(x, y, 6, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    // 2. 橄榄球草坪
    const grassGradient = ctx.createLinearGradient(0, 170, 0, CANVAS_HEIGHT)
    grassGradient.addColorStop(0, isUltimateKO.value ? '#064e3b' : '#15803d')
    grassGradient.addColorStop(1, isUltimateKO.value ? '#022c22' : '#166534')
    ctx.fillStyle = grassGradient
    ctx.fillRect(0, 170, CANVAS_WIDTH, CANVAS_HEIGHT - 170)

    // 条纹草坪
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    for (let x = 0; x < CANVAS_WIDTH; x += 80) {
        ctx.fillRect(x, 170, 40, CANVAS_HEIGHT - 170)
    }

    // 3. 码线与端区标志 (Yard lines)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let x = 80; x < CANVAS_WIDTH; x += 80) {
        ctx.moveTo(x, 200)
        ctx.lineTo(x, 420)
    }
    ctx.stroke()

    // 码线数字
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    const yards = [10, 20, 30, 40, 50, 40, 30, 20, 10]
    yards.forEach((y, i) => {
        ctx.fillText(y.toString(), 80 + i * 80, 220)
        ctx.fillText(y.toString(), 80 + i * 80, 410)
    })

    // 4. 黄色橄榄球门柱 (Goal Post)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(740, 330)
    ctx.lineTo(740, 200)
    ctx.moveTo(710, 200)
    ctx.lineTo(770, 200)
    ctx.moveTo(710, 200)
    ctx.lineTo(710, 120)
    ctx.moveTo(770, 200)
    ctx.lineTo(770, 120)
    ctx.stroke()

    // 落点显示
    if (isTargeting.value) {
        options.value.forEach((opt, idx) => {
            ctx.save()
            ctx.beginPath()
            ctx.ellipse(opt.targetX, opt.targetY + 15, 45, 18, 0, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(250, 204, 21, 0.25)'
            ctx.fill()
            ctx.lineWidth = 2
            ctx.strokeStyle = '#ea580c'
            ctx.setLineDash([4, 4])
            ctx.stroke()

            const cardWidth = 110
            const cardHeight = 36
            const cardX = opt.targetX - cardWidth / 2
            const cardY = opt.targetY - 25

            ctx.setLineDash([])
            ctx.fillStyle = '#0f172a'
            ctx.strokeStyle = '#facc15'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = '#ea580c'
            ctx.font = 'bold 12px sans-serif'
            ctx.fillText(`[${idx + 1}]`, cardX + 16, cardY + 22)

            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 14px sans-serif'
            ctx.fillText(opt.text, cardX + 38, cardY + 22)

            ctx.restore()
        })
    }
}

// 绘制橄榄球选手 (带有头盔与护肩)
const drawPlayerCharacter = (p) => {
    ctx.save()
    ctx.translate(p.x, p.y)

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(0, 5, 22, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    if (keys.left || keys.right) p.walkFrame += 0.2
    else p.walkFrame = 0
    const legOffset = Math.sin(p.walkFrame) * 10

    // 双腿
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(-8, -20)
    ctx.lineTo(-8 - legOffset, 0)
    ctx.moveTo(8, -20)
    ctx.lineTo(8 + legOffset, 0)
    ctx.stroke()

    // 战术球鞋
    ctx.fillStyle = '#ea580c'
    ctx.fillRect(-12 - legOffset, -2, 12, 6)
    ctx.fillRect(4 + legOffset, -2, 12, 6)

    // 橄榄球短裤
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(-12, -34, 24, 16)

    // 护肩与队服球衣 (带有 88 号)
    ctx.fillStyle = '#0284c7'
    ctx.beginPath()
    ctx.roundRect(-16, -60, 32, 28, 4)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = '900 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('88', 0, -42)

    // 橄榄球头盔
    ctx.fillStyle = '#ea580c'
    ctx.beginPath()
    ctx.arc(0, -72, 14, 0, Math.PI * 2)
    ctx.fill()

    // 头盔护面面罩 (Grid)
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(2, -72)
    ctx.lineTo(14, -72)
    ctx.lineTo(12, -62)
    ctx.lineTo(2, -62)
    ctx.stroke()

    // 手臂与挥球动作
    ctx.save()
    ctx.translate(6, -52)
    let targetAngle = p.swinging ? -Math.PI / 1.1 : Math.PI / 6
    p.armAngle += (targetAngle - p.armAngle) * 0.35
    ctx.rotate(p.armAngle)

    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(18, -6)
    ctx.stroke()

    if (p.effectFrame > 0) {
        p.effectFrame--
        ctx.strokeStyle = isUltimateKO.value ? '#facc15' : '#ea580c'
        ctx.lineWidth = isUltimateKO.value ? 10 : 4
        ctx.beginPath()
        ctx.arc(18, -6, 18 + (15 - p.effectFrame) * 3, 0, Math.PI * 2)
        ctx.stroke()
    }

    ctx.restore()
    ctx.restore()
}

// ----------------------------------------------------
// 🤖 橄榄球发球机/防守塔绘制
// ----------------------------------------------------
const drawCyberTurret = (m) => {
    ctx.save()
    ctx.translate(m.x + m.recoil, m.y)

    if (m.recoil > 0) m.recoil *= 0.82

    // 阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.beginPath()
    ctx.ellipse(0, 20, 38, 10, 0, 0, Math.PI * 2)
    ctx.fill()

    // 底座履带
    ctx.fillStyle = '#334155'
    ctx.beginPath()
    ctx.roundRect(-35, 10, 60, 14, 4)
    ctx.fill()

    // 主体结构 (深绿/黑金样式)
    ctx.fillStyle = m.isBroken ? '#475569' : '#1e293b'
    ctx.strokeStyle = '#ea580c'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-30, 10)
    ctx.lineTo(20, 10)
    ctx.lineTo(15, -20)
    ctx.lineTo(-20, -25)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // 侧面装甲
    ctx.fillStyle = m.isBroken ? '#7f1d1d' : '#15803d'
    ctx.fillRect(-15, -15, 25, 18)

    // 发射管口
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(-20, -12, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#facc15'
    ctx.stroke()

    // 报废烟雾效果
    if (m.isBroken) {
        ctx.fillStyle = 'rgba(234, 88, 12, 0.6)'
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

    // 斩杀爆破粒子
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

    // 橄榄球绘制与旋转飞行
    if (football.active) {
        const step = isUltimateKO.value ? 0.08 : (isTargeting.value || isQTEActive.value ? 0.001 : 0.015)
        football.progress += step
        if (football.progress > 1) football.progress = 1

        if (football.progress >= 0.4 && !football.quizTriggered) {
            triggerMidAirQuiz()
        }

        const p = football.progress
        football.x = football.startX + (football.targetX - football.startX) * p
        football.y = football.startY + (football.targetY - football.startY) * p - Math.sin(p * Math.PI) * football.arcHeight
        football.rotation += 0.15

        // 斩杀激光/火球尾迹
        if (isUltimateKO.value) {
            ctx.strokeStyle = '#ea580c'
            ctx.shadowColor = '#facc15'
            ctx.shadowBlur = 15
            ctx.lineWidth = 14
            ctx.beginPath()
            ctx.moveTo(football.startX, football.startY)
            ctx.lineTo(football.x, football.y)
            ctx.stroke()
            ctx.shadowBlur = 0
        }

        ctx.save()
        ctx.translate(football.x, football.y)
        ctx.rotate(football.rotation)

        // 橄榄球椭圆身体 (Brown Football Body)
        ctx.fillStyle = '#78350f'
        ctx.beginPath()
        ctx.ellipse(0, 0, isUltimateKO.value ? 16 : 10, isUltimateKO.value ? 10 : 6, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // 橄榄球缝线 (White Laces)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(-4, 0)
        ctx.lineTo(4, 0)
        ctx.moveTo(-2, -2)
        ctx.lineTo(-2, 2)
        ctx.moveTo(2, -2)
        ctx.lineTo(2, 2)
        ctx.stroke()

        ctx.restore()

        // 单词渲染
        if (currentWord.value && !isUltimateKO.value) {
            ctx.save()
            ctx.fillStyle = '#facc15'
            ctx.font = '900 20px monospace'
            ctx.textAlign = 'center'
            ctx.shadowColor = 'black'
            ctx.shadowBlur = 6
            ctx.fillText(currentWord.value.word || currentWord.value.en, football.x, football.y - 18)
            ctx.restore()
        }
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
                    <span class="move-label">战术选择:</span>
                    <button 
                        class="move-tab pass" 
                        :class="{ active: currentMoveType === 'pass' }"
                        @click="currentMoveType = 'pass'"
                    >
                        🏈 短传 <span class="key-hint">(J)</span>
                    </button>
                    <button 
                        class="move-tab rush" 
                        :class="{ active: currentMoveType === 'rush' }"
                        @click="currentMoveType = 'rush'"
                    >
                        ⚡ 强攻冲锋 <span class="key-hint">(K)</span>
                    </button>
                    <button 
                        class="move-tab touchdown" 
                        :class="{ active: currentMoveType === 'touchdown' }"
                        @click="currentMoveType = 'touchdown'"
                    >
                        💥 达阵轰炸 <span class="key-hint">(L)</span>
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
                <span class="aim-text">🎯 传球向正确路线！</span>
            </div>

            <!-- 🔥 QTE 达阵斩杀互动浮层 -->
            <div v-if="isQTEActive" class="qte-interactive-overlay" @click="handleQTEClick">
                <div class="qte-title">🏈 触发 10连胜 TOUCHDOWN 触地达阵！</div>
                <div class="qte-prompt">连续狂按【空格键】或【点击屏幕】撕裂防线！</div>
                
                <!-- 充能进度条 -->
                <div class="qte-energy-bar">
                    <div class="qte-energy-fill" :style="{ width: (qteCount / QTE_GOAL * 100) + '%' }"></div>
                </div>
                <div class="qte-counter">{{ qteCount }} / {{ QTE_GOAL }} TOUCHDOWN</div>

                <!-- 倒计时条 -->
                <div class="qte-timer-bar">
                    <div class="qte-timer-fill" :style="{ width: qteTimeLeft + '%' }"></div>
                </div>
            </div>

            <!-- 斩杀成功大字幕 -->
            <div v-if="isUltimateKO" class="ko-overlay-banner">
                <div class="ko-title">🏆 TOUCHDOWN! WINNER! 🏆</div>
                <div class="ko-sub">达阵爆破！全对大满贯强攻通关！</div>
            </div>

            <!-- 通关结算弹窗 -->
            <div v-if="gameWinner" class="quiz-overlay">
                <div class="result-card" :class="{ 'perfect-card': playerScore === GROUP_SIZE }">
                    <h2>{{ playerScore === GROUP_SIZE ? '👑 完美达阵胜利！' : (gameWinner === 'player' ? '🏆 成功撕裂防线！' : '💪 继续加油！') }}</h2>
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
            <div class="move-tip">💡 1/2/3 选接球路线，J/K/L 切换战术</div>
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
    background: #091a10;
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
    background: #143823;
    border: 2px solid #22543d;
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
    background: #091a10;
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid #22543d;
}

.move-label {
    color: #a7f3d0;
    font-size: 12px;
}

.move-tab {
    background: transparent;
    border: none;
    color: #a7f3d0;
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

.move-tab.pass.active { background: #0284c7; color: white; }
.move-tab.rush.active { background: #d97706; color: white; }
.move-tab.touchdown.active { background: #dc2626; color: white; }

/* 10 词进度条 */
.progress-bar-10 {
    display: flex;
    gap: 6px;
    justify-content: center;
}

.progress-dot {
    flex: 1;
    height: 18px;
    background: #143823;
    border: 1px solid #22543d;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    color: #a7f3d0;
    transition: all 0.2s;
}

.progress-dot.current {
    border-color: #facc15;
    color: #facc15;
    box-shadow: 0 0 8px rgba(250, 204, 21, 0.5);
}

.progress-dot.correct {
    background: #16a34a;
    border-color: #4ade80;
    color: white;
}

.progress-dot.wrong {
    background: #dc2626;
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
    border: 3px solid #22543d;
    box-shadow: 0 12px 24px rgba(0,0,0,0.6);
    cursor: pointer;
}

/* 🔥 QTE 达阵斩杀互动浮层样式 */
.qte-interactive-overlay {
    position: absolute;
    inset: 0;
    background: rgba(9, 26, 16, 0.82);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 12px;
}

.qte-title {
    font-size: 24px;
    font-weight: 900;
    color: #facc15;
    text-shadow: 0 0 12px #ea580c;
    animation: pulse 0.8s infinite;
}

.qte-prompt {
    font-size: 15px;
    font-weight: bold;
    color: #ffffff;
    margin-top: 6px;
}

.qte-energy-bar {
    width: 60%;
    height: 22px;
    background: #143823;
    border: 2px solid #facc15;
    border-radius: 12px;
    overflow: hidden;
    margin-top: 16px;
}

.qte-energy-fill {
    height: 100%;
    background: linear-gradient(90deg, #16a34a, #ea580c);
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
    background: #22543d;
    border-radius: 3px;
    overflow: hidden;
    margin-top: 12px;
}

.qte-timer-fill {
    height: 100%;
    background: #dc2626;
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
    font-size: 36px;
    font-weight: 900;
    color: #facc15;
    font-style: italic;
    text-shadow: 0 0 20px #ea580c, 0 4px 0 #7c2d12;
    letter-spacing: 2px;
}

.ko-sub {
    font-size: 16px;
    font-weight: bold;
    color: #ffffff;
    background: #ea580c;
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
    background: rgba(234, 88, 12, 0.9);
    border: 2px solid #facc15;
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
    background: rgba(9, 26, 16, 0.88);
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
    background: #16a34a;
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
    background: #143823;
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid #22543d;
}

.key-group {
    display: flex;
    gap: 10px;
}

.ctrl-btn {
    background: #22543d;
    color: white;
    border: 1px solid #2f7152;
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
    background: #091a10;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    color: #facc15;
}

.move-tip {
    color: #a7f3d0;
    font-size: 12px;
}
</style>
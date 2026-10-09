<template>
  <div class="word-module-container">
    <!-- 模式 1：测试卡片网格模式（懒加载一划到底 + 紧凑置底 Footer） -->
    <div v-if="currentView === 'test'" class="word-card-test-wrapper">
      
      <!-- 可滚动的卡片主内容区域 -->
      <div class="grid-scroll-area" @scroll="handleGridScroll">
        <!-- 顶部导航与词库切换栏 -->
        <div class="test-header">
          <div class="bank-selector">
            <span class="label">当前词库：</span>
            <div class="bank-tabs">
              <button 
                v-for="bank in banks" 
                :key="bank.key"
                class="bank-btn"
                :class="{ active: currentBankKey === bank.key }"
                @click="switchBank(bank.key)"
              >
                {{ bank.name }}
              </button>
            </div>
          </div>

          <button class="reset-btn" @click="resetTest">🔄 重新测试</button>
        </div>

        <!-- 3x3 单词卡片网格区域 -->
        <div class="card-grid">
          <div 
            v-for="(word, index) in renderedGridWords" 
            :key="word.en + index"
            class="word-card"
            :class="{
              'status-known': wordState[word.en] === 'known',
              'status-unknown': wordState[word.en] === 'unknown'
            }"
          >
            <div class="card-top">
              <h3 class="word-title">{{ word.en }}</h3>
              <button class="sound-btn" @click="speak(word.en)" title="朗读">🔊</button>
            </div>
            
            <div class="word-ps" v-if="word.ps">/ {{ word.ps }} /</div>

            <!-- 认识 / 不会 操作按钮 -->
            <div class="action-btns">
              <button 
                class="act-btn btn-know" 
                :class="{ active: wordState[word.en] === 'known' }"
                @click="markWord(word.en, 'known')"
              >
                认识
              </button>
              <button 
                class="act-btn btn-unknown" 
                :class="{ active: wordState[word.en] === 'unknown' }"
                @click="markWord(word.en, 'unknown')"
              >
                不会
              </button>
            </div>
          </div>
        </div>

        <!-- 触底加载提示器 -->
        <div v-if="hasMoreGridWords" class="grid-loading-tip">
          ↓ 向下滑动加载更多单词 (已显示 {{ renderedGridWords.length }}/{{ activeBankWords.length }})
        </div>
        <div v-else class="grid-loading-tip finish">
          🎉 已显示全部 {{ activeBankWords.length }} 个单词
        </div>
      </div>

      <!-- 紧凑型固定置底 Footer 区域 -->
      <footer class="fixed-test-footer">
        <!-- 单行紧凑进度统计卡片 -->
        <div class="progress-panel">
          <span class="progress-title">
            测试进度：<span class="highlight-num">{{ totalTested }}</span> / {{ activeBankWords.length }}
          </span>
          <span class="divider">|</span>
          <div class="progress-detail">
            <span>认识：<b class="text-green">{{ knownCount }}</b> 个</span>
            <span class="divider">|</span>
            <span>不会：<b class="text-orange">{{ unknownCount }}</b> 个</span>
          </div>
        </div>

        <!-- 操作按钮栏 -->
        <div class="test-actions">
          <button 
            class="start-learn-btn" 
            :disabled="unknownCount === 0"
            @click="startLearnUnknown"
          >
            开始学习不会的单词 ({{ unknownCount }}个)
          </button>
          <button class="outline-btn" @click="resetTest">重新测试</button>
        </div>
      </footer>
    </div>

    <!-- 模式 2：单词学习详情页模式（侧边栏固定 5 词按页切换） -->
    <div v-else-if="currentView === 'learn'" class="word-learn-container">
      <!-- 左侧 sidebar：单词导航与控制 -->
      <aside class="learn-sidebar">
        <div class="sidebar-header">
          <span class="header-icon">📚</span>
          <h2>单词学习</h2>
        </div>

        <!-- 侧边栏：精准渲染当前页的 5 个单词 -->
        <div class="word-menu-list">
          <div
            v-for="(word, index) in currentPageWords"
            :key="word.en + (startIndex + index)"
            class="word-menu-item"
            :class="{ active: currentLearnIndex === startIndex + index }"
            @click="selectWord(startIndex + index)"
          >
            <span class="word-index">{{ startIndex + index + 1 }}</span>
            <span class="word-text">{{ word.en }}</span>
          </div>
        </div>

        <!-- 侧边栏底部：5 词切页控制区 -->
        <div class="sidebar-actions">
          <button class="action-btn primary-btn" @click="isTestMode = !isTestMode">
            {{ isTestMode ? ' 查看释义' : ' 记忆检测' }}
          </button>

          <!-- 切页控制按钮 -->
          <div class="page-nav-btns">
            <button 
              class="nav-btn" 
              :disabled="currentPage === 1" 
              @click="prevPage"
            >
              上一页
            </button>
            <button 
              class="nav-btn" 
              :disabled="currentPage === totalPages" 
              @click="nextPage"
            >
              下一页
            </button>
          </div>

          <div class="page-indicator">
            第 {{ currentPage }} 页，共 {{ totalPages }} 页
          </div>

          <button class="back-btn" @click="currentView = 'test'">返回测试</button>
        </div>
      </aside>

      <!-- 右侧 main：单词详情展示区 -->
      <main class="learn-content" v-if="currentLearnWord">
        <div class="word-header-title">
          <h1>{{ currentLearnWord.en }}</h1>
        </div>

        <!-- 发音面板 -->
        <div class="detail-card phonetic-card">
          <div class="phonetic-item" @click="speak(currentLearnWord.en, 'us')">
            <span class="sound-icon">🔊</span>
            <span class="label">美式发音：</span>
            <span class="phonetic-text">/{{ currentLearnWord.usPhonetic || currentLearnWord.ps || 'nuː' }}/</span>
          </div>
          <div class="phonetic-item" @click="speak(currentLearnWord.en, 'uk')">
            <span class="sound-icon">🔊</span>
            <span class="label">英式发音：</span>
            <span class="phonetic-text">/{{ currentLearnWord.ukPhonetic || currentLearnWord.ps || 'njuː' }}/</span>
          </div>
        </div>

        <!-- 拼读拆解面板 -->
        <div class="detail-card spelling-card">
          <div class="tab-header">
            <button 
              class="tab-btn" 
              :class="{ active: spellTab === 'split' }"
              @click="spellTab = 'split'"
            >
              拆分发音
            </button>
            <button 
              class="tab-btn" 
              :class="{ active: spellTab === 'phonics' }"
              @click="spellTab = 'phonics'"
            >
              自然拼读
            </button>
          </div>

          <div class="spelling-content">
            <div v-if="spellTab === 'split'" class="split-syllable-box" @click="speak(currentLearnWord.en)">
              <div class="syllable-text">{{ currentLearnWord.en }}</div>
              <div class="syllable-ps">/{{ currentLearnWord.ps || 'nuː' }}/</div>
            </div>

            <div v-else class="phonics-box">
              <span 
                v-for="(part, i) in (currentLearnWord.phonicsParts || [currentLearnWord.en])" 
                :key="i"
                class="phonics-chip"
              >
                {{ part }}
              </span>
            </div>

            <button class="play-full-btn" @click="speak(currentLearnWord.en)">
              ► 播放完整发音
            </button>
          </div>
        </div>

        <!-- 释义与例句面板 -->
        <div class="detail-card meaning-card">
          <div class="card-section-title">
            <span class="icon">📖</span> 释义
          </div>

          <div v-if="isTestMode" class="test-mask" @click="isTestMode = false">
            <span>🙈 点击取消遮罩或再次点击“记忆检测”查看释义</span>
          </div>

          <div v-else class="meaning-body">
            <div class="pos-tag" v-if="currentLearnWord.pos || 'adj.'">
              {{ currentLearnWord.pos || 'adj.' }}
            </div>
            <div class="cn-text">{{ currentLearnWord.cn }}</div>

            <div class="example-box">
              <div class="example-en">
                {{ currentLearnWord.exampleEn || `She has a ${currentLearnWord.en} item.` }}
                <button class="sound-mini-btn" @click="speak(currentLearnWord.exampleEn || currentLearnWord.en)">🔊</button>
              </div>
              <div class="example-cn">
                {{ currentLearnWord.exampleCn || `她有一个新的物品。` }}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  customBanks: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['start-learning'])

// 视图模式: 'test' | 'learn'
const currentView = ref('test')

// 词库定义
const banks = [
  { key: 'primary', name: '小学考纲' },
  { key: 'junior', name: '初中考纲' },
  { key: 'senior', name: '高中考纲' }
]

const currentBankKey = ref('primary')

// 50 个词汇的基础词库
const defaultBankData = {
  primary: [
    { en: 'apple', ps: 'ˈæpl', pos: 'n.', cn: '苹果', exampleEn: 'An apple a day keeps the doctor away.', exampleCn: '一天一苹果，医生远离我。' },
    { en: 'book', ps: 'bʊk', pos: 'n.', cn: '书本', exampleEn: 'He is reading an interesting book.', exampleCn: '他正在读一本有趣的书。' },
    { en: 'cat', ps: 'kæt', pos: 'n.', cn: '猫', exampleEn: 'The cat is sleeping on the mat.', exampleCn: '猫趴在垫子上睡觉。' },
    { en: 'dog', ps: 'dɒɡ', pos: 'n.', cn: '狗', exampleEn: 'A dog is barking outside.', exampleCn: '一只狗在外面叫。' },
    { en: 'egg', ps: 'eɡ', pos: 'n.', cn: '鸡蛋', exampleEn: 'I ate a boiled egg for breakfast.', exampleCn: '我早餐吃了一个煮鸡蛋。' },
    { en: 'fish', ps: 'fɪʃ', pos: 'n.', cn: '鱼', exampleEn: 'Fish swim in the river.', exampleCn: '鱼在河里游泳。' },
    { en: 'girl', ps: 'ɡɜːl', pos: 'n.', cn: '女孩', exampleEn: 'She is a clever girl.', exampleCn: '她是个聪明的女孩。' },
    { en: 'house', ps: 'haʊs', pos: 'n.', cn: '房屋', exampleEn: 'They live in a big house.', exampleCn: '他们住在一栋大房子里。' },
    { en: 'ice', ps: 'aɪs', pos: 'n.', cn: '冰', exampleEn: 'The ice is melting.', exampleCn: '冰正在融化。' },
    { en: 'juice', ps: 'dʒuːs', pos: 'n.', cn: '果汁', exampleEn: 'Would you like some orange juice?', exampleCn: '你想喝点橙汁吗？' },
    { en: 'kite', ps: 'kaɪt', pos: 'n.', cn: '风筝', exampleEn: 'They are flying kites in the park.', exampleCn: '他们正在公园里放风筝。' },
    { en: 'lion', ps: 'ˈlaɪən', pos: 'n.', cn: '狮子', exampleEn: 'The lion is the king of the forest.', exampleCn: '狮子是森林之王。' },
    { en: 'milk', ps: 'mɪlk', pos: 'n.', cn: '牛奶', exampleEn: 'Drink a glass of milk before bed.', exampleCn: '睡前喝一杯牛奶。' },
    { en: 'new', ps: 'njuː', pos: 'adj.', cn: '新的', exampleEn: 'She has a new schoolbag.', exampleCn: '她有一个新书包。' },
    { en: 'open', ps: 'ˈəʊpən', pos: 'v.', cn: '打开', exampleEn: 'Please open the window.', exampleCn: '请打开窗户。' },
    { en: 'pen', ps: 'pen', pos: 'n.', cn: '钢笔', exampleEn: 'I write with a blue pen.', exampleCn: '我用蓝色钢笔写字。' },
    { en: 'queen', ps: 'kwiːn', pos: 'n.', cn: '女王；王后', exampleEn: 'The queen wore a golden crown.', exampleCn: '女王戴着一顶金王冠。' },
    { en: 'rabbit', ps: 'ˈræbɪt', pos: 'n.', cn: '兔子', exampleEn: 'The rabbit is eating carrots.', exampleCn: '兔子正在吃胡萝卜。' },
    { en: 'sun', ps: 'sʌn', pos: 'n.', cn: '太阳', exampleEn: 'The sun shines brightly.', exampleCn: '阳光明媚。' },
    { en: 'tree', ps: 'triː', pos: 'n.', cn: '树木', exampleEn: 'Birds are singing in the tree.', exampleCn: '鸟儿在树上唱歌。' },
    { en: 'umbrella', ps: 'ʌmˈbrelə', pos: 'n.', cn: '雨伞', exampleEn: 'Don\'t forget to bring an umbrella.', exampleCn: '别忘了带一把伞。' },
    { en: 'voice', ps: 'vɔɪs', pos: 'n.', cn: '声音', exampleEn: 'She has a beautiful singing voice.', exampleCn: '她有美妙的歌声。' },
    { en: 'water', ps: 'ˈwɔːtə', pos: 'n.', cn: '水', exampleEn: 'Drink plenty of water every day.', exampleCn: '每天多喝水。' },
    { en: 'yellow', ps: 'ˈjeləʊ', pos: 'adj.', cn: '黄色的', exampleEn: 'The sunflower is yellow.', exampleCn: '向日葵是黄色的。' },
    { en: 'zoo', ps: 'zuː', pos: 'n.', cn: '动物园', exampleEn: 'We visited the zoo yesterday.', exampleCn: '我们昨天参观了动物园。' },
    { en: 'bird', ps: 'bɜːd', pos: 'n.', cn: '鸟', exampleEn: 'The bird is flying high.', exampleCn: '鸟儿飞得很快很高。' },
    { en: 'cake', ps: 'keɪk', pos: 'n.', cn: '蛋糕', exampleEn: 'It is a birthday cake.', exampleCn: '这是一个生日蛋糕。' },
    { en: 'duck', ps: 'dʌk', pos: 'n.', cn: '鸭子', exampleEn: 'Ducks swim on the lake.', exampleCn: '鸭子在湖面上游泳。' },
    { en: 'friend', ps: 'frend', pos: 'n.', cn: '朋友', exampleEn: 'A friend in need is a friend indeed.', exampleCn: '患难见真情。' },
    { en: 'green', ps: 'ɡriːn', pos: 'adj.', cn: '绿色的', exampleEn: 'The grass is green in spring.', exampleCn: '春天草是绿色的。' },
    { en: 'hand', ps: 'hænd', pos: 'n.', cn: '手', exampleEn: 'Wash your hands before dinner.', exampleCn: '饭前请洗手。' },
    { en: 'jump', ps: 'dʒʌmp', pos: 'v.', cn: '跳跃', exampleEn: 'The kids jump with joy.', exampleCn: '孩子们高兴得跳了起来。' },
    { en: 'kind', ps: 'kaɪnd', pos: 'adj.', cn: '友善的', exampleEn: 'She is very kind to everyone.', exampleCn: '她对每个人都很友善。' },
    { en: 'long', ps: 'lɒŋ', pos: 'adj.', cn: '长的', exampleEn: 'It has a long tail.', exampleCn: '它有一条长尾巴。' },
    { en: 'moon', ps: 'muːn', pos: 'n.', cn: '月亮', exampleEn: 'The moon is full tonight.', exampleCn: '今晚月亮很圆。' },
    { en: 'nice', ps: 'naɪs', pos: 'adj.', cn: '美好的', exampleEn: 'Have a nice day!', exampleCn: '祝你有美好的一天！' },
    { en: 'old', ps: 'əʊld', pos: 'adj.', cn: '老的；旧的', exampleEn: 'This is an old house.', exampleCn: '这是一栋旧房子。' },
    { en: 'park', ps: 'pɑːk', pos: 'n.', cn: '公园', exampleEn: 'Let\'s go for a walk in the park.', exampleCn: '我们去公园散散步吧。' },
    { en: 'rain', ps: 'reɪn', pos: 'n.', cn: '雨', exampleEn: 'It started to rain heavily.', exampleCn: '开始下大雨了。' },
    { en: 'star', ps: 'stɑːr', pos: 'n.', cn: '星星', exampleEn: 'Stars twinkle in the dark night.', exampleCn: '星星在黑夜里闪烁。' },
    { en: 'think', ps: 'θɪŋk', pos: 'v.', cn: '思考', exampleEn: 'Let me think about it.', exampleCn: '让我思考一下。' },
    { en: 'train', ps: 'treɪn', pos: 'n.', cn: '火车', exampleEn: 'The train arrived on time.', exampleCn: '火车准时到达。' },
    { en: 'warm', ps: 'wɔːm', pos: 'adj.', cn: '温暖的', exampleEn: 'The tea is nice and warm.', exampleCn: '这茶非常温暖舒适。' },
    { en: 'year', ps: 'jɪə', pos: 'n.', cn: '年份', exampleEn: 'Happy New Year!', exampleCn: '新年快乐！' },
    { en: 'bear', ps: 'beə', pos: 'n.', cn: '熊', exampleEn: 'The bear hibernates in winter.', exampleCn: '熊在冬天冬眠。' },
    { en: 'desk', ps: 'desk', pos: 'n.', cn: '书桌', exampleEn: 'Put your books on the desk.', exampleCn: '把书放在书桌上。' },
    { en: 'food', ps: 'fuːd', pos: 'n.', cn: '食物', exampleEn: 'Good food gives you energy.', exampleCn: '好食物能带给你能量。' },
    { en: 'gift', ps: 'ɡɪft', pos: 'n.', cn: '礼物', exampleEn: 'Thank you for the wonderful gift.', exampleCn: '谢谢你送的这份好礼物。' },
    { en: 'hill', ps: 'hɪl', pos: 'n.', cn: '小山', exampleEn: 'They climbed up the hill.', exampleCn: '他们爬上了小山。' },
    { en: 'room', ps: 'ruːm', pos: 'n.', cn: '房间', exampleEn: 'Keep your room clean and tidy.', exampleCn: '保持房间整洁。' }
  ],
  junior: [
    { en: 'achieve', ps: 'əˈtʃiːv', pos: 'v.', cn: '实现；达到', exampleEn: 'Achieve your goals through hard work.', exampleCn: '通过努力工作实现你的目标。' },
    { en: 'benefit', ps: 'ˈbenɪfɪt', pos: 'n.', cn: '利益；好处', exampleEn: 'Regular exercise brings many benefits.', exampleCn: '定期运动带来很多好处。' },
    { en: 'culture', ps: 'ˈkʌltʃə', pos: 'n.', cn: '文化', exampleEn: 'Learning languages expands cultural horizons.', exampleCn: '学习语言能拓展文化视野。' },
    { en: 'decision', ps: 'dɪˈsɪʒn', pos: 'n.', cn: '决定', exampleEn: 'Think carefully before making a decision.', exampleCn: '做决定前要仔细思考。' },
    { en: 'effort', ps: 'ˈefət', pos: 'n.', cn: '努力', exampleEn: 'Success requires constant effort.', exampleCn: '成功需要不懈的努力。' },
    { en: 'future', ps: 'ˈfjuːtʃə', pos: 'n.', cn: '未来', exampleEn: 'Work hard for a brighter future.', exampleCn: '为了更美好的未来而努力。' },
    { en: 'growth', ps: 'ɡrəʊθ', pos: 'n.', cn: '增长；成长', exampleEn: 'Reading promotes personal growth.', exampleCn: '阅读促进个人成长。' },
    { en: 'habit', ps: 'ˈhæbɪt', pos: 'n.', cn: '习惯', exampleEn: 'Develop a habit of early rising.', exampleCn: '养成早起的习惯。' },
    { en: 'impact', ps: 'ˈɪmpækt', pos: 'n.', cn: '影响', exampleEn: 'Technology has a great impact on life.', exampleCn: '科技对生活产生了巨大的影响。' },
    { en: 'journey', ps: 'ˈdʒɜːni', pos: 'n.', cn: '旅程', exampleEn: 'Life is a long journey of learning.', exampleCn: '生活是一段长期的学习旅程。' },
    { en: 'knowledge', ps: 'ˈnɒlɪdʒ', pos: 'n.', cn: '知识', exampleEn: 'Knowledge is power.', exampleCn: '知识就是力量。' },
    { en: 'language', ps: 'ˈlæŋɡwɪdʒ', pos: 'n.', cn: '语言', exampleEn: 'English is a global language.', exampleCn: '英语是一门全球语言。' },
    { en: 'method', ps: 'ˈmeθəd', pos: 'n.', cn: '方法', exampleEn: 'Find an efficient learning method.', exampleCn: '找到一种高效的学习方法。' },
    { en: 'nature', ps: 'ˈneɪtʃə', pos: 'n.', cn: '大自然', exampleEn: 'We should protect nature.', exampleCn: '我们应该保护大自然。' },
    { en: 'opinion', ps: 'əˈpɪnjən', pos: 'n.', cn: '观点；意见', exampleEn: 'Everyone has a different opinion.', exampleCn: '每个人都有不同的观点。' },
    { en: 'purpose', ps: 'ˈpɜːpəs', pos: 'n.', cn: '目的', exampleEn: 'What is the purpose of this project?', exampleCn: '这个项目的目的是什么？' },
    { en: 'quality', ps: 'ˈkwɒləti', pos: 'n.', cn: '质量；品质', exampleEn: 'Focus on quality rather than quantity.', exampleCn: '重质不重量。' },
    { en: 'reason', ps: 'ˈriːzn', pos: 'n.', cn: '原因', exampleEn: 'Give me a reason for your choice.', exampleCn: '告诉我你做选择的原因。' },
    { en: 'system', ps: 'ˈsɪstəm', pos: 'n.', cn: '系统', exampleEn: 'The solar system is fascinating.', exampleCn: '太阳系非常迷人。' },
    { en: 'traffic', ps: 'ˈtræfɪk', pos: 'n.', cn: '交通', exampleEn: 'Traffic was heavy during rush hour.', exampleCn: '高峰期的交通非常拥堵。' },
    { en: 'universe', ps: 'ˈjuːnɪvɜːs', pos: 'n.', cn: '宇宙', exampleEn: 'The universe holds many mysteries.', exampleCn: '宇宙包含许多谜团。' },
    { en: 'value', ps: 'ˈvæljuː', pos: 'n.', cn: '价值', exampleEn: 'Time has immense value.', exampleCn: '时间具有巨大的价值。' },
    { en: 'wisdom', ps: 'ˈwɪzdəm', pos: 'n.', cn: '智慧', exampleEn: 'Experience brings wisdom.', exampleCn: '经验带来智慧。' },
    { en: 'youth', ps: 'juːθ', pos: 'n.', cn: '青春', exampleEn: 'Cherish your precious youth.', exampleCn: '珍惜你宝贵的青春。' },
    { en: 'ability', ps: 'əˈbɪləti', pos: 'n.', cn: '能力', exampleEn: 'She has the ability to solve complex problems.', exampleCn: '她有解决复杂问题的能力。' },
    { en: 'balance', ps: 'ˈbæləns', pos: 'n.', cn: '平衡', exampleEn: 'Keep a balance between work and life.', exampleCn: '保持工作和生活的平衡。' },
    { en: 'courage', ps: 'ˈkʌrɪdʒ', pos: 'n.', cn: '勇气', exampleEn: 'Facing challenges requires courage.', exampleCn: '面对挑战需要勇气。' },
    { en: 'danger', ps: 'ˈdeɪndʒə', pos: 'n.', cn: '危险', exampleEn: 'Stay away from potential danger.', exampleCn: '远离潜在的危险。' },
    { en: 'energy', ps: 'ˈenədʒi', pos: 'n.', cn: '能量；活力', exampleEn: 'Solar energy is renewable and clean.', exampleCn: '太阳能是清洁的可再生能源。' },
    { en: 'factor', ps: 'ˈfæktə', pos: 'n.', cn: '因素', exampleEn: 'Hard work is a key factor in success.', exampleCn: '努力是成功的关键因素。' },
    { en: 'global', ps: 'ˈɡləʊbl', pos: 'adj.', cn: '全球的', exampleEn: 'Climate change is a global issue.', exampleCn: '气候变化是一个全球性问题。' },
    { en: 'history', ps: 'ˈhɪstri', pos: 'n.', cn: '历史', exampleEn: 'Learn from the lessons of history.', exampleCn: '吸取历史的教训。' },
    { en: 'interest', ps: 'ˈɪntrest', pos: 'n.', cn: '兴趣', exampleEn: 'Develop an interest in science.', exampleCn: '培养对科学的兴趣。' },
    { en: 'memory', ps: 'ˈmeməri', pos: 'n.', cn: '记忆', exampleEn: 'I have fond memories of childhood.', exampleCn: '我对童年有着美好的记忆。' },
    { en: 'nation', ps: 'ˈneɪʃn', pos: 'n.', cn: '国家', exampleEn: 'Education is essential for a nation.', exampleCn: '教育对一个国家至关重要。' },
    { en: 'origin', ps: 'ˈɒrɪdʒɪn', pos: 'n.', cn: '起源', exampleEn: 'The origin of life remains a grand topic.', exampleCn: '生命的起源依然是一个宏大话题。' },
    { en: 'patient', ps: 'ˈpeɪʃnt', pos: 'adj.', cn: '耐心的', exampleEn: 'Teachers are patient with students.', exampleCn: '老师对学生很有耐心。' },
    { en: 'record', ps: 'ˈrekɔːd', pos: 'n.', cn: '记录', exampleEn: 'He broke the world record.', exampleCn: '他打破了世界纪录。' },
    { en: 'science', ps: 'ˈsaɪəns', pos: 'n.', cn: '科学', exampleEn: 'Science changes our daily lives.', exampleCn: '科学改变了我们的日常生活。' },
    { en: 'talent', ps: 'ˈtælənt', pos: 'n.', cn: '才能；天赋', exampleEn: 'She displayed great talent in music.', exampleCn: '她在音乐方面展现了极高的天赋。' },
    { en: 'unique', ps: 'juˈniːk', pos: 'adj.', cn: '独特的', exampleEn: 'Every individual has a unique personality.', exampleCn: '每个人都有独特的个性。' },
    { en: 'victory', ps: 'ˈvɪktəri', pos: 'n.', cn: '胜利', exampleEn: 'The team celebrated their victory.', exampleCn: '全队庆祝他们的胜利。' },
    { en: 'wealth', ps: 'welθ', pos: 'n.', cn: '财富', exampleEn: 'Health is the greatest wealth.', exampleCn: '健康是最大的财富。' },
    { en: 'action', ps: 'ˈækʃn', pos: 'n.', cn: '行动', exampleEn: 'Actions speak louder than words.', exampleCn: '事实胜于雄辩。' },
    { en: 'benefit', ps: 'ˈbenɪfɪt', pos: 'v.', cn: '有益于', exampleEn: 'Good books benefit us all.', exampleCn: '好书让我们受益匪浅。' },
    { en: 'chance', ps: 'tʃɑːns', pos: 'n.', cn: '机会', exampleEn: 'Grab every chance to practice English.', exampleCn: '抓住每一个练习英语的机会。' },
    { en: 'desire', ps: 'dɪˈzaɪə', pos: 'n.', cn: '渴望', exampleEn: 'A strong desire to achieve excellence.', exampleCn: '对追求卓越的强烈渴望。' },
    { en: 'effort', ps: 'ˈefət', pos: 'n.', cn: '精力', exampleEn: 'Spare no effort to complete the job.', exampleCn: '不遗余力地完成这份工作。' },
    { en: 'future', ps: 'ˈfjuːtʃə', pos: 'adj.', cn: '未来的', exampleEn: 'Plan for future growth.', exampleCn: '为未来的增长规划。' },
    { en: 'growth', ps: 'ɡrəʊθ', pos: 'n.', cn: '发育', exampleEn: 'Nutrition is key to plant growth.', exampleCn: '营养是植物生长的关键。' }
  ],
  senior: [
    { en: 'abundant', ps: 'əˈbʌndənt', pos: 'adj.', cn: '丰富的', exampleEn: 'The region is abundant in natural resources.', exampleCn: '该地区拥有丰富的自然资源。' },
    { en: 'brilliant', ps: 'ˈbrɪliənt', pos: 'adj.', cn: '杰出的；灿烂的', exampleEn: 'She made a brilliant speech yesterday.', exampleCn: '她昨天做了一场精彩的演讲。' },
    { en: 'capacity', ps: 'kəˈpæsəti', pos: 'n.', cn: '能力；容量', exampleEn: 'The hall has a seating capacity of 500.', exampleCn: '这个大厅可容纳500人。' },
    { en: 'deliberate', ps: 'dɪˈlɪbərət', pos: 'adj.', cn: '深思熟虑的', exampleEn: 'It was a deliberate decision after long debate.', exampleCn: '这是经过长时间争论后的周密决定。' },
    { en: 'emphasis', ps: 'ˈemfəsɪs', pos: 'n.', cn: '强调', exampleEn: 'The school places emphasis on creativity.', exampleCn: '学校注重培养创造力。' },
    { en: 'frequent', ps: 'ˈfriːkwənt', pos: 'adj.', cn: '频繁的', exampleEn: 'He is a frequent visitor to the museum.', exampleCn: '他是这家博物馆的常客。' },
    { en: 'genuine', ps: 'ˈdʒenjuɪn', pos: 'adj.', cn: '真诚的；真实的', exampleEn: 'He showed genuine interest in the proposal.', exampleCn: '他对这项提议表现出了真诚的兴趣。' },
    { en: 'horizon', ps: 'həˈraɪzn', pos: 'n.', cn: '地平线；视野', exampleEn: 'Travel expands your mind and horizons.', exampleCn: '旅行拓展心灵和视野。' },
    { en: 'inevitable', ps: 'ɪnˈevɪtəbl', pos: 'adj.', cn: '不可避免的', exampleEn: 'Change is an inevitable part of life.', exampleCn: '改变是生活中不可避免的一部分。' },
    { en: 'justify', ps: 'ˈdʒʌstɪfaɪ', pos: 'v.', cn: '证明……是合法的/合理的', exampleEn: 'Nothing can justify such rude behavior.', exampleCn: '没有任何理由可以为这种粗鲁行为作解释。' },
    { en: 'keen', ps: 'kiːn', pos: 'adj.', cn: '敏锐的；热心的', exampleEn: 'He has a keen eye for subtle details.', exampleCn: '他对细微的细节有着敏锐的洞察力。' },
    { en: 'liberty', ps: 'ˈlɪbəti', pos: 'n.', cn: '自由', exampleEn: 'The statue stands as a symbol of liberty.', exampleCn: '这座雕像是自由的象征。' },
    { en: 'motive', ps: 'ˈməʊtɪv', pos: 'n.', cn: '动机', exampleEn: 'What was the motive behind his actions?', exampleCn: '他这些行为背后的动机是什么？' },
    { en: 'negotiate', ps: 'nɪˈɡəʊʃieɪt', pos: 'v.', cn: '谈判；协商', exampleEn: 'They managed to negotiate a peace deal.', exampleCn: '他们成功协商达成了一项和平协议。' },
    { en: 'objective', ps: 'əbˈdʒektɪv', pos: 'n.', cn: '目标；客观的', exampleEn: 'Our primary objective is customer satisfaction.', exampleCn: '我们的首要目标是客户满意度。' },
    { en: 'predict', ps: 'prɪˈdɪkt', pos: 'v.', cn: '预测', exampleEn: 'It is hard to predict future economic trends.', exampleCn: '很难预测未来的经济走向。' },
    { en: 'qualify', ps: 'ˈkwɒlɪfaɪ', pos: 'v.', cn: '使具备资格', exampleEn: 'Hard work qualified her for the position.', exampleCn: '努力让她具备了胜任该职位的资格。' },
    { en: 'reluctant', ps: 'rɪˈlʌktənt', pos: 'adj.', cn: '不情愿的', exampleEn: 'He was reluctant to leave his home town.', exampleCn: '他不情愿离开家乡。' },
    { en: 'stimulate', ps: 'ˈstɪmjuleɪt', pos: 'v.', cn: '刺激；激励', exampleEn: 'The policy helped stimulate economic growth.', exampleCn: '这项政策有助于刺激经济增长。' },
    { en: 'tendency', ps: 'ˈtendənsi', pos: 'n.', cn: '趋势；倾向', exampleEn: 'There is a tendency towards automation.', exampleCn: '存在自动化升级的趋势。' },
    { en: 'ultimate', ps: 'ˈʌltɪmət', pos: 'adj.', cn: '最终的；极限的', exampleEn: 'Their ultimate goal is world peace.', exampleCn: '他们的终极目标是世界和平。' },
    { en: 'vague', ps: 'veɪɡ', pos: 'adj.', cn: '含糊的；模糊的', exampleEn: 'The instructions were rather vague.', exampleCn: '说明书相当模糊不清。' },
    { en: 'yield', ps: 'jiːld', pos: 'v.', cn: '出产；屈服', exampleEn: 'The research yielded fruitful results.', exampleCn: '这项研究取得了丰硕的成果。' },
    { en: 'zone', ps: 'zəʊn', pos: 'n.', cn: '区域', exampleEn: 'The area was declared a safety zone.', exampleCn: '该地区被宣布为安全区。' },
    { en: 'advocate', ps: 'ˈædvəkeɪt', pos: 'v.', cn: '提倡；主张', exampleEn: 'They advocate environmental protection.', exampleCn: '他们倡导环境保护。' },
    { en: 'barrier', ps: 'ˈbæriə', pos: 'n.', cn: '障碍；屏障', exampleEn: 'Language can be a barrier to communication.', exampleCn: '语言可能是交流的屏障。' },
    { en: 'clarify', ps: 'ˈklærəfaɪ', pos: 'v.', cn: '澄清；阐明', exampleEn: 'Please clarify your position on this issue.', exampleCn: '请澄清你在该问题上的立场。' },
    { en: 'dominant', ps: 'ˈdɒmɪnənt', pos: 'adj.', cn: '占主导地位的', exampleEn: 'English remains the dominant international language.', exampleCn: '英语仍是主导地位的国际语言。' },
    { en: 'evaluate', ps: 'ɪˈvæljueɪt', pos: 'v.', cn: '评估；评价', exampleEn: 'We need time to evaluate the proposals.', exampleCn: '我们需要时间来评估这些提案。' },
    { en: 'flexible', ps: 'ˈfleksəbl', pos: 'adj.', cn: '灵活的；有弹性的', exampleEn: 'We offer flexible working hours.', exampleCn: '我们提供灵活的工作时间。' },
    { en: 'guarantee', ps: 'ˌɡærənˈtiː', pos: 'v.', cn: '保证；担保', exampleEn: 'We guarantee the quality of our products.', exampleCn: '我们保证产品的质量。' },
    { en: 'hypothesis', ps: 'haɪˈpɒθəsɪs', pos: 'n.', cn: '假设；假说', exampleEn: 'Test the hypothesis with scientific experiments.', exampleCn: '通过科学实验检验该假设。' },
    { en: 'illustrate', ps: 'ˈɪləstreɪt', pos: 'v.', cn: '说明；阐明', exampleEn: 'Charts help illustrate data clearly.', exampleCn: '图表有助于清晰说明数据。' },
    { en: 'logical', ps: 'ˈlɒdʒɪkl', pos: 'adj.', cn: '合乎逻辑的', exampleEn: 'Provide a logical explanation for your conclusion.', exampleCn: '为你的结论提供合乎逻辑的解释。' },
    { en: 'minimize', ps: 'ˈmɪnɪmaɪz', pos: 'v.', cn: '使最小化', exampleEn: 'Efforts were made to minimize risks.', exampleCn: '大家努力将风险降到最低。' },
    { en: 'novel', ps: 'ˈnɒvl', pos: 'adj.', cn: '新颖的；原创的', exampleEn: 'He proposed a novel solution to the problem.', exampleCn: '他提出了一个新颖的解决方案。' },
    { en: 'overcome', ps: 'ˌəʊvəˈkʌm', pos: 'v.', cn: '克服', exampleEn: 'Together we can overcome any hardship.', exampleCn: '团结一致，我们可以克服任何艰难险阻。' },
    { en: 'potential', ps: 'pəˈtenʃl', pos: 'n.', cn: '潜力', exampleEn: 'Unlock your full potential through learning.', exampleCn: '通过学习释放你所有的潜力。' },
    { en: 'radical', ps: 'ˈrædɪkl', pos: 'adj.', cn: '激进的；根本的', exampleEn: 'The company needs radical reform.', exampleCn: '公司需要进行根本性的改革。' },
    { en: 'sufficient', ps: 'səˈfɪʃnt', pos: 'adj.', cn: '充分的；足够的', exampleEn: 'Ensure there is sufficient evidence.', exampleCn: '确保有充分的证据。' },
    { en: 'transform', ps: 'trænsˈfɔːm', pos: 'v.', cn: '使改变；转换', exampleEn: 'Education can transform lives.', exampleCn: '教育能够改变人生。' },
    { en: 'underlying', ps: 'ˌʌndəˈlaɪɪŋ', pos: 'adj.', cn: '潜在的；基础的', exampleEn: 'Address the underlying causes of the problem.', exampleCn: '解决问题的深层根源。' },
    { en: 'vital', ps: 'ˈvaɪtl', pos: 'adj.', cn: '至关重要的', exampleEn: 'Fresh air and clean water are vital for health.', exampleCn: '新鲜空气和清洁水源对健康至关重要。' },
    { en: 'widespread', ps: 'ˈwaɪdspred', pos: 'adj.', cn: '广泛的', exampleEn: 'The internet brought widespread changes.', exampleCn: '互联网带来了广泛深刻的变化。' },
    { en: 'accumulate', ps: 'əˈkjuːmjəleɪt', pos: 'v.', cn: '积累', exampleEn: 'Knowledge accumulates over time.', exampleCn: '知识随时间慢慢积累。' },
    { en: 'brief', ps: 'briːf', pos: 'adj.', cn: '简短的', exampleEn: 'Keep your presentation brief and sweet.', exampleCn: '让你的展示简明扼要。' },
    { en: 'comprehensive', ps: 'ˌkɒmprɪˈhensɪv', pos: 'adj.', cn: '综合的；全面的', exampleEn: 'A comprehensive study of climate change.', exampleCn: '关于气候变化的全面研究。' },
    { en: 'diverse', ps: 'daɪˈvɜːs', pos: 'adj.', cn: '多种多样的', exampleEn: 'Cultivate a diverse range of hobbies.', exampleCn: '培养多种多样的兴趣爱好。' },
    { en: 'essential', ps: 'ɪˈsenʃl', pos: 'adj.', cn: '必不可少的', exampleEn: 'Good sleep is essential to productivity.', exampleCn: '良好的睡眠对工作效率必不可少。' },
    { en: 'fundamental', ps: 'ˌfʌndəˈmentl', pos: 'adj.', cn: '基础的；根本的', exampleEn: 'Respect is a fundamental human value.', exampleCn: '尊重是人类的基本价值观。' }
  ]
}

// 单词状态记录
const wordState = ref({})

// 1. 【测试卡片网格页】懒加载状态配置
const GRID_BATCH_SIZE = 9        // 每次触底增加 9 个卡片 (3 行)
const visibleGridCount = ref(9)   // 初始渲染前 9 个

// 2. 【学习详情页】5 词分页状态配置
const PAGE_SIZE = 5            // 每页固定 5 个
const learningList = ref([])   // 待学习全量数组
const currentLearnIndex = ref(0)// 当前选中的单词全局索引
const currentPage = ref(1)     // 侧边栏当前页码
const spellTab = ref('split')
const isTestMode = ref(false)

// 当前选中的全量词库
const activeBankWords = computed(() => {
  if (props.customBanks && props.customBanks[currentBankKey.value]) {
    return props.customBanks[currentBankKey.value]
  }
  return defaultBankData[currentBankKey.value] || []
})

// 【测试网格页】懒加载渲染数组
const renderedGridWords = computed(() => {
  return activeBankWords.value.slice(0, visibleGridCount.value)
})

const hasMoreGridWords = computed(() => {
  return visibleGridCount.value < activeBankWords.value.length
})

// 【测试网格页】触底滚动监听：自动懒加载追加 9 个
const handleGridScroll = (e) => {
  const { scrollTop, clientHeight, scrollHeight } = e.target
  if (scrollTop + clientHeight >= scrollHeight - 30) {
    if (hasMoreGridWords.value) {
      visibleGridCount.value = Math.min(
        visibleGridCount.value + GRID_BATCH_SIZE, 
        activeBankWords.value.length
      )
    }
  }
}

// 【学习详情页】5 词分页计算
const totalPages = computed(() => {
  return Math.ceil(learningList.value.length / PAGE_SIZE) || 1
})

const startIndex = computed(() => {
  return (currentPage.value - 1) * PAGE_SIZE
})

// 截取当前页的 5 个单词
const currentPageWords = computed(() => {
  return learningList.value.slice(startIndex.value, startIndex.value + PAGE_SIZE)
})

const currentLearnWord = computed(() => {
  return learningList.value[currentLearnIndex.value] || null
})

// 监听选中索引变动自动跳转对应侧边栏页码
watch(currentLearnIndex, (newIdx) => {
  const targetPage = Math.floor(newIdx / PAGE_SIZE) + 1
  if (targetPage !== currentPage.value) {
    currentPage.value = targetPage
  }
})

// 切页与选词逻辑
const selectWord = (globalIdx) => {
  currentLearnIndex.value = globalIdx
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    currentLearnIndex.value = startIndex.value
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    currentLearnIndex.value = startIndex.value
  }
}

// 统计
const knownCount = computed(() => {
  return Object.values(wordState.value).filter(s => s === 'known').length
})

const unknownCount = computed(() => {
  return Object.values(wordState.value).filter(s => s === 'unknown').length
})

const totalTested = computed(() => {
  return knownCount.value + unknownCount.value
})

const markWord = (en, status) => {
  if (wordState.value[en] === status) {
    delete wordState.value[en]
  } else {
    wordState.value[en] = status
  }
}

const switchBank = (key) => {
  currentBankKey.value = key
  resetTest()
}

const resetTest = () => {
  wordState.value = {}
  visibleGridCount.value = 9 // 重新测试重置懒加载数量
}

const speak = (text, langType = 'us') => {
  if (!text) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = langType === 'uk' ? 'en-GB' : 'en-US'
  msg.rate = 0.85
  window.speechSynthesis.speak(msg)
}

// 进入详情学习模式
const startLearnUnknown = () => {
  const unknownList = activeBankWords.value.filter(item => wordState.value[item.en] === 'unknown')
  if (unknownList.length === 0) return

  learningList.value = unknownList
  currentLearnIndex.value = 0
  currentPage.value = 1
  isTestMode.value = false
  currentView.value = 'learn'

  emit('start-learning', unknownList)
}
</script>

<style scoped>
.word-module-container {
  width: 100%;
}

/* ================= 模式 1：测试卡片网格视图（紧凑固定页脚） ================= */
.word-card-test-wrapper {
  max-width: 900px;
  max-height: 90vh; /* 设置为最大高度适应 */
  margin: 0 auto;
  padding: 20px 24px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
  margin-top:5px;
}

/* 上半部分：独立滚动的卡片内容区 */
.grid-scroll-area {
  flex: 1;
  overflow-y: auto; 
  padding-right: 6px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 独立的淡薄荷绿滚动条 */
.grid-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.grid-scroll-area::-webkit-scrollbar-thumb {
  background: #a7f3d0;
  border-radius: 10px;
}

.grid-scroll-area::-webkit-scrollbar-track {
  background: #f8fafc;
}

.test-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.bank-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bank-selector .label {
  font-size: 13px;
  font-weight: 700;
  color: #475569;
}

.bank-tabs {
  display: flex;
  gap: 6px;
  background: #e2e8f0;
  padding: 3px;
  border-radius: 8px;
}

.bank-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bank-btn.active {
  background: #ffffff;
  color: #27ae60;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.reset-btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.word-card {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.word-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

.word-card.status-known {
  border-color: #86efac;
  background: #f0fdf4;
}

.word-card.status-unknown {
  border-color: #fca5a5;
  background: #fef2f2;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.word-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #27ae60;
}

.sound-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.sound-btn:hover {
  opacity: 1;
}

.word-ps {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
  margin-bottom: 16px;
  font-family: sans-serif;
}

.action-btns {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.act-btn {
  flex: 1;
  border: none;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-know {
  background: #e8f5e9;
  color: #27ae60;
}

.btn-know:hover, .btn-know.active {
  background: #27ae60;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(39, 174, 96, 0.3);
}

.btn-unknown {
  background: #fff3e0;
  color: #ff9800;
}

.btn-unknown:hover, .btn-unknown.active {
  background: #ff9800;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(255, 152, 0, 0.3);
}

.grid-loading-tip {
  text-align: center;
  padding: 10px;
  font-size: 13px;
  color: #27ae60;
  font-weight: 600;
  background: #f0fdf4;
  border-radius: 10px;
}

.grid-loading-tip.finish {
  color: #94a3b8;
  background: #f8fafc;
}

/* 下半部分：紧凑型常驻 Footer 栏 */
.fixed-test-footer {
  margin-top: 12px;
  padding-top: 12px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 10px; /* 压缩空隙 */
  flex-shrink: 0; 
}

.progress-panel {
  background: #f0fdf4;
  border: 1px solid #dcfce7;
  border-radius: 10px;
  padding: 8px 16px; /* 压缩边距 */
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.progress-title {
  font-size: 13px;
  font-weight: 700;
  color: #166534;
}

.highlight-num {
  color: #27ae60;
  font-size: 15px;
}

.progress-detail {
  font-size: 13px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  color: #cbd5e1;
}

.text-green { color: #27ae60; }
.text-orange { color: #ff9800; }

.test-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.start-learn-btn {
  background: #27ae60;
  color: #ffffff;
  border: none;
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 3px 10px rgba(39, 174, 96, 0.2);
}

.start-learn-btn:hover:not(:disabled) {
  background: #219150;
  transform: translateY(-1px);
}

.start-learn-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

.outline-btn {
  background: #ffffff;
  border: 1px solid #27ae60;
  color: #27ae60;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.outline-btn:hover {
  background: #f0fdf4;
}

/* ================= 模式 2：单词学习详情视图 (固定 5 词分页) ================= */
.word-learn-container {
  display: flex;
  max-width: 1000px;
  min-height: 680px;
  margin: 0 auto;
  background: #f4fbf7;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(39, 174, 96, 0.08);
  border: 1px solid #e1f5fe;
}

.learn-sidebar {
  width: 280px;
  background: #fbfdfe;
  border-right: 1px solid #e8f5e9;
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  color: #27ae60;
  font-weight: 800;
}

.word-menu-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden; 
}

.word-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e8f5e9;
  cursor: pointer;
  transition: all 0.2s ease;
}

.word-menu-item:hover {
  background: #f0fdf4;
  border-color: #86efac;
}

.word-menu-item.active {
  background: #e8f5e9;
  border-color: #27ae60;
  box-shadow: 0 2px 8px rgba(39, 174, 96, 0.15);
}

.word-index {
  width: 24px;
  height: 24px;
  background: #27ae60;
  color: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.word-menu-item.active .word-index {
  background: #1e7e43;
}

.word-text {
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-actions {
  margin-top: auto;
  padding-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  border: none;
  padding: 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn {
  background: #27ae60;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(39, 174, 96, 0.25);
}

.primary-btn:hover {
  background: #219150;
}

.page-nav-btns {
  display: flex;
  gap: 10px;
}

.nav-btn {
  flex: 1;
  background: #e2e8f0;
  border: none;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
}

.nav-btn:hover:not(:disabled) {
  background: #cbd5e1;
  color: #1e293b;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-indicator {
  text-align: center;
  font-size: 12px;
  color: #27ae60;
  font-weight: 600;
  background: #f0fdf4;
  padding: 6px;
  border-radius: 20px;
  border: 1px dashed #a7f3d0;
}

.back-btn {
  background: transparent;
  border: 1px solid #cbd5e1;
  color: #64748b;
  padding: 8px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}

.back-btn:hover {
  background: #f1f5f9;
}

.learn-content {
  flex: 1;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
}

.word-header-title h1 {
  margin: 0;
  font-size: 40px;
  font-weight: 900;
  color: #27ae60;
  letter-spacing: 0.5px;
}

.detail-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.phonetic-card {
  display: flex;
  gap: 24px;
  background: #f0fdf4;
  border-color: #dcfce7;
}

.phonetic-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.phonetic-item:hover {
  background: #dcfce7;
}

.phonetic-item .label {
  font-size: 13px;
  color: #27ae60;
  font-weight: 600;
}

.phonetic-item .phonetic-text {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.spelling-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-header {
  display: flex;
  gap: 8px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 10px;
  width: fit-content;
}

.tab-btn {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #27ae60;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(39, 174, 96, 0.2);
}

.spelling-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding-top: 4px;
}

.split-syllable-box {
  background: #27ae60;
  color: #ffffff;
  padding: 10px 20px;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(39, 174, 96, 0.2);
}

.syllable-text {
  font-size: 18px;
  font-weight: 800;
}

.syllable-ps {
  font-size: 12px;
  opacity: 0.9;
}

.phonics-box {
  display: flex;
  gap: 8px;
}

.phonics-chip {
  background: #e8f5e9;
  color: #27ae60;
  border: 1px solid #a7f3d0;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 16px;
}

.play-full-btn {
  background: #e8f5e9;
  color: #27ae60;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.play-full-btn:hover {
  background: #27ae60;
  color: #ffffff;
}

.meaning-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-section-title {
  font-size: 15px;
  font-weight: 800;
  color: #27ae60;
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 2px solid #f0fdf4;
  padding-bottom: 8px;
}

.meaning-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pos-tag {
  display: inline-block;
  background: #27ae60;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  width: fit-content;
}

.cn-text {
  font-size: 18px;
  font-weight: 800;
  color: #1e293b;
}

.example-box {
  background: #f8fafc;
  border-left: 4px solid #27ae60;
  padding: 12px 16px;
  border-radius: 0 12px 12px 0;
  margin-top: 6px;
}

.example-en {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sound-mini-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.6;
}

.sound-mini-btn:hover {
  opacity: 1;
}

.example-cn {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

.test-mask {
  background: #f1f5f9;
  border: 2px dashed #cbd5e1;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.test-mask:hover {
  background: #e2e8f0;
  color: #1e293b;
}
</style>
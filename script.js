// 游戏状态变量
let questions = [];                  // 题库数组
let currentQuestionIndex = 0;        // 当前题目索引
let score = 0;                       // 当前分数
let timeLeft = 60;                   // 剩余时间(秒)
let timerInterval = null;            // 计时器间隔ID
let startTime = null;                // 游戏开始时间
let completionTime = null;           // 游戏完成时间
let correctAnswers = 0;              // 正确答案数量
let incorrectAnswers = 0;            // 错误答案数量
let totalAnswered = 0;               // 总答题数量
const leaderboardKey = 'leaderboard';// 本地存储排行榜的键名
let currentQuizName = '';            // 当前题库名称

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 创建解析列表容器
  createExplanationList();
  
  // 绑定按钮事件
  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('view-leaderboard-btn').addEventListener('click', viewLeaderboard);
  document.getElementById('back-to-menu-btn').addEventListener('click', backToMenu);
  document.getElementById('restart-game-btn').addEventListener('click', backToMenu); // 返回主界面
  document.getElementById('clear-leaderboard-btn').addEventListener('click', clearLeaderboard);
  document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
  document.getElementById('quiz-filter').addEventListener('change', filterLeaderboard);
  
  // 初始化游戏说明弹窗
  setupInstructionsModal();
  
  // 预加载题库
  fetchQuestions().then(success => {
    if (success) {
      console.log('题库加载完成， ready to play!');
      populateQuizFilters();
    }
  });
});

/**
 * 创建解析列表容器
 * 用于在电脑端存储和显示所有解析内容
 */
function createExplanationList() {
  const explanationSection = document.querySelector('.explanation-section');
  if (!explanationSection) return;
  
  // 创建列表容器
  const listContainer = document.createElement('div');
  listContainer.id = 'explanation-list-container';
  listContainer.className = 'explanation-list-container';
  
  // 创建列表元素
  const list = document.createElement('ul');
  list.id = 'explanation-list';
  list.className = 'explanation-list';
  
  listContainer.appendChild(list);
  explanationSection.appendChild(listContainer);
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .explanation-list-container {
      width: 100%;
      max-height: 60vh;
      overflow-y: auto;
    }
    
    .explanation-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .explanation-item {
      padding: 15px;
      border-radius: 16px;
      animation: fadeIn 0.5s ease-out;
      transform-origin: top;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    @media (max-width: 899px) {
      #explanation-list-container {
        display: none;
      }
      
      #feedback:not(.hidden) {
        display: block !important;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * 添加解析到列表
 * @param {string} content - 解析内容
 * @param {boolean} isCorrect - 是否正确
 */
function addExplanation(content, isCorrect) {
  // 对于移动设备，仍然使用原来的反馈方式
  if (window.innerWidth <= 899) {
    const feedback = document.getElementById('feedback');
    feedback.textContent = content;
    feedback.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
    feedback.classList.remove('hidden');
    return;
  }
  
  // 对于桌面设备，添加到解析列表
  const list = document.getElementById('explanation-list');
  if (!list) return;
  
  // 创建新的解析项
  const item = document.createElement('li');
  item.className = `explanation-item ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
  item.textContent = content;
  
  // 将新解析添加到列表顶部
  if (list.firstChild) {
    list.insertBefore(item, list.firstChild);
  } else {
    list.appendChild(item);
  }
  
  // 隐藏原始反馈元素
  const feedback = document.getElementById('feedback');
  feedback.classList.add('hidden');
  
  // 滚动到顶部以显示最新解析
  list.scrollTop = 0;
}

/**
 * 初始化游戏说明弹窗
 * 设置弹窗的显示、关闭事件监听
 */
function setupInstructionsModal() {
  const modal = document.getElementById('instructions-modal');
  const showBtn = document.getElementById('show-instructions-btn');
  const closeBtn = document.querySelector('.close-modal');

  // 检查元素是否存在
  if (!modal || !showBtn || !closeBtn) {
    console.warn('游戏说明相关元素不存在');
    return;
  }

  // 显示弹窗
  showBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  // 关闭弹窗
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // 点击弹窗外部关闭
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
}

/**
 * 格式化日期时间
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期时间字符串
 */
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 更新正确率显示
 * 显示正确/错误/总答题数及正确率
 */
function updateAccuracyDisplay() {
  const accuracyElement = document.getElementById('accuracy-display');
  if (!accuracyElement) return;
  
  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
  
  // 设置不同颜色显示
  accuracyElement.innerHTML = `
    <span style="color: #38a169;">${correctAnswers}</span>/
    <span style="color: #dc2626;">${incorrectAnswers}</span>/
    <span style="color: #666;">${totalAnswered}</span>-
    <span style="color: #000;">${accuracy}%</span>
  `;
}

/**
 * 从JSON文件加载题库并处理
 * @returns {Promise<boolean>} 加载成功返回true，失败返回false
 */
async function fetchQuestions() {
  try {
    const res = await fetch('questions.json');
    if (!res.ok) {
      throw new Error(`加载题库失败: HTTP状态码 ${res.status}`);
    }
    
    const rawData = await res.json();
    
    // 检查是否是包含name和questions字段的完整题库格式
    if (rawData.name && Array.isArray(rawData.questions)) {
      currentQuizName = rawData.name;
      questions = rawData.questions;
    } else if (Array.isArray(rawData)) {
      // 兼容旧格式，没有name字段的情况
      currentQuizName = "默认题库";
      questions = rawData;
    } else {
      throw new Error('题库格式错误，预期为包含name和questions的对象或题目数组');
    }
    
    // 验证题库格式
    if (!Array.isArray(questions)) {
      throw new Error('题库格式错误，预期为数组');
    }
    
    // 处理每道题，过滤无效题目
    questions = questions.map((q, idx) => {
      // 验证题目必要字段
      if (!q.question || !q.answer || !q.options || !q.difficulty) {
        console.warn(`题目ID ${idx+1} 格式不完整，已跳过`);
        return null;
      }
      
      const diffConf = {
        1: { options: 3, score: 5 },
        2: { options: 4, score: 10 },
        3: { options: 5, score: 15 },
        4: { options: 6, score: 20 }
      }[q.difficulty] || { options: 3, score: 5 };
      
      // 确保正确答案在选项中
      if (!q.options.includes(q.answer)) {
        q.options.push(q.answer);
        console.warn(`题目ID ${idx+1} 选项中缺少正确答案，已自动添加`);
      }
      
      // 根据难度筛选选项数量，确保包含正确答案
      let opts = [q.answer]; // 先添加正确答案
      const otherOptions = q.options.filter(opt => opt !== q.answer);
      const needed = diffConf.options - 1;
      
      // 随机选择需要的选项
      for (let i = 0; i < needed && otherOptions.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * otherOptions.length);
        opts.push(otherOptions[randomIndex]);
        otherOptions.splice(randomIndex, 1);
      }
      
      return { 
        ...q, 
        options: opts, 
        diffConf, 
        id: idx + 1 
      };
    }).filter(Boolean); // 过滤无效题目
    
    if (questions.length === 0) {
      throw new Error('未加载到有效题目，请检查题库文件');
    }
    
    shuffleArray(questions);
    console.log(`成功加载 ${questions.length} 道题目，题库名称: ${currentQuizName}`);
    return true;
  } catch (error) {
    console.error('题库加载错误:', error);
    showErrorMessage(`加载失败: ${error.message}，请刷新页面重试`);
    return false;
  }
}

/**
 * 填充题库筛选下拉框
 */
function populateQuizFilters() {
  const filterSelect = document.getElementById('quiz-filter');
  if (!filterSelect) return;
  
  // 清除现有选项（保留"所有题库"）
  while (filterSelect.options.length > 1) {
    filterSelect.remove(1);
  }
  
  // 获取所有已保存的排行榜记录
  const leaderboard = getLeaderboard();
  
  // 提取所有独特的题库名称
  const quizNames = new Set();
  leaderboard.forEach(entry => {
    if (entry.quizName) {
      quizNames.add(entry.quizName);
    }
  });
  
  // 添加当前题库（即使还没有记录）
  if (currentQuizName) {
    quizNames.add(currentQuizName);
  }
  
  // 添加到下拉框
  quizNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    filterSelect.appendChild(option);
  });
}

/**
 * 过滤显示排行榜
 */
function filterLeaderboard() {
  const selectedQuiz = document.getElementById('quiz-filter').value;
  renderLeaderboard(selectedQuiz);
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息内容
 */
function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭 ×';
  closeBtn.style.marginTop = '15px';
  closeBtn.style.background = 'rgba(255,255,255,0.2)';
  closeBtn.style.color = 'white';
  closeBtn.style.borderRadius = '20px';
  closeBtn.style.padding = '8px 16px';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => errorDiv.remove();
  errorDiv.appendChild(closeBtn);
  
  document.body.appendChild(errorDiv);
}

/**
 * Fisher-Yates 洗牌算法
 * 随机打乱数组顺序
 * @param {Array} array - 要打乱的数组
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * 随机打乱选项顺序
 * @param {Array} options - 选项数组
 * @returns {Array} 打乱后的选项数组
 */
function shuffleOptions(options) {
  const arr = options.slice();
  shuffleArray(arr);
  return arr;
}

/**
 * 加载新题目
 * 如果题目已完成，结束游戏
 */
function loadNewQuestion() {
  // 实现加载新题目的逻辑（此处省略，保持原有实现）
  // ...
  
  // 示例实现
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  
  const currentQuestion = questions[currentQuestionIndex];
  const questionElement = document.getElementById('question');
  const optionsElement = document.getElementById('options');
  
  if (!questionElement || !optionsElement) return;
  
  // 清空选项
  optionsElement.innerHTML = '';
  
  // 显示题目
  questionElement.textContent = currentQuestion.question;
  
  // 打乱选项顺序
  const shuffledOptions = shuffleOptions(currentQuestion.options);
  
  // 创建选项按钮
  shuffledOptions.forEach(option => {
    const button = document.createElement('button');
    button.textContent = option;
    button.addEventListener('click', () => checkAnswer(option, currentQuestion.answer, currentQuestion.explanation || '无解析', currentQuestion.diffConf.score));
    optionsElement.appendChild(button);
  });
  
  // 隐藏反馈
  document.getElementById('feedback').classList.add('hidden');
}

/**
 * 检查答案是否正确
 * @param {string} userAnswer - 用户选择的答案
 * @param {string} correctAnswer - 正确答案
 * @param {string} explanation - 答案解析
 * @param {number} points - 本题分值
 */
function checkAnswer(userAnswer, correctAnswer, explanation, points) {
  // 实现检查答案的逻辑（此处省略，保持原有实现）
  // ...
  
  // 示例实现
  const options = document.querySelectorAll('#options button');
  options.forEach(button => {
    button.disabled = true;
    if (button.textContent === correctAnswer) {
      button.classList.add('correct');
    } else if (button.textContent === userAnswer) {
      button.classList.add('incorrect');
    }
  });
  
  const isCorrect = userAnswer === correctAnswer;
  
  if (isCorrect) {
    score += points;
    correctAnswers++;
    document.getElementById('score-value').textContent = score;
  } else {
    incorrectAnswers++;
  }
  
  totalAnswered++;
  updateAccuracyDisplay();
  
  // 显示解析
  const feedbackText = isCorrect 
    ? `正确！${explanation}` 
    : `错误。正确答案是：${correctAnswer} ${explanation}`;
  
  addExplanation(feedbackText, isCorrect);
  
  // 延迟加载下一题
  setTimeout(() => {
    currentQuestionIndex++;
    loadNewQuestion();
  }, 1500);
}

/**
 * 开始游戏
 */
function startGame() {
  // 实现开始游戏的逻辑（此处省略，保持原有实现）
  // ...
  
  // 重置游戏状态
  score = 0;
  timeLeft = 60;
  currentQuestionIndex = 0;
  correctAnswers = 0;
  incorrectAnswers = 0;
  totalAnswered = 0;
  startTime = new Date();
  
  // 更新UI
  document.getElementById('score-value').textContent = score;
  document.getElementById('time-left').textContent = timeLeft;
  updateAccuracyDisplay();
  document.getElementById('progress-fill').style.width = '100%';
  
  // 隐藏开始菜单，显示游戏界面
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  
  // 清空解析列表
  const explanationList = document.getElementById('explanation-list');
  if (explanationList) explanationList.innerHTML = '';
  
  // 加载第一题
  loadNewQuestion();
  
  // 启动计时器
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
    document.getElementById('progress-fill').style.width = `${(timeLeft / 60) * 100}%`;
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

/**
 * 结束游戏
 */
function endGame() {
  // 实现结束游戏的逻辑（此处省略，保持原有实现）
  // ...
  
  completionTime = new Date();
  const timeTaken = Math.round((completionTime - startTime) / 1000);
  
  // 隐藏游戏界面，显示游戏结束界面
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over-menu').classList.remove('hidden');
  
  // 显示最终得分
  document.getElementById('final-score').textContent = score;
  
  // 更新答题统计
  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
  document.getElementById('quiz-completion-time').textContent = 
    `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
  
  // 保存分数到排行榜
  const isNewRecord = saveScore(score, correctAnswers, incorrectAnswers, totalAnswered, timeTaken);
  
  // 显示记录信息
  const recordMessage = document.getElementById('record-message');
  if (isNewRecord) {
    recordMessage.classList.remove('hidden');
    // 显示庆祝信息
    setTimeout(() => {
      document.getElementById('celebration-message').classList.remove('hidden');
      setTimeout(() => {
        document.getElementById('celebration-message').classList.add('hidden');
      }, 2000);
    }, 500);
  } else {
    recordMessage.classList.add('hidden');
  }
  
  // 显示游戏结束时的排行榜
  renderLeaderboard(null, 'game-over-leaderboard');
}

/**
 * 获取排行榜数据
 * @returns {Array} 排序后的排行榜数据
 */
function getLeaderboard() {
  const leaderboardJson = localStorage.getItem(leaderboardKey);
  return leaderboardJson ? JSON.parse(leaderboardJson) : [];
}

/**
 * 保存分数到排行榜
 * @param {number} score - 分数
 * @param {number} correct - 正确数量
 * @param {number} incorrect - 错误数量
 * @param {number} total - 总数量
 * @param {number} timeTaken - 用时(秒)
 * @returns {boolean} 是否是新纪录
 */
function saveScore(score, correct, incorrect, total, timeTaken) {
  const leaderboard = getLeaderboard();
  const now = new Date();
  
  // 创建新记录
  const newEntry = {
    score,
    correct,
    incorrect,
    total,
    timeTaken,
    date: now.toISOString(),
    formattedDate: formatDateTime(now),
    quizName: currentQuizName
  };
  
  // 添加到排行榜
  leaderboard.push(newEntry);
  
  // 按分数排序，保留前100名
  leaderboard.sort((a, b) => b.score - a.score);
  if (leaderboard.length > 100) {
    leaderboard.splice(100);
  }
  
  // 保存到本地存储
  localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
  
  // 更新筛选器
  populateQuizFilters();
  
  // 检查是否是新纪录
  return leaderboard[0] === newEntry;
}

/**
 * 渲染排行榜
 * @param {string|null} filterQuiz - 要筛选的题库名称，null表示不筛选
 * @param {string} listId - 要渲染的列表ID
 */
function renderLeaderboard(filterQuiz = null, listId = 'leaderboard') {
  const leaderboard = getLeaderboard();
  const listElement = document.getElementById(listId);
  
  if (!listElement) return;
  
  // 清空列表
  listElement.innerHTML = '';
  
  // 筛选排行榜
  let filteredLeaderboard = leaderboard;
  if (filterQuiz && filterQuiz !== 'all') {
    filteredLeaderboard = leaderboard.filter(entry => entry.quizName === filterQuiz);
  }
  
  // 更新统计信息
  updateLeaderboardStats(filteredLeaderboard);
  
  // 如果没有记录
  if (filteredLeaderboard.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = '暂无记录';
    emptyItem.style.textAlign = 'center';
    listElement.appendChild(emptyItem);
    return;
  }
  
  // 添加记录到列表
  filteredLeaderboard.forEach((entry, index) => {
    const listItem = document.createElement('li');
    
    // 计算正确率
    const accuracy = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
    
    // 设置当前记录样式
    if (index === 0) {
      listItem.classList.add('current-record');
    }
    
    listItem.innerHTML = `
      <span class="rank">${index + 1}</span>
      <span class="score">${entry.score}分</span>
      <span class="date">${entry.formattedDate}</span>
      <span class="accuracy">正确率: ${accuracy}%</span>
      <span class="quiz-name">题库: ${entry.quizName || '未知'}</span>
    `;
    
    listElement.appendChild(listItem);
  });
}

/**
 * 更新排行榜统计信息
 * @param {Array} leaderboard - 排行榜数据
 */
function updateLeaderboardStats(leaderboard) {
  if (leaderboard.length === 0) {
    document.getElementById('total-players').textContent = '0';
    document.getElementById('total-games').textContent = '0';
    document.getElementById('avg-score').textContent = '0';
    return;
  }
  
  // 计算总玩家数（基于日期去重）
  const uniqueDates = new Set(leaderboard.map(entry => entry.date.split('T')[0]));
  const totalPlayers = uniqueDates.size;
  
  // 总游戏数
  const totalGames = leaderboard.length;
  
  // 平均得分
  const totalScore = leaderboard.reduce((sum, entry) => sum + entry.score, 0);
  const avgScore = Math.round(totalScore / totalGames);
  
  // 更新UI
  document.getElementById('total-players').textContent = totalPlayers;
  document.getElementById('total-games').textContent = totalGames;
  document.getElementById('avg-score').textContent = avgScore;
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('leaderboard-menu').classList.remove('hidden');
  renderLeaderboard();
}

/**
 * 返回主菜单
 */
function backToMenu() {
  clearInterval(timerInterval);
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById('start-menu').classList.remove('hidden');
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
  if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复！')) {
    localStorage.removeItem(leaderboardKey);
    renderLeaderboard();
    renderLeaderboard(null, 'game-over-leaderboard');
    populateQuizFilters();
  }
}

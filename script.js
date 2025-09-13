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

// 难度与分值和选项数映射
const difficultyMap = {
  1: { options: 3, score: 5 },
  2: { options: 4, score: 10 },
  3: { options: 5, score: 15 },
  4: { options: 6, score: 20 }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 绑定按钮事件
  document.getElementById('start-game-btn').addEventListener('click', startGame);
  document.getElementById('view-leaderboard-btn').addEventListener('click', viewLeaderboard);
  document.getElementById('back-to-menu-btn').addEventListener('click', backToMenu);
  document.getElementById('restart-game-btn').addEventListener('click', restartGame);
  document.getElementById('clear-leaderboard-btn').addEventListener('click', clearLeaderboard);
  document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
  
  // 初始化游戏说明弹窗
  setupInstructionsModal();
  
  // 预加载题库
  fetchQuestions().then(success => {
    if (success) {
      console.log('题库加载完成， ready to play!');
    }
  });
});

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
    
    const rawQuestions = await res.json();
    
    // 验证题库格式
    if (!Array.isArray(rawQuestions)) {
      throw new Error('题库格式错误，预期为数组');
    }
    
    // 处理每道题，过滤无效题目
    questions = rawQuestions.map((q, idx) => {
      // 验证题目必要字段
      if (!q.question || !q.answer || !q.options || !q.difficulty) {
        console.warn(`题目ID ${idx+1} 格式不完整，已跳过`);
        return null;
      }
      
      const diffConf = difficultyMap[q.difficulty] || difficultyMap[1];
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
    console.log(`成功加载 ${questions.length} 道题目`);
    return true;
  } catch (error) {
    console.error('题库加载错误:', error);
    showErrorMessage(`加载失败: ${error.message}，请刷新页面重试`);
    return false;
  }
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
  // 如果没有题目了，结束游戏
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  
  const q = questions[currentQuestionIndex];
  const questionElement = document.getElementById('question');
  const optionsDiv = document.getElementById('options');
  
  // 检查DOM元素是否存在
  if (!questionElement || !optionsDiv) {
    console.error('找不到题目或选项容器元素');
    endGame();
    return;
  }
  
  // 显示题目
  questionElement.textContent = q.question;
  
  optionsDiv.innerHTML = '';
  
  const shuffledOptions = shuffleOptions(q.options);
  
  // 创建选项按钮
  shuffledOptions.forEach(option => {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.addEventListener('click', () => {
      checkAnswer(option, btn, shuffledOptions);
    });
    
    optionsDiv.appendChild(btn);
  });
  
  // 重置反馈
  const feedback = document.getElementById('feedback');
  if (feedback) {
    feedback.classList.add('hidden');
    feedback.textContent = '';
  }
}

/**
 * 检查答案并显示反馈
 * @param {string} selected - 选中的答案
 * @param {HTMLButtonElement} selectedBtn - 选中的按钮元素
 * @param {Array} allOptions - 所有选项
 */
function checkAnswer(selected, selectedBtn, allOptions) {
  const q = questions[currentQuestionIndex];
  const feedback = document.getElementById('feedback');
  const optionsDiv = document.getElementById('options');
  
  if (!feedback || !optionsDiv) {
    console.error('找不到反馈或选项容器元素');
    return;
  }
  
  let addScore = q.diffConf.score;
  let feedbackText = '';
  const isCorrect = selected === q.answer;

  // 禁止再次选择
  Array.from(optionsDiv.children).forEach(btn => {
    btn.disabled = true;
  });

  if (isCorrect) {
    score += addScore;
    correctAnswers++;
    selectedBtn.classList.add('correct');
    feedbackText = `回答正确！+${addScore}分 🎉`;
    feedback.className = 'feedback-correct';
  } else {
    incorrectAnswers++;
    selectedBtn.classList.add('incorrect');
    feedbackText = `回答错误！正确答案：${q.answer} 😢`;
    feedback.className = 'feedback-incorrect';
    
    // 高亮正确选项
    Array.from(optionsDiv.children).forEach(btn => {
      if (btn.textContent === q.answer) {
        btn.classList.add('correct');
      }
    });
  }

  totalAnswered++;
  updateAccuracyDisplay();

  // 添加解析
  if (q.explanation) {
    feedbackText += `\n解析：${q.explanation}`;
  }
  
  feedback.textContent = feedbackText;
  feedback.classList.remove('hidden');
  
  // 更新分数
  const scoreElement = document.getElementById('score-value');
  if (scoreElement) {
    scoreElement.textContent = score;
  }
  
  // 延迟加载下一题
  currentQuestionIndex++;
  setTimeout(loadNewQuestion, 1500);
}

/**
 * 更新计时进度条
 * 根据剩余时间改变进度条颜色
 */
function updateProgressBar() {
  const progressFill = document.getElementById('progress-fill');
  if (progressFill) {
    progressFill.style.width = (timeLeft / 60 * 100) + '%';
    
    // 进度条颜色随时间变化
    if (timeLeft < 15) {
      progressFill.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
    } else if (timeLeft < 30) {
      progressFill.style.background = "linear-gradient(90deg, #f59e0b, #d97706)";
    } else {
      progressFill.style.background = "linear-gradient(90deg, #3b82f6, #6366f1)";
    }
  }
}

/**
 * 检查是否为新纪录
 * @param {number} newScore - 新分数
 * @returns {boolean} 是否为新纪录
 */
function isNewRecord(newScore) {
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    if (leaderboard.length === 0) return true;
    
    // 取最低的高分记录进行比较
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
    const minHighScore = sorted.length >= 10 ? sorted[9].score : sorted[sorted.length - 1].score;
    
    return leaderboard.length < 10 || newScore > minHighScore;
  } catch (error) {
    console.error('检查新纪录时出错:', error);
    return false;
  }
}

/**
 * 保存分数到排行榜
 */
function saveScore() {
  try {
    const now = new Date();
    const newRecord = {
      score: score,
      date: formatDateTime(now),
      timeSpent: 60 - timeLeft,
      accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0
    };
    
    // 获取现有排行榜数据
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    
    // 添加新记录
    leaderboard.push(newRecord);
    
    // 按分数排序并保留前10名
    leaderboard.sort((a, b) => b.score - a.score || a.timeSpent - b.timeSpent);
    if (leaderboard.length > 10) {
      leaderboard = leaderboard.slice(0, 10);
    }
    
    // 保存回本地存储
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
    
    // 检查是否为新纪录
    return isNewRecord(score);
  } catch (error) {
    console.error('保存分数时出错:', error);
    showErrorMessage('保存分数失败: ' + error.message);
    return false;
  }
}

/**
 * 渲染排行榜
 * @param {string} listId - 列表元素ID
 * @param {boolean} highlightCurrent - 是否高亮当前记录
 */
function renderLeaderboard(listId, highlightCurrent = false) {
  try {
    const leaderboardList = document.getElementById(listId);
    if (!leaderboardList) {
      console.error('找不到排行榜列表元素');
      return;
    }
    
    // 清空列表
    leaderboardList.innerHTML = '';
    
    // 获取排行榜数据
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    
    // 如果没有记录
    if (leaderboard.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.textContent = '暂无记录，快来创造第一个记录吧！';
      emptyItem.style.textAlign = 'center';
      leaderboardList.appendChild(emptyItem);
      return;
    }
    
    // 按分数排序
    leaderboard.sort((a, b) => b.score - a.score || a.timeSpent - b.timeSpent);
    
    // 渲染每条记录
    leaderboard.forEach((entry, index) => {
      const listItem = document.createElement('li');
      
      // 格式化时间
      const minutes = Math.floor(entry.timeSpent / 60);
      const seconds = entry.timeSpent % 60;
      const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // 设置内容
      listItem.innerHTML = `
        <span class="rank">${index + 1}.</span>
        <span class="score">${entry.score}分</span>
        <span class="date">${entry.date}</span>
        <span class="time">用时: ${timeFormatted}</span>
        <span class="accuracy">正确率: ${entry.accuracy}%</span>
      `;
      
      // 如果需要高亮当前记录且是最高分
      if (highlightCurrent && index === 0 && entry.score === score) {
        listItem.classList.add('current-record');
      }
      
      leaderboardList.appendChild(listItem);
    });
  } catch (error) {
    console.error('渲染排行榜时出错:', error);
    showErrorMessage('加载排行榜失败: ' + error.message);
  }
}

/**
 * 开始游戏
 * 重置游戏状态，显示游戏界面，开始计时
 */
function startGame() {
  // 重置游戏状态
  score = 0;
  timeLeft = 60;
  currentQuestionIndex = 0;
  correctAnswers = 0;
  incorrectAnswers = 0;
  totalAnswered = 0;
  startTime = new Date();
  
  // 更新显示
  document.getElementById('score-value').textContent = '0';
  document.getElementById('time-left').textContent = '60';
  updateAccuracyDisplay();
  updateProgressBar();
  
  // 显示游戏界面，隐藏其他界面
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('leaderboard-menu').classList.add('hidden');
  document.getElementById('game-over-menu').classList.add('hidden');
  document.getElementById('celebration-message').classList.add('hidden');
  
  // 清除之前的计时器
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // 开始计时
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
    updateProgressBar();
    
    // 时间到，结束游戏
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
  
  // 加载第一题
  loadNewQuestion();
}

/**
 * 结束游戏
 * 计算完成时间，保存分数，显示游戏结束界面
 */
function endGame() {
  // 清除计时器
  clearInterval(timerInterval);
  
  // 计算完成时间
  completionTime = new Date();
  const timeSpent = Math.floor((completionTime - startTime) / 1000);
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // 保存分数并检查是否为新纪录
  const newRecord = saveScore();
  
  // 更新游戏结束界面
  document.getElementById('final-score').textContent = score;
  document.getElementById('quiz-completion-time').textContent = timeFormatted;
  
  // 显示或隐藏新纪录消息
  const recordMessage = document.getElementById('record-message');
  if (recordMessage) {
    if (newRecord) {
      recordMessage.classList.remove('hidden');
      document.getElementById('celebration-message').classList.remove('hidden');
    } else {
      recordMessage.classList.add('hidden');
    }
  }
  
  // 渲染游戏结束界面的排行榜，高亮当前记录
  renderLeaderboard('game-over-leaderboard', true);
  
  // 显示游戏结束界面，隐藏游戏界面
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over-menu').classList.remove('hidden');
}

/**
 * 查看排行榜
 * 显示排行榜界面并渲染数据
 */
function viewLeaderboard() {
  renderLeaderboard('leaderboard');
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('leaderboard-menu').classList.remove('hidden');
}

/**
 * 返回主菜单
 * 显示开始菜单，隐藏其他界面
 */
function backToMenu() {
  // 清除计时器
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  document.getElementById('leaderboard-menu').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
}

/**
 * 重新开始游戏
 * 清除计时器，调用开始游戏函数
 */
function restartGame() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  document.getElementById('celebration-message').classList.add('hidden');
  startGame();
}

/**
 * 清空排行榜
 * 清除本地存储中的排行榜数据并重新渲染
 */
function clearLeaderboard() {
  if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复！')) {
    localStorage.removeItem(leaderboardKey);
    renderLeaderboard('leaderboard');
    renderLeaderboard('game-over-leaderboard');
  }
}

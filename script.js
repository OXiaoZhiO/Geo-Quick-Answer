let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
let currentTimeInterval = null;
let startTime = null;
let completionTime = null;
let correctAnswers = 0;
let incorrectAnswers = 0;
let totalAnswered = 0;
const leaderboardKey = 'leaderboard';

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
      // 更新总题目数显示
      document.getElementById('total-questions').textContent = questions.length;
    }
  });
});

// 游戏说明弹窗控制
function setupInstructionsModal() {
  const modal = document.getElementById('instructions-modal');
  const showBtn = document.getElementById('show-instructions-btn');
  const closeBtn = document.querySelector('.close-modal');

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

// 格式化日期时间
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 更新正确率显示
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

// 读取题库并根据难度筛选选项数
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

// 显示错误信息
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

// Fisher-Yates 洗牌算法
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 选项顺序随机
function shuffleOptions(options) {
  const arr = options.slice();
  shuffleArray(arr);
  return arr;
}

// 显示题目和选项
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
  
  // 显示题目和当前题目计数（添加编号）
  questionElement.textContent = `NO.${q.id} ${q.question}`;
  document.getElementById('current-question').textContent = currentQuestionIndex + 1;
  
  optionsDiv.innerHTML = '';
  
  const shuffledOptions = shuffleOptions(q.options);
  
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

// 判断答案并显示反馈
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

  // 添加解析和答题时间
  const currentTime = new Date();
  feedbackText += `\n答题时间: ${formatDateTime(currentTime)}`;
  
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

// 更新计时进度条
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

// 检查是否为新纪录
function isNewRecord(newScore) {
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    if (leaderboard.length === 0) return true;
    
    // 只保留前10名记录
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
    return sorted.length < 10 || newScore > sorted[sorted.length - 1].score;
  } catch (error) {
    console.error('检查新纪录失败:', error);
    return false;
  }
}

// 更新计时器显示
function updateTimer() {
  const timeElement = document.getElementById('time-left');
  if (timeElement) {
    timeElement.textContent = timeLeft;
  }
  
  updateProgressBar();
  
  // 更新当前时间显示
  const now = new Date();
  document.getElementById('current-time').textContent = now.toLocaleTimeString();
  
  if (timeLeft <= 0) {
    endGame();
    return;
  }
  
  timeLeft--;
}

// 开始游戏
function startGame() {
  // 重置游戏状态
  currentQuestionIndex = 0;
  score = 0;
  timeLeft = 60;
  correctAnswers = 0;
  incorrectAnswers = 0;
  totalAnswered = 0;
  startTime = new Date();
  
  // 更新UI
  document.getElementById('score-value').textContent = '0';
  document.getElementById('current-question').textContent = '1';
  updateProgressBar();
  
  // 显示游戏界面，隐藏其他界面
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('leaderboard-menu').classList.add('hidden');
  document.getElementById('game-over-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  
  // 启动计时器
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  
  // 加载第一题
  loadNewQuestion();
}

// 结束游戏
function endGame() {
  // 清除计时器
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  completionTime = new Date();
  const timeSpent = Math.round((completionTime - startTime) / 1000);
  
  // 更新游戏结束界面
  document.getElementById('final-score').textContent = score;
  document.getElementById('quiz-completion-time').textContent = formatDateTime(completionTime);
  
  // 保存成绩到排行榜
  saveScore(score, timeSpent);
  
  // 显示游戏结束界面，隐藏游戏界面
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over-menu').classList.remove('hidden');
  
  // 更新游戏结束界面的排行榜
  renderLeaderboard('game-over-leaderboard');
  
  // 检查是否为新纪录
  const recordMessage = document.getElementById('record-message');
  if (recordMessage) {
    if (isNewRecord(score)) {
      recordMessage.classList.remove('hidden');
      // 可以添加庆祝动画
      recordMessage.style.animation = 'pulse 1s infinite alternate';
    } else {
      recordMessage.classList.add('hidden');
      recordMessage.style.animation = 'none';
    }
  }
}

// 保存分数到本地存储
function saveScore(score, timeSpent) {
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    
    const newEntry = {
      score,
      timeSpent,
      date: new Date().toISOString(),
      datetime: formatDateTime(new Date())
    };
    
    leaderboard.push(newEntry);
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
  } catch (error) {
    console.error('保存分数失败:', error);
  }
}

// 渲染排行榜
function renderLeaderboard(elementId) {
  const leaderboardElement = document.getElementById(elementId);
  if (!leaderboardElement) return;
  
  try {
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    
    // 排序并只显示前10名
    leaderboard = [...leaderboard]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    // 清空现有内容
    leaderboardElement.innerHTML = '';
    
    if (leaderboard.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.textContent = '暂无记录';
      emptyItem.className = 'empty-record';
      leaderboardElement.appendChild(emptyItem);
      return;
    }
    
    // 添加排行榜项
    leaderboard.forEach((entry, index) => {
      const listItem = document.createElement('li');
      listItem.className = index < 3 ? 'top-score' : '';
      
      listItem.innerHTML = `
        <span class="rank">${index + 1}.</span>
        <span class="score">${entry.score}分</span>
        <span class="time">${entry.datetime}</span>
      `;
      
      leaderboardElement.appendChild(listItem);
    });
  } catch (error) {
    console.error('渲染排行榜失败:', error);
    leaderboardElement.innerHTML = '<li>加载排行榜失败</li>';
  }
}

// 查看排行榜
function viewLeaderboard() {
  renderLeaderboard('leaderboard');
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('leaderboard-menu').classList.remove('hidden');
}

// 返回主菜单
function backToMenu() {
  document.getElementById('leaderboard-menu').classList.add('hidden');
  document.getElementById('game-over-menu').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
}

// 重新开始游戏
function restartGame() {
  document.getElementById('game-over-menu').classList.add('hidden');
  startGame();
}

// 清空排行榜
function clearLeaderboard() {
  if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复！')) {
    localStorage.removeItem(leaderboardKey);
    renderLeaderboard('leaderboard');
    renderLeaderboard('game-over-leaderboard');
  }
}

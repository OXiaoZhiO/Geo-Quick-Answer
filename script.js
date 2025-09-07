let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
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
  
  // 预加载题库
  fetchQuestions().then(success => {
    if (success) {
      console.log('题库加载完成， ready to play!');
    }
  });
});

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
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '50%';
  errorDiv.style.left = '50%';
  errorDiv.style.transform = 'translate(-50%, -50%)';
  errorDiv.style.backgroundColor = '#ff4444';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '20px';
  errorDiv.style.borderRadius = '8px';
  errorDiv.style.zIndex = '1000';
  errorDiv.textContent = message;
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.marginTop = '10px';
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
  const questionCountElement = document.getElementById('question-count');
  
  // 检查DOM元素是否存在
  if (!questionElement || !optionsDiv) {
    console.error('找不到题目或选项容器元素');
    endGame();
    return;
  }
  
  // 显示题目和题目数量
  questionElement.textContent = `NO.${q.id} ${q.question}`;
  // 显示当前题目数/总题目数
  if (questionCountElement) {
    questionCountElement.textContent = `第 ${currentQuestionIndex + 1}/${questions.length} 题`;
  }
  
  optionsDiv.innerHTML = '';
  
  const shuffledOptions = shuffleOptions(q.options);
  
  shuffledOptions.forEach(option => {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.className = "option-btn";
    btn.style.background = "linear-gradient(135deg, #3b82f6, #6366f1)";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.padding = "10px";
    btn.style.margin = "5px";
    btn.style.borderRadius = "5px";
    btn.style.cursor = "pointer";
    btn.style.transition = "background 0.3s";
    
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
    btn.style.cursor = 'not-allowed';
  });

  if (isCorrect) {
    score += addScore;
    selectedBtn.style.background = "linear-gradient(135deg, #48bb78, #38a169)"; // 绿色渐变
    feedbackText = `回答正确！+${addScore}分`;
    feedback.className = 'feedback-correct';
  } else {
    selectedBtn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)"; // 红色渐变
    feedbackText = `回答错误！正确答案：${q.answer}。`;
    feedback.className = 'feedback-incorrect';
    
    // 高亮正确选项
    Array.from(optionsDiv.children).forEach(btn => {
      if (btn.textContent === q.answer) {
        btn.style.background = "linear-gradient(135deg, #48bb78, #38a169)";
      }
    });
  }

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

// 开始游戏
function startGame() {
  // 验证题库是否加载完成
  if (questions.length === 0) {
    showErrorMessage('题库加载中，请稍后再试');
    return;
  }
  
  // 验证必要元素是否存在
  const requiredElements = [
    'time-left', 'score-value', 'progress-fill',
    'question', 'options', 'feedback', 'question-count'
  ];
  
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  if (missingElements.length > 0) {
    console.error(`缺少必要的DOM元素: ${missingElements.join(', ')}`);
    showErrorMessage('游戏初始化失败，缺少必要组件');
    return;
  }
  
  // 重置游戏状态
  timeLeft = 60;
  score = 0;
  currentQuestionIndex = 0;
  
  // 更新UI显示
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('score-value').textContent = score;
  document.getElementById('time-left').textContent = timeLeft;
  updateProgressBar();

  // 清除现有计时器
  clearInterval(timerInterval);
  
  // 启动计时器
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
    updateProgressBar();
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);

  // 重新随机题目顺序
  shuffleArray(questions);
  loadNewQuestion();
}

// 查看排行榜
function viewLeaderboard() {
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('leaderboard-menu').classList.remove('hidden');
  updateLeaderboard('leaderboard');
}

// 返回主菜单
function backToMenu() {
  document.getElementById('leaderboard-menu').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
}

// 结束游戏
function endGame() {
  clearInterval(timerInterval);
  
  // 保存分数
  if (score > 0) {
    saveScore(score);
  }
  
  // 更新UI
  const gameElement = document.getElementById('game');
  const gameOverElement = document.getElementById('game-over-menu');
  const finalScoreElement = document.getElementById('final-score');
  
  if (gameElement && gameOverElement && finalScoreElement) {
    gameElement.classList.add('hidden');
    gameOverElement.classList.remove('hidden');
    finalScoreElement.textContent = score;
    updateLeaderboard('game-over-leaderboard');
  } else {
    console.error('找不到游戏结束相关元素');
  }
}

// 重置游戏
function resetGame() {
  timeLeft = 60;
  score = 0;
  currentQuestionIndex = 0;
}

// 重新开始游戏
function restartGame() {
  document.getElementById('game-over-menu').classList.add('hidden');
  startGame();
}

// 保存分数到本地存储
function saveScore(newScore) {
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    leaderboard.push(newScore);
    // 按分数排序并保留前10名
    leaderboard.sort((a, b) => b - a);
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard.slice(0, 10)));
  } catch (error) {
    console.error('保存分数失败:', error);
  }
}

// 更新排行榜显示
function updateLeaderboard(listId) {
  const leaderboardList = document.getElementById(listId);
  
  if (!leaderboardList) {
    console.error('找不到排行榜列表元素');
    return;
  }
  
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    leaderboardList.innerHTML = '';
    
    if (leaderboard.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.textContent = '暂无分数记录';
      leaderboardList.appendChild(emptyItem);
      return;
    }
    
    // 显示排行榜前10名
    leaderboard.forEach((score, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = `${index + 1}. ${score} 分`;
      leaderboardList.appendChild(listItem);
    });
  } catch (error) {
    console.error('更新排行榜失败:', error);
    const errorItem = document.createElement('li');
    errorItem.textContent = '排行榜加载失败';
    leaderboardList.appendChild(errorItem);
  }
}

// 显示排行榜
function displayLeaderboard() {
  const leaderboardMenu = document.getElementById('leaderboard-menu');
  const leaderboardList = document.getElementById('leaderboard');
  
  if (!leaderboardMenu || !leaderboardList) {
    console.error('找不到排行榜相关元素');
    return;
  }
  
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    leaderboardList.innerHTML = '';
    
    if (leaderboard.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.textContent = '暂无分数记录';
      leaderboardList.appendChild(emptyItem);
      return;
    }
    
    leaderboard.forEach((score, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = `${index + 1}. ${score} 分`;
      leaderboardList.appendChild(listItem);
    });
  } catch (error) {
    console.error('显示排行榜失败:', error);
    leaderboardList.innerHTML = '<li>排行榜加载失败</li>';
  }
}

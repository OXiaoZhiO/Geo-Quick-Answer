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
  loadQuestions().then(success => {
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

// 读取题库并根据难度筛选选项数（兼容本地文件系统）
function loadQuestions() {
  return new Promise((resolve) => {
    // 尝试使用fetch API
    fetch('questions.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP状态码 ${res.status}`);
        return res.json();
      })
      .then(rawQuestions => processQuestions(rawQuestions) && resolve(true))
      .catch(fetchError => {
        console.log('Fetch失败，尝试使用备用方法加载题库:', fetchError);
        
        // 备用方法：使用XMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'questions.json', true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status === 200 || xhr.status === 0) { // status 0 适用于本地文件
              try {
                const rawQuestions = JSON.parse(xhr.responseText);
                if (processQuestions(rawQuestions)) {
                  resolve(true);
                } else {
                  showErrorMessage('题库格式错误，请检查questions.json文件');
                  resolve(false);
                }
              } catch (parseError) {
                showErrorMessage(`解析题库失败: ${parseError.message}`);
                resolve(false);
              }
            } else {
              showErrorMessage(`加载题库失败: ${xhr.statusText || '未知错误'}`);
              resolve(false);
            }
          }
        };
        xhr.send();
      });
  });
}

// 处理题库数据
function processQuestions(rawQuestions) {
  // 验证题库格式
  if (!Array.isArray(rawQuestions)) {
    showErrorMessage('题库格式错误，预期为数组');
    return false;
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
    showErrorMessage('未加载到有效题目，请检查题库文件');
    return false;
  }
  
  shuffleArray(questions);
  console.log(`成功加载 ${questions.length} 道题目`);
  return true;
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
  
  // 显示题目和当前题目计数
  questionElement.textContent = q.question;
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
    return newScore > leaderboard[0].score;
  } catch (error) {
    console.error('检查新纪录失败:', error);
    return false;
  }
}

// 显示庆祝信息
function showCelebration() {
  const celebration = document.getElementById('celebration-message');
  if (celebration) {
    celebration.classList.remove('hidden');
    // 3秒后隐藏庆祝信息
    setTimeout(() => {
      celebration.classList.add('hidden');
    }, 3000);
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
    'question', 'options', 'feedback', 'current-question', 'total-questions'
  ];
  
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  if (missingElements.length > 0) {
    console.error(`缺少必要的DOM元素: ${missingElements.join(', ')}`);
    showErrorMessage('游戏初始化失败，缺少必要组件');
    return;
  }
  
  // 记录开始时间
  startTime = new Date();
  
  // 重置游戏状态
  timeLeft = 60;
  score = 0;
  currentQuestionIndex = 0;
  correctAnswers = 0;
  incorrectAnswers = 0;
  totalAnswered = 0;
  
  // 更新UI
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('score-value').textContent = score;
  document.getElementById('time-left').textContent = timeLeft;
  document.getElementById('total-questions').textContent = questions.length;
  
  // 修改时间显示元素为正确率显示
  const timeElement = document.getElementById('current-time');
  if (timeElement) {
    timeElement.id = 'accuracy-display';
  }
  
  updateProgressBar();
  updateAccuracyDisplay();

  // 清除现有计时器
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);
  
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
  // 清除计时器
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);
  
  document.getElementById('leaderboard-menu').classList.add('hidden');
  document.getElementById('instructions-modal').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
}

// 清空排行榜
function clearLeaderboard() {
  if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
    try {
      localStorage.removeItem(leaderboardKey);
      updateLeaderboard('leaderboard');
      updateLeaderboard('game-over-leaderboard');
      showErrorMessage('排行榜已清空');
    } catch (error) {
      console.error('清空排行榜失败:', error);
      showErrorMessage('清空失败，请重试');
    }
  }
}

// 结束游戏
function endGame() {
  // 记录完成时间
  completionTime = new Date();
  
  // 清除计时器
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);
  
  // 计算正确率
  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
  
  // 保存分数
  const isRecord = isNewRecord(score);
  if (score > 0) {
    saveScore(score, accuracy);
  }
  
  // 更新UI
  const gameElement = document.getElementById('game');
  const gameOverElement = document.getElementById('game-over-menu');
  const finalScoreElement = document.getElementById('final-score');
  const completionTimeElement = document.getElementById('quiz-completion-time');
  const recordMessage = document.getElementById('record-message');
  
  if (gameElement && gameOverElement && finalScoreElement && completionTimeElement) {
    gameElement.classList.add('hidden');
    gameOverElement.classList.remove('hidden');
    finalScoreElement.textContent = score;
    completionTimeElement.textContent = formatDateTime(completionTime);
    
    // 添加正确率显示
    let accuracyElement = document.getElementById('game-over-accuracy');
    if (!accuracyElement) {
      accuracyElement = document.createElement('p');
      accuracyElement.id = 'game-over-accuracy';
      finalScoreElement.parentNode.insertBefore(accuracyElement, finalScoreElement.nextSibling);
    }
    accuracyElement.innerHTML = `正确率: <span style="font-weight: bold;">${accuracy}%</span>`;
    
    // 显示破纪录信息
    if (isRecord && score > 0) {
      recordMessage.classList.remove('hidden');
      showCelebration();
    } else {
      recordMessage.classList.add('hidden');
    }
    
    updateLeaderboard('game-over-leaderboard');
  } else {
    console.error('找不到游戏结束相关元素');
  }
}

// 重新开始游戏
function restartGame() {
  document.getElementById('game-over-menu').classList.add('hidden');
  document.getElementById('celebration-message').classList.add('hidden');
  startGame();
}

// 保存分数到本地存储
function saveScore(newScore, accuracy) {
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    // 保存分数、正确率和时间
    leaderboard.push({
      score: newScore,
      accuracy: accuracy,
      time: new Date().toISOString()
    });
    // 按分数排序并保留前10名
    leaderboard.sort((a, b) => b.score - a.score);
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
    leaderboard.forEach((entry, index) => {
      const listItem = document.createElement('li');
      // 格式化时间显示
      const date = new Date(entry.time);
      const formattedTime = formatDateTime(date);
      
      // 添加排名图标
      const rankIcon = index < 3 ? 
        (index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉') : 
        `${index + 1}.`;
      
      listItem.textContent = `${rankIcon} ${entry.score} 分 (正确率: ${entry.accuracy}%) (${formattedTime})`;
      leaderboardList.appendChild(listItem);
    });
  } catch (error) {
    console.error('更新排行榜失败:', error);
    const errorItem = document.createElement('li');
    errorItem.textContent = '排行榜加载失败';
    leaderboardList.appendChild(errorItem);
  }
}

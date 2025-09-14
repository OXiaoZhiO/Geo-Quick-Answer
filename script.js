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

// 新增变量 - 题库相关
let selectedQuiz = '1.json'; // 默认题库
const quizStorageKey = 'selectedQuiz';
let isLocalEnvironment = false;

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
  
  // 检测是否为本地环境
  isLocalEnvironment = window.location.protocol === 'file:';
  
  // 从本地存储加载上次选择的题库
  const savedQuiz = localStorage.getItem(quizStorageKey);
  if (savedQuiz) {
    selectedQuiz = savedQuiz;
  }
  
  // 初始化题库选择器
  initQuizSelector();
  
  // 预加载题库
  fetchQuestions().then(success => {
    if (success) {
      console.log('题库加载完成， ready to play!');
      // 更新总题目数显示
      document.getElementById('total-questions').textContent = questions.length;
    }
  });
});

// 初始化题库选择器
function initQuizSelector() {
  const quizList = document.getElementById('quiz-list');
  const localFileSelector = document.getElementById('local-file-selector');
  
  if (!quizList || !localFileSelector) return;
  
  // 本地环境使用文件选择器
  if (isLocalEnvironment) {
    quizList.classList.add('hidden');
    localFileSelector.classList.remove('hidden');
    
    const fileInput = document.getElementById('quiz-file-input');
    if (fileInput) {
      // 尝试设置文件选择对话框的默认路径（浏览器可能限制此功能）
      fileInput.addEventListener('click', (e) => {
        // 某些浏览器支持直接设置属性引导用户到data文件夹
        if (typeof fileInput.webkitdirectory !== 'undefined') {
          fileInput.webkitdirectory = true;
        }
      });
      
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          // 验证是否是data文件夹下的json文件
          if (file.name.endsWith('.json')) {
            selectedQuiz = file.name;
            localStorage.setItem(quizStorageKey, selectedQuiz);
            
            // 读取本地文件内容
            const reader = new FileReader();
            reader.onload = function(event) {
              try {
                const content = JSON.parse(event.target.result);
                questions = processQuestions(content);
                document.getElementById('total-questions').textContent = questions.length;
                showNotification(`已选择题库: ${content.name || selectedQuiz} (${questions.length}题)`);
              } catch (error) {
                showErrorMessage('文件解析错误: ' + error.message);
              }
            };
            reader.readAsText(file);
          } else {
            showErrorMessage('请选择JSON格式的题库文件');
          }
        }
      });
    }
  } else {
    // 网页环境加载data文件夹下的题库列表
    fetchQuizList();
  }
}

// 获取题库列表
function fetchQuizList() {
  // 尝试加载data文件夹下的题库文件
  const quizFiles = ['1.json', '2.json'];
  const quizList = document.getElementById('quiz-list');
  
  quizFiles.forEach(file => {
    fetch(`data/${file}`)
      .then(response => {
        if (!response.ok) throw new Error('无法加载题库');
        return response.json();
      })
      .then(data => {
        const quizName = data.name || file;
        const questionCount = data.length || 0;
        
        const quizOption = document.createElement('div');
        quizOption.className = `quiz-option ${selectedQuiz === file ? 'selected' : ''}`;
        quizOption.innerHTML = `
          <span>${quizName}</span>
          <span class="question-count">${questionCount}题</span>
        `;
        
        quizOption.addEventListener('click', () => {
          // 更新选中状态
          document.querySelectorAll('.quiz-option').forEach(el => {
            el.classList.remove('selected');
          });
          quizOption.classList.add('selected');
          
          // 保存选择
          selectedQuiz = file;
          localStorage.setItem(quizStorageKey, selectedQuiz);
          
          // 重新加载题库
          fetchQuestions().then(success => {
            if (success) {
              showNotification(`已选择: ${quizName}`);
            }
          });
        });
        
        quizList.appendChild(quizOption);
      })
      .catch(error => {
        console.warn(`加载题库${file}失败:`, error);
      });
  });
}

// 处理题目数据
function processQuestions(rawQuestions) {
  return rawQuestions.map((q, idx) => {
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
}

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
    let rawQuestions;
    
    if (isLocalEnvironment) {
      // 本地环境已通过文件选择器加载
      if (questions.length > 0) return true;
      showErrorMessage('请先选择data文件夹中的题库文件');
      return false;
    } else {
      // 网页环境加载选中的题库
      const res = await fetch(`data/${selectedQuiz}`);
      if (!res.ok) {
        throw new Error(`加载题库失败: HTTP状态码 ${res.status}`);
      }
      rawQuestions = await res.json();
    }
    
    // 验证题库格式
    if (!Array.isArray(rawQuestions)) {
      throw new Error('题库格式错误，预期为数组');
    }
    
    questions = processQuestions(rawQuestions);
    
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

// 显示通知
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 2000);
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
    
    // 取最低的记录分数（假设排行榜已排序）
    const minScore = leaderboard[leaderboard.length - 1].score;
    // 如果记录数不足10条或分数高于最低记录，则为新纪录
    return leaderboard.length < 10 || newScore > minScore;
  } catch (error) {
    console.error('检查新纪录失败:', error);
    return false;
  }
}

// 开始游戏
function startGame() {
  if (questions.length === 0) {
    showErrorMessage('题库加载失败，请先选择有效的题库文件');
    return;
  }
  
  // 重置游戏状态
  score = 0;
  currentQuestionIndex = 0;
  timeLeft = 60;
  correctAnswers = 0;
  incorrectAnswers = 0;
  totalAnswered = 0;
  startTime = new Date();
  
  // 更新UI
  document.getElementById('score-value').textContent = '0';
  document.getElementById('time-left').textContent = timeLeft;
  updateProgressBar();
  
  // 显示游戏界面，隐藏开始菜单
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  
  // 启动计时器
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
    updateProgressBar();
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
  
  // 更新当前时间显示
  if (currentTimeInterval) clearInterval(currentTimeInterval);
  currentTimeInterval = setInterval(() => {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString();
  }, 1000);
  
  // 加载第一题
  loadNewQuestion();
}

// 结束游戏
function endGame() {
  // 清除计时器
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);
  
  // 记录完成时间
  completionTime = new Date();
  const timeTaken = Math.round((completionTime - startTime) / 1000);
  
  // 更新游戏结束界面
  document.getElementById('final-score').textContent = score;
  document.getElementById('quiz-completion-time').textContent = `${timeTaken}秒`;
  
  // 保存成绩到排行榜
  saveScore(score, timeTaken);
  
  // 显示游戏结束界面，隐藏游戏界面
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over-menu').classList.remove('hidden');
  
  // 更新游戏结束界面的排行榜
  updateLeaderboard('game-over-leaderboard');
  
  // 检查是否为新纪录
  if (isNewRecord(score)) {
    document.getElementById('record-message').classList.remove('hidden');
    document.getElementById('celebration-message').classList.remove('hidden');
    
    // 3秒后隐藏庆祝信息
    setTimeout(() => {
      document.getElementById('celebration-message').classList.add('hidden');
    }, 3000);
  } else {
    document.getElementById('record-message').classList.add('hidden');
    document.getElementById('celebration-message').classList.add('hidden');
  }
}

// 保存分数到本地存储
function saveScore(score, timeTaken) {
  try {
    const now = new Date();
    const newEntry = {
      score: score,
      time: timeTaken,
      date: formatDateTime(now),
      timestamp: now.getTime()
    };
    
    // 获取现有排行榜
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    
    // 添加新记录
    leaderboard.push(newEntry);
    
    // 按分数排序（降序），然后按时间排序（升序）
    leaderboard.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score; // 分数高的在前
      }
      return a.time - b.time; // 分数相同，用时少的在前
    });
    
    // 只保留前10名
    if (leaderboard.length > 10) {
      leaderboard = leaderboard.slice(0, 10);
    }
    
    // 保存回本地存储
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
  } catch (error) {
    console.error('保存分数失败:', error);
    showErrorMessage('保存成绩失败: ' + error.message);
  }
}

// 显示排行榜
function viewLeaderboard() {
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('leaderboard-menu').classList.remove('hidden');
  updateLeaderboard('leaderboard');
}

// 更新排行榜显示
function updateLeaderboard(elementId) {
  const leaderboardElement = document.getElementById(elementId);
  if (!leaderboardElement) return;
  
  try {
    // 获取排行榜数据
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    
    if (leaderboard.length === 0) {
      leaderboardElement.innerHTML = '<li>暂无记录，快来创造第一个记录吧！</li>';
      return;
    }
    
    // 生成排行榜HTML
    leaderboardElement.innerHTML = leaderboard.map((entry, index) => `
      <li>
        <strong>${index + 1}.</strong> 
        得分: ${entry.score}分, 
        用时: ${entry.time}秒, 
        日期: ${entry.date}
      </li>
    `).join('');
  } catch (error) {
    console.error('更新排行榜失败:', error);
    leaderboardElement.innerHTML = '<li>加载排行榜失败</li>';
  }
}

// 返回主菜单
function backToMenu() {
  document.getElementById('leaderboard-menu').classList.add('hidden');
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
    updateLeaderboard('leaderboard');
    updateLeaderboard('game-over-leaderboard');
    showNotification('排行榜已清空');
  }
}

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
const selectedBankKey = 'selectedQuestionBank';
let currentBank = '1.json'; // 默认题库
let questionBanks = [];

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
  document.getElementById('select-question-bank-btn').addEventListener('click', showBankSelection);
  document.getElementById('back-from-bank-btn').addEventListener('click', backFromBankSelection);
  
  // 初始化游戏说明弹窗
  setupInstructionsModal();
  
  // 检查保存的题库选择
  const savedBank = localStorage.getItem(selectedBankKey);
  if (savedBank) {
    currentBank = savedBank;
  }
  
  // 加载题库列表
  loadQuestionBanks();
});

// 检查是否为本地环境 (file:// 协议)
function isLocalEnvironment() {
  return window.location.protocol === 'file:';
}

// 加载题库列表
async function loadQuestionBanks() {
  if (isLocalEnvironment()) {
    // 本地环境下不自动加载，等待用户选择
    document.getElementById('current-bank-name').textContent = "请选择题库";
  } else {
    // 网页环境下，尝试加载data文件夹中的1.json和2.json
    try {
      // 尝试加载默认的两个题库
      const bankFiles = ['1.json', '2.json'];
      questionBanks = [];
      
      for (const file of bankFiles) {
        const response = await fetch(`data/${file}`);
        if (response.ok) {
          const bankData = await response.json();
          questionBanks.push({
            file: file,
            name: bankData.name || file,
            questionCount: Array.isArray(bankData.questions) ? bankData.questions.length : 0
          });
        }
      }
      
      // 更新当前题库信息
      updateCurrentBankInfo();
      // 生成题库选择列表
      renderBankList();
    } catch (error) {
      console.error('加载题库列表失败:', error);
      showErrorMessage('加载题库列表失败，请检查文件是否存在');
    }
  }
}

// 显示题库选择界面
function showBankSelection() {
  hideAllScreens();
  document.getElementById('bank-selection').classList.remove('hidden');
  
  // 如果是本地环境，提示用户选择文件
  if (isLocalEnvironment()) {
    const bankList = document.getElementById('bank-list');
    bankList.innerHTML = `
      <p>请选择data文件夹中的题库文件：</p>
      <button id="choose-local-bank" class="secondary-btn">
        <span>选择本地题库文件</span> 📂
      </button>
    `;
    
    document.getElementById('choose-local-bank').addEventListener('click', () => {
      const fileChooser = document.getElementById('file-chooser');
      fileChooser.click();
      
      fileChooser.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          loadLocalQuestionBank(file);
        }
      };
    });
  } else {
    // 网页环境下显示已加载的题库列表
    renderBankList();
  }
}

// 渲染题库列表
function renderBankList() {
  const bankList = document.getElementById('bank-list');
  bankList.innerHTML = '';
  
  if (questionBanks.length === 0) {
    bankList.innerHTML = '<p>未找到任何题库，请检查data文件夹</p>';
    return;
  }
  
  questionBanks.forEach(bank => {
    const bankItem = document.createElement('div');
    bankItem.className = `bank-item ${bank.file === currentBank ? 'selected' : ''}`;
    bankItem.innerHTML = `
      <div class="bank-name">${bank.name}</div>
      <div class="bank-stats">题目数量: ${bank.questionCount} 道</div>
    `;
    
    bankItem.addEventListener('click', () => {
      selectQuestionBank(bank.file);
    });
    
    bankList.appendChild(bankItem);
  });
}

// 选择题库
function selectQuestionBank(bankFile) {
  currentBank = bankFile;
  localStorage.setItem(selectedBankKey, bankFile);
  updateCurrentBankInfo();
  renderBankList();
  showSuccessMessage(`已选择题库: ${questionBanks.find(b => b.file === bankFile)?.name || bankFile}`);
}

// 从题库选择界面返回
function backFromBankSelection() {
  hideAllScreens();
  document.getElementById('start-menu').classList.remove('hidden');
}

// 更新当前题库信息显示
function updateCurrentBankInfo() {
  const bankInfo = document.getElementById('current-bank-name');
  if (!bankInfo) return;
  
  const selectedBank = questionBanks.find(bank => bank.file === currentBank);
  if (selectedBank) {
    bankInfo.textContent = `${selectedBank.name} (${selectedBank.questionCount}题)`;
  } else {
    bankInfo.textContent = currentBank;
  }
}

// 加载本地题库文件
function loadLocalQuestionBank(file) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const content = JSON.parse(e.target.result);
      
      // 验证题库格式
      if (!content.name || !Array.isArray(content.questions)) {
        throw new Error('题库格式不正确，缺少name或questions字段');
      }
      
      // 保存当前选择的文件名
      currentBank = file.name;
      localStorage.setItem(selectedBankKey, file.name);
      
      // 添加到题库列表
      const existingIndex = questionBanks.findIndex(b => b.file === file.name);
      if (existingIndex >= 0) {
        questionBanks[existingIndex] = {
          file: file.name,
          name: content.name,
          questionCount: content.questions.length
        };
      } else {
        questionBanks.push({
          file: file.name,
          name: content.name,
          questionCount: content.questions.length
        });
      }
      
      // 更新界面
      updateCurrentBankInfo();
      renderBankList();
      showSuccessMessage(`已加载题库: ${content.name} (${content.questions.length}题)`);
      
      // 解析题目
      parseQuestions(content.questions);
    } catch (error) {
      showErrorMessage(`加载题库失败: ${error.message}`);
      console.error('解析题库失败:', error);
    }
  };
  
  reader.readAsText(file);
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

// 读取当前选中的题库
async function fetchCurrentQuestionBank() {
  try {
    if (isLocalEnvironment() && questions.length === 0) {
      // 本地环境且尚未加载题目，提示用户选择文件
      showErrorMessage('请先在主菜单选择题库');
      return false;
    }
    
    if (!isLocalEnvironment()) {
      // 网页环境下通过fetch加载
      const res = await fetch(`data/${currentBank}`);
      if (!res.ok) {
        throw new Error(`加载题库失败: HTTP状态码 ${res.status}`);
      }
      
      const bankData = await res.json();
      
      // 验证题库格式
      if (!Array.isArray(bankData.questions)) {
        throw new Error('题库格式错误，questions应为数组');
      }
      
      parseQuestions(bankData.questions);
    }
    
    // 如果是本地环境且已经通过文件选择器加载了题目，直接使用
    return questions.length > 0;
  } catch (error) {
    console.error('题库加载错误:', error);
    showErrorMessage(`加载失败: ${error.message}，请重试`);
    return false;
  }
}

// 解析题目数据
function parseQuestions(rawQuestions) {
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
}

// 显示错误信息
function showErrorMessage(message) {
  // 先移除已存在的错误信息
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message modal';
  errorDiv.innerHTML = `
    <div class="modal-content">
      <h3 style="color: #dc2626;">错误</h3>
      <p>${message}</p>
      <button class="secondary-btn close-error">关闭</button>
    </div>
  `;
  
  document.body.appendChild(errorDiv);
  
  errorDiv.querySelector('.close-error').addEventListener('click', () => {
    errorDiv.remove();
  });
}

// 显示成功信息
function showSuccessMessage(message) {
  // 先移除已存在的信息
  const existingMsg = document.querySelector('.success-message');
  if (existingMsg) {
    existingMsg.remove();
  }
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'success-message modal';
  msgDiv.innerHTML = `
    <div class="modal-content">
      <h3 style="color: #38a169;">成功</h3>
      <p>${message}</p>
      <button class="secondary-btn close-success">确定</button>
    </div>
  `;
  
  document.body.appendChild(msgDiv);
  
  msgDiv.querySelector('.close-success').addEventListener('click', () => {
    msgDiv.remove();
  });
  
  // 3秒后自动关闭
  setTimeout(() => {
    msgDiv.remove();
  }, 3000);
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
  document.getElementById('total-questions').textContent = questions.length;
  
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
    
    // 取前10名中最低的分数
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
    const cutoff = sorted.length < 10 ? 0 : sorted[9].score;
    
    return newScore > cutoff;
  } catch (error) {
    console.error('检查新纪录时出错:', error);
    return false;
  }
}

// 保存分数到排行榜
function saveScore() {
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    const now = new Date();
    
    const scoreData = {
      score: score,
      date: formatDateTime(now),
      questionsAnswered: totalAnswered,
      correct: correctAnswers,
      accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
      bank: currentBank
    };
    
    leaderboard.push(scoreData);
    
    // 只保留前10条记录
    const sorted = leaderboard.sort((a, b) => b.score - a.score);
    const topScores = sorted.slice(0, 10);
    
    localStorage.setItem(leaderboardKey, JSON.stringify(topScores));
    
    return scoreData;
  } catch (error) {
    console.error('保存分数时出错:', error);
    showErrorMessage('保存分数失败');
    return null;
  }
}

// 显示排行榜
function displayLeaderboard(elementId, filterByBank = false) {
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    const listElement = document.getElementById(elementId);
    
    if (!listElement) return;
    
    listElement.innerHTML = '';
    
    if (leaderboard.length === 0) {
      listElement.innerHTML = '<li>暂无记录</li>';
      return;
    }
    
    // 根据当前题库筛选记录（如果需要）
    let displayScores = leaderboard;
    if (filterByBank) {
      displayScores = leaderboard.filter(item => item.bank === currentBank);
      
      if (displayScores.length === 0) {
        listElement.innerHTML = `<li>当前题库暂无记录</li>`;
        return;
      }
    }
    
    // 按分数排序
    displayScores.sort((a, b) => b.score - a.score);
    
    displayScores.forEach((entry, index) => {
      const listItem = document.createElement('li');
      listItem.innerHTML = `
        <div>
          <strong>${index + 1}.</strong> 得分: ${entry.score} 分
          ${entry.bank ? `<br><small>题库: ${entry.bank}</small>` : ''}
        </div>
        <div>
          <small>${entry.date}</small><br>
          <small>正确率: ${entry.accuracy}%</small>
        </div>
      `;
      listElement.appendChild(listItem);
    });
  } catch (error) {
    console.error('显示排行榜时出错:', error);
  }
}

// 清空排行榜
function clearLeaderboard() {
  if (confirm('确定要清空所有排行榜记录吗？')) {
    localStorage.removeItem(leaderboardKey);
    displayLeaderboard('leaderboard');
    displayLeaderboard('game-over-leaderboard');
    showSuccessMessage('排行榜已清空');
  }
}

// 开始游戏
async function startGame() {
  // 重置游戏状态
  currentQuestionIndex = 0;
  score = 0;
  timeLeft = 60;
  correctAnswers = 0;
  incorrectAnswers = 0;
  totalAnswered = 0;
  startTime = new Date();
  
  // 加载当前选中的题库
  const loaded = await fetchCurrentQuestionBank();
  if (!loaded) return;
  
  // 更新UI
  document.getElementById('score-value').textContent = '0';
  document.getElementById('time-left').textContent = '60';
  updateProgressBar();
  
  // 显示游戏界面
  hideAllScreens();
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
  
  // 加载第一道题
  loadNewQuestion();
}

// 结束游戏
function endGame() {
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);
  completionTime = new Date();
  
  // 保存分数
  const scoreData = saveScore();
  
  // 更新游戏结束界面
  document.getElementById('final-score').textContent = score;
  document.getElementById('quiz-completion-time').textContent = formatDateTime(completionTime);
  
  // 显示新纪录提示
  const recordMessage = document.getElementById('record-message');
  if (scoreData && isNewRecord(scoreData.score)) {
    recordMessage.classList.remove('hidden');
  } else {
    recordMessage.classList.add('hidden');
  }
  
  // 显示排行榜
  displayLeaderboard('game-over-leaderboard', true);
  
  // 切换到游戏结束界面
  hideAllScreens();
  document.getElementById('game-over-menu').classList.remove('hidden');
}

// 查看排行榜
function viewLeaderboard() {
  displayLeaderboard('leaderboard');
  hideAllScreens();
  document.getElementById('leaderboard-menu').classList.remove('hidden');
}

// 返回主菜单
function backToMenu() {
  hideAllScreens();
  document.getElementById('start-menu').classList.remove('hidden');
}

// 重新开始游戏
function restartGame() {
  startGame();
}

// 隐藏所有屏幕
function hideAllScreens() {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.add('hidden');
  });
  
  // 隐藏弹窗
  const modals = document.querySelectorAll('.modal:not(.hidden)');
  modals.forEach(modal => {
    modal.classList.add('hidden');
  });
}

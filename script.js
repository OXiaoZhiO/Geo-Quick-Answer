let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
let currentTimeInterval = null;
let startTime = null;
let completionTime = null;
const leaderboardKey = 'leaderboard';

// 难度与分值和选项数映射
const difficultyMap = {
  1: { options: 3, score: 5 },
  2: { options: 4, score: 10 },
  3: { options: 5, score: 15 },
  4: { options: 6, score: 20 }
};

// 页面加载完成后初始化（核心：根据协议判断运行环境）
document.addEventListener('DOMContentLoaded', () => {
  // 1. 判断环境：file:// 是本地，http/https 是网页
  const isLocalEnv = window.location.protocol === 'file:';
  
  // 2. 绑定基础按钮事件
  bindButtonEvents();
  
  // 3. 初始化游戏说明弹窗
  setupInstructionsModal();
  
  // 4. 动态切换加载方式
  if (isLocalEnv) {
    console.log('检测到本地环境，启用手动选择JSON文件');
    createLocalFileSelector(); // 本地：显示文件选择器
  } else {
    console.log('检测到网页环境，自动加载JSON题库');
    fetchRemoteQuestions(); // 网页：保持原有fetch加载
  }
});

// 绑定所有按钮事件（统一管理，避免空指针）
function bindButtonEvents() {
  // 开始游戏按钮
  const startBtn = document.getElementById('start-game-btn');
  if (startBtn) startBtn.addEventListener('click', startGame);

  // 查看排行榜按钮
  const leaderboardBtn = document.getElementById('view-leaderboard-btn');
  if (leaderboardBtn) leaderboardBtn.addEventListener('click', viewLeaderboard);

  // 返回主菜单按钮
  const backBtn = document.getElementById('back-to-menu-btn');
  if (backBtn) backBtn.addEventListener('click', backToMenu);

  // 重新开始按钮
  const restartBtn = document.getElementById('restart-game-btn');
  if (restartBtn) restartBtn.addEventListener('click', restartGame);

  // 清空排行榜按钮
  const clearLeaderboardBtn = document.getElementById('clear-leaderboard-btn');
  if (clearLeaderboardBtn) clearLeaderboardBtn.addEventListener('click', clearLeaderboard);
  const clearRecordsBtn = document.getElementById('clear-records-btn');
  if (clearRecordsBtn) clearRecordsBtn.addEventListener('click', clearLeaderboard);
}

// ------------------------------
// 本地环境：创建文件选择器（解决CORS）
// ------------------------------
function createLocalFileSelector() {
  // 1. 确保开始菜单存在
  const startMenu = document.getElementById('start-menu');
  if (!startMenu) {
    showErrorMessage('本地环境初始化失败：未找到开始菜单');
    return;
  }

  // 2. 创建文件选择区域（样式适配原有UI）
  const fileSelector = document.createElement('div');
  fileSelector.className = 'local-file-selector';
  fileSelector.style.margin = '15px 0';
  fileSelector.style.padding = '10px';
  fileSelector.style.background = 'rgba(255,255,255,0.8)';
  fileSelector.style.borderRadius = '10px';
  fileSelector.innerHTML = `
    <p style="margin: 8px 0; font-size: 0.95em; color: #333;">
      📂 本地环境：请选择 questions.json 文件
    </p>
    <input type="file" id="local-json-file" accept=".json" 
           style="padding: 8px; margin: 8px 0; border: 1px solid #ddd; border-radius: 8px; width: 90%;" />
    <p id="file-load-status" style="margin: 8px 0; font-size: 0.9em; color: #666;">
      状态：未选择文件
    </p>
  `;

  // 3. 插入到开始菜单（优先插在开始按钮前，兼容DOM结构）
  const startGameBtn = document.getElementById('start-game-btn');
  if (startGameBtn) {
    startGameBtn.before(fileSelector); // 避免insertBefore的父节点问题
  } else {
    startMenu.appendChild(fileSelector);
  }

  // 4. 绑定文件选择事件
  const jsonInput = document.getElementById('local-json-file');
  const loadStatus = document.getElementById('file-load-status');
  if (jsonInput && loadStatus) {
    jsonInput.addEventListener('change', (e) => {
      handleLocalFileSelect(e, loadStatus);
    });
  }
}

// 处理本地文件选择
function handleLocalFileSelect(event, statusElem) {
  const file = event.target.files[0];
  if (!file) {
    statusElem.textContent = '状态：未选择文件';
    statusElem.style.color = '#666';
    questions = [];
    return;
  }

  // 验证文件类型
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    statusElem.textContent = '状态：错误！请选择JSON格式文件';
    statusElem.style.color = '#dc2626';
    questions = [];
    return;
  }

  // 读取文件内容（FileReader）
  const reader = new FileReader();
  reader.onloadstart = () => {
    statusElem.textContent = '状态：正在解析题库...';
    statusElem.style.color = '#3b82f6';
  };

  reader.onload = (e) => {
    try {
      const rawQuestions = JSON.parse(e.target.result);
      if (processQuestions(rawQuestions)) {
        statusElem.textContent = `状态：加载成功！共 ${questions.length} 道题`;
        statusElem.style.color = '#10b981';
        // 更新总题目数显示
        const totalQuesElem = document.getElementById('total-questions');
        if (totalQuesElem) totalQuesElem.textContent = questions.length;
      } else {
        statusElem.textContent = '状态：解析失败！题库格式错误';
        statusElem.style.color = '#dc2626';
      }
    } catch (err) {
      statusElem.textContent = `状态：解析错误！${err.message.slice(0, 25)}...`;
      statusElem.style.color = '#dc2626';
    }
  };

  reader.onerror = () => {
    statusElem.textContent = '状态：读取失败！文件损坏或无权限';
    statusElem.style.color = '#dc2626';
  };

  // 以UTF-8编码读取（解决中文乱码）
  reader.readAsText(file, 'UTF-8');
}

// ------------------------------
// 网页环境：原有fetch加载逻辑（无改动）
// ------------------------------
async function fetchRemoteQuestions() {
  try {
    const res = await fetch('questions.json');
    if (!res.ok) throw new Error(`HTTP状态码 ${res.status}`);
    
    const rawQuestions = await res.json();
    if (processQuestions(rawQuestions)) {
      console.log(`网页环境：成功加载 ${questions.length} 道题`);
      // 更新总题目数显示
      const totalQuesElem = document.getElementById('total-questions');
      if (totalQuesElem) totalQuesElem.textContent = questions.length;
    } else {
      showErrorMessage('网页环境：题库格式错误');
    }
  } catch (err) {
    console.error('网页环境加载失败:', err);
    showErrorMessage(`网页环境加载题库失败：${err.message}`);
  }
}

// ------------------------------
// 通用函数（题库处理、UI控制等，保持原有逻辑）
// ------------------------------
// 游戏说明弹窗控制
function setupInstructionsModal() {
  const modal = document.getElementById('instructions-modal');
  const showBtn = document.getElementById('show-instructions-btn');
  const closeBtn = document.querySelector('.close-modal');

  if (!modal || !showBtn || !closeBtn) return;

  showBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
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

// 更新当前时间显示
function updateCurrentTimeDisplay() {
  const timeElem = document.getElementById('current-time');
  if (timeElem) {
    timeElem.textContent = formatDateTime(new Date()).split(' ')[1];
  }
}

// 处理题库数据（本地和网页通用）
function processQuestions(rawQuestions) {
  // 验证题库格式
  if (!Array.isArray(rawQuestions)) {
    showErrorMessage('题库必须是数组格式');
    return false;
  }

  // 过滤无效题目
  const validQuestions = rawQuestions.map((q, idx) => {
    if (!q.question || !q.answer || !Array.isArray(q.options) || q.difficulty === undefined) {
      console.warn(`跳过无效题目（索引${idx}）：缺少必要字段`);
      return null;
    }

    // 补全难度配置
    const diffConf = difficultyMap[q.difficulty] || difficultyMap[1];
    // 确保正确答案在选项中
    if (!q.options.includes(q.answer)) {
      q.options.push(q.answer);
      console.warn(`题目${idx+1}：自动补充正确答案到选项`);
    }

    // 按难度筛选选项数量
    const maxOpts = Math.min(diffConf.options, q.options.length);
    let finalOpts = [q.answer];
    const otherOpts = q.options.filter(opt => opt !== q.answer);

    // 随机选择其他选项
    while (finalOpts.length < maxOpts && otherOpts.length > 0) {
      const randomIdx = Math.floor(Math.random() * otherOpts.length);
      finalOpts.push(otherOpts.splice(randomIdx, 1)[0]);
    }

    return {
      id: idx + 1,
      question: q.question.trim(),
      answer: q.answer.trim(),
      options: finalOpts,
      difficulty: q.difficulty,
      diffConf: diffConf,
      explanation: q.explanation ? q.explanation.trim() : '无解析'
    };
  }).filter(Boolean);

  // 验证有效题目数量
  if (validQuestions.length === 0) {
    showErrorMessage('无有效题目，请检查题库内容');
    return false;
  }

  // 打乱题目顺序
  shuffleArray(validQuestions);
  questions = validQuestions;
  return true;
}

// 显示错误提示
function showErrorMessage(message) {
  const oldError = document.querySelector('.error-message');
  if (oldError) oldError.remove();

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '50%';
  errorDiv.style.left = '50%';
  errorDiv.style.transform = 'translate(-50%, -50%)';
  errorDiv.style.background = '#ef4444';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '15px 20px';
  errorDiv.style.borderRadius = '8px';
  errorDiv.style.zIndex = '1000';
  errorDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  errorDiv.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.marginTop = '10px';
  closeBtn.style.padding = '6px 12px';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '4px';
  closeBtn.style.background = 'rgba(255,255,255,0.3)';
  closeBtn.style.color = 'white';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => errorDiv.remove());
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

// 加载新题目
function loadNewQuestion() {
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }

  const questionElem = document.getElementById('question');
  const optionsElem = document.getElementById('options');
  const currentQuesElem = document.getElementById('current-question');
  const feedbackElem = document.getElementById('feedback');

  if (!questionElem || !optionsElem) {
    console.error('题目/选项容器缺失');
    endGame();
    return;
  }

  const currentQues = questions[currentQuestionIndex];
  // 显示带序号的题目（NO.id）
  questionElem.textContent = `NO.${currentQues.id} ${currentQues.question}`;
  if (currentQuesElem) currentQuesElem.textContent = currentQuestionIndex + 1;

  // 重置选项区
  optionsElem.innerHTML = '';
  // 重置反馈
  if (feedbackElem) {
    feedbackElem.classList.add('hidden');
    feedbackElem.textContent = '';
  }

  // 生成选项按钮（打乱顺序）
  const shuffledOpts = [...currentQues.options];
  shuffleArray(shuffledOpts);

  shuffledOpts.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.style.margin = '8px auto';
    btn.style.padding = '10px 15px';
    btn.style.width = '90%';
    btn.style.maxWidth = '400px';
    btn.style.border = 'none';
    btn.style.borderRadius = '20px';
    btn.style.background = 'linear-gradient(135deg, #3b82f6, #6366f1)';
    btn.style.color = 'white';
    btn.style.fontSize = '1em';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'all 0.2s';

    btn.addEventListener('click', () => {
      checkAnswer(currentQues, opt, btn, optionsElem, feedbackElem);
    });

    optionsElem.appendChild(btn);
  });
}

// 检查答案并反馈
function checkAnswer(question, selectedOpt, selectedBtn, optionsElem, feedbackElem) {
  // 禁止所有选项点击
  Array.from(optionsElem.children).forEach(btn => {
    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    btn.style.opacity = '0.8';
  });

  const isCorrect = selectedOpt === question.answer;
  let feedbackText = '';

  // 更新样式和分数
  if (isCorrect) {
    selectedBtn.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
    score += question.diffConf.score;
    feedbackText = `✅ 回答正确！+${question.diffConf.score}分`;
    if (feedbackElem) feedbackElem.className = 'feedback-correct';
  } else {
    selectedBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    // 高亮正确答案
    Array.from(optionsElem.children).forEach(btn => {
      if (btn.textContent === question.answer) {
        btn.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
      }
    });
    feedbackText = `❌ 回答错误！正确答案：${question.answer}`;
    if (feedbackElem) feedbackElem.className = 'feedback-incorrect';
  }

  // 添加解析和时间
  feedbackText += `\n📅 答题时间：${formatDateTime(new Date())}`;
  feedbackText += `\n💡 解析：${question.explanation}`;

  // 显示反馈
  if (feedbackElem) {
    feedbackElem.textContent = feedbackText;
    feedbackElem.classList.remove('hidden');
  }

  // 更新分数显示
  const scoreElem = document.getElementById('score-value');
  if (scoreElem) scoreElem.textContent = score;

  // 加载下一题
  currentQuestionIndex++;
  setTimeout(loadNewQuestion, 1500);
}

// 更新计时进度条
function updateProgressBar() {
  const progressFill = document.getElementById('progress-fill');
  if (progressFill) {
    const progressPercent = (timeLeft / 60) * 100;
    progressFill.style.width = `${progressPercent}%`;

    // 进度条颜色随时间变化
    if (timeLeft < 15) {
      progressFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    } else if (timeLeft < 30) {
      progressFill.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
    } else {
      progressFill.style.background = 'linear-gradient(90deg, #3b82f6, #6366f1)';
    }
  }
}

// 检查是否为新纪录
function isNewRecord(newScore) {
  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    if (leaderboard.length === 0) return true;
    leaderboard.sort((a, b) => b.score - a.score);
    return newScore > leaderboard[0].score;
  } catch (err) {
    console.error('读取排行榜失败:', err);
    return false;
  }
}

// 显示破纪录庆祝
function showCelebration() {
  const celebrationElem = document.getElementById('celebration-message');
  if (celebrationElem) {
    celebrationElem.classList.remove('hidden');
    setTimeout(() => celebrationElem.classList.add('hidden'), 3000);
  }
}

// 开始游戏
function startGame() {
  // 验证题库是否加载
  if (questions.length === 0) {
    showErrorMessage('请先加载有效的题库文件');
    return;
  }

  // 验证核心DOM元素
  const requiredElems = [
    'time-left', 'score-value', 'progress-fill', 
    'question', 'options', 'feedback', 'current-question', 'total-questions'
  ];
  const missingElems = requiredElems.filter(id => !document.getElementById(id));
  if (missingElems.length > 0) {
    showErrorMessage(`初始化失败：缺少元素（${missingElems.join(', ')}）`);
    return;
  }

  // 重置游戏状态
  timeLeft = 60;
  score = 0;
  currentQuestionIndex = 0;
  startTime = new Date();

  // 更新UI
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('score-value').textContent = '0';
  document.getElementById('time-left').textContent = '60';
  document.getElementById('total-questions').textContent = questions.length;
  updateProgressBar();
  updateCurrentTimeDisplay();

  // 清除旧计时器
  if (timerInterval) clearInterval(timerInterval);
  if (currentTimeInterval) clearInterval(currentTimeInterval);

  // 启动倒计时
  timerInterval = setInterval(() => {
    timeLeft--;
    const timeLeftElem = document.getElementById('time-left');
    if (timeLeftElem) timeLeftElem.textContent = timeLeft;
    updateProgressBar();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);

  // 启动时间更新
  currentTimeInterval = setInterval(updateCurrentTimeDisplay, 1000);

  // 加载第一题
  loadNewQuestion();
}

// 结束游戏
function endGame() {
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);
  completionTime = new Date();

  // 保存分数
  let isNewRecordFlag = false;
  if (score > 0) {
    saveScore(score);
    isNewRecordFlag = isNewRecord(score);
  }

  // 切换界面
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over-menu').classList.remove('hidden');

  // 更新结算信息
  const finalScoreElem = document.getElementById('final-score');
  const completionTimeElem = document.getElementById('quiz-completion-time');
  const recordMsgElem = document.getElementById('record-message');

  if (finalScoreElem) finalScoreElem.textContent = score;
  if (completionTimeElem) completionTimeElem.textContent = formatDateTime(completionTime);
  if (recordMsgElem) {
    isNewRecordFlag && score > 0 
      ? (recordMsgElem.classList.remove('hidden'), showCelebration())
      : recordMsgElem.classList.add('hidden');
  }

  // 更新排行榜
  updateLeaderboard('game-over-leaderboard');
}

// 查看排行榜
function viewLeaderboard() {
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('leaderboard-menu').classList.remove('hidden');
  updateLeaderboard('leaderboard');
}

// 返回主菜单
function backToMenu() {
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);

  document.getElementById('leaderboard-menu').classList.add('hidden');
  document.getElementById('game-over-menu').classList.add('hidden');
  document.getElementById('instructions-modal').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
}

// 重新开始游戏
function restartGame() {
  document.getElementById('game-over-menu').classList.add('hidden');
  document.getElementById('celebration-message').classList.add('hidden');
  startGame();
}

// 保存分数到本地存储
function saveScore(newScore) {
  try {
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    leaderboard.push({
      score: newScore,
      time: new Date().toISOString(),
      date: formatDateTime(new Date())
    });
    // 排序并保留前10名
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > 10) leaderboard = leaderboard.slice(0, 10);
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
  } catch (err) {
    console.error('保存分数失败:', err);
    showErrorMessage('保存分数失败，请允许本地存储');
  }
}

// 更新排行榜显示
function updateLeaderboard(containerId) {
  const leaderboardList = document.getElementById(containerId);
  if (!leaderboardList) return;

  try {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    leaderboardList.innerHTML = '';

    if (leaderboard.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.style.padding = '10px';
      emptyItem.style.textAlign = 'center';
      emptyItem.style.color = '#666';
      emptyItem.textContent = '暂无分数记录';
      leaderboardList.appendChild(emptyItem);
      return;
    }

    // 渲染排行榜
    leaderboard.forEach((item, index) => {
      const listItem = document.createElement('li');
      listItem.style.display = 'flex';
      listItem.style.justifyContent = 'space-between';
      listItem.style.alignItems = 'center';
      listItem.style.padding = '8px 12px';
      listItem.style.margin = '5px 0';
      listItem.style.background = '#f3f4f6';
      listItem.style.borderRadius = '8px';

      const rankIcon = index < 3 
        ? (index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉') 
        : `${index + 1}.`;

      listItem.innerHTML = `
        <span style="font-weight: 500;">${rankIcon}</span>
        <span style="flex: 1; margin: 0 10px; text-align: center;">${item.score} 分</span>
        <span style="font-size: 0.85em; color: #666;">${item.date.split(' ')[0]}</span>
      `;

      leaderboardList.appendChild(listItem);
    });
  } catch (err) {
    leaderboardList.innerHTML = '<li style="color: #dc2626; padding: 10px; text-align: center;">排行榜加载失败</li>';
  }
}

// 清空排行榜
function clearLeaderboard() {
  if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复！')) {
    try {
      localStorage.removeItem(leaderboardKey);
      updateLeaderboard('leaderboard');
      updateLeaderboard('game-over-leaderboard');
      showErrorMessage('排行榜已清空');
    } catch (err) {
      showErrorMessage('清空失败，请允许本地存储');
    }
  }
}

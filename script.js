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

// 页面加载完成后初始化（确保DOM完全渲染）
document.addEventListener('DOMContentLoaded', () => {
  // 优先创建文件选择器（核心修复：确保DOM节点存在后再操作）
  setTimeout(createFileSelector, 100); // 延迟100ms确保start-menu完全渲染
  
  // 绑定按钮事件（增加元素存在性检查）
  bindButtonEvents();
  
  // 初始化游戏说明弹窗
  setupInstructionsModal();
});

// 绑定所有按钮事件（统一管理，避免空指针）
function bindButtonEvents() {
  // 开始游戏按钮
  const startBtn = document.getElementById('start-game-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startGame);
  }

  // 查看排行榜按钮
  const leaderboardBtn = document.getElementById('view-leaderboard-btn');
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', viewLeaderboard);
  }

  // 返回主菜单按钮
  const backBtn = document.getElementById('back-to-menu-btn');
  if (backBtn) {
    backBtn.addEventListener('click', backToMenu);
  }

  // 重新开始按钮
  const restartBtn = document.getElementById('restart-game-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', restartGame);
  }

  // 清空排行榜按钮（兼容可能的重复ID）
  const clearLeaderboardBtn = document.getElementById('clear-leaderboard-btn');
  if (clearLeaderboardBtn) {
    clearLeaderboardBtn.addEventListener('click', clearLeaderboard);
  }
  const clearRecordsBtn = document.getElementById('clear-records-btn');
  if (clearRecordsBtn) {
    clearRecordsBtn.addEventListener('click', clearLeaderboard);
  }
}

// 创建文件选择器（核心修复：稳健的节点插入逻辑）
function createFileSelector() {
  // 1. 确保核心容器存在
  const startMenu = document.getElementById('start-menu');
  if (!startMenu) {
    console.error('错误：未找到「开始菜单」元素（start-menu）');
    showErrorMessage('页面加载异常，请刷新重试');
    return;
  }

  // 2. 找到插入参考点（优先用「开始游戏」按钮，不存在则插入到菜单末尾）
  const startGameBtn = document.getElementById('start-game-btn');
  
  // 3. 创建文件选择区域DOM
  const fileSelector = document.createElement('div');
  fileSelector.className = 'file-selector';
  fileSelector.style.margin = '15px 0';
  fileSelector.innerHTML = `
    <p style="margin: 8px 0; font-size: 0.95em;">请选择本地题库文件 (questions.json)</p>
    <input type="file" id="json-file" accept=".json" style="padding: 8px; margin: 8px 0; border-radius: 8px; border: 1px solid #ddd;" />
    <p id="file-status" style="margin: 8px 0; font-size: 0.9em; color: #666;">状态：未选择文件</p>
  `;

  // 4. 插入DOM（修复核心：确保参考节点是父节点的子元素）
  if (startGameBtn && startGameBtn.parentNode === startMenu) {
    // 正常情况：插入到「开始游戏」按钮之前
    startMenu.insertBefore(fileSelector, startGameBtn);
  } else if (startGameBtn) {
    // 特殊情况：按钮存在但父节点不同，插入到按钮的前一个兄弟节点
    startGameBtn.before(fileSelector);
  } else {
    // 降级情况：按钮不存在，直接插入到菜单末尾
    startMenu.appendChild(fileSelector);
  }

  // 5. 绑定文件选择事件
  const jsonFileInput = document.getElementById('json-file');
  const fileStatus = document.getElementById('file-status');
  if (jsonFileInput && fileStatus) {
    jsonFileInput.addEventListener('change', (e) => handleFileSelect(e, fileStatus));
  }
}

// 处理文件选择（分离UI状态和业务逻辑）
function handleFileSelect(event, statusElement) {
  const file = event.target.files[0];
  if (!file) {
    statusElement.textContent = '状态：未选择文件';
    statusElement.style.color = '#666';
    questions = [];
    return;
  }

  // 验证文件类型
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    statusElement.textContent = '状态：错误！请选择JSON格式文件';
    statusElement.style.color = '#dc2626';
    questions = [];
    return;
  }

  // 读取文件内容（FileReader异步处理）
  const reader = new FileReader();
  reader.onloadstart = () => {
    statusElement.textContent = '状态：正在加载题库...';
    statusElement.style.color = '#3b82f6';
  };

  reader.onload = (e) => {
    try {
      // 解析JSON
      const rawQuestions = JSON.parse(e.target.result);
      // 处理题库数据
      const loadSuccess = processQuestions(rawQuestions);
      
      if (loadSuccess) {
        statusElement.textContent = `状态：加载成功！共 ${questions.length} 道题`;
        statusElement.style.color = '#10b981';
        // 更新总题目数显示（如果存在）
        const totalQuesElem = document.getElementById('total-questions');
        if (totalQuesElem) {
          totalQuesElem.textContent = questions.length;
        }
      } else {
        statusElement.textContent = '状态：加载失败！题库格式错误';
        statusElement.style.color = '#dc2626';
      }
    } catch (parseErr) {
      statusElement.textContent = `状态：解析失败！${parseErr.message.slice(0, 30)}...`;
      statusElement.style.color = '#dc2626';
    }
  };

  reader.onerror = () => {
    statusElement.textContent = '状态：读取失败！文件损坏或无权限';
    statusElement.style.color = '#dc2626';
  };

  // 执行读取（UTF-8编码确保中文正常）
  reader.readAsText(file, 'UTF-8');
}

// 游戏说明弹窗控制（增加元素存在性检查）
function setupInstructionsModal() {
  const modal = document.getElementById('instructions-modal');
  const showBtn = document.getElementById('show-instructions-btn');
  const closeBtn = document.querySelector('.close-modal');

  if (!modal || !showBtn || !closeBtn) {
    console.warn('警告：游戏说明弹窗相关元素缺失');
    return;
  }

  // 显示弹窗
  showBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  // 关闭弹窗（多种方式）
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  // 点击弹窗外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
}

// 格式化日期时间（工具函数）
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 更新当前时间显示（兼容元素缺失）
function updateCurrentTimeDisplay() {
  const timeElem = document.getElementById('current-time');
  if (timeElem) {
    const now = new Date();
    timeElem.textContent = formatDateTime(now).split(' ')[1]; // 只显示时分秒
  }
}

// 处理题库数据（验证+格式化）
function processQuestions(rawQuestions) {
  // 1. 验证题库整体格式
  if (!Array.isArray(rawQuestions)) {
    showErrorMessage('题库错误：必须是数组格式');
    return false;
  }

  // 2. 处理每道题（过滤无效题）
  const validQuestions = rawQuestions.map((q, idx) => {
    // 验证必要字段
    if (!q.question || !q.answer || !Array.isArray(q.options) || q.difficulty === undefined) {
      console.warn(`跳过无效题目（索引${idx}）：缺少必要字段`);
      return null;
    }

    // 补全难度配置
    const diffConf = difficultyMap[q.difficulty] || difficultyMap[1];
    // 确保正确答案在选项中
    if (!q.options.includes(q.answer)) {
      q.options.push(q.answer);
      console.warn(`题目${idx+1}：选项中缺少正确答案，已自动补充`);
    }

    // 按难度筛选选项数量（确保不超过原选项数）
    const maxOpts = Math.min(diffConf.options, q.options.length);
    let finalOpts = [q.answer]; // 先保留正确答案
    const otherOpts = q.options.filter(opt => opt !== q.answer);

    // 随机选择其他选项
    while (finalOpts.length < maxOpts && otherOpts.length > 0) {
      const randomIdx = Math.floor(Math.random() * otherOpts.length);
      finalOpts.push(otherOpts.splice(randomIdx, 1)[0]);
    }

    // 返回格式化后的题目
    return {
      id: idx + 1,
      question: q.question.trim(),
      answer: q.answer.trim(),
      options: finalOpts,
      difficulty: q.difficulty,
      diffConf: diffConf,
      explanation: q.explanation ? q.explanation.trim() : '无解析'
    };
  }).filter(Boolean); // 过滤null（无效题）

  // 3. 验证有效题数量
  if (validQuestions.length === 0) {
    showErrorMessage('无有效题目：请检查题库内容');
    return false;
  }

  // 4. 打乱题目顺序（随机出题）
  shuffleArray(validQuestions);
  questions = validQuestions;
  return true;
}

// 显示错误提示（统一样式）
function showErrorMessage(message) {
  // 先移除旧的错误提示
  const oldError = document.querySelector('.error-message');
  if (oldError) oldError.remove();

  // 创建新的错误提示
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
  errorDiv.style.maxWidth = '80%';
  errorDiv.textContent = message;

  // 添加关闭按钮
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

  // 添加到页面
  document.body.appendChild(errorDiv);
}

// Fisher-Yates 洗牌算法（打乱数组）
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 加载新题目（游戏核心逻辑）
function loadNewQuestion() {
  // 1. 检查是否有剩余题目
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }

  // 2. 获取DOM元素
  const questionElem = document.getElementById('question');
  const optionsElem = document.getElementById('options');
  const currentQuesElem = document.getElementById('current-question');
  const feedbackElem = document.getElementById('feedback');

  if (!questionElem || !optionsElem) {
    console.error('错误：题目/选项容器缺失');
    endGame();
    return;
  }

  // 3. 获取当前题目
  const currentQues = questions[currentQuestionIndex];

  // 4. 更新UI
  questionElem.textContent = `NO.${currentQues.id} ${currentQues.question}`;
  if (currentQuesElem) {
    currentQuesElem.textContent = currentQuestionIndex + 1;
  }
  // 重置选项区
  optionsElem.innerHTML = '';
  // 重置反馈
  if (feedbackElem) {
    feedbackElem.classList.add('hidden');
    feedbackElem.textContent = '';
  }

  // 5. 生成选项按钮（打乱顺序）
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

    // 选项点击事件
    btn.addEventListener('click', () => {
      checkAnswer(currentQues, opt, btn, optionsElem, feedbackElem);
    });

    optionsElem.appendChild(btn);
  });
}

// 检查答案并反馈
function checkAnswer(question, selectedOpt, selectedBtn, optionsElem, feedbackElem) {
  // 1. 禁止所有选项点击
  Array.from(optionsElem.children).forEach(btn => {
    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    btn.style.opacity = '0.8';
  });

  // 2. 判断对错
  const isCorrect = selectedOpt === question.answer;
  let feedbackText = '';

  // 3. 更新UI和分数
  if (isCorrect) {
    // 正确：绿色样式+加分
    selectedBtn.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
    score += question.diffConf.score;
    feedbackText = `✅ 回答正确！+${question.diffConf.score}分`;
    if (feedbackElem) {
      feedbackElem.className = 'feedback-correct';
    }
  } else {
    // 错误：红色样式+显示正确答案
    selectedBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    // 高亮正确答案按钮
    Array.from(optionsElem.children).forEach(btn => {
      if (btn.textContent === question.answer) {
        btn.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
      }
    });
    feedbackText = `❌ 回答错误！正确答案：${question.answer}`;
    if (feedbackElem) {
      feedbackElem.className = 'feedback-incorrect';
    }
  }

  // 4. 添加解析和时间
  feedbackText += `\n📅 答题时间：${formatDateTime(new Date())}`;
  feedbackText += `\n💡 解析：${question.explanation}`;

  // 5. 显示反馈
  if (feedbackElem) {
    feedbackElem.textContent = feedbackText;
    feedbackElem.classList.remove('hidden');
  }

  // 6. 更新分数显示
  const scoreElem = document.getElementById('score-value');
  if (scoreElem) {
    scoreElem.textContent = score;
  }

  // 7. 延迟加载下一题（1.5秒后）
  currentQuestionIndex++;
  setTimeout(loadNewQuestion, 1500);
}

// 更新计时进度条
function updateProgressBar() {
  const progressFill = document.getElementById('progress-fill');
  if (progressFill) {
    const progressPercent = (timeLeft / 60) * 100;
    progressFill.style.width = `${progressPercent}%`;

    // 进度条颜色随时间变化（紧急度提醒）
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
    // 按分数降序排序，取最高分对比
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
    // 3秒后自动隐藏
    setTimeout(() => {
      celebrationElem.classList.add('hidden');
    }, 3000);
  }
}

// 开始游戏（初始化+启动）
function startGame() {
  // 1. 验证题库是否加载
  if (questions.length === 0) {
    showErrorMessage('请先选择并加载有效的题库文件');
    return;
  }

  // 2. 验证核心DOM元素
  const requiredElems = [
    'time-left', 'score-value', 'progress-fill', 
    'question', 'options', 'feedback', 'current-question', 'total-questions'
  ];
  const missingElems = requiredElems.filter(id => !document.getElementById(id));
  if (missingElems.length > 0) {
    showErrorMessage(`游戏初始化失败：缺少核心元素（${missingElems.join(', ')}）`);
    return;
  }

  // 3. 重置游戏状态
  timeLeft = 60;
  score = 0;
  currentQuestionIndex = 0;
  startTime = new Date();

  // 4. 更新初始UI
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('score-value').textContent = '0';
  document.getElementById('time-left').textContent = '60';
  document.getElementById('total-questions').textContent = questions.length;
  updateProgressBar();
  updateCurrentTimeDisplay();

  // 5. 清除旧计时器
  if (timerInterval) clearInterval(timerInterval);
  if (currentTimeInterval) clearInterval(currentTimeInterval);

  // 6. 启动倒计时器
  timerInterval = setInterval(() => {
    timeLeft--;
    const timeLeftElem = document.getElementById('time-left');
    if (timeLeftElem) timeLeftElem.textContent = timeLeft;
    updateProgressBar();

    // 时间到，结束游戏
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);

  // 7. 启动实时时间更新
  currentTimeInterval = setInterval(updateCurrentTimeDisplay, 1000);

  // 8. 加载第一题
  loadNewQuestion();
}

// 结束游戏（结算+排行榜）
function endGame() {
  // 1. 清除计时器
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);
  completionTime = new Date();

  // 2. 保存分数（仅当分数>0时）
  let isNewRecordFlag = false;
  if (score > 0) {
    saveScore(score);
    isNewRecordFlag = isNewRecord(score);
  }

  // 3. 切换到游戏结束界面
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over-menu').classList.remove('hidden');

  // 4. 更新结算信息
  const finalScoreElem = document.getElementById('final-score');
  const completionTimeElem = document.getElementById('quiz-completion-time');
  const recordMsgElem = document.getElementById('record-message');

  if (finalScoreElem) finalScoreElem.textContent = score;
  if (completionTimeElem) completionTimeElem.textContent = formatDateTime(completionTime);
  if (recordMsgElem) {
    if (isNewRecordFlag && score > 0) {
      recordMsgElem.classList.remove('hidden');
      showCelebration(); // 显示破纪录动画
    } else {
      recordMsgElem.classList.add('hidden');
    }
  }

  // 5. 更新游戏结束界面的排行榜
  updateLeaderboard('game-over-leaderboard');
}

// 查看排行榜
function viewLeaderboard() {
  // 切换界面
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('leaderboard-menu').classList.remove('hidden');
  // 加载排行榜数据
  updateLeaderboard('leaderboard');
}

// 返回主菜单
function backToMenu() {
  // 清除计时器
  clearInterval(timerInterval);
  clearInterval(currentTimeInterval);

  // 隐藏其他界面，显示主菜单
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
    // 读取现有排行榜
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    // 添加新分数（带时间戳）
    leaderboard.push({
      score: newScore,
      time: new Date().toISOString(),
      date: formatDateTime(new Date())
    });
    // 按分数降序排序，保留前10名
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > 10) leaderboard = leaderboard.slice(0, 10);
    // 保存回本地存储
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
  } catch (err) {
    console.error('保存分数失败:', err);
    showErrorMessage('保存分数失败，请允许浏览器本地存储');
  }
}

// 更新排行榜显示（通用函数，支持不同容器）
function updateLeaderboard(containerId) {
  const leaderboardList = document.getElementById(containerId);
  if (!leaderboardList) {
    console.error(`找不到排行榜容器（${containerId}）`);
    return;
  }

  try {
    // 读取排行榜数据
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    leaderboardList.innerHTML = '';

    // 无数据时显示提示
    if (leaderboard.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.style.padding = '10px';
      emptyItem.style.textAlign = 'center';
      emptyItem.style.color = '#666';
      emptyItem.textContent = '暂无分数记录';
      leaderboardList.appendChild(emptyItem);
      return;
    }

    // 渲染排行榜列表
    leaderboard.forEach((item, index) => {
      const listItem = document.createElement('li');
      listItem.style.display = 'flex';
      listItem.style.justifyContent = 'space-between';
      listItem.style.alignItems = 'center';
      listItem.style.padding = '8px 12px';
      listItem.style.margin = '5px 0';
      listItem.style.background = '#f3f4f6';
      listItem.style.borderRadius = '8px';

      // 排名图标（前三名特殊标记）
      const rankIcon = index < 3 
        ? (index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉') 
        : `${index + 1}.`;

      // 内容结构
      listItem.innerHTML = `
        <span style="font-weight: 500;">${rankIcon}</span>
        <span style="flex: 1; margin: 0 10px; text-align: center;">${item.score} 分</span>
        <span style="font-size: 0.85em; color: #666;">${item.date.split(' ')[0]}</span>
      `;

      leaderboardList.appendChild(listItem);
    });
  } catch (err) {
    console.error('加载排行榜失败:', err);
    leaderboardList.innerHTML = '<li style="color: #dc2626; padding: 10px; text-align: center;">排行榜加载失败</li>';
  }
}

// 清空排行榜（带确认提示）
function clearLeaderboard() {
  if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复！')) {
    try {
      localStorage.removeItem(leaderboardKey);
      // 更新所有排行榜显示
      updateLeaderboard('leaderboard');
      updateLeaderboard('game-over-leaderboard');
      showErrorMessage('排行榜已清空', 'success');
    } catch (err) {
      console.error('清空排行榜失败:', err);
      showErrorMessage('清空失败，请允许浏览器本地存储');
    }
  }
}

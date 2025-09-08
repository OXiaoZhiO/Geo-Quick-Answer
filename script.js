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

// 更新当前时间显示
function updateCurrentTimeDisplay() {
  const now = new Date();
  document.getElementById('current-time').textContent = formatDateTime(now).split(' ')[1];
}

// 读取题库并根据难度筛选选项数
async function fetchQuestions() {
  try {
    // 使用XMLHttpRequest替代fetch以支持本地file协议
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'questions.json', true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 0) { // 0状态码支持本地file协议
            try {
              const rawQuestions = JSON.parse(xhr.responseText);
              
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
              resolve(true);
            } catch (error) {
              console.error('解析题库错误:', error);
              showErrorMessage(`解析失败: ${error.message}，请检查题库格式`);
              reject(error);
            }
          } else {
            const error = new Error(`加载题库失败: 状态码 ${xhr.status}`);
            console.error(error);
            showErrorMessage(`加载失败: ${error.message}，请刷新页面重试`);
            reject(error);
          }
        }
      };
      xhr.send();
    });
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
  
  // 显示带有序号的题目和当前题目计数
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
    selectedBtn.classList.add('correct');
    feedbackText = `回答正确！+${addScore}分 🎉`;
    feedback.className = 'feedback-correct';
  } else {
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
    return newScore > leaderboard[0];
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
    showErrorMessage('题库加载失败，请刷新页面重试');
    return;
  }
  
  // 重置游戏状态
  currentQuestionIndex = 0;
  score = 0;
  timeLeft = 60;
  startTime = new Date();
  
  // 更新UI
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('score-value').textContent = '0';
  document.getElementById('time-left').textContent = timeLeft;
  updateProgressBar();
  
  // 加载第一题
  loadNewQuestion();
  
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

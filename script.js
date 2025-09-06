let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
const leaderboardKey = 'leaderboard';
let selectedDifficulty = 1; // 默认难度
let isAnswering = false;

// 难度与分值和选项数映射
const difficultyMap = {
  1: { options: 3, score: 5 },
  2: { options: 4, score: 10 },
  3: { options: 5, score: 15 },
  4: { options: 6, score: 20 }
};

// 读取题库并处理
async function fetchQuestions() {
  // 显示加载提示
  const app = document.getElementById('app');
  const originalAppHTML = app.innerHTML;
  app.innerHTML = '<div style="text-align:center"><p>加载题库中...</p></div>';
  
  try {
    const res = await fetch('questions.json');
    let rawQuestions = await res.json();
    
    // 根据选择的难度筛选题目
    questions = rawQuestions
      .filter(q => q.difficulty === selectedDifficulty)
      .map((q, idx) => {
        const diffConf = difficultyMap[q.difficulty] || difficultyMap[1];
        let opts = q.options.slice();
        while (opts.length < diffConf.options) {
          let fakeOption = "选项" + (opts.length + 1);
          if (!opts.includes(fakeOption) && fakeOption !== q.answer) opts.push(fakeOption);
        }
        return { ...q, options: opts, diffConf, id: idx + 1 };
      });
      
    shuffleArray(questions);
    
    // 恢复界面
    app.innerHTML = originalAppHTML;
    initEventListeners();
    updateQuestionCounter();
  } catch (error) {
    app.innerHTML = '<div style="text-align:center"><p>加载失败，请刷新页面重试</p></div>';
    console.error('加载题库出错:', error);
  }
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

// 更新题目计数器
function updateQuestionCounter() {
  const counter = document.getElementById('question-counter');
  if (counter) {
    counter.textContent = `题目 ${currentQuestionIndex + 1}/${questions.length}`;
  }
}

// 显示题目和选项
function loadNewQuestion() {
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  
  const q = questions[currentQuestionIndex];
  document.getElementById('question').textContent = `NO.${q.id} ${q.question}`;
  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = '';

  const shuffledOptions = shuffleOptions(q.options);

  shuffledOptions.forEach(option => {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.className = "option-btn";
    btn.style.background = "linear-gradient(135deg, #3b82f6, #6366f1)";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.transition = "background 0.3s";
    btn.onclick = () => checkAnswer(option, btn, shuffledOptions);
    optionsDiv.appendChild(btn);
  });

  document.getElementById('feedback').classList.add('hidden');
  document.getElementById('feedback').textContent = '';
  updateQuestionCounter();
}

// 判断答案并显示反馈
function checkAnswer(selected, selectedBtn, allOptions) {
  if (isAnswering) return;
  isAnswering = true;
  
  const q = questions[currentQuestionIndex];
  const feedback = document.getElementById('feedback');
  const optionsDiv = document.getElementById('options');
  let addScore = q.diffConf.score;
  let feedbackText = '';
  let isCorrect = selected === q.answer;

  // 禁止再次选择
  Array.from(optionsDiv.children).forEach(btn => btn.disabled = true);

  if (isCorrect) {
    score += addScore;
    selectedBtn.style.background = "linear-gradient(135deg, #48bb78, #38a169)";
    feedbackText = `回答正确！+${addScore}分`;
  } else {
    selectedBtn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    feedbackText = `回答错误！正确答案：${q.answer}。`;
    // 正确选项按钮高亮绿色
    Array.from(optionsDiv.children).forEach(btn => {
      if (btn.textContent === q.answer) {
        btn.style.background = "linear-gradient(135deg, #48bb78, #38a169)";
      }
    });
  }

  // 题目解析
  if (q.explanation) {
    feedbackText += `\n解析：${q.explanation}`;
  }
  feedback.textContent = feedbackText;
  feedback.classList.remove('hidden');
  document.getElementById('score-value').textContent = score;
  currentQuestionIndex++;
  
  setTimeout(() => {
    isAnswering = false;
    loadNewQuestion();
  }, 1500);
}

// 计时进度条
function updateProgressBar() {
  const progressFill = document.getElementById('progress-fill');
  progressFill.style.width = (timeLeft / 60 * 100) + '%';
}

function startGame() {
  timeLeft = 60;
  score = 0;
  currentQuestionIndex = 0;
  document.getElementById('score-value').textContent = score;
  document.getElementById('time-left').textContent = timeLeft;
  updateProgressBar();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
    updateProgressBar();
    if (timeLeft === 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);

  loadNewQuestion();
}

function endGame() {
  clearInterval(timerInterval);
  saveScore(score);
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over-menu').classList.remove('hidden');
  document.getElementById('final-score').textContent = score;
  updateLeaderboard();
}

function resetGame() {
  timeLeft = 60;
  score = 0;
  currentQuestionIndex = 0;
}

function saveScore(newScore) {
  const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
  leaderboard.push(newScore);
  leaderboard.sort((a, b) => b - a);
  localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard.slice(0, 10)));
}

function displayLeaderboard() {
  const leaderboardMenu = document.getElementById('leaderboard-menu');
  const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
  const leaderboardList = document.getElementById('leaderboard');
  leaderboardList.innerHTML = '';
  leaderboard.forEach((score, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${score} 分`;
    leaderboardList.appendChild(li);
  });
  document.getElementById('start-menu').classList.add('hidden');
  leaderboardMenu.classList.remove('hidden');
}

function updateLeaderboard() {
  const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
  const leaderboardList = document.getElementById('game-over-leaderboard');
  leaderboardList.innerHTML = '';
  leaderboard.forEach((score, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${score} 分`;
    leaderboardList.appendChild(li);
  });
}

// 初始化事件监听器
function initEventListeners() {
  // 难度选择按钮
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDifficulty = parseInt(btn.dataset.level);
      fetchQuestions(); // 重新加载对应难度的题目
    });
  });
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", async () => {
  await fetchQuestions();

  document.getElementById('start-game-btn').addEventListener('click', () => {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    startGame();
  });

  document.getElementById('view-leaderboard-btn').addEventListener('click', () => {
    displayLeaderboard();
  });

  document.getElementById('restart-game-btn').addEventListener('click', () => {
    document.getElementById('game-over-menu').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
    resetGame();
  });

  // 处理排行榜返回主菜单
  const backBtn = document.getElementById('back-to-menu-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      document.getElementById('leaderboard-menu').classList.add('hidden');
      document.getElementById('start-menu').classList.remove('hidden');
    });
  }
});

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

// 读取题库并处理选项
async function fetchQuestions() {
  const res = await fetch('questions.json');
  let rawQuestions = await res.json();
  questions = rawQuestions.map((q, idx) => {
    const diffConf = difficultyMap[q.difficulty] || difficultyMap[1];
    
    // 确保有1个正确答案和5个干扰项，共6个选项
    if (!q.options.includes(q.answer)) {
      q.options.unshift(q.answer); // 确保正确答案在选项中
    }
    
    // 过滤重复选项
    const uniqueOptions = [...new Set(q.options)];
    
    // 如果选项不足6个，补充随机生成的干扰项
    let opts = uniqueOptions.slice();
    while (opts.length < 6) {
      let fakeOption = generateFakeOption(q.question, opts, q.answer);
      if (!opts.includes(fakeOption) && fakeOption !== q.answer) {
        opts.push(fakeOption);
      }
    }
    
    // 根据难度筛选显示的选项数量
    const shuffledAllOptions = shuffleArray(opts.slice()); // 先打乱所有6个选项
    const displayOptions = shuffledAllOptions.slice(0, diffConf.options); // 取前N个选项
    
    return { 
      ...q, 
      allOptions: opts, // 存储所有6个选项
      displayOptions: displayOptions, // 存储当前难度下要显示的选项
      diffConf, 
      id: idx + 1 
    };
  });
  
  // 随机排序题目
  shuffleArray(questions);
}

// 生成更合理的假选项
function generateFakeOption(question, existingOptions, correctAnswer) {
  // 地理相关的常见假选项词汇
  const geographyTerms = [
    "伦敦", "巴黎", "纽约", "莫斯科", "悉尼", "柏林", "东京", "北京",
    "太平洋", "大西洋", "印度洋", "北冰洋", "喜马拉雅山", "阿尔卑斯山",
    "黄河", "珠江", "黑龙江", "里海", "青海湖", "洞庭湖", "巴西", "印度",
    "加拿大", "澳大利亚", "法国", "德国", "埃及", "南非", "热带雨林",
    "温带季风", "高原山地", "极地气候", "黑土", "红土", "黄土", "沙漠",
    "平原", "高原", "盆地", "山脉", "岛屿", "半岛", "海峡", "运河"
  ];
  
  // 尝试找到一个不在现有选项中的地理术语
  for (let term of geographyTerms) {
    if (!existingOptions.includes(term) && term !== correctAnswer) {
      return term;
    }
  }
  
  // 如果找不到合适的术语，使用默认方式生成
  return "选项" + (existingOptions.length + 1);
}

// Fisher-Yates 洗牌算法
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

  // 对当前要显示的选项再次打乱顺序
  const shuffledOptions = shuffleArray(q.displayOptions);

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
}

// 判断答案并显示反馈
function checkAnswer(selected, selectedBtn, allOptions) {
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
    selectedBtn.style.background = "linear-gradient(135deg, #48bb78, #38a169)"; // 绿色渐变
    feedbackText = `回答正确！+${addScore}分`;
  } else {
    selectedBtn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)"; // 红色渐变
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
  setTimeout(loadNewQuestion, 1500);
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

// 按钮事件绑定
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

let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
const leaderboardKey = 'leaderboard';

// 难度与分值和选项数映射
const difficultyMap = {
  1: { options: 3， score: 5 }，
  2: { options: 4， score: 10 }，
  3: { options: 5， score: 15 }，
  4: { options: 6， score: 20 }
};

// 读取题库并补足选项数
async function fetchQuestions() {
  const res = await fetch('questions.json');
  let rawQuestions = await res。json();
  questions = rawQuestions。map(q => {
    const diffConf = difficultyMap[q。difficulty] || difficultyMap[1];
    let opts = q。options。slice();
    while (opts。length < diffConf。options) {
      let fakeOption = "选项" + (opts。length + 1);
      if (!opts。includes(fakeOption) && fakeOption !== q。answer) opts。push(fakeOption);
    }
    return { ...q， options: opts， diffConf };
  });
  shuffleArray(questions);
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
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  const q = questions[currentQuestionIndex];
  document。getElementById('question')。textContent = q。question;
  const optionsDiv = document。getElementById('options');
  optionsDiv。innerHTML = '';

  const shuffledOptions = shuffleOptions(q。options);

  shuffledOptions。forEach(option => {
    const btn = document。createElement('button');
    btn。textContent = option;
    btn。className = "option-btn";
    btn。style。background = "linear-gradient(135deg, #3b82f6, #6366f1)";
    btn。onclick = () => checkAnswer(option， btn， shuffledOptions);
    optionsDiv。appendChild(btn);
  });

  document。getElementById('feedback')。classList。add('hidden');
  document。getElementById('feedback')。textContent = '';
}

// 判断答案并显示反馈
function checkAnswer(selected， selectedBtn， allOptions) {
  const q = questions[currentQuestionIndex];
  const feedback = document。getElementById('feedback');
  const optionsDiv = document。getElementById('options');
  let addScore = q。diffConf。score;
  let feedbackText = '';
  let isCorrect = selected === q。answer;

  // 禁止再次选择
  Array。from(optionsDiv。children)。forEach(btn => btn。disabled = true);

  if (isCorrect) {
    score += addScore;
    selectedBtn。classList。add('feedback-correct');
    selectedBtn。style。background = "linear-gradient(135deg, #48bb78, #38a169)"; // 绿色渐变
    feedbackText = `回答正确！+${addScore}分`;
  } else {
    selectedBtn。classList。add('feedback-incorrect');
    selectedBtn。style。background = "linear-gradient(135deg, #ef4444, #dc2626)"; // 红色渐变
    feedbackText = `回答错误！正确答案：${q。answer}。`;
    // 正确选项高亮绿色
    Array。from(optionsDiv。children)。forEach(btn => {
      if (btn。textContent === q。answer) {
        btn。classList。add('feedback-correct');
        btn。style。background = "linear-gradient(135deg, #48bb78, #38a169)";
      }
    });
  }

  // 题目解析
  if (q。explanation) {
    feedbackText += `\n解析：${q。explanation}`;
  }
  feedback。textContent = feedbackText;
  feedback。className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
  feedback。classList。remove('hidden');
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

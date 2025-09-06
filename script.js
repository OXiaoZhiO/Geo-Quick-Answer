let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
const leaderboardKey = 'leaderboard';

// 异步加载题库
async function fetchQuestions() {
  const res = await fetch('questions.json');
  questions = await res.json();
  shuffleArray(questions); // 题库顺序随机
}

// 洗牌算法（Fisher-Yates）
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
  document.getElementById('question').textContent = q.question;
  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = '';

  const shuffledOptions = shuffleOptions(q.options);
  shuffledOptions.forEach(option => {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.onclick = () => checkAnswer(option);
    optionsDiv.appendChild(btn);
  });

  document.getElementById('feedback').classList.add('hidden');
}

// 判断答案并显示反馈
function checkAnswer(selected) {
  const q = questions[currentQuestionIndex];
  const feedback = document.getElementById('feedback');
  if (selected === q.answer) {
    score += q.difficulty || 1;
    feedback.textContent = '回答正确！';
    feedback.className = 'feedback-correct';
  } else {
    feedback.textContent = '回答错误！正确答案：' + q.answer;
    feedback.className = 'feedback-incorrect';
  }
  feedback.classList.remove('hidden');
  document.getElementById('score-value').textContent = score;
  currentQuestionIndex++;
  setTimeout(loadNewQuestion, 1000);
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
  const leaderboardList = document.getElementById('leaderboard');
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

  // 如果你有返回排行榜主菜单按钮
  const backBtn = document.getElementById('back-to-menu-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      document.getElementById('leaderboard-menu').classList.add('hidden');
      document.getElementById('start-menu').classList.remove('hidden');
    });
  }
});

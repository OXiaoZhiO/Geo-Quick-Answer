let timeLeft = 60;
let score = 0;
let questions = [];
let currentQuestionIndex = 0;
let timerInterval = null;

const leaderboardKey = 'leaderboard';

// 加载题库
async function fetchQuestions() {
  const res = await fetch('questions.json');
  questions = await res.json();
}

// 显示题目
function loadNewQuestion() {
  // 如果所有题目都答完了，直接结束游戏
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  const q = questions[currentQuestionIndex];
  document.getElementById('question').textContent = q.question;
  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = '';
  q.options.forEach(option => {
    const btn = document.createElement('button');
    btn.textContent = option;
    btn.onclick = () => checkAnswer(option);
    optionsDiv.appendChild(btn);
  });
  document.getElementById('feedback').classList.add('hidden');
}

function checkAnswer(selected) {
  const q = questions[currentQuestionIndex];
  const feedback = document.getElementById('feedback');
  if (selected === q.answer) {
    score += q.difficulty || 1; // 难度越高得分越多
    feedback.textContent = '回答正确！';
    feedback.className = 'feedback-correct';
  } else {
    feedback.textContent = '回答错误！正确答案：' + q.answer;
    feedback.className = 'feedback-incorrect';
  }
  feedback.classList.remove('hidden');
  document.getElementById('score-value').textContent = score;
  currentQuestionIndex++;
  setTimeout(loadNewQuestion, 1000); // 1秒后自动跳到下一题
}

function startGame() {
  timeLeft = 60;
  score = 0;
  currentQuestionIndex = 0;
  document.getElementById('score-value').textContent = score;
  document.getElementById('time-left').textContent = timeLeft;

  // 开始计时
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
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

// 按钮事件
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
});

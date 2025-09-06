let timeLeft = 60;
let score = 0;
const leaderboardKey = 'leaderboard';

document.getElementById('start-game-btn').addEventListener('click', () => {
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  startGame();
});

document.getElementById('view-leaderboard-btn').addEventListener('click', () => {
  displayLeaderboard();
});

document.getElementById('back-to-menu-btn').addEventListener('click', () => {
  document.getElementById('leaderboard-menu').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
});

document.getElementById('restart-game-btn').addEventListener('click', () => {
  document.getElementById('game-over-menu').classList.add('hidden');
  document.getElementById('start-menu').classList.remove('hidden');
  resetGame();
});

function startGame() {
  timeLeft = 60;
  score = 0;
  document.getElementById('score-value').textContent = score;
  document.getElementById('time-left').textContent = timeLeft;

  const timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;

    if (timeLeft === 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);

  loadNewQuestion();
}

function loadNewQuestion() {
  // Implement question loading logic here
}

function endGame() {
  saveScore(score);
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over-menu').classList.remove('hidden');
  document.getElementById('final-score').textContent = score;
  updateLeaderboard();
}

function resetGame() {
  timeLeft = 60;
  score = 0;
}

function saveScore(newScore) {
  const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
  leaderboard.push(newScore);
  leaderboard.sort((a, b) => b - a);
  localStorage.setItem(leaderboardKey', JSON.stringify(leaderboard.slice(0, 10)));
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

let timeLeft = 60;
let score = 0;
let currentQuestion = {};
let questions = [];
let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];

// Fetch questions
fetch('questions.json')
  .then(response => response.json())
  .then(data => {
    questions = data;
  });

const startMenu = document.getElementById('start-menu');
const game = document.getElementById('game');
const gameOverMenu = document.getElementById('game-over-menu');
const timer = document.getElementById('time-left');
const scoreValue = document.getElementById('score-value');
const questionText = document.getElementById('question');
const optionsDiv = document.getElementById('options');
const feedback = document.getElementById('feedback');
const finalScore = document.getElementById('final-score');
const leaderboardList = document.getElementById('leaderboard');

// Start game
document.getElementById('start-game-btn').addEventListener('click', () => {
  startMenu.classList.add('hidden');
  game.classList.remove('hidden');
  startGame();
});

// Restart game
document.getElementById('restart-game-btn').addEventListener('click', () => {
  gameOverMenu.classList.add('hidden');
  startMenu.classList.remove('hidden');
  resetGame();
});

function startGame() {
  loadNewQuestion();
  const timerInterval = setInterval(() => {
    timeLeft--;
    timer.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

function loadNewQuestion() {
  if (questions.length === 0) {
    endGame();
    return;
  }

  const randomIndex = Math.floor(Math.random() * questions.length);
  currentQuestion = questions.splice(randomIndex, 1)[0];
  displayQuestion(currentQuestion);
}

function displayQuestion(question) {
  questionText.textContent = question.question;
  optionsDiv.innerHTML = '';
  question.options.forEach(option => {
    const button = document.createElement('button');
    button.textContent = option;
    button.addEventListener('click', () => checkAnswer(option));
    optionsDiv.appendChild(button);
  });
}

function checkAnswer(selectedOption) {
  feedback.classList.remove('hidden');
  if (selectedOption === currentQuestion.answer) {
    score += currentQuestion.difficulty * 10;
    feedback.textContent = '正确！';
    feedback.style.color = 'green';
  } else {
    feedback.textContent = '错误！';
    feedback.style.color = 'red';
  }
  scoreValue.textContent = score;
  setTimeout(() => {
    feedback.classList.add('hidden');
    loadNewQuestion();
  }, 1000);
}

function endGame() {
  game.classList.add('hidden');
  gameOverMenu.classList.remove('hidden');
  finalScore.textContent = score;

  // Update leaderboard
  leaderboard.push(score);
  leaderboard.sort((a, b) => b - a);
  leaderboard = leaderboard.slice(0, 5);
  localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
  displayLeaderboard();
}

function displayLeaderboard() {
  leaderboardList.innerHTML = '';
  leaderboard.forEach((score, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${score} 分`;
    leaderboardList.appendChild(li);
  });
}

function resetGame() {
  timeLeft = 60;
  score = 0;
  scoreValue.textContent = score;
  timer.textContent = timeLeft;
  fetch('questions.json')
    .then(response => response.json())
    .then(data => {
      questions = data;
    });
}

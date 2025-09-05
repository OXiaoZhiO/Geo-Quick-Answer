let timeLeft = 60;
let score = 0;
let currentQuestion = {};
let questions = [];

// Fetch questions from the JSON file
fetch('questions.json')
  .then(response => response.json())
  .then(data => {
    questions = data;
    loadNewQuestion();
  });

document.getElementById('submit-answer').addEventListener('click', loadNewQuestion);
document.getElementById('restart-game').addEventListener('click', restartGame);

const timerInterval = setInterval(() => {
  timeLeft--;
  document.getElementById('time-left').textContent = timeLeft;

  if (timeLeft <= 0) {
    endGame();
  }
}, 1000);

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
  document.getElementById('question').textContent = question.question;

  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = '';
  question.options.forEach(option => {
    const button = document.createElement('button');
    button.textContent = option;
    button.addEventListener('click', () => checkAnswer(option));
    optionsDiv.appendChild(button);
  });
}

function checkAnswer(selectedOption) {
  if (selectedOption === currentQuestion.answer) {
    score += currentQuestion.difficulty * 10;
    document.getElementById('score-value').textContent = score;
  }
  loadNewQuestion();
}

function endGame() {
  clearInterval(timerInterval);
  document.getElementById('game').classList.add('hidden');
  document.getElementById('game-over').classList.remove('hidden');
  document.getElementById('final-score').textContent = score;
}

function restartGame() {
  timeLeft = 60;
  score = 0;
  document.getElementById('score-value').textContent = score;
  document.getElementById('time-left').textContent = timeLeft;
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('game-over').classList.add('hidden');
  fetch('questions.json')
    .then(response => response.json())
    .then(data => {
      questions = data;
      loadNewQuestion();
    });
}
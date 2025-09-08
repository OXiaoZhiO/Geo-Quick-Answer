// 游戏状态变量
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 30;
let timer;
let questions = [];
let gameStarted = false;

// DOM 元素
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const questionElement = document.getElementById('question');
const optionsElement = document.getElementById('options');
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');
const finalScoreElement = document.getElementById('final-score');
const leaderboardList = document.getElementById('leaderboard-list');

// 事件监听器
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);
document.getElementById('view-leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('back-to-menu-btn').addEventListener('click', showStartScreen);
document.getElementById('instructions-btn').addEventListener('click', () => {
    alert('地理快回答游戏规则：\n1. 每轮有10道地理知识题\n2. 每道题有30秒时间作答\n3. 答对一题得10分\n4. 答错不扣分，但会直接进入下一题\n5. 时间用完未答题视为答错\n6. 完成所有题目后可提交分数到排行榜');
});

// 检测运行环境并加载题库
function loadQuestions() {
    return new Promise((resolve, reject) => {
        // 检测是否在本地 file:// 协议下运行
        const isLocalFile = window.location.protocol === 'file:';
        
        if (isLocalFile) {
            // 本地环境：使用 import 方法加载JSON
            try {
                import('./questions.json', { assert: { type: 'json' } })
                    .then(module => resolve(module.default))
                    .catch(error => reject(error));
            } catch (error) {
                reject(error);
            }
        } else {
            // 服务器环境 (GitHub Pages)：使用 fetch 方法
            fetch('questions.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`加载失败: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => resolve(data))
                .catch(error => reject(error));
        }
    });
}

// 初始化游戏
function initGame(loadedQuestions) {
    questions = [...loadedQuestions]; // 复制题库
    currentQuestionIndex = 0;
    score = 0;
    scoreElement.textContent = score;
    showQuestion();
}

// 开始游戏
function startGame() {
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    gameStarted = true;
    loadQuestions()
        .then(questions => {
            if (validateQuestions(questions)) {
                initGame(questions);
            } else {
                showError('题库格式不正确，请检查 questions.json 文件');
                showStartScreen();
            }
        })
        .catch(error => {
            console.error('加载题库失败:', error);
            showError('加载题库失败，请确保文件存在且格式正确');
            showStartScreen();
        });
}

// 验证题库格式
function validateQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
        return false;
    }
    
    return questions.every(question => {
        return (
            question.id !== undefined &&
            typeof question.question === 'string' &&
            Array.isArray(question.options) &&
            question.options.length >= 2 &&
            typeof question.answer === 'string' &&
            typeof question.difficulty === 'number'
        );
    });
}

// 显示题目
function showQuestion() {
    if (currentQuestionIndex >= 10 || currentQuestionIndex >= questions.length) {
        endGame();
        return;
    }
    
    clearInterval(timer);
    timeLeft = 30;
    timerElement.textContent = timeLeft;
    
    // 启动计时器
    timer = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            currentQuestionIndex++;
            showQuestion();
        }
    }, 1000);
    
    // 获取当前题目并随机排序选项
    const question = questions[currentQuestionIndex];
    questionElement.textContent = question.question;
    optionsElement.innerHTML = '';
    
    // 随机排序选项但保持正确答案可识别
    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    
    shuffledOptions.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.className = 'option-btn bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition duration-200';
        button.addEventListener('click', () => checkAnswer(option, question.answer));
        optionsElement.appendChild(button);
    });
}

// 检查答案
function checkAnswer(selectedOption, correctAnswer) {
    clearInterval(timer);
    
    if (selectedOption === correctAnswer) {
        score += 10;
        scoreElement.textContent = score;
    }
    
    currentQuestionIndex++;
    // 短暂延迟后显示下一题
    setTimeout(showQuestion, 1000);
}

// 结束游戏
function endGame() {
    clearInterval(timer);
    gameScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');
    finalScoreElement.textContent = score;
    
    // 保存分数到本地存储
    saveScore(score);
    gameStarted = false;
}

// 保存分数
function saveScore(score) {
    const leaderboard = JSON.parse(localStorage.getItem('geoQuizLeaderboard') || '[]');
    const playerName = prompt('游戏结束！请输入你的名字：', '玩家');
    
    if (playerName) {
        leaderboard.push({
            name: playerName,
            score: score,
            date: new Date().toLocaleString()
        });
        
        // 按分数排序，保留前10名
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > 10) {
            leaderboard.splice(10);
        }
        
        localStorage.setItem('geoQuizLeaderboard', JSON.stringify(leaderboard));
    }
}

// 显示排行榜
function showLeaderboard() {
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    leaderboardScreen.classList.remove('hidden');
    
    // 清空现有列表
    leaderboardList.innerHTML = '';
    
    // 获取并显示排行榜数据
    const leaderboard = JSON.parse(localStorage.getItem('geoQuizLeaderboard') || '[]');
    
    if (leaderboard.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'py-2 text-center text-gray-500';
        emptyItem.textContent = '暂无记录，快来挑战吧！';
        leaderboardList.appendChild(emptyItem);
        return;
    }
    
    leaderboard.forEach((entry, index) => {
        const listItem = document.createElement('li');
        listItem.className = `py-2 px-4 ${index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : index === 2 ? 'bg-amber-100' : ''}`;
        listItem.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-bold">${index + 1}. ${entry.name}</span>
                <span class="text-green-600 font-bold">${entry.score}分</span>
            </div>
            <div class="text-sm text-gray-500">${entry.date}</div>
        `;
        leaderboardList.appendChild(listItem);
    });
}

// 显示开始界面
function showStartScreen() {
    if (gameStarted) {
        if (confirm('确定要退出游戏吗？当前进度将会丢失。')) {
            clearInterval(timer);
            gameStarted = false;
        } else {
            return;
        }
    }
    
    startScreen.classList.remove('hidden');
    endScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden');
}

// 显示错误信息
function showError(message) {
    alert(`错误: ${message}`);
}

// 页面加载时预加载题库（可选）
loadQuestions().catch(error => {
    console.log('预加载题库失败，游戏开始时会再次尝试:', error);
});
    

// 全局错误处理函数
function setupErrorHandling() {
    // 错误队列，用于存储待显示的错误
    const errorQueue = [];
    // 标记当前是否有错误弹窗显示中
    let isErrorShowing = false;
    
    // 创建错误容器元素（如果不存在）
    function createErrorContainer() {
        let container = document.getElementById('error-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'error-container';
            container.className = 'error-container hidden';
            document.body.appendChild(container);
        }
        return container;
    }
    
    // 显示错误提示
    function showError(title, message) {
        // 将错误添加到队列
        errorQueue.push({ title, message });
        
        // 如果当前没有错误显示，处理队列中的第一个错误
        if (!isErrorShowing) {
            processNextError();
        }
    }
    
    // 处理队列中的下一个错误
    function processNextError() {
        if (errorQueue.length === 0) {
            isErrorShowing = false;
            return;
        }
        
        isErrorShowing = true;
        const { title, message } = errorQueue.shift();
        const errorContainer = createErrorContainer();
        
        // 显示错误弹窗
        errorContainer.className = 'error-container';
        errorContainer.innerHTML = `
            <div class="error-title">${title}</div>
            <div class="error-message">${message}</div>
            <button class="error-close">关闭</button>
        `;
        
        // 关闭按钮事件
        const closeBtn = errorContainer.querySelector('.error-close');
        closeBtn.addEventListener('click', () => {
            errorContainer.className = 'error-container hidden';
            // 处理下一个错误
            setTimeout(processNextError, 300);
        });
        
        // 5秒后自动关闭，处理下一个错误
        setTimeout(() => {
            if (errorContainer.className !== 'error-container hidden') {
                errorContainer.className = 'error-container hidden';
                setTimeout(processNextError, 300);
            }
        }, 8000);
    }
    
    // 捕获全局JavaScript错误
    window.addEventListener('error', (event) => {
        event.preventDefault();
        showError('JavaScript错误', `${event.error.message}\n在文件: ${event.filename}\n行号: ${event.lineno}`);
        console.error('全局错误捕获:', event.error);
    });
    
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
        event.preventDefault();
        const error = event.reason;
        showError('异步操作错误', error.message || '发生了未处理的异步错误');
        console.error('未处理的Promise拒绝:', error);
    });
    
    // 自定义错误抛出函数
    window.throwError = (title, message) => {
        showError(title, message);
        console.error(`${title}:`, message);
    };
}

// 游戏核心变量
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
const leaderboardKey = 'leaderboard';
let isAnswering = false;

// 每题固定分值
const POINTS_PER_QUESTION = 10;

// 读取题库并处理（不筛选，全部使用）
async function fetchQuestions() {
    try {
        const res = await fetch('questions.json');
        
        // 检查HTTP错误状态
        if (!res.ok) {
            throw new Error(`加载题库失败: HTTP状态码 ${res.status}`);
        }
        
        let rawQuestions = await res.json();
        
        // 验证题库格式
        if (!Array.isArray(rawQuestions)) {
            throw new Error('题库格式错误，预期为数组');
        }
        
        // 验证题目结构
        rawQuestions.forEach((q, index) => {
            if (!q.question || !q.answer || !Array.isArray(q.options)) {
                throw new Error(`第${index + 1}题格式错误，缺少必要字段`);
            }
        });
        
        // 使用所有题目，不进行难度筛选
        questions = rawQuestions.map((q, idx) => {
            // 确保至少有3个选项
            let opts = q.options.slice();
            while (opts.length < 3) {
                let fakeOption = "选项" + (opts.length + 1);
                if (!opts.includes(fakeOption) && fakeOption !== q.answer) {
                    opts.push(fakeOption);
                }
            }
            return { ...q, options: opts, id: idx + 1 };
        });
        
        if (questions.length === 0) {
            throw new Error('题库中没有题目，请检查questions.json文件');
        }
        
        // 随机打乱题目顺序
        shuffleArray(questions);
        updateQuestionCounter();
    } catch (error) {
        window.throwError('题库加载失败', error.message);
        // 显示重试按钮
        const startMenu = document.getElementById('start-menu');
        if (startMenu) {
            startMenu.innerHTML += `<p style="color: #dc2626;">加载失败: ${error.message}</p>
            <button id="retry-load">重试</button>`;
            document.getElementById('retry-load').addEventListener('click', () => {
                location.reload();
            });
        }
    }
}

// Fisher-Yates 洗牌算法
function shuffleArray(array) {
    try {
        if (!Array.isArray(array)) {
            throw new Error('洗牌函数需要数组参数');
        }
        
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    } catch (error) {
        window.throwError('洗牌错误', error.message);
    }
}

// 选项顺序随机
function shuffleOptions(options) {
    try {
        if (!Array.isArray(options)) {
            throw new Error('选项洗牌需要数组参数');
        }
        
        const arr = options.slice();
        shuffleArray(arr);
        return arr;
    } catch (error) {
        window.throwError('选项处理错误', error.message);
        return options; // 返回原始选项作为备用
    }
}

// 更新题目计数器
function updateQuestionCounter() {
    try {
        const counter = document.getElementById('question-counter');
        if (!counter) {
            throw new Error('未找到题目计数器元素');
        }
        
        counter.textContent = `题目 ${currentQuestionIndex + 1}/${questions.length}`;
    } catch (error) {
        window.throwError('UI更新错误', error.message);
    }
}

// 显示题目和选项
function loadNewQuestion() {
    try {
        if (currentQuestionIndex >= questions.length) {
            endGame();
            return;
        }
        
        const q = questions[currentQuestionIndex];
        if (!q) {
            throw new Error(`未找到第${currentQuestionIndex + 1}题`);
        }
        
        const questionElement = document.getElementById('question');
        const optionsDiv = document.getElementById('options');
        
        if (!questionElement || !optionsDiv) {
            throw new Error('未找到题目或选项容器元素');
        }
        
        questionElement.textContent = `NO.${q.id} ${q.question}`;
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

        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.classList.add('hidden');
            feedback.textContent = '';
        }
        
        updateQuestionCounter();
    } catch (error) {
        window.throwError('加载题目错误', error.message);
    }
}

// 判断答案并显示反馈
function checkAnswer(selected, selectedBtn, allOptions) {
    try {
        if (isAnswering) return;
        isAnswering = true;
        
        const q = questions[currentQuestionIndex];
        if (!q) {
            throw new Error(`无法验证答案，未找到第${currentQuestionIndex + 1}题`);
        }
        
        const feedback = document.getElementById('feedback');
        const optionsDiv = document.getElementById('options');
        
        if (!feedback || !optionsDiv) {
            throw new Error('未找到反馈或选项容器元素');
        }
        
        let feedbackText = '';
        let isCorrect = selected === q.answer;

        // 禁止再次选择
        Array.from(optionsDiv.children).forEach(btn => btn.disabled = true);

        if (isCorrect) {
            score += POINTS_PER_QUESTION;
            selectedBtn.style.background = "linear-gradient(135deg, #48bb78, #38a169)";
            feedbackText = `回答正确！+${POINTS_PER_QUESTION}分`;
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
        
        const scoreElement = document.getElementById('score-value');
        if (scoreElement) {
            scoreElement.textContent = score;
        }
        
        currentQuestionIndex++;
        
        setTimeout(() => {
            isAnswering = false;
            loadNewQuestion();
        }, 1500);
    } catch (error) {
        window.throwError('答案验证错误', error.message);
        isAnswering = false; // 重置状态，避免卡住
    }
}

// 计时进度条
function updateProgressBar() {
    try {
        const progressFill = document.getElementById('progress-fill');
        if (!progressFill) {
            throw new Error('未找到进度条元素');
        }
        
        progressFill.style.width = (timeLeft / 60 * 100) + '%';
    } catch (error) {
        window.throwError('进度条更新错误', error.message);
    }
}

function startGame() {
    try {
        timeLeft = 60;
        score = 0;
        currentQuestionIndex = 0;
        
        const scoreElement = document.getElementById('score-value');
        const timeElement = document.getElementById('time-left');
        
        if (!scoreElement || !timeElement) {
            throw new Error('未找到分数或时间显示元素');
        }
        
        scoreElement.textContent = score;
        timeElement.textContent = timeLeft;
        updateProgressBar();

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            timeElement.textContent = timeLeft;
            updateProgressBar();
            
            if (timeLeft === 0) {
                clearInterval(timerInterval);
                endGame();
            }
        }, 1000);

        loadNewQuestion();
    } catch (error) {
        window.throwError('游戏启动错误', error.message);
        clearInterval(timerInterval); // 确保计时器已停止
    }
}

function endGame() {
    try {
        clearInterval(timerInterval);
        saveScore(score);
        
        const gameElement = document.getElementById('game');
        const gameOverElement = document.getElementById('game-over-menu');
        const finalScoreElement = document.getElementById('final-score');
        
        if (!gameElement || !gameOverElement || !finalScoreElement) {
            throw new Error('未找到游戏结束相关元素');
        }
        
        gameElement.classList.add('hidden');
        gameOverElement.classList.remove('hidden');
        finalScoreElement.textContent = score;
        updateLeaderboard();
    } catch (error) {
        window.throwError('游戏结束处理错误', error.message);
    }
}

function resetGame() {
    try {
        timeLeft = 60;
        score = 0;
        currentQuestionIndex = 0;
        clearInterval(timerInterval);
    } catch (error) {
        window.throwError('游戏重置错误', error.message);
    }
}

function saveScore(newScore) {
    try {
        if (typeof newScore !== 'number' || isNaN(newScore)) {
            throw new Error('保存的分数必须是有效的数字');
        }
        
        let leaderboard;
        try {
            leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
        } catch (e) {
            // 处理localStorage数据损坏的情况
            leaderboard = [];
            window.throwError('排行榜数据修复', '检测到损坏的排行榜数据，已重置');
        }
        
        leaderboard.push(newScore);
        leaderboard.sort((a, b) => b - a);
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard.slice(0, 10)));
    } catch (error) {
        window.throwError('分数保存错误', error.message);
    }
}

function displayLeaderboard() {
    try {
        const leaderboardMenu = document.getElementById('leaderboard-menu');
        const leaderboardList = document.getElementById('leaderboard');
        
        if (!leaderboardMenu || !leaderboardList) {
            throw new Error('未找到排行榜相关元素');
        }
        
        let leaderboard;
        try {
            leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
        } catch (e) {
            leaderboard = [];
            window.throwError('排行榜数据修复', '检测到损坏的排行榜数据，已重置');
        }
        
        leaderboardList.innerHTML = '';
        
        if (leaderboard.length === 0) {
            const li = document.createElement('li');
            li.textContent = '暂无分数记录';
            leaderboardList.appendChild(li);
        } else {
            leaderboard.forEach((score, index) => {
                const li = document.createElement('li');
                li.textContent = `${index + 1}. ${score} 分`;
                leaderboardList.appendChild(li);
            });
        }
        
        document.getElementById('start-menu').classList.add('hidden');
        leaderboardMenu.classList.remove('hidden');
    } catch (error) {
        window.throwError('排行榜显示错误', error.message);
    }
}

function updateLeaderboard() {
    try {
        const leaderboardList = document.getElementById('game-over-leaderboard');
        if (!leaderboardList) {
            throw new Error('未找到游戏结束时的排行榜元素');
        }
        
        let leaderboard;
        try {
            leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
        } catch (e) {
            leaderboard = [];
            window.throwError('排行榜数据修复', '检测到损坏的排行榜数据，已重置');
        }
        
        leaderboardList.innerHTML = '';
        
        if (leaderboard.length === 0) {
            const li = document.createElement('li');
            li.textContent = '暂无分数记录';
            leaderboardList.appendChild(li);
        } else {
            leaderboard.forEach((score, index) => {
                const li = document.createElement('li');
                li.textContent = `${index + 1}. ${score} 分`;
                leaderboardList.appendChild(li);
            });
        }
    } catch (error) {
        window.throwError('游戏结束排行榜错误', error.message);
    }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 先设置错误处理，确保能捕获后续所有错误
        setupErrorHandling();
        
        // 检查必要元素是否存在
        const requiredElements = ['app', 'start-menu', 'game', 'leaderboard-menu', 'game-over-menu'];
        requiredElements.forEach(id => {
            if (!document.getElementById(id)) {
                throw new Error(`缺少必要的页面元素: #${id}`);
            }
        });
        
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
        } else {
            window.throwError('元素缺失', '未找到返回主菜单按钮');
        }
    } catch (error) {
        // 如果初始化错误处理前发生错误，直接显示
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container';
        errorContainer.innerHTML = `
          <div class="error-title">初始化错误</div>
          <div class="error-message">${error.message}</div>
          <button class="error-close" onclick="window.location.reload()">刷新页面</button>
        `;
        document.body.appendChild(errorContainer);
        console.error('初始化错误:', error);
    }
});
    

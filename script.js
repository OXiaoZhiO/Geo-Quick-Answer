// 游戏状态变量
let questions = [];                  // 题库数组
let currentQuestionIndex = 0;        // 当前题目索引
let score = 0;                       // 当前分数
let timeLeft = 60;                   // 剩余时间(秒)
let timerInterval = null;            // 计时器间隔ID
let startTime = null;                // 游戏开始时间
let completionTime = null;           // 游戏完成时间
let correctAnswers = 0;              // 正确答案数量
let incorrectAnswers = 0;            // 错误答案数量
let totalAnswered = 0;               // 总答题数量
const leaderboardKey = 'leaderboard';// 本地存储排行榜的键名
const selectedLibraryKey = 'selectedLibrary'; // 存储选中的题库
let availableLibraries = [           // 可用题库列表
    { id: '1', file: 'data/1.json' },
    { id: '2', file: 'data/2.json' }
];
let currentLibrary = {               // 当前选中的题库
    file: 'data/1.json',
    name: '加载中...',
    questionCount: 0
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 创建解析列表容器
    createExplanationList();
    
    // 绑定按钮事件 - 修复：移除了对不存在的clear-records-btn的绑定
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('view-leaderboard-btn').addEventListener('click', () => {
        viewLeaderboard();
        populateLibraryFilter();
    });
    document.getElementById('back-to-menu-btn').addEventListener('click', backToMenu);
    document.getElementById('restart-game-btn').addEventListener('click', backToMenu); // 返回主界面
    document.getElementById('clear-leaderboard-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('select-library-btn').addEventListener('click', showLibrarySelector);
    document.getElementById('back-from-library-btn').addEventListener('click', hideLibrarySelector);
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    
    // 绑定排行榜筛选事件
    const libraryFilter = document.getElementById('library-filter');
    if (libraryFilter) {
        libraryFilter.addEventListener('change', function() {
            updateLeaderboardDisplay('leaderboard', this.value);
        });
    }
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 预加载当前选中的题库
    loadCurrentLibrary();
});

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.remove('hidden');
    renderLibraryList();
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
}

/**
 * 渲染题库列表
 */
function renderLibraryList() {
    const libraryList = document.getElementById('library-list');
    if (!libraryList) return;
    
    libraryList.innerHTML = '';
    
    // 添加内置题库
    availableLibraries.forEach(library => {
        fetchLibraryInfo(library.file).then(info => {
            const item = document.createElement('div');
            item.className = `library-item ${currentLibrary.file === library.file ? 'selected' : ''}`;
            item.innerHTML = `
                <div>
                    <div>${info.name || library.file}</div>
                    <div class="library-meta">${info.questionCount || '未知'} 题</div>
                </div>
                ${currentLibrary.file === library.file ? '<i class="fas fa-check"></i>' : ''}
            `;
            
            item.addEventListener('click', () => {
                selectLibrary(library.file, info.name, info.questionCount);
            });
            
            libraryList.appendChild(item);
        });
    });
}

/**
 * 选择题库
 * @param {string} filePath - 题库文件路径
 * @param {string} name - 题库名称
 * @param {number} questionCount - 题目数量
 */
function selectLibrary(filePath, name, questionCount) {
    currentLibrary = {
        file: filePath,
        name: name || filePath,
        questionCount: questionCount || 0
    };
    
    // 保存到本地存储
    localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
    
    // 更新当前选择显示
    const libraryNameElement = document.getElementById('current-library-name');
    if (libraryNameElement) {
        libraryNameElement.textContent = currentLibrary.name;
    }
    
    // 重新渲染列表以更新选中状态
    renderLibraryList();
    
    // 加载选中的题库
    loadQuestionsFromFile(currentLibrary.file);
}

/**
 * 从本地存储加载选中的题库
 */
function loadSelectedLibrary() {
    try {
        const savedLibrary = localStorage.getItem(selectedLibraryKey);
        if (savedLibrary) {
            currentLibrary = JSON.parse(savedLibrary);
        }
    } catch (e) {
        console.error('加载保存的题库失败', e);
        // 加载失败时使用默认题库
        currentLibrary = {
            file: 'data/1.json',
            name: '默认题库',
            questionCount: 0
        };
    }
    
    // 更新当前选择显示
    const libraryNameElement = document.getElementById('current-library-name');
    if (libraryNameElement) {
        libraryNameElement.textContent = currentLibrary.name;
    }
}

/**
 * 加载当前选中的题库
 */
function loadCurrentLibrary() {
    // 检查是否是本地file协议
    if (window.location.protocol === 'file:') {
        console.log('检测到本地文件协议，使用文件选择方式加载题库');
        // 不自动加载，等待用户选择
    } else {
        // 网页模式，直接加载
        loadQuestionsFromFile(currentLibrary.file);
    }
}

/**
 * 处理用户选择本地题库文件
 * @param {Event} event - 文件选择事件
 */
function handleLibraryFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = JSON.parse(e.target.result);
            processLibraryContent(content, file.name);
            
            // 保存为当前选中的题库
            currentLibrary = {
                file: file.name,
                name: content.name || file.name,
                questionCount: content.questions ? content.questions.length : 0
            };
            
            localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
            const libraryNameElement = document.getElementById('current-library-name');
            if (libraryNameElement) {
                libraryNameElement.textContent = currentLibrary.name;
            }
            
            // 清空文件输入，允许重新选择同一个文件
            const fileInput = document.getElementById('library-file-input');
            if (fileInput) {
                fileInput.value = '';
            }
        } catch (error) {
            showErrorMessage('解析题库文件失败: ' + error.message);
        }
    };
    reader.readAsText(file);
}

/**
 * 获取题库信息（名称和题数）
 * @param {string} filePath - 题库文件路径
 * @returns {Promise} 包含题库信息的Promise对象
 */
async function fetchLibraryInfo(filePath) {
    try {
        const res = await fetch(filePath);
        if (!res.ok) {
            throw new Error(`加载题库信息失败: HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        return {
            name: content.name || filePath,
            questionCount: content.questions ? content.questions.length : 0
        };
    } catch (error) {
        console.error('获取题库信息失败:', error);
        return {
            name: filePath,
            questionCount: 0
        };
    }
}

/**
 * 从文件加载题库
 * @param {string} filePath - 题库文件路径
 * @returns {Promise} 加载是否成功的Promise对象
 */
async function loadQuestionsFromFile(filePath) {
    try {
        // 检查是否是本地file协议
        if (window.location.protocol === 'file:') {
            // 本地模式，提示用户选择文件
            const fileInput = document.getElementById('library-file-input');
            if (fileInput) {
                fileInput.click();
            }
            return false;
        }
        
        const res = await fetch(filePath);
        if (!res.ok) {
            throw new Error(`加载题库失败: HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        processLibraryContent(content, filePath);
        return true;
    } catch (error) {
        console.error('加载题库错误:', error);
        showErrorMessage(`加载失败: ${error.message}，请尝试选择其他题库`);
        return false;
    }
}

/**
 * 处理题库内容
 * @param {Object} content - 题库内容
 * @param {string} filePath - 题库文件路径
 */
function processLibraryContent(content, filePath) {
    // 验证题库格式
    if (!content.questions || !Array.isArray(content.questions)) {
        throw new Error('题库格式错误，预期包含questions数组');
    }
    
    // 更新当前题库信息
    currentLibrary.name = content.name || filePath;
    currentLibrary.questionCount = content.questions.length;
    
    // 处理每道题，过滤无效题目
    questions = content.questions.map((q, idx) => {
        // 验证题目必要字段
        if (!q.question || !q.answer || !q.options || q.difficulty === undefined) {
            console.warn(`题目ID ${idx+1} 格式不完整，已跳过`);
            return null;
        }
        
        // 根据难度设置选项数量和分数
        const diffConf = {
            1: { options: 3, score: 5 },
            2: { options: 4, score: 10 },
            3: { options: 5, score: 15 },
            4: { options: 6, score: 20 }
        }[q.difficulty] || { options: 3, score: 5 };
        
        // 确保正确答案在选项中
        if (!q.options.includes(q.answer)) {
            q.options.push(q.answer);
            console.warn(`题目ID ${idx+1} 选项中缺少正确答案，已自动添加`);
        }
        
        // 根据难度筛选选项数量，确保包含正确答案
        let opts = [q.answer]; // 先添加正确答案
        const otherOptions = q.options.filter(opt => opt !== q.answer);
        const needed = diffConf.options - 1;
        
        // 随机选择需要的选项
        for (let i = 0; i < needed && otherOptions.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * otherOptions.length);
            opts.push(otherOptions[randomIndex]);
            otherOptions.splice(randomIndex, 1);
        }
        
        return { 
            ...q, 
            options: opts, 
            diffConf, 
            id: idx + 1 
        };
    }).filter(Boolean); // 过滤无效题目
    
    if (questions.length === 0) {
        throw new Error('未加载到有效题目，请检查题库文件');
    }
    
    // 打乱题目顺序
    shuffleArray(questions);
    console.log(`成功加载 ${questions.length} 道题目 (${currentLibrary.name})`);
    
    // 显示成功消息
    showTemporaryMessage(`已加载: ${currentLibrary.name} (${questions.length}题)`);
}

/**
 * 显示临时消息
 * @param {string} message - 消息内容
 */
function showTemporaryMessage(message) {
    const msgElement = document.createElement('div');
    msgElement.className = 'feedback-correct';
    msgElement.style.position = 'fixed';
    msgElement.style.bottom = '20px';
    msgElement.style.left = '50%';
    msgElement.style.transform = 'translateX(-50%)';
    msgElement.style.padding = '10px 20px';
    msgElement.style.borderRadius = '5px';
    msgElement.style.zIndex = '1000';
    msgElement.textContent = message;
    
    document.body.appendChild(msgElement);
    
    // 2秒后自动消失
    setTimeout(() => {
        msgElement.style.opacity = '0';
        msgElement.style.transition = 'opacity 0.5s';
        setTimeout(() => msgElement.remove(), 500);
    }, 2000);
}

/**
 * 创建解析列表容器
 * 用于在电脑端存储和显示所有解析内容
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (!explanationSection) return;
    
    // 创建列表容器
    const listContainer = document.createElement('div');
    listContainer.id = 'explanation-list-container';
    listContainer.className = 'explanation-list-container';
    
    // 创建列表元素
    const list = document.createElement('ul');
    list.id = 'explanation-list';
    list.className = 'explanation-list';
    
    listContainer.appendChild(list);
    explanationSection.appendChild(listContainer);
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .explanation-list-container {
            width: 100%;
            max-height: 60vh;
            overflow-y: auto;
        }
        
        .explanation-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .explanation-item {
            padding: 15px;
            border-radius: 16px;
            animation: fadeIn 0.5s ease-out;
            transform-origin: top;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        @media (max-width: 899px) {
            #explanation-list-container {
                display: none;
            }
            
            #feedback:not(.hidden) {
                display: block !important;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * 添加解析到列表
 * @param {string} content - 解析内容
 * @param {boolean} isCorrect - 是否正确
 */
function addExplanation(content, isCorrect) {
    // 对于移动设备，仍然使用原来的反馈方式
    if (window.innerWidth <= 899) {
        const feedback = document.getElementById('feedback');
        if (feedback) {
            feedback.textContent = content;
            feedback.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
            feedback.classList.remove('hidden');
        }
        return;
    }
    
    // 对于桌面设备，添加到解析列表
    const list = document.getElementById('explanation-list');
    if (!list) return;
    
    // 创建新的解析项
    const item = document.createElement('li');
    item.className = `explanation-item ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
    item.textContent = content;
    
    // 将新解析添加到列表顶部
    if (list.firstChild) {
        list.insertBefore(item, list.firstChild);
    } else {
        list.appendChild(item);
    }
    
    // 隐藏原始反馈元素
    const feedback = document.getElementById('feedback');
    if (feedback) {
        feedback.classList.add('hidden');
    }
    
    // 滚动到顶部以显示最新解析
    list.scrollTop = 0;
}

/**
 * 初始化游戏说明弹窗
 * 设置弹窗的显示、关闭事件监听
 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const showBtn = document.getElementById('show-instructions-btn');
    const closeBtn = document.querySelector('.close-modal');

    // 检查元素是否存在
    if (!modal || !showBtn || !closeBtn) {
        console.warn('游戏说明相关元素不存在');
        return;
    }

    // 显示弹窗
    showBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });

    // 关闭弹窗
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // 点击弹窗外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

/**
 * 更新正确率显示
 * 显示正确/错误/总答题数及正确率
 */
function updateAccuracyDisplay() {
    const accuracyElement = document.getElementById('accuracy-display');
    if (!accuracyElement) return;
    
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    
    // 设置不同颜色显示
    accuracyElement.innerHTML = `
        <span style="color: #38a169;">${correctAnswers}</span>/
        <span style="color: #dc2626;">${incorrectAnswers}</span>/
        <span style="color: #666;">${totalAnswered}</span>-
        <span style="color: #000;">${accuracy}%</span>
    `;
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息内容
 */
function showErrorMessage(message) {
    // 先移除已存在的错误信息
    const existingErrors = document.querySelectorAll('.feedback-incorrect[style*="position: fixed"]');
    existingErrors.forEach(el => el.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'feedback-incorrect';
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '50%';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translate(-50%, -50%)';
    errorDiv.style.padding = '20px';
    errorDiv.style.borderRadius = '10px';
    errorDiv.style.zIndex = '1000';
    errorDiv.style.maxWidth = '90%';
    errorDiv.textContent = message;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭 ×';
    closeBtn.style.marginTop = '15px';
    closeBtn.style.background = 'rgba(255,255,255,0.2)';
    closeBtn.style.color = 'white';
    closeBtn.style.borderRadius = '20px';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => errorDiv.remove();
    errorDiv.appendChild(closeBtn);
    
    document.body.appendChild(errorDiv);
}

/**
 * Fisher-Yates 洗牌算法
 * 随机打乱数组顺序
 * @param {Array} array - 要打乱的数组
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * 随机打乱选项顺序
 * @param {Array} options - 选项数组
 * @returns {Array} 打乱后的选项数组
 */
function shuffleOptions(options) {
    const arr = options.slice();
    shuffleArray(arr);
    return arr;
}

/**
 * 加载新题目
 * 如果题目已完成，结束游戏
 */
function loadNewQuestion() {
    // 如果所有题目都已回答或时间已到，结束游戏
    if (currentQuestionIndex >= questions.length || timeLeft <= 0) {
        endGame();
        return;
    }
    
    const currentQuestion = questions[currentQuestionIndex];
    const questionElement = document.getElementById('question');
    const optionsElement = document.getElementById('options');
    
    if (!questionElement || !optionsElement) return;
    
    // 清空之前的内容
    optionsElement.innerHTML = '';
    
    // 显示问题
    questionElement.textContent = currentQuestion.question;
    
    // 打乱选项顺序并显示
    const shuffledOptions = shuffleOptions(currentQuestion.options);
    shuffledOptions.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        
        // 添加点击事件
        button.addEventListener('click', () => {
            // 禁用所有选项按钮
            document.querySelectorAll('.option-btn').forEach(btn => {
                btn.disabled = true;
                
                // 标记正确和错误答案
                if (btn.textContent === currentQuestion.answer) {
                    btn.classList.add('correct');
                } else if (btn === button) {
                    btn.classList.add('incorrect');
                }
            });
            
            // 判断答案是否正确
            const isCorrect = option === currentQuestion.answer;
            if (isCorrect) {
                score += currentQuestion.diffConf.score;
                correctAnswers++;
                const scoreElement = document.getElementById('score-value');
                if (scoreElement) {
                    scoreElement.textContent = score;
                }
            } else {
                incorrectAnswers++;
            }
            
            totalAnswered++;
            updateAccuracyDisplay();
            
            // 显示解析
            const explanation = currentQuestion.explanation || 
                (isCorrect ? '回答正确！' : `回答错误。正确答案是：${currentQuestion.answer}`);
            addExplanation(`${currentQuestionIndex + 1}. ${currentQuestion.question} - ${explanation}`, isCorrect);
            
            // 延迟加载下一题
            setTimeout(() => {
                currentQuestionIndex++;
                loadNewQuestion();
            }, 1000);
        });
        
        optionsElement.appendChild(button);
    });
}

/**
 * 开始游戏
 */
function startGame() {
    // 检查是否有可用题目
    if (questions.length === 0) {
        showErrorMessage('没有可用题目，请先选择一个有效的题库');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    score = 0;
    currentQuestionIndex = 0;
    timeLeft = 60;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalAnswered = 0;
    startTime = new Date();
    
    // 更新UI
    const scoreElement = document.getElementById('score-value');
    if (scoreElement) {
        scoreElement.textContent = score;
    }
    
    const timeElement = document.getElementById('time-left');
    if (timeElement) {
        timeElement.textContent = timeLeft;
    }
    
    updateAccuracyDisplay();
    
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = '100%';
        progressFill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
    }
    
    // 清空解析列表
    const explanationList = document.getElementById('explanation-list');
    if (explanationList) explanationList.innerHTML = '';
    
    // 隐藏反馈
    const feedback = document.getElementById('feedback');
    if (feedback) {
        feedback.classList.add('hidden');
    }
    
    // 切换界面
    document.getElementById('start-menu').classList.add('hidden');
    const gameScreen = document.getElementById('game');
    if (gameScreen) {
        gameScreen.classList.remove('hidden');
    }
    
    // 启动计时器
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    
    // 加载第一题
    loadNewQuestion();
}

/**
 * 更新计时器
 */
function updateTimer() {
    timeLeft--;
    const timeElement = document.getElementById('time-left');
    if (timeElement) {
        timeElement.textContent = timeLeft;
    }
    
    // 更新进度条
    const progressPercent = (timeLeft / 60) * 100;
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
        
        // 改变进度条颜色表示紧急程度
        if (timeLeft < 10) {
            progressFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        } else if (timeLeft < 20) {
            progressFill.style.background = 'linear-gradient(90deg, #f39c12, #d35400)';
        }
    }
    
    // 时间到，结束游戏
    if (timeLeft <= 0) {
        endGame();
    }
}

/**
 * 结束游戏
 */
function endGame() {
    // 清除计时器
    clearInterval(timerInterval);
    timerInterval = null;
    completionTime = new Date();
    
    // 计算用时
    const timeSpent = Math.round((completionTime - startTime) / 1000);
    
    // 更新最终得分
    const finalScoreElement = document.getElementById('final-score');
    if (finalScoreElement) {
        finalScoreElement.textContent = score;
    }
    
    // 更新答题统计
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    const completionTimeElement = document.getElementById('quiz-completion-time');
    if (completionTimeElement) {
        completionTimeElement.textContent = 
            `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    }
    
    // 保存成绩到排行榜
    saveScore(score, timeSpent, correctAnswers, incorrectAnswers, totalAnswered);
    
    // 更新游戏结束界面的排行榜（只显示当前题库）
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.name);
    
    // 切换到游戏结束界面
    document.getElementById('game').classList.add('hidden');
    const gameOverScreen = document.getElementById('game-over-menu');
    if (gameOverScreen) {
        gameOverScreen.classList.remove('hidden');
    }
}

/**
 * 保存分数到本地存储
 * @param {number} score - 分数
 * @param {number} timeSpent - 用时（秒）
 * @param {number} correct - 正确题数
 * @param {number} incorrect - 错误题数
 * @param {number} total - 总题数
 */
function saveScore(score, timeSpent, correct, incorrect, total) {
    try {
        // 获取现有排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '{}');
        
        // 确保当前题库的数组存在
        if (!leaderboard[currentLibrary.name]) {
            leaderboard[currentLibrary.name] = [];
        }
        
        // 添加新分数记录
        const newScore = {
            score: score,
            date: new Date().toISOString(),
            timeSpent: timeSpent,
            correct: correct,
            incorrect: incorrect,
            total: total
        };
        
        leaderboard[currentLibrary.name].push(newScore);
        
        // 按分数排序，保留前10名
        leaderboard[currentLibrary.name].sort((a, b) => b.score - a.score);
        if (leaderboard[currentLibrary.name].length > 10) {
            leaderboard[currentLibrary.name] = leaderboard[currentLibrary.name].slice(0, 10);
        }
        
        // 保存回本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        
        // 检查是否是新纪录
        const libraryScores = leaderboard[currentLibrary.name];
        if (libraryScores.length === 1 || score >= libraryScores[0].score) {
            setTimeout(() => {
                const celebration = document.getElementById('celebration-message');
                if (celebration) {
                    celebration.classList.remove('hidden');
                    setTimeout(() => {
                        celebration.classList.add('hidden');
                    }, 2000);
                }
            }, 500);
            
            const recordMessage = document.getElementById('record-message');
            if (recordMessage) {
                recordMessage.classList.remove('hidden');
            }
        } else {
            const recordMessage = document.getElementById('record-message');
            if (recordMessage) {
                recordMessage.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('保存分数失败:', error);
        showErrorMessage('保存成绩失败: ' + error.message);
    }
}

/**
 * 显示排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    const leaderboardScreen = document.getElementById('leaderboard-menu');
    if (leaderboardScreen) {
        leaderboardScreen.classList.remove('hidden');
    }
    updateLeaderboardDisplay('leaderboard', 'all');
}

/**
 * 填充题库筛选下拉菜单
 */
function populateLibraryFilter() {
    const filter = document.getElementById('library-filter');
    if (!filter) return;
    
    // 保存当前选中的值
    const currentValue = filter.value;
    
    // 保留"所有题库"选项，清除其他选项
    while (filter.options.length > 1) {
        filter.remove(1);
    }
    
    try {
        // 获取所有记录
        const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '{}');
        
        // 获取所有独特的题库名称
        const libraries = Object.keys(leaderboard);
        
        // 添加到筛选器
        libraries.forEach(library => {
            const option = document.createElement('option');
            option.value = library;
            option.textContent = library;
            filter.appendChild(option);
        });
        
        // 恢复之前的选择
        if (currentValue && filter.querySelector(`option[value="${currentValue}"]`)) {
            filter.value = currentValue;
        }
    } catch (error) {
        console.error('填充题库筛选器失败:', error);
    }
}

/**
 * 更新排行榜显示
 * @param {string} elementId - 排行榜元素ID
 * @param {string} libraryFilter - 题库筛选条件，"all"表示所有题库
 */
function updateLeaderboardDisplay(elementId, libraryFilter) {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    
    try {
        // 获取排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '{}');
        let allScores = [];
        
        // 根据题库筛选
        if (libraryFilter && libraryFilter !== 'all' && leaderboard[libraryFilter]) {
            // 只显示特定题库的分数
            allScores = leaderboard[libraryFilter].map(score => ({
                ...score,
                library: libraryFilter
            }));
        } else {
            // 显示所有题库的分数
            Object.keys(leaderboard).forEach(library => {
                leaderboard[library].forEach(score => {
                    allScores.push({
                        ...score,
                        library: library
                    });
                });
            });
        }
        
        // 按分数排序
        allScores.sort((a, b) => b.score - a.score);
        
        // 只显示前10名
        const topScores = allScores.slice(0, 10);
        
        // 清空现有内容
        leaderboardElement.innerHTML = '';
        
        // 如果没有记录
        if (topScores.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = '暂无记录';
            emptyItem.style.textAlign = 'center';
            leaderboardElement.appendChild(emptyItem);
            return;
        }
        
        // 添加每条记录
        topScores.forEach((entry, index) => {
            // 解析日期
            const date = new Date(entry.date);
            const formattedDate = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div>
                    <strong>${index + 1}. ${entry.score}分</strong>
                    <div class="library-meta">${formattedDate} · ${entry.library}</div>
                </div>
                <div>${entry.correct}/${entry.incorrect}/${entry.total}</div>
            `;
            
            // 为第一名添加特殊样式
            if (index === 0) {
                listItem.classList.add('first-place');
            }
            
            leaderboardElement.appendChild(listItem);
        });
    } catch (error) {
        console.error('更新排行榜失败:', error);
        leaderboardElement.innerHTML = '<li>加载排行榜失败</li>';
    }
}

/**
 * 返回主菜单
 */
function backToMenu() {
    // 清除计时器
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 隐藏所有界面，显示主菜单
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById('start-menu').classList.remove('hidden');
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    const filter = document.getElementById('library-filter');
    const currentFilter = filter ? filter.value : 'all';
    
    // 根据当前筛选条件决定清空范围
    if (currentFilter === 'all') {
        if (confirm('确定要清空所有题库的排行榜记录吗？此操作不可恢复。')) {
            localStorage.removeItem(leaderboardKey);
        }
    } else {
        if (confirm(`确定要清空"${currentFilter}"题库的所有记录吗？此操作不可恢复。`)) {
            try {
                let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '{}');
                if (leaderboard[currentFilter]) {
                    delete leaderboard[currentFilter];
                    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
                }
            } catch (error) {
                console.error('清空特定题库记录失败:', error);
                showErrorMessage('清空记录失败: ' + error.message);
            }
        }
    }
    
    // 更新显示
    updateLeaderboardDisplay('leaderboard', currentFilter);
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.name);
    
    // 更新筛选器
    populateLibraryFilter();
}

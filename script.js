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
    { id: '2', file: 'data/2.json' },
    { id: '3', file: 'data/3.json' },
    { id: '4', file: 'data/4.json' },
    { id: '5', file: 'data/5.json' }
    
];
let currentLibrary = {               // 当前选中的题库
    file: 'data/1.json',
    name: '加载中...',
    questionCount: 0
};

// 错误提示函数
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 15px; background: #ff4444; color: white; border-radius: 5px; z-index: 9999;';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

// 成功提示函数
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 15px; background: #00C851; color: white; border-radius: 5px; z-index: 9999;';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 创建解析列表容器
    createExplanationList();
    
    // 绑定按钮事件（添加存在性检查）
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', startGame);
    }

    const viewLeaderboardBtn = document.getElementById('view-leaderboard-btn');
    if (viewLeaderboardBtn) {
        viewLeaderboardBtn.addEventListener('click', () => {
            viewLeaderboard();
            populateLibraryFilter();
        });
    }

    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', backToMenu);
    }

    const restartGameBtn = document.getElementById('restart-game-btn');
    if (restartGameBtn) {
        restartGameBtn.addEventListener('click', backToMenu); // 返回主界面
    }

    const clearLeaderboardBtn = document.getElementById('clear-leaderboard-btn');
    if (clearLeaderboardBtn) {
        clearLeaderboardBtn.addEventListener('click', clearLeaderboard);
    }

    const clearRecordsBtn = document.getElementById('clear-records-btn');
    if (clearRecordsBtn) {
        clearRecordsBtn.addEventListener('click', clearLeaderboard);
    }

    const selectLibraryBtn = document.getElementById('select-library-btn');
    if (selectLibraryBtn) {
        selectLibraryBtn.addEventListener('click', showLibrarySelector);
    }

    const backFromLibraryBtn = document.getElementById('back-from-library-btn');
    if (backFromLibraryBtn) {
        backFromLibraryBtn.addEventListener('click', hideLibrarySelector);
    }

    const libraryFileInput = document.getElementById('library-file-input');
    if (libraryFileInput) {
        libraryFileInput.addEventListener('change', handleLibraryFileSelect);
    }

    // 游戏说明按钮事件绑定
    const showInstructionsBtn = document.getElementById('show-instructions-btn');
    if (showInstructionsBtn) {
        showInstructionsBtn.addEventListener('click', () => {
            const instructionsModal = document.getElementById('instructions-modal');
            if (instructionsModal) {
                instructionsModal.classList.remove('hidden');
            }
        });
    }

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
 * 初始化游戏说明弹窗关闭逻辑
 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const closeBtn = document.querySelector('.close-modal');
    
    // 关闭按钮事件
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
    
    // 点击模态框外部关闭
    if (modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    const startMenu = document.getElementById('start-menu');
    const librarySelector = document.getElementById('library-selector');
    if (startMenu && librarySelector) {
        startMenu.classList.add('hidden');
        librarySelector.classList.remove('hidden');
        renderLibraryList();
    } else {
        showErrorMessage('无法切换到题库选择界面');
    }
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    const librarySelector = document.getElementById('library-selector');
    const startMenu = document.getElementById('start-menu');
    if (librarySelector && startMenu) {
        librarySelector.classList.add('hidden');
        startMenu.classList.remove('hidden');
    } else {
        showErrorMessage('无法返回主菜单');
    }
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
    const currentLibraryName = document.getElementById('current-library-name');
    if (currentLibraryName) {
        currentLibraryName.textContent = currentLibrary.name;
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
    const currentLibraryName = document.getElementById('current-library-name');
    if (currentLibraryName) {
        currentLibraryName.textContent = currentLibrary.name;
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
            const currentLibraryName = document.getElementById('current-library-name');
            if (currentLibraryName) {
                currentLibraryName.textContent = currentLibrary.name;
            }
            
            // 清空文件输入，允许重新选择同一个文件
            const libraryFileInput = document.getElementById('library-file-input');
            if (libraryFileInput) {
                libraryFileInput.value = '';
            }
            
            showSuccessMessage(`成功加载题库: ${currentLibrary.name}`);
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
            const libraryFileInput = document.getElementById('library-file-input');
            if (libraryFileInput) {
                libraryFileInput.click();
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
        
        return {
            ...q,
            score: diffConf.score
        };
    }).filter(Boolean); // 过滤空值（无效题目）

    // 处理完成后更新界面提示
    if (questions.length === 0) {
        showErrorMessage('题库中没有有效题目，请检查文件格式');
    } else {
        showSuccessMessage(`题库加载成功，共 ${questions.length} 道题`);
    }
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (!explanationSection) return;
    
    // 检查解析列表是否已存在
    let explanationsList = document.getElementById('explanations-list');
    if (!explanationsList) {
        explanationsList = document.createElement('div');
        explanationsList.id = 'explanations-list';
        explanationsList.className = 'explanations-container';
        explanationSection.appendChild(explanationsList);
    }
}

/**
 * 开始游戏
 */
function startGame() {
    // 检查是否有可用题目
    if (questions.length === 0) {
        showErrorMessage('没有加载任何题库，请先选择题库');
        return;
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 显示游戏界面，隐藏开始菜单
    const startMenu = document.getElementById('start-menu');
    const gameScreen = document.getElementById('game');
    
    if (startMenu && gameScreen) {
        startMenu.classList.add('hidden');
        gameScreen.classList.remove('hidden');
    }
    
    // 记录开始时间
    startTime = new Date();
    
    // 显示第一题
    displayQuestion(currentQuestionIndex);
    
    // 启动计时器
    startTimer();
}

/**
 * 重置游戏状态
 */
function resetGameState() {
    currentQuestionIndex = 0;
    score = 0;
    timeLeft = 60;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalAnswered = 0;
    
    // 重置UI
    const scoreDisplay = document.getElementById('score');
    const timeDisplay = document.getElementById('time-left');
    const progressFill = document.querySelector('.progress-fill');
    
    if (scoreDisplay) scoreDisplay.textContent = '0';
    if (timeDisplay) timeDisplay.textContent = timeLeft;
    if (progressFill) progressFill.style.width = '100%';
    
    // 清除之前的计时器
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/**
 * 显示当前题目
 * @param {number} index - 题目索引
 */
function displayQuestion(index) {
    if (index >= questions.length) {
        // 如果所有题目都已回答，结束游戏
        endGame();
        return;
    }
    
    const question = questions[index];
    const questionElement = document.getElementById('question');
    const optionsElement = document.getElementById('options');
    const feedbackElement = document.getElementById('feedback');
    
    // 清空之前的内容
    if (optionsElement) optionsElement.innerHTML = '';
    if (feedbackElement) {
        feedbackElement.textContent = '';
        feedbackElement.className = '';
    }
    
    // 显示题目
    if (questionElement) {
        questionElement.textContent = question.question;
    }
    
    // 生成选项按钮
    if (optionsElement) {
        // 随机排序选项，避免答案位置固定
        const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
        
        shuffledOptions.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            
            button.addEventListener('click', () => {
                checkAnswer(option, question.answer, question.explanation, question.score);
            });
            
            optionsElement.appendChild(button);
        });
    }
    
    // 更新进度条
    updateProgress();
}

/**
 * 检查答案是否正确
 * @param {string} userAnswer - 用户选择的答案
 * @param {string} correctAnswer - 正确答案
 * @param {string} explanation - 解析
 * @param {number} points - 本题分值
 */
function checkAnswer(userAnswer, correctAnswer, explanation, points) {
    // 禁用所有选项按钮，防止重复点击
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach(button => {
        button.disabled = true;
        
        // 标记正确和错误答案
        if (button.textContent === correctAnswer) {
            button.classList.add('correct');
        } else if (button.textContent === userAnswer) {
            button.classList.add('incorrect');
        }
    });
    
    // 显示反馈
    const feedbackElement = document.getElementById('feedback');
    if (feedbackElement) {
        if (userAnswer === correctAnswer) {
            feedbackElement.textContent = `正确！解析：${explanation}`;
            feedbackElement.className = 'feedback-correct';
            score += points;
            correctAnswers++;
        } else {
            feedbackElement.textContent = `错误！正确答案是：${correctAnswer}。解析：${explanation}`;
            feedbackElement.className = 'feedback-incorrect';
            incorrectAnswers++;
        }
        
        // 更新分数显示
        const scoreDisplay = document.getElementById('score');
        if (scoreDisplay) {
            scoreDisplay.textContent = score.toString();
        }
        
        totalAnswered++;
        
        // 添加到解析列表
        addToExplanationList(questions[currentQuestionIndex].question, userAnswer, correctAnswer, userAnswer === correctAnswer);
        
        // 延迟显示下一题
        setTimeout(() => {
            currentQuestionIndex++;
            displayQuestion(currentQuestionIndex);
        }, 2000);
    }
}

/**
 * 添加到解析列表
 */
function addToExplanationList(question, userAnswer, correctAnswer, isCorrect) {
    const explanationsList = document.getElementById('explanations-list');
    if (!explanationsList) return;
    
    const item = document.createElement('div');
    item.className = `explanation-item ${isCorrect ? 'correct' : 'incorrect'}`;
    item.innerHTML = `
        <div class="explanation-question">${question}</div>
        <div class="explanation-answers">
            <span>你的答案: ${userAnswer}</span>
            <span>正确答案: ${correctAnswer}</span>
        </div>
    `;
    
    // 添加淡入动画
    item.style.opacity = '0';
    explanationsList.prepend(item);
    
    // 触发重排后添加动画
    setTimeout(() => {
        item.style.transition = 'opacity 0.3s ease';
        item.style.opacity = '1';
    }, 10);
    
    // 限制列表长度，只保留最近的10条
    if (explanationsList.children.length > 10) {
        explanationsList.removeChild(explanationsList.lastChild);
    }
}

/**
 * 启动计时器
 */
function startTimer() {
    const timeDisplay = document.getElementById('time-left');
    const progressFill = document.querySelector('.progress-fill');
    
    if (!timeDisplay || !progressFill) return;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timeDisplay.textContent = timeLeft;
        
        // 更新进度条
        const progressPercent = (timeLeft / 60) * 100;
        progressFill.style.width = `${progressPercent}%`;
        
        // 改变进度条颜色表示紧急程度
        if (timeLeft < 10) {
            progressFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        } else if (timeLeft < 20) {
            progressFill.style.background = 'linear-gradient(90deg, #f39c12, #d35400)';
        }
        
        // 时间到，结束游戏
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

/**
 * 更新进度
 */
function updateProgress() {
    const progressText = document.getElementById('progress');
    if (progressText) {
        progressText.textContent = `${currentQuestionIndex + 1}/${questions.length}`;
    }
}

/**
 * 结束游戏
 */
function endGame() {
    // 记录完成时间
    completionTime = new Date();
    
    // 清除计时器
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 隐藏游戏界面，显示结束界面
    const gameScreen = document.getElementById('game');
    const gameOverMenu = document.getElementById('game-over-menu');
    
    if (gameScreen && gameOverMenu) {
        gameScreen.classList.add('hidden');
        gameOverMenu.classList.remove('hidden');
    }
    
    // 显示最终分数
    const finalScoreElement = document.getElementById('final-score');
    if (finalScoreElement) {
        finalScoreElement.textContent = score.toString();
    }
    
    // 显示答题统计
    const completionStats = document.getElementById('quiz-completion-time');
    if (completionStats) {
        const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
        completionStats.textContent = `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    }
    
    // 保存成绩到排行榜
    saveScoreToLeaderboard();
    
    // 显示当前题库的排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
}

/**
 * 保存分数到排行榜
 */
function saveScoreToLeaderboard() {
    try {
        // 获取当前排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 创建新记录
        const newRecord = {
            score: score,
            date: new Date().toISOString(),
            library: currentLibrary.file,
            libraryName: currentLibrary.name,
            correct: correctAnswers,
            incorrect: incorrectAnswers,
            total: totalAnswered,
            timeTaken: startTime ? Math.round((completionTime - startTime) / 1000) : 0
        };
        
        // 添加新记录
        leaderboard.push(newRecord);
        
        // 按分数排序，保留前10名
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > 10) {
            leaderboard = leaderboard.slice(0, 10);
        }
        
        // 保存回本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        
        // 检查是否是新纪录
        checkNewRecord(leaderboard, newRecord);
        
    } catch (error) {
        console.error('保存分数到排行榜失败:', error);
        showErrorMessage('无法保存成绩到排行榜');
    }
}

/**
 * 检查是否是新纪录
 */
function checkNewRecord(leaderboard, newRecord) {
    // 找到新记录的位置
    const newRecordIndex = leaderboard.findIndex(record => record.date === newRecord.date);
    
    // 如果是前三名，显示庆祝消息
    if (newRecordIndex !== -1 && newRecordIndex < 3) {
        const celebrationModal = document.getElementById('celebration-message');
        if (celebrationModal) {
            celebrationModal.classList.remove('hidden');
            
            // 3秒后隐藏庆祝消息
            setTimeout(() => {
                celebrationModal.classList.add('hidden');
            }, 3000);
        }
    }
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    const startMenu = document.getElementById('start-menu');
    const leaderboardMenu = document.getElementById('leaderboard-menu');
    
    if (startMenu && leaderboardMenu) {
        startMenu.classList.add('hidden');
        leaderboardMenu.classList.remove('hidden');
    }
    
    // 更新排行榜显示
    updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter')?.value || 'all');
}

/**
 * 填充题库筛选下拉框
 */
function populateLibraryFilter() {
    const libraryFilter = document.getElementById('library-filter');
    if (!libraryFilter) return;
    
    // 保存当前选中的值
    const currentValue = libraryFilter.value;
    
    // 清除现有选项（保留"所有题库"）
    while (libraryFilter.options.length > 1) {
        libraryFilter.remove(1);
    }
    
    // 获取所有独特的题库
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const libraries = new Set();
    
    // 添加内置题库
    availableLibraries.forEach(library => {
        libraries.add(library.file);
    });
    
    // 添加排行榜中出现的题库
    leaderboard.forEach(record => {
        libraries.add(record.library);
    });
    
    // 添加到下拉框
    libraries.forEach(library => {
        // 查找题库名称
        let libraryName = library;
        
        // 检查是否是内置题库
        const builtInLib = availableLibraries.find(lib => lib.file === library);
        if (builtInLib) {
            fetchLibraryInfo(library).then(info => {
                const option = Array.from(libraryFilter.options).find(opt => opt.value === library);
                if (option) {
                    option.textContent = info.name || library;
                }
            });
        } else {
            // 尝试从记录中找到名称
            const recordWithName = leaderboard.find(record => record.library === library);
            if (recordWithName && recordWithName.libraryName) {
                libraryName = recordWithName.libraryName;
            }
        }
        
        const option = document.createElement('option');
        option.value = library;
        option.textContent = libraryName;
        libraryFilter.appendChild(option);
    });
    
    // 恢复之前的选择
    if (currentValue) {
        libraryFilter.value = currentValue;
    }
}

/**
 * 更新排行榜显示
 * @param {string} listId - 列表元素ID
 * @param {string} filter - 筛选条件（题库文件路径或"all"）
 */
function updateLeaderboardDisplay(listId, filter) {
    const leaderboardList = document.getElementById(listId);
    if (!leaderboardList) return;
    
    // 清空列表
    leaderboardList.innerHTML = '';
    
    // 获取排行榜数据
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    
    // 应用筛选
    if (filter && filter !== 'all') {
        leaderboard = leaderboard.filter(record => record.library === filter);
    }
    
    // 如果没有记录
    if (leaderboard.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = '暂无记录';
        emptyItem.style.textAlign = 'center';
        leaderboardList.appendChild(emptyItem);
        return;
    }
    
    // 显示记录
    leaderboard.forEach((record, index) => {
        const item = document.createElement('li');
        
        // 格式化日期
        const date = new Date(record.date);
        const formattedDate = date.toLocaleString();
        
        // 为前三名添加特殊样式
        let rankIcon = '';
        if (index === 0) rankIcon = '<i class="fas fa-crown" style="color: #f1c40f;"></i>';
        else if (index === 1) rankIcon = '<i class="fas fa-medal" style="color: #c0c0c0;"></i>';
        else if (index === 2) rankIcon = '<i class="fas fa-medal" style="color: #cd7f32;"></i>';
        else rankIcon = `<span class="rank">${index + 1}</span>`;
        
        item.innerHTML = `
            <div class="rank-container">${rankIcon}</div>
            <div class="score-details">
                <div>${record.libraryName || record.library}</div>
                <div class="small-text">${formattedDate} · 正确率: ${record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0}%</div>
            </div>
            <div class="score-value">${record.score}分</div>
        `;
        
        leaderboardList.appendChild(item);
    });
}

/**
 * 返回主菜单
 */
function backToMenu() {
    // 隐藏所有界面，显示开始菜单
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    const startMenu = document.getElementById('start-menu');
    if (startMenu) {
        startMenu.classList.remove('hidden');
    }
    
    // 清除计时器
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        
        // 更新排行榜显示
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter')?.value || 'all');
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
        
        showSuccessMessage('排行榜已清空');
    }
}

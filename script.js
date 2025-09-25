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
    
    // 绑定按钮事件
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('view-leaderboard-btn').addEventListener('click', () => {
        viewLeaderboard();
        populateLibraryFilter();
    });
    
    // 绑定悬浮按钮事件
    document.getElementById('float-back-btn').addEventListener('click', backToMenu);
    document.getElementById('float-clear-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('float-restart-btn').addEventListener('click', backToMenu);
    
    document.getElementById('select-library-btn').addEventListener('click', showLibrarySelector);
    document.getElementById('back-from-library-btn').addEventListener('click', hideLibrarySelector);
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 初始化知识卡片
    setupKnowledgeCard();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 预加载当前选中的题库
    loadCurrentLibrary();
});

/**
 * 设置知识卡片
 */
function setupKnowledgeCard() {
    const card = document.getElementById('knowledge-card');
    card.addEventListener('click', () => {
        // 添加淡入淡出效果
        const content = card.querySelector('.knowledge-content');
        content.style.opacity = '0';
        
        setTimeout(() => {
            showRandomQuestionInKnowledgeCard();
            content.style.opacity = '1';
        }, 300);
    });
    
    // 初始加载一个随机题目
    setTimeout(showRandomQuestionInKnowledgeCard, 1000);
}

/**
 * 在知识卡片中显示随机题目
 */
function showRandomQuestionInKnowledgeCard() {
    if (questions.length === 0) {
        document.querySelector('.knowledge-id').textContent = 'NO.暂无数据';
        document.querySelector('.knowledge-question').textContent = '请先选择并加载题库';
        document.querySelector('.knowledge-answer').classList.add('hidden');
        document.querySelector('.knowledge-explanation').classList.add('hidden');
        return;
    }
    
    // 随机选择一题
    const randomIndex = Math.floor(Math.random() * questions.length);
    const question = questions[randomIndex];
    
    // 更新卡片内容
    document.querySelector('.knowledge-id').textContent = `NO.${question.id || (randomIndex + 1)}`;
    document.querySelector('.knowledge-question').textContent = question.question;
    
    const answerEl = document.querySelector('.knowledge-answer');
    const explanationEl = document.querySelector('.knowledge-explanation');
    
    answerEl.textContent = `答案：${question.answer}`;
    answerEl.classList.remove('hidden');
    
    if (question.explanation) {
        explanationEl.textContent = `解析：${question.explanation}`;
        explanationEl.classList.remove('hidden');
    } else {
        explanationEl.classList.add('hidden');
    }
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.remove('hidden');
    renderLibraryList();
    
    // 显示悬浮返回按钮
    showFloatingButtons(['float-back-btn']);
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
    
    // 隐藏悬浮按钮
    hideAllFloatingButtons();
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
    document.getElementById('current-library-name').textContent = currentLibrary.name;
    
    // 重新渲染列表以更新选中状态
    renderLibraryList();
    
    // 加载选中的题库
    loadQuestionsFromFile(currentLibrary.file).then(success => {
        if (success) {
            // 加载成功后更新知识卡片
            showRandomQuestionInKnowledgeCard();
        }
    });
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
    document.getElementById('current-library-name').textContent = currentLibrary.name;
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
        loadQuestionsFromFile(currentLibrary.file).then(success => {
            if (success) {
                showRandomQuestionInKnowledgeCard();
            }
        });
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
            document.getElementById('current-library-name').textContent = currentLibrary.name;
            
            // 清空文件输入，允许重新选择同一个文件
            document.getElementById('library-file-input').value = '';
            
            // 更新知识卡片
            showRandomQuestionInKnowledgeCard();
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
            document.getElementById('library-file-input').click();
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
        
        // 确保选项数量符合难度要求
        if (q.options.length < diffConf.options) {
            console.warn(`题目ID ${idx+1} 选项数量不足，已补充空选项`);
            while (q.options.length < diffConf.options) {
                q.options.push(`选项${q.options.length + 1}`);
            }
        } else if (q.options.length > diffConf.options) {
            q.options = q.options.slice(0, diffConf.options);
        }
        
        // 随机排序选项
        const shuffledOptions = [...q.options];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
        }
        
        return {
            id: q.id || idx + 1,
            question: q.question,
            answer: q.answer,
            options: shuffledOptions,
            difficulty: q.difficulty,
            explanation: q.explanation || '无解析',
            score: diffConf.score
        };
    }).filter(q => q !== null); // 过滤掉无效题目
    
    if (questions.length === 0) {
        throw new Error('未找到有效的题目，请检查题库文件');
    }
    
    console.log(`成功加载题库: ${currentLibrary.name}，共 ${questions.length} 题`);
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        explanationSection.innerHTML = '<div id="explanation-list"></div>';
    }
}

/**
 * 开始游戏
 */
function startGame() {
    if (questions.length === 0) {
        showErrorMessage('请先选择并加载题库');
        return;
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 显示游戏界面
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    
    // 显示左上角返回按钮
    showFloatingButtons(['float-back-btn']);
    
    // 开始计时
    startTime = new Date();
    startTimer();
    
    // 显示第一题
    showNextQuestion();
}

/**
 * 重置游戏状态
 */
function resetGameState() {
    score = 0;
    timeLeft = 60;
    currentQuestionIndex = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalAnswered = 0;
    completionTime = null;
    
    // 重置UI
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('feedback').classList.add('hidden');
    document.getElementById('explanation-list').innerHTML = '';
    updateAccuracyDisplay();
}

/**
 * 开始计时器
 */
function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('time-left').textContent = timeLeft;
        document.getElementById('progress-fill').style.width = `${(timeLeft / 60) * 100}%`;
        
        // 改变进度条颜色，时间越少越红
        const progressFill = document.getElementById('progress-fill');
        if (timeLeft < 10) {
            progressFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        } else if (timeLeft < 20) {
            progressFill.style.background = 'linear-gradient(90deg, #f39c12, #d35400)';
        }
        
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/**
 * 显示下一题
 */
function showNextQuestion() {
    // 如果所有题目都已答完，重新随机排序题库继续
    if (currentQuestionIndex >= questions.length) {
        shuffleQuestions();
        currentQuestionIndex = 0;
    }
    
    const question = questions[currentQuestionIndex];
    const questionElement = document.getElementById('question');
    const optionsElement = document.getElementById('options');
    
    // 清空之前的内容
    optionsElement.innerHTML = '';
    
    // 显示题目
    questionElement.textContent = question.question;
    
    // 设置选项容器样式（6个选项时用两列布局）
    if (question.options.length === 6) {
        optionsElement.classList.add('six-options');
    } else {
        optionsElement.classList.remove('six-options');
    }
    
    // 显示选项
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.addEventListener('click', () => checkAnswer(option, question));
        optionsElement.appendChild(button);
    });
    
    // 隐藏反馈
    document.getElementById('feedback').classList.add('hidden');
}

/**
 * 随机打乱题目顺序
 */
function shuffleQuestions() {
    for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
    }
}

/**
 * 检查答案
 * @param {string} selectedOption - 选中的选项
 * @param {Object} question - 当前题目对象
 */
function checkAnswer(selectedOption, question) {
    // 禁用所有选项按钮
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach(button => {
        button.disabled = true;
        // 标记正确和错误答案
        if (button.textContent === question.answer) {
            button.classList.add('correct');
        } else if (button.textContent === selectedOption) {
            button.classList.add('incorrect');
        }
    });
    
    // 记录答题结果
    totalAnswered++;
    let isCorrect = selectedOption === question.answer;
    
    if (isCorrect) {
        correctAnswers++;
        score += question.score;
        document.getElementById('score-value').textContent = score;
        showFeedback(true, question);
    } else {
        incorrectAnswers++;
        showFeedback(false, question);
    }
    
    // 更新正确率显示
    updateAccuracyDisplay();
    
    // 添加到解析列表
    addToExplanationList(question, isCorrect);
    
    // 延迟显示下一题
    currentQuestionIndex++;
    setTimeout(showNextQuestion, 2000);
}

/**
 * 显示答案反馈
 * @param {boolean} isCorrect - 是否正确
 * @param {Object} question - 题目对象
 */
function showFeedback(isCorrect, question) {
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.classList.remove('hidden', 'feedback-correct', 'feedback-incorrect');
    
    if (isCorrect) {
        feedbackElement.classList.add('feedback-correct');
        feedbackElement.innerHTML = `正确！+${question.score}分<br>${question.explanation}`;
    } else {
        feedbackElement.classList.add('feedback-incorrect');
        feedbackElement.innerHTML = `错误！正确答案是：${question.answer}<br>${question.explanation}`;
    }
}

/**
 * 更新正确率显示
 */
function updateAccuracyDisplay() {
    if (totalAnswered === 0) {
        document.getElementById('accuracy-display').textContent = '0/0/0-0%';
        return;
    }
    
    const accuracy = Math.round((correctAnswers / totalAnswered) * 100);
    document.getElementById('accuracy-display').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
}

/**
 * 添加到解析列表
 * @param {Object} question - 题目对象
 * @param {boolean} isCorrect - 是否正确
 */
function addToExplanationList(question, isCorrect) {
    const listElement = document.getElementById('explanation-list');
    const item = document.createElement('div');
    item.className = 'explanation-item';
    
    item.innerHTML = `
        <strong>${currentQuestionIndex + 1}. ${question.question}</strong>
        <div>你的答案: ${isCorrect ? '<span style="color: #27ae60;">正确</span>' : '<span style="color: #c0392b;">错误</span>'}</div>
        <div>正确答案: ${question.answer}</div>
    `;
    
    // 添加到列表顶部
    listElement.insertBefore(item, listElement.firstChild);
    
    // 自动滚动到顶部
    listElement.scrollTop = 0;
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
    
    // 更新游戏结束界面
    document.getElementById('final-score').textContent = score;
    
    // 更新答题统计
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 保存成绩
    saveScore(score, correctAnswers, incorrectAnswers, totalAnswered, timeSpent);
    
    // 显示游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    
    // 更新游戏结束界面的排行榜（仅当前题库）
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
    
    // 更新悬浮按钮
    showFloatingButtons(['float-back-btn', 'float-restart-btn', 'float-clear-btn']);
}

/**
 * 保存分数到本地存储
 */
function saveScore(score, correct, incorrect, total, timeSpent) {
    // 获取当前排行榜数据
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    
    // 创建新分数记录
    const newScore = {
        score: score,
        correct: correct,
        incorrect: incorrect,
        total: total,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        timeSpent: timeSpent,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        library: currentLibrary.file,
        libraryName: currentLibrary.name
    };
    
    // 添加新分数
    leaderboard.push(newScore);
    
    // 按分数排序，保留前100名
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > 100) {
        leaderboard = leaderboard.slice(0, 100);
    }
    
    // 保存回本地存储
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
    
    // 检查是否是当前题库的新纪录
    const libraryScores = leaderboard.filter(item => item.library === currentLibrary.file);
    if (libraryScores.length <= 1 || score >= libraryScores[0].score) {
        document.getElementById('record-message').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('celebration-message').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('celebration-message').classList.add('hidden');
            }, 2000);
        }, 500);
    } else {
        document.getElementById('record-message').classList.add('hidden');
    }
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
    
    // 显示悬浮按钮
    showFloatingButtons(['float-back-btn', 'float-clear-btn']);
}

/**
 * 更新排行榜显示
 * @param {string} listId - 列表元素ID
 * @param {string} libraryFilter - 题库筛选条件，'all'表示所有题库
 */
function updateLeaderboardDisplay(listId, libraryFilter) {
    const leaderboardList = document.getElementById(listId);
    if (!leaderboardList) return;
    
    // 获取排行榜数据
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    
    // 根据筛选条件过滤
    let filteredScores = leaderboard;
    if (libraryFilter && libraryFilter !== 'all') {
        filteredScores = leaderboard.filter(item => item.library === libraryFilter);
    }
    
    // 清空列表
    leaderboardList.innerHTML = '';
    
    // 没有数据时显示提示
    if (filteredScores.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = '暂无记录';
        emptyItem.style.textAlign = 'center';
        leaderboardList.appendChild(emptyItem);
        return;
    }
    
    // 添加列表项
    filteredScores.forEach((item, index) => {
        const listItem = document.createElement('li');
        
        // 为前三名添加特殊样式
        let medal = '';
        if (index === 0) medal = '<i class="fas fa-medal" style="color: #ffd700;"></i>';
        if (index === 1) medal = '<i class="fas fa-medal" style="color: #c0c0c0;"></i>';
        if (index === 2) medal = '<i class="fas fa-medal" style="color: #cd7f32;"></i>';
        
        // 构建列表项内容
        listItem.innerHTML = `
            <div>
                <strong>${index + 1}</strong>. ${medal} ${item.score}分
                ${libraryFilter === 'all' ? `<div class="library-name-small">${item.libraryName || item.library}</div>` : ''}
            </div>
            <div>
                <small>${item.date} ${item.time}</small><br>
                <small>${item.accuracy}% 正确率</small>
            </div>
        `;
        
        leaderboardList.appendChild(listItem);
    });
}

/**
 * 填充题库筛选下拉框
 */
function populateLibraryFilter() {
    const filterSelect = document.getElementById('library-filter');
    if (!filterSelect) return;
    
    // 保存当前选中的值
    const currentValue = filterSelect.value;
    
    // 清除现有选项（保留"所有题库"）
    while (filterSelect.options.length > 1) {
        filterSelect.remove(1);
    }
    
    // 获取所有独特的题库
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const libraries = new Map();
    
    // 添加当前选中的题库
    libraries.set(currentLibrary.file, currentLibrary.name);
    
    // 添加排行榜中出现的题库
    leaderboard.forEach(item => {
        if (!libraries.has(item.library)) {
            libraries.set(item.library, item.libraryName || item.library);
        }
    });
    
    // 添加内置题库
    availableLibraries.forEach(library => {
        if (!libraries.has(library.file)) {
            fetchLibraryInfo(library.file).then(info => {
                libraries.set(library.file, info.name || library.file);
                addLibraryOption(filterSelect, library.file, info.name || library.file);
            });
        } else {
            addLibraryOption(filterSelect, library.file, libraries.get(library.file));
        }
    });
    
    // 恢复选中值
    if (currentValue && filterSelect.querySelector(`option[value="${currentValue}"]`)) {
        filterSelect.value = currentValue;
    }
}

/**
 * 向下拉框添加题库选项
 */
function addLibraryOption(selectElement, value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    selectElement.appendChild(option);
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
    }
}

/**
 * 返回主菜单
 */
function backToMenu() {
    // 停止计时器（如果正在运行）
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 隐藏所有界面，显示主菜单
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById('start-menu').classList.remove('hidden');
    
    // 隐藏所有悬浮按钮
    hideAllFloatingButtons();
    
    // 隐藏庆祝弹窗
    document.getElementById('celebration-message').classList.add('hidden');
}

/**
 * 设置游戏说明弹窗
 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const btn = document.getElementById('show-instructions-btn');
    const span = document.getElementsByClassName('close-modal')[0];
    
    // 打开弹窗
    btn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    });
    
    // 关闭弹窗
    span.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    });
    
    // 点击弹窗外部关闭
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    });
}

/**
 * 显示指定的悬浮按钮
 * @param {Array} buttonIds - 按钮ID数组
 */
function showFloatingButtons(buttonIds) {
    // 先隐藏所有按钮
    hideAllFloatingButtons();
    
    // 显示指定按钮
    buttonIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('hidden');
        }
    });
}

/**
 * 隐藏所有悬浮按钮
 */
function hideAllFloatingButtons() {
    document.querySelectorAll('.float-btn').forEach(btn => {
        btn.classList.add('hidden');
    });
}

/**
 * 显示错误消息
 * @param {string} message - 错误消息
 */
function showErrorMessage(message) {
    alert(message);
}

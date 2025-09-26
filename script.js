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
let explanationItems = [];           // 解析记录
let currentKnowledgeCard = null;     // 当前知识卡片内容

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
    document.getElementById('back-to-menu-btn').addEventListener('click', backToMenu);
    document.getElementById('restart-game-btn').addEventListener('click', backToMenu); // 返回主界面
    document.getElementById('clear-leaderboard-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('select-library-btn').addEventListener('click', showLibrarySelector);
    document.getElementById('back-from-library-btn').addEventListener('click', hideLibrarySelector);
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    
    // 绑定悬浮按钮事件
    document.getElementById('floating-back-btn').addEventListener('click', backToMenu);
    document.getElementById('floating-clear-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('floating-leaderboard-btn').addEventListener('click', () => {
        viewLeaderboard();
        populateLibraryFilter();
    });
    
    // 绑定知识卡片点击事件
    document.getElementById('knowledge-card').addEventListener('click', loadRandomKnowledge);
    
    // 绑定拖放事件
    const uploadArea = document.querySelector('.custom-upload-area');
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 尝试动态获取data文件夹中的题库
    if (window.location.protocol !== 'file:') {
        discoverDataLibraries();
    } else {
        // 本地模式，隐藏内置题库列表，只显示上传选项
        showNotification('info', '本地模式：请通过上传按钮选择data文件夹中的题库');
    }
    
    // 预加载当前选中的题库
    loadCurrentLibrary();
    
    // 初始加载知识卡片
    loadRandomKnowledge();
});

/**
 * 动态发现data文件夹中的题库文件
 */
async function discoverDataLibraries() {
    // 由于没有后端，我们尝试加载可能的文件名
    // 实际应用中，这应该通过后端API实现
    const possibleFiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    availableLibraries = [];
    
    for (const num of possibleFiles) {
        const filePath = `data/${num}.json`;
        try {
            const response = await fetch(filePath, { method: 'HEAD' });
            if (response.ok) {
                availableLibraries.push({ id: num.toString(), file: filePath });
            }
        } catch (error) {
            console.log(`文件 ${filePath} 不存在`);
        }
    }
    
    renderLibraryList();
    showNotification('success', `已发现 ${availableLibraries.length} 个题库`);
}

/**
 * 处理拖放事件 - 拖动悬停
 */
function handleDragOver(e) {
    e.preventDefault();
    const uploadArea = document.querySelector('.custom-upload-area');
    uploadArea.classList.add('dragover');
}

/**
 * 处理拖放事件 - 拖动离开
 */
function handleDragLeave() {
    const uploadArea = document.querySelector('.custom-upload-area');
    uploadArea.classList.remove('dragover');
}

/**
 * 处理拖放事件 - 放置文件
 */
function handleDrop(e) {
    e.preventDefault();
    const uploadArea = document.querySelector('.custom-upload-area');
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json' || file.name.endsWith('.json')) {
        handleDroppedLibraryFile(file);
    } else {
        showNotification('error', '请上传JSON格式的题库文件');
    }
}

/**
 * 处理拖放的题库文件
 */
function handleDroppedLibraryFile(file) {
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
            
            showNotification('success', `已加载题库: ${currentLibrary.name}`);
            loadRandomKnowledge();
        } catch (error) {
            showNotification('error', '解析题库文件失败: ' + error.message);
        }
    };
    reader.readAsText(file);
}

/**
 * 显示提示通知
 * @param {string} type - 通知类型: success, error, warning, info
 * @param {string} message - 通知消息
 */
function showNotification(type, message) {
    console.log(`${type}: ${message}`);
    
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // 根据类型选择图标
    let icon = 'info-circle';
    switch(type) {
        case 'success': icon = 'check-circle'; break;
        case 'error': icon = 'exclamation-circle'; break;
        case 'warning': icon = 'exclamation-triangle'; break;
    }
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
        <button class="close-btn">&times;</button>
    `;
    
    container.appendChild(notification);
    
    // 关闭按钮事件
    notification.querySelector('.close-btn').addEventListener('click', () => {
        notification.style.opacity = 0;
        setTimeout(() => notification.remove(), 300);
    });
    
    // 3秒后自动关闭
    setTimeout(() => {
        notification.style.opacity = 0;
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    // 确保通知不重叠，只保留最多5个通知
    const notifications = container.querySelectorAll('.notification');
    if (notifications.length > 5) {
        notifications[0].remove();
    }
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.remove('hidden');
    renderLibraryList();
    
    // 本地模式下隐藏内置题库列表
    if (window.location.protocol === 'file:') {
        document.getElementById('library-list').style.display = 'none';
    } else {
        document.getElementById('library-list').style.display = 'flex';
    }
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
    document.getElementById('current-library-name').textContent = currentLibrary.name;
    
    // 重新渲染列表以更新选中状态
    renderLibraryList();
    
    // 加载选中的题库
    loadQuestionsFromFile(currentLibrary.file);
    
    // 更新知识卡片
    loadRandomKnowledge();
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
        showNotification('error', '加载保存的题库失败，将使用默认题库');
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
            document.getElementById('current-library-name').textContent = currentLibrary.name;
            
            // 清空文件输入，允许重新选择同一个文件
            document.getElementById('library-file-input').value = '';
            
            showNotification('success', `已加载题库: ${currentLibrary.name}`);
            loadRandomKnowledge();
        } catch (error) {
            showNotification('error', '解析题库文件失败: ' + error.message);
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
            throw new Error(`HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        return {
            name: content.name || filePath,
            questionCount: content.questions ? content.questions.length : 0
        };
    } catch (error) {
        console.error(`获取题库信息失败 (${filePath}):`, error);
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
            throw new Error(`HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        processLibraryContent(content, filePath);
        showNotification('success', `题库加载成功: ${currentLibrary.name} (${currentLibrary.questionCount}题)`);
        return true;
    } catch (error) {
        console.error('加载题库错误:', error);
        showNotification('error', `加载失败: ${error.message}，请尝试选择其他题库`);
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
            id: q.id || idx + 1,
            question: q.question,
            answer: q.answer,
            options: q.options.slice(0, diffConf.options),
            difficulty: q.difficulty,
            score: diffConf.score,
            explanation: q.explanation || '无解析'
        };
    }).filter(q => q !== null); // 过滤掉无效题目
    
    // 打乱题目顺序
    questions = shuffleArray(questions);
    
    if (questions.length === 0) {
        throw new Error('题库中没有有效的题目');
    }
}

/**
 * 打乱数组顺序
 * @param {Array} array - 要打乱的数组
 * @returns {Array} 打乱后的数组
 */
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        explanationSection.innerHTML = '';
        explanationItems = [];
    }
}

/**
 * 开始游戏
 */
function startGame() {
    if (questions.length === 0) {
        showNotification('warning', '请先选择并加载一个有效的题库');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    currentQuestionIndex = 0;
    score = 0;
    timeLeft = 60;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalAnswered = 0;
    startTime = new Date();
    explanationItems = [];
    
    // 显示游戏界面，隐藏其他界面
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.add('hidden');
    document.getElementById('game-over-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    
    // 更新UI
    updateScoreDisplay();
    updateAccuracyDisplay();
    document.getElementById('progress-fill').style.width = '100%';
    
    // 创建解析列表
    createExplanationList();
    
    // 显示第一题
    showQuestion(questions[currentQuestionIndex]);
    
    // 启动计时器
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    
    // 显示悬浮按钮
    document.querySelector('.floating-controls').style.display = 'flex';
}

/**
 * 显示题目
 * @param {Object} question - 题目对象
 */
function showQuestion(question) {
    // 清空反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.classList.add('hidden');
    
    // 显示题目
    const questionElement = document.getElementById('question');
    questionElement.textContent = `NO.${question.id} ${question.question}`;
    
    // 显示选项
    const optionsElement = document.getElementById('options');
    optionsElement.innerHTML = '';
    
    // 打乱选项顺序
    const shuffledOptions = shuffleArray([...question.options]);
    
    shuffledOptions.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.addEventListener('click', () => {
            checkAnswer(question, option, button);
        });
        optionsElement.appendChild(button);
    });
}

/**
 * 检查答案
 * @param {Object} question - 题目对象
 * @param {string} selectedOption - 选中的选项
 * @param {HTMLElement} button - 选项按钮元素
 */
function checkAnswer(question, selectedOption, button) {
    // 禁用所有选项按钮
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => {
        btn.disabled = true;
        // 标记正确答案
        if (btn.textContent === question.answer) {
            btn.classList.add('correct');
        }
    });
    
    // 检查是否正确
    const isCorrect = selectedOption === question.answer;
    
    // 更新分数和统计
    if (isCorrect) {
        score += question.score;
        correctAnswers++;
        button.classList.add('correct');
    } else {
        incorrectAnswers++;
        button.classList.add('incorrect');
    }
    
    totalAnswered++;
    
    // 更新UI
    updateScoreDisplay();
    updateAccuracyDisplay();
    
    // 显示反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.textContent = isCorrect 
        ? `正确！+${question.score}分` 
        : `错误。正确答案是：${question.answer}`;
    feedbackElement.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
    feedbackElement.classList.remove('hidden');
    
    // 添加到解析记录
    addExplanation(question, isCorrect);
    
    // 延迟显示下一题
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length && timeLeft > 0) {
            showQuestion(questions[currentQuestionIndex]);
        } else if (timeLeft > 0) {
            // 如果题目答完但时间还有剩余
            showNotification('info', '已完成所有题目！');
            endGame();
        }
    }, 1500);
}

/**
 * 添加解析记录
 * @param {Object} question - 题目对象
 * @param {boolean} isCorrect - 是否回答正确
 */
function addExplanation(question, isCorrect) {
    const explanationSection = document.querySelector('.explanation-section');
    if (!explanationSection) return;
    
    const explanationItem = document.createElement('div');
    explanationItem.className = `explanation-item ${isCorrect ? 'correct' : 'incorrect'}`;
    explanationItem.innerHTML = `
        <div>第${totalAnswered}题：${isCorrect ? '回答正确' : '回答错误'}</div>
        <div>题目：NO.${question.id} ${question.question}</div>
        <div>解析：${question.explanation}</div>
    `;
    
    explanationSection.prepend(explanationItem);
    explanationItems.push({
        questionId: question.id,
        questionText: question.question,
        isCorrect: isCorrect,
        explanation: question.explanation
    });
}

/**
 * 更新计时器
 */
function updateTimer() {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
    
    // 更新进度条
    const progressPercent = (timeLeft / 60) * 100;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;
    
    // 改变进度条颜色表示紧急程度
    const progressFill = document.getElementById('progress-fill');
    if (timeLeft < 10) {
        progressFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    } else if (timeLeft < 20) {
        progressFill.style.background = 'linear-gradient(90deg, #f39c12, #d35400)';
    }
    
    // 时间到，结束游戏
    if (timeLeft <= 0) {
        endGame();
    }
}

/**
 * 更新分数显示
 */
function updateScoreDisplay() {
    document.getElementById('score-value').textContent = score;
}

/**
 * 更新正确率显示
 */
function updateAccuracyDisplay() {
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('accuracy-display').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
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
    const isNewRecord = saveScore(score, correctAnswers, incorrectAnswers, totalAnswered, timeSpent);
    
    // 显示游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    
    // 显示当前题库的排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
    
    // 如果是新纪录，显示庆祝信息
    if (isNewRecord) {
        document.getElementById('record-message').classList.remove('hidden');
        document.getElementById('celebration-message').classList.remove('hidden');
        
        // 3秒后隐藏庆祝信息
        setTimeout(() => {
            document.getElementById('celebration-message').classList.add('hidden');
        }, 3000);
    } else {
        document.getElementById('record-message').classList.add('hidden');
        document.getElementById('celebration-message').classList.add('hidden');
    }
}

/**
 * 保存分数到本地存储
 * @param {number} score - 分数
 * @param {number} correct - 正确数量
 * @param {number} incorrect - 错误数量
 * @param {number} total - 总答题数
 * @param {number} timeSpent - 用时(秒)
 * @returns {boolean} 是否创造了新纪录
 */
function saveScore(score, correct, incorrect, total, timeSpent) {
    try {
        // 获取现有排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 检查是否已有相同记录（防止重复）
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();
        
        // 创建新记录
        const newRecord = {
            score: score,
            correct: correct,
            incorrect: incorrect,
            total: total,
            date: dateStr,
            time: timeStr,
            timestamp: now.getTime(),
            library: currentLibrary.file,
            libraryName: currentLibrary.name,
            explanations: explanationItems // 保存解析信息
        };
        
        // 检查是否已存在相同时间戳的记录（防止重复提交）
        const duplicate = leaderboard.some(record => 
            record.timestamp === newRecord.timestamp && 
            record.library === newRecord.library
        );
        
        if (duplicate) {
            console.log('检测到重复记录，已跳过保存');
            return false;
        }
        
        // 添加新记录
        leaderboard.push(newRecord);
        
        // 按分数排序，保留前100条记录
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > 100) {
            leaderboard = leaderboard.slice(0, 100);
        }
        
        // 保存到本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        
        // 检查是否是当前题库的新纪录
        const libraryRecords = leaderboard.filter(record => record.library === currentLibrary.file);
        const isNewRecord = libraryRecords.length === 1 || score > libraryRecords[1].score;
        
        return isNewRecord;
    } catch (error) {
        console.error('保存分数失败:', error);
        showNotification('error', '保存成绩失败: ' + error.message);
        return false;
    }
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
    
    // 清空选中记录的解析
    document.getElementById('selected-record-explanation').innerHTML = 
        '<p>请选择一条记录查看解析</p>';
}

/**
 * 更新排行榜显示
 * @param {string} elementId - 排行榜元素ID
 * @param {string} libraryFilter - 题库筛选条件
 */
function updateLeaderboardDisplay(elementId, libraryFilter) {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    
    try {
        // 获取排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 根据题库筛选
        if (libraryFilter && libraryFilter !== 'all') {
            leaderboard = leaderboard.filter(record => record.library === libraryFilter);
        }
        
        // 按分数排序
        leaderboard.sort((a, b) => b.score - a.score);
        
        // 显示排行榜
        leaderboardElement.innerHTML = '';
        
        if (leaderboard.length === 0) {
            leaderboardElement.innerHTML = '<li>暂无记录</li>';
            return;
        }
        
        leaderboard.forEach((record, index) => {
            const accuracy = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div>
                    <strong>${index + 1}. ${record.score}分</strong>
                    ${libraryFilter === 'all' ? `<div class="library-name-small">${record.libraryName || record.library}</div>` : ''}
                    <div>${record.date} ${record.time}</div>
                    <div>正确率: ${accuracy}% (${record.correct}/${record.incorrect}/${record.total})</div>
                </div>
            `;
            
            // 添加点击事件查看解析
            listItem.addEventListener('click', () => {
                displayRecordExplanation(record);
            });
            
            leaderboardElement.appendChild(listItem);
        });
    } catch (error) {
        console.error('更新排行榜失败:', error);
        leaderboardElement.innerHTML = '<li>加载排行榜失败</li>';
    }
}

/**
 * 显示选中记录的解析
 * @param {Object} record - 排行榜记录
 */
function displayRecordExplanation(record) {
    const explanationElement = document.getElementById('selected-record-explanation');
    if (!explanationElement || !record.explanations || record.explanations.length === 0) {
        explanationElement.innerHTML = '<p>该记录没有解析信息</p>';
        return;
    }
    
    let html = '<div class="explanation-list">';
    record.explanations.forEach((item, index) => {
        html += `
            <div class="explanation-item ${item.isCorrect ? 'correct' : 'incorrect'}">
                <div>第${index + 1}题：${item.isCorrect ? '回答正确' : '回答错误'}</div>
                <div>题目：NO.${item.questionId} ${item.questionText}</div>
                <div>解析：${item.explanation}</div>
            </div>
        `;
    });
    html += '</div>';
    
    explanationElement.innerHTML = html;
}

/**
 * 填充题库筛选下拉框
 */
function populateLibraryFilter() {
    const filterElement = document.getElementById('library-filter');
    if (!filterElement) return;
    
    // 保存当前选中的值
    const currentValue = filterElement.value;
    
    // 清空现有选项（保留"所有题库"）
    filterElement.innerHTML = '<option value="all">所有题库</option>';
    
    try {
        // 获取所有记录中的独特题库
        const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        const libraries = new Map();
        
        // 添加内置题库
        availableLibraries.forEach(library => {
            libraries.set(library.file, library.file);
        });
        
        // 添加记录中的题库
        leaderboard.forEach(record => {
            libraries.set(record.library, record.libraryName || record.library);
        });
        
        // 添加到下拉框
        libraries.forEach((name, file) => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = name;
            filterElement.appendChild(option);
        });
        
        // 恢复选中值
        if (currentValue && filterElement.querySelector(`option[value="${currentValue}"]`)) {
            filterElement.value = currentValue;
        } else if (leaderboard.length > 0) {
            // 默认选中当前题库
            filterElement.value = currentLibrary.file;
        }
    } catch (error) {
        console.error('填充题库筛选失败:', error);
    }
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
        showNotification('info', '排行榜记录已清空');
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
    document.getElementById('game').classList.add('hidden');
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.add('hidden');
    document.getElementById('game-over-menu').classList.add('hidden');
    document.getElementById('celebration-message').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
}

/**
 * 初始化游戏说明弹窗
 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const showBtn = document.getElementById('show-instructions-btn');
    const closeBtn = document.querySelector('.close-modal');
    
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
 * 加载随机知识点到知识卡片
 */
function loadRandomKnowledge() {
    const cardContent = document.querySelector('.knowledge-content');
    
    if (questions.length === 0) {
        cardContent.innerHTML = '<p>请先选择一个题库以加载知识点</p>';
        return;
    }
    
    // 随机选择一题
    const randomIndex = Math.floor(Math.random() * questions.length);
    const randomQuestion = questions[randomIndex];
    
    // 添加淡入淡出效果
    cardContent.style.opacity = '0';
    
    setTimeout(() => {
        cardContent.innerHTML = `
            <p><strong>NO.${randomQuestion.id} ${randomQuestion.question}</strong></p>
            <p><strong>答案：</strong>${randomQuestion.answer}</p>
            <p><strong>解析：</strong>${randomQuestion.explanation}</p>
        `;
        cardContent.style.opacity = '1';
        currentKnowledgeCard = randomQuestion;
    }, 300);
}

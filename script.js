// 游戏状态变量
let questions = [];                  // 题库数组
let shuffledQuestions = [];          // 打乱顺序的题库
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
let currentExplanations = [];        // 当前答题的解析记录
let isLoading = true;                // 是否正在加载

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 显示加载界面
    showLoadingScreen();
    
    // 创建解析列表容器
    createExplanationList();
    
    // 绑定按钮事件
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('view-leaderboard-btn').addEventListener('click', () => {
        viewLeaderboard();
        populateLibraryFilter();
        showClearButton(true);
    });
    
    document.getElementById('restart-game-btn').addEventListener('click', backToMenu); // 返回主界面
    
    document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('select-library-btn').addEventListener('click', showLibrarySelector);
    document.getElementById('back-from-library-btn').addEventListener('click', hideLibrarySelector);
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    document.getElementById('show-instructions-btn').addEventListener('click', () => {
        document.getElementById('instructions-modal').classList.remove('hidden');
    });
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('instructions-modal').classList.add('hidden');
    });
    
    // 全局返回按钮
    document.getElementById('global-back-btn').addEventListener('click', backToMenu);
    document.getElementById('global-clear-btn').addEventListener('click', clearLeaderboard);
    
    // 知识卡片点击事件
    document.getElementById('knowledge-card').addEventListener('click', showRandomKnowledge);
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 绑定排行榜项点击事件
    document.getElementById('leaderboard').addEventListener('click', function(e) {
        const listItem = e.target.closest('li');
        if (listItem && listItem.dataset.recordId) {
            showRecordExplanation(listItem.dataset.recordId);
        }
    });
    
    // 初始化拖放上传
    initDragAndDrop();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 预加载当前选中的题库
    loadCurrentLibrary().then(() => {
        // 加载完成后隐藏加载界面
        hideLoadingScreen();
        isLoading = false;
        
        // 显示随机知识
        if (questions.length > 0) {
            showRandomKnowledge();
        }
    }).catch(error => {
        showErrorMessage('初始化题库失败: ' + error.message);
        hideLoadingScreen();
        isLoading = false;
    });
});

/**
 * 显示加载界面
 */
function showLoadingScreen() {
    document.getElementById('loading-screen').classList.remove('hidden');
}

/**
 * 隐藏加载界面
 */
function hideLoadingScreen() {
    document.getElementById('loading-screen').classList.add('hidden');
}

/**
 * 初始化拖放上传功能
 */
function initDragAndDrop() {
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.getElementById('library-file-input');
    const browseLink = document.querySelector('.browse-link');
    
    // 浏览文件链接点击
    browseLink.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
    });
    
    // 拖放事件
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#3498db';
        uploadArea.style.background = 'rgba(52, 152, 219, 0.1)';
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#bdc3c7';
        uploadArea.style.background = 'transparent';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#bdc3c7';
        uploadArea.style.background = 'transparent';
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                handleDroppedFile(file);
            } else {
                showErrorMessage('请上传JSON格式的题库文件');
            }
        }
    });
}

/**
 * 处理拖放的文件
 */
function handleDroppedFile(file) {
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
            
            showSuccessMessage(`成功加载题库: ${currentLibrary.name}`);
        } catch (error) {
            showErrorMessage('解析题库文件失败: ' + error.message);
        }
    };
    reader.readAsText(file);
}

/**
 * 显示/隐藏清空按钮
 */
function showClearButton(show) {
    const clearBtn = document.getElementById('global-clear-btn');
    if (show) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }
}

/**
 * 显示通知消息
 */
function showNotification(message, type = 'info', duration = 3000) {
    console.log(`${type}: ${message}`);
    
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        ${message}
        <button class="close">&times;</button>
    `;
    
    container.appendChild(notification);
    
    // 关闭按钮事件
    notification.querySelector('.close').addEventListener('click', () => {
        notification.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
    });
    
    // 自动消失
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
}

/**
 * 显示成功消息
 */
function showSuccessMessage(message, duration = 3000) {
    showNotification(message, 'success', duration);
}

/**
 * 显示错误消息
 */
function showErrorMessage(message, duration = 5000) {
    showNotification(message, 'error', duration);
}

/**
 * 显示信息消息
 */
function showInfoMessage(message, duration = 3000) {
    showNotification(message, 'info', duration);
}

/**
 * 显示警告消息
 */
function showWarningMessage(message, duration = 4000) {
    showNotification(message, 'warning', duration);
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.remove('hidden');
    renderLibraryList();
    showClearButton(false);
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
    showClearButton(false);
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
            showSuccessMessage(`已选择题库: ${currentLibrary.name}`);
            showRandomKnowledge();
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
        showErrorMessage('加载保存的题库失败，将使用默认题库');
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
async function loadCurrentLibrary() {
    // 检查是否是本地file协议
    if (window.location.protocol === 'file:') {
        console.log('检测到本地文件协议，使用文件选择方式加载题库');
        // 仅在有本地存储的选中题库时尝试加载
        if (currentLibrary && currentLibrary.file && currentLibrary.file.includes('.json')) {
            return loadQuestionsFromFile(currentLibrary.file);
        }
        return false;
    } else {
        // 网页模式，直接加载
        return loadQuestionsFromFile(currentLibrary.file);
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
            
            showSuccessMessage(`已加载题库: ${currentLibrary.name}`);
            
            // 清空文件输入，允许重新选择同一个文件
            document.getElementById('library-file-input').value = '';
            
            // 显示随机知识
            showRandomKnowledge();
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
            throw new Error(`HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        return {
            name: content.name || filePath.split('/').pop().replace('.json', ''),
            questionCount: content.questions ? content.questions.length : 0
        };
    } catch (error) {
        console.error('获取题库信息失败:', error);
        return {
            name: filePath.split('/').pop().replace('.json', ''),
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
        // 显示加载状态
        showLoadingScreen();
        
        // 检查是否是本地file协议
        if (window.location.protocol === 'file:') {
            // 本地模式，提示用户选择文件
            const fileInput = document.getElementById('library-file-input');
            fileInput.click();
            hideLoadingScreen();
            return false;
        }
        
        const res = await fetch(filePath);
        if (!res.ok) {
            throw new Error(`HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        processLibraryContent(content, filePath);
        
        hideLoadingScreen();
        return true;
    } catch (error) {
        console.error('加载题库错误:', error);
        showErrorMessage(`加载失败: ${error.message}，请尝试选择其他题库`);
        hideLoadingScreen();
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
    currentLibrary.name = content.name || filePath.split('/').pop().replace('.json', '');
    currentLibrary.questionCount = content.questions.length;
    
    // 处理每道题，过滤无效题目
    questions = content.questions.filter((q, idx) => {
        // 验证题目必要字段
        if (!q.question || !q.answer || !q.options || q.difficulty === undefined) {
            console.warn(`题目ID ${idx+1} 格式不完整，已跳过`);
            return false;
        }
        
        // 确保正确答案在选项中
        if (!q.options.includes(q.answer)) {
            q.options.push(q.answer);
            console.warn(`题目ID ${q.id || idx+1} 选项中缺少正确答案，已自动添加`);
        }
        
        return true;
    });
    
    // 打乱题目顺序
    shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    
    if (questions.length === 0) {
        throw new Error('题库中没有有效的题目');
    }
    
    showSuccessMessage(`题库加载完成，共 ${questions.length} 题`);
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        explanationSection.innerHTML = `
            <div class="card explanation-card">
                <h3>答题记录</h3>
                <div id="explanation-list"></div>
            </div>
        `;
    }
}

/**
 * 开始游戏
 */
function startGame() {
    if (questions.length === 0) {
        showErrorMessage('请先选择一个有效的题库');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    score = 0;
    timeLeft = 60;
    currentQuestionIndex = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalAnswered = 0;
    currentExplanations = [];
    
    // 打乱题目顺序
    shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    
    // 更新UI
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('explanation-list').innerHTML = '';
    
    // 显示全局返回按钮
    showClearButton(false);
    
    // 显示第一题
    showNextQuestion();
    
    // 开始计时
    startTime = new Date();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

/**
 * 显示下一题
 */
function showNextQuestion() {
    // 检查是否还有题目
    if (currentQuestionIndex >= shuffledQuestions.length) {
        // 如果题目答完了，重新打乱题目继续
        shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
        currentQuestionIndex = 0;
    }
    
    const question = shuffledQuestions[currentQuestionIndex];
    currentQuestionIndex++;
    
    // 根据难度设置选项数量
    const optionCounts = {1: 3, 2: 4, 3: 5, 4: 6};
    const optionCount = optionCounts[question.difficulty] || 3;
    
    // 确保有足够的选项，如果不够则使用所有可用选项
    let availableOptions = [...new Set(question.options)]; // 去重
    if (availableOptions.length < optionCount) {
        console.warn(`题目ID ${question.id} 选项不足，使用所有可用选项`);
    }
    
    // 随机选择选项，但确保正确答案在其中
    let selectedOptions = [question.answer];
    while (selectedOptions.length < Math.min(optionCount, availableOptions.length)) {
        const randomOption = availableOptions[Math.floor(Math.random() * availableOptions.length)];
        if (!selectedOptions.includes(randomOption)) {
            selectedOptions.push(randomOption);
        }
    }
    
    // 打乱选项顺序
    selectedOptions.sort(() => Math.random() - 0.5);
    
    // 显示题目
    const questionElement = document.getElementById('question');
    questionElement.innerHTML = `NO.${question.id} ${question.question}`;
    
    // 显示选项
    const optionsElement = document.getElementById('options');
    optionsElement.innerHTML = '';
    
    selectedOptions.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.addEventListener('click', () => {
            checkAnswer(question, option, optionElement);
        });
        optionsElement.appendChild(optionElement);
    });
    
    // 隐藏反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.classList.add('hidden');
}

/**
 * 检查答案
 * @param {Object} question - 题目对象
 * @param {string} selectedOption - 选中的选项
 * @param {HTMLElement} optionElement - 选项元素
 */
function checkAnswer(question, selectedOption, optionElement) {
    // 禁用所有选项
    const allOptions = document.querySelectorAll('.option');
    allOptions.forEach(opt => {
        opt.style.pointerEvents = 'none';
        // 标记正确答案
        if (opt.textContent === question.answer) {
            opt.classList.add('correct');
        }
    });
    
    // 检查是否正确
    const isCorrect = selectedOption === question.answer;
    if (isCorrect) {
        correctAnswers++;
        // 根据难度加分
        const scores = {1: 5, 2: 10, 3: 15, 4: 20};
        const points = scores[question.difficulty] || 5;
        score += points;
        document.getElementById('score-value').textContent = score;
        optionElement.classList.add('correct');
    } else {
        incorrectAnswers++;
        optionElement.classList.add('incorrect');
    }
    
    totalAnswered++;
    
    // 更新正确率显示
    updateAccuracyDisplay();
    
    // 显示反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.textContent = isCorrect ? 
        `正确！加${scores[question.difficulty] || 5}分` : 
        `错误。正确答案是：${question.answer}`;
    feedbackElement.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
    feedbackElement.classList.remove('hidden');
    
    // 记录解析
    const explanationText = `第${totalAnswered}题：${isCorrect ? '回答正确' : '回答错误'}
题目：NO.${question.id} ${question.question}
解析：${question.explanation || '无解析'}`;
    
    currentExplanations.push({
        questionId: question.id,
        questionText: question.question,
        isCorrect: isCorrect,
        explanation: question.explanation || '无解析',
        text: explanationText
    });
    
    // 显示解析（最新的在最上面）
    const explanationList = document.getElementById('explanation-list');
    const explanationItem = document.createElement('div');
    explanationItem.className = 'explanation-item';
    explanationItem.textContent = explanationText;
    explanationList.insertBefore(explanationItem, explanationList.firstChild);
    
    // 滚动到最新解析
    explanationItem.scrollIntoView({behavior: 'smooth', block: 'start'});
    
    // 延迟显示下一题
    setTimeout(showNextQuestion, 1500);
}

/**
 * 更新计时器
 */
function updateTimer() {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
    document.getElementById('progress-fill').style.width = `${(timeLeft / 60) * 100}%`;
    
    // 时间到，结束游戏
    if (timeLeft <= 0) {
        endGame();
    }
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
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    document.getElementById('final-score').textContent = score;
    
    // 更新答题统计
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 保存记录
    const isNewRecord = saveScore(score, correctAnswers, incorrectAnswers, totalAnswered);
    
    // 显示当前题库排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.name);
    
    // 如果是新纪录，显示庆祝信息
    if (isNewRecord) {
        document.getElementById('record-message').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('celebration-message').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('celebration-message').classList.add('hidden');
            }, 3000);
        }, 500);
    } else {
        document.getElementById('record-message').classList.add('hidden');
    }
    
    // 显示全局返回按钮
    showClearButton(false);
}

/**
 * 保存分数到本地存储
 * @param {number} score - 分数
 * @param {number} correct - 正确数量
 * @param {number} incorrect - 错误数量
 * @param {number} total - 总数量
 * @returns {boolean} 是否是新纪录
 */
function saveScore(score, correct, incorrect, total) {
    try {
        // 获取现有排行榜
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 创建新记录
        const newRecord = {
            id: Date.now(), // 使用时间戳作为唯一ID
            score: score,
            correct: correct,
            incorrect: incorrect,
            total: total,
            date: new Date().toLocaleString(),
            library: currentLibrary.name,
            explanations: currentExplanations
        };
        
        // 检查是否已存在相同记录（防止重复）
        const duplicate = leaderboard.some(record => 
            record.score === score &&
            record.correct === correct &&
            record.incorrect === incorrect &&
            record.total === total &&
            record.library === currentLibrary.name &&
            Math.abs(record.id - newRecord.id) < 30000 // 30秒内的相同记录视为重复
        );
        
        if (duplicate) {
            console.log('检测到重复记录，已跳过保存');
            return false;
        }
        
        // 添加新记录
        leaderboard.push(newRecord);
        
        // 按分数排序，保留前100名
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > 100) {
            leaderboard = leaderboard.slice(0, 100);
        }
        
        // 保存回本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        
        // 检查是否是当前题库的新纪录
        const libraryRecords = leaderboard.filter(r => r.library === currentLibrary.name);
        return libraryRecords.length === 0 || score >= libraryRecords[0].score;
    } catch (error) {
        console.error('保存分数失败:', error);
        showErrorMessage('保存记录失败: ' + error.message);
        return false;
    }
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
    updateLeaderboardDisplay('leaderboard', 'all');
    showClearButton(true);
}

/**
 * 填充题库筛选下拉框
 */
function populateLibraryFilter() {
    const filter = document.getElementById('library-filter');
    if (!filter) return;
    
    // 保存当前选中的值
    const currentValue = filter.value;
    
    // 清空现有选项（保留"所有题库"）
    while (filter.options.length > 1) {
        filter.remove(1);
    }
    
    // 获取所有独特的题库名称
    try {
        const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        const libraries = new Set();
        
        // 添加当前选中的题库
        libraries.add(currentLibrary.name);
        
        // 添加排行榜中已有的题库
        leaderboard.forEach(record => {
            libraries.add(record.library);
        });
        
        // 添加可用的内置题库
        availableLibraries.forEach(library => {
            fetchLibraryInfo(library.file).then(info => {
                libraries.add(info.name);
                // 重新填充选项
                populateLibraryFilter();
            });
        });
        
        // 添加到筛选框
        Array.from(libraries).sort().forEach(library => {
            // 跳过已存在的选项
            if ([...filter.options].some(option => option.value === library)) {
                return;
            }
            
            const option = document.createElement('option');
            option.value = library;
            option.textContent = library;
            filter.appendChild(option);
        });
        
        // 恢复选中值
        if (currentValue && [...filter.options].some(option => option.value === currentValue)) {
            filter.value = currentValue;
        }
    } catch (error) {
        console.error('填充题库筛选失败:', error);
        showErrorMessage('加载筛选选项失败: ' + error.message);
    }
}

/**
 * 更新排行榜显示
 * @param {string} elementId - 排行榜元素ID
 * @param {string} library - 要筛选的题库名称，"all"表示所有
 */
function updateLeaderboardDisplay(elementId, library) {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    
    try {
        // 获取排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 筛选题库
        if (library && library !== 'all') {
            leaderboard = leaderboard.filter(record => record.library === library);
        }
        
        // 按分数排序
        leaderboard.sort((a, b) => b.score - a.score);
        
        // 显示排行榜
        if (leaderboard.length === 0) {
            leaderboardElement.innerHTML = '<li>暂无记录</li>';
            return;
        }
        
        leaderboardElement.innerHTML = '';
        leaderboard.forEach((record, index) => {
            const accuracy = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;
            const listItem = document.createElement('li');
            listItem.dataset.recordId = record.id;
            
            listItem.innerHTML = `
                <div class="rank-info">
                    <span class="rank">${index + 1}</span>
                    <span class="score">${record.score}分</span>
                    ${library === 'all' ? `<div class="library-name-small">${record.library}</div>` : ''}
                </div>
                <div class="details">
                    <span>${record.date}</span>
                    <span>${accuracy}%</span>
                </div>
            `;
            
            leaderboardElement.appendChild(listItem);
        });
        
        // 清空右侧解析
        if (elementId === 'leaderboard') {
            document.getElementById('leaderboard-explanation-content').innerHTML = 
                '<p>选择一条记录查看解析</p>';
        }
    } catch (error) {
        console.error('更新排行榜失败:', error);
        leaderboardElement.innerHTML = `<li>加载失败: ${error.message}</li>`;
    }
}

/**
 * 显示记录的解析
 */
function showRecordExplanation(recordId) {
    try {
        const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        const record = leaderboard.find(r => r.id.toString() === recordId.toString());
        
        if (!record || !record.explanations) {
            document.getElementById('leaderboard-explanation-content').innerHTML = 
                '<p>没有找到解析数据</p>';
            return;
        }
        
        const explanationContainer = document.getElementById('leaderboard-explanation-content');
        explanationContainer.innerHTML = '';
        
        // 最新的解析在最上面
        [...record.explanations].reverse().forEach((exp, index) => {
            const item = document.createElement('div');
            item.className = 'explanation-item';
            item.textContent = `第${record.explanations.length - index}题：${exp.isCorrect ? '回答正确' : '回答错误'}
题目：NO.${exp.questionId} ${exp.questionText}
解析：${exp.explanation}`;
            explanationContainer.appendChild(item);
        });
    } catch (error) {
        console.error('显示解析失败:', error);
        document.getElementById('leaderboard-explanation-content').innerHTML = 
            `<p>加载解析失败: ${error.message}</p>`;
    }
}

/**
 * 返回主菜单
 */
function backToMenu() {
    // 停止计时器
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 隐藏所有界面，显示主菜单
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById('start-menu').classList.remove('hidden');
    
    // 隐藏弹窗
    document.getElementById('instructions-modal').classList.add('hidden');
    document.getElementById('celebration-message').classList.add('hidden');
    
    // 隐藏清空按钮
    showClearButton(false);
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.name);
        showSuccessMessage('排行榜已清空');
    }
}

/**
 * 初始化游戏说明弹窗
 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const closeBtn = document.querySelector('.close-modal');
    
    // 点击关闭按钮
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
 * 显示随机知识点
 */
function showRandomKnowledge() {
    if (questions.length === 0) {
        document.getElementById('knowledge-content').textContent = '没有可用的知识点，请先选择一个题库';
        return;
    }
    
    // 随机选择一题
    const randomIndex = Math.floor(Math.random() * questions.length);
    const question = questions[randomIndex];
    
    // 显示知识点，添加淡入淡出效果
    const contentElement = document.getElementById('knowledge-content');
    contentElement.style.opacity = '0';
    
    setTimeout(() => {
        contentElement.textContent = `NO.${question.id} ${question.question}
答案：${question.answer}
解析：${question.explanation || '无解析'}`;
        contentElement.style.opacity = '1';
    }, 300);
}

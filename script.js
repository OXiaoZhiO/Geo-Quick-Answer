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
let isSubmittingScore = false;       // 防止重复提交分数的标记
let answerHistory = [];              // 记录答题历史，用于生成解析

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
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 预加载当前选中的题库
    loadCurrentLibrary();
    
    // 初始化文件上传区域的拖放功能
    initFileUploadDragDrop();
    
    // 绑定排行榜点击事件
    document.getElementById('leaderboard').addEventListener('click', handleLeaderboardItemClick);
});

/**
 * 初始化文件上传区域的拖放功能
 */
function initFileUploadDragDrop() {
    const uploadArea = document.querySelector('.custom-upload-area');
    const fileInput = document.getElementById('library-file-input');
    
    // 点击上传区域触发文件选择
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // 拖放事件处理
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                handleDroppedFile(file);
            } else {
                showNotification('请上传JSON格式的题库文件', 'error');
            }
        }
    });
}

/**
 * 处理拖放的文件
 * @param {File} file - 拖放的文件
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
            
            showNotification(`成功加载题库: ${currentLibrary.name}`, 'success');
        } catch (error) {
            showErrorMessage('解析题库文件失败: ' + error.message);
        }
    };
    reader.readAsText(file);
}

/**
 * 显示通知提示
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型：success, error, info, warning
 * @param {number} duration - 显示时长(毫秒)，默认3000
 */
function showNotification(message, type = 'info', duration = 3000) {
    console.log(`${type}: ${message}`);
    
    const container = document.getElementById('notification-container');
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // 根据类型设置图标
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
    
    // 添加到容器
    container.appendChild(notification);
    
    // 关闭按钮事件
    notification.querySelector('.close-btn').addEventListener('click', () => {
        notification.remove();
    });
    
    // 自动消失
    setTimeout(() => {
        if (container.contains(notification)) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }
    }, duration);
}

/**
 * 显示错误消息（通知的快捷方式）
 * @param {string} message - 错误消息
 */
function showErrorMessage(message) {
    showNotification(message, 'error');
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    const startMenu = document.getElementById('start-menu');
    const librarySelector = document.getElementById('library-selector');
    
    // 检测是否是本地file协议
    const fileUploadSection = document.getElementById('local-file-upload');
    const libraryList = document.getElementById('library-list');
    
    if (window.location.protocol === 'file:') {
        // 本地模式，只显示上传按钮
        libraryList.style.display = 'none';
        fileUploadSection.style.display = 'block';
    } else {
        // 网页模式，显示所有选项
        libraryList.style.display = 'flex';
        fileUploadSection.style.display = 'block';
        renderLibraryList();
    }
    
    startMenu.classList.add('hidden');
    librarySelector.classList.remove('hidden');
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
}

/**
 * 渲染题库列表 - 确保不重复且顺序固定
 */
function renderLibraryList() {
    const libraryList = document.getElementById('library-list');
    if (!libraryList) return;
    
    libraryList.innerHTML = '';
    
    // 使用Set确保不重复
    const uniqueLibraries = [...new Map(availableLibraries.map(item => [item.file, item])).values()];
    
    // 按ID排序，确保顺序固定
    uniqueLibraries.sort((a, b) => a.id.localeCompare(b.id));
    
    // 添加内置题库
    uniqueLibraries.forEach(library => {
        fetchLibraryInfo(library.file).then(info => {
            // 检查元素是否已存在，避免重复添加
            if (!document.querySelector(`.library-item[data-file="${library.file}"]`)) {
                const item = document.createElement('div');
                item.className = `library-item ${currentLibrary.file === library.file ? 'selected' : ''}`;
                item.dataset.file = library.file;
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
            }
        }).catch(error => {
            showErrorMessage(`加载题库信息失败: ${error.message}`);
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
    loadQuestionsFromFile(currentLibrary.file)
        .then(success => {
            if (success) {
                showNotification(`已选择题库: ${currentLibrary.name}`, 'success');
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
function loadCurrentLibrary() {
    // 检查是否是本地file协议
    if (window.location.protocol === 'file:') {
        console.log('检测到本地文件协议，使用文件选择方式加载题库');
        // 不自动加载，等待用户选择
        showNotification('请从本地选择题库文件', 'info');
    } else {
        // 网页模式，直接加载
        loadQuestionsFromFile(currentLibrary.file)
            .catch(error => {
                showErrorMessage(`加载题库失败: ${error.message}`);
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
            
            showNotification(`成功加载题库: ${currentLibrary.name}`, 'success');
        } catch (error) {
            showErrorMessage('解析题库文件失败: ' + error.message);
        } finally {
            // 清空文件输入，允许重新选择同一个文件
            document.getElementById('library-file-input').value = '';
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
        throw new Error(`无法加载 ${filePath}`);
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
    
    // 验证题目数量
    if (content.questions.length === 0) {
        throw new Error('题库中没有题目');
    }
    
    // 更新当前题库信息
    currentLibrary.name = content.name || filePath;
    currentLibrary.questionCount = content.questions.length;
    
    // 处理每道题，过滤无效题目
    questions = content.questions.map((q) => {
        // 验证题目必要字段
        if (!q.question || !q.answer || !q.options || q.difficulty === undefined) {
            console.warn(`题目ID ${q.id || '未知'} 格式不完整，已跳过`);
            return null;
        }
        
        // 确保ID存在
        if (q.id === undefined) {
            q.id = questions.length + 1;
            console.warn(`题目缺少ID，已自动分配ID: ${q.id}`);
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
            console.warn(`题目ID ${q.id} 选项中缺少正确答案，已自动添加`);
        }
        
        // 限制选项数量
        if (q.options.length > diffConf.options) {
            q.options = q.options.slice(0, diffConf.options);
        } else if (q.options.length < diffConf.options) {
            // 如果选项不足，用占位符补充
            while (q.options.length < diffConf.options) {
                q.options.push(`选项 ${q.options.length + 1}`);
            }
        }
        
        // 添加分数信息
        q.score = diffConf.score;
        
        return q;
    }).filter(q => q !== null); // 过滤无效题目
    
    if (questions.length === 0) {
        throw new Error('没有有效的题目，请检查题库文件');
    }
    
    console.log(`成功加载题库: ${currentLibrary.name}，共 ${questions.length} 题`);
}

/**
 * 开始游戏
 */
function startGame() {
    if (questions.length === 0) {
        showErrorMessage('请先选择并加载一个有效的题库');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 显示游戏界面
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    
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
    currentQuestionIndex = 0;
    score = 0;
    timeLeft = 60;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalAnswered = 0;
    completionTime = null;
    isSubmittingScore = false;
    answerHistory = []; // 重置答题历史
    
    // 重置UI
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    
    // 清空解析列表
    const explanationSection = document.querySelector('.explanation-section');
    explanationSection.innerHTML = '<div class="explanation-header">答题记录</div>';
}

/**
 * 开始计时器
 */
function startTimer() {
    // 清除之前的计时器
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
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
    }, 1000);
}

/**
 * 显示下一题 - 使用JSON中的id作为前缀
 */
function showNextQuestion() {
    // 检查是否还有题目
    if (currentQuestionIndex >= questions.length) {
        // 如果题目答完了，提前结束游戏
        endGame();
        return;
    }
    
    // 隐藏反馈
    document.getElementById('feedback').classList.add('hidden');
    
    // 获取当前题目
    const question = questions[currentQuestionIndex];
    
    // 显示题目（包含JSON中的id）
    const questionElement = document.getElementById('question');
    questionElement.innerHTML = `NO.${question.id} ${question.question}`;
    
    // 显示选项（保持原顺序）
    const optionsElement = document.getElementById('options');
    optionsElement.innerHTML = '';
    
    question.options.forEach(option => {
        const optionElement = document.createElement('button');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.dataset.option = option; // 存储选项文本用于记录
        optionElement.addEventListener('click', () => {
            checkAnswer(option, question);
        });
        optionsElement.appendChild(optionElement);
    });
}

/**
 * 检查答案
 * @param {string} selectedOption - 选中的选项
 * @param {Object} question - 当前题目对象
 */
function checkAnswer(selectedOption, question) {
    // 禁用所有选项，防止重复点击
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.disabled = true;
        // 标记正确和错误的选项
        if (option.textContent === question.answer) {
            option.classList.add('correct');
        } else if (option.textContent === selectedOption) {
            option.classList.add('incorrect');
        }
    });
    
    // 判断是否正确
    const isCorrect = selectedOption === question.answer;
    
    // 记录答题历史
    answerHistory.push({
        questionId: question.id,
        question: question.question,
        yourAnswer: selectedOption,
        correctAnswer: question.answer,
        isCorrect: isCorrect,
        explanation: question.explanation || '无解析信息'
    });
    
    // 更新统计
    totalAnswered++;
    if (isCorrect) {
        correctAnswers++;
        score += question.score;
        document.getElementById('score-value').textContent = score;
    } else {
        incorrectAnswers++;
    }
    
    // 更新正确率显示
    updateAccuracyDisplay();
    
    // 显示反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.classList.remove('hidden');
    
    if (isCorrect) {
        feedbackElement.className = 'feedback-correct';
        feedbackElement.innerHTML = `<i class="fas fa-check-circle"></i> 正确！+${question.score}分`;
    } else {
        feedbackElement.className = 'feedback-incorrect';
        feedbackElement.innerHTML = `<i class="fas fa-times-circle"></i> 错误！正确答案是：${question.answer}`;
    }
    
    // 添加到解析记录
    addExplanation(question, isCorrect, selectedOption);
    
    // 延迟显示下一题
    setTimeout(() => {
        currentQuestionIndex++;
        showNextQuestion();
    }, 1500);
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
 * 添加解析记录
 * @param {Object} question - 题目对象
 * @param {boolean} isCorrect - 是否回答正确
 * @param {string} selectedOption - 选中的选项
 */
function addExplanation(question, isCorrect, selectedOption) {
    const explanationSection = document.querySelector('.explanation-section');
    
    const item = document.createElement('div');
    item.className = `explanation-item ${isCorrect ? 'explanation-correct' : 'explanation-incorrect'}`;
    
    // 按照指定格式显示解析，包含题目ID
    item.innerHTML = `
        <div>第${question.id}题：${isCorrect ? '回答正确' : '回答错误'}</div>
        <div class="explanation-question">题目：${question.question}</div>
        <div class="explanation-options">
            <div class="explanation-your-option">你的选项：${selectedOption}</div>
            <div class="explanation-correct-option">正确选项：${question.answer}</div>
        </div>
        <div class="explanation-text">解析：${question.explanation || '无解析信息'}</div>
    `;
    
    // 添加到解析区域顶部
    explanationSection.insertBefore(item, explanationSection.children[1]); // 在标题后插入
    
    // 滚动到顶部
    explanationSection.scrollTop = 0;
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        explanationSection.innerHTML = '<div class="explanation-header">答题记录</div>';
    }
}

/**
 * 结束游戏
 */
function endGame() {
    // 清除计时器
    clearInterval(timerInterval);
    completionTime = new Date();
    
    // 隐藏游戏界面，显示游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    
    // 显示最终得分（加大加粗并渐变）
    document.getElementById('final-score').textContent = score;
    
    // 更新答题统计
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 显示本次答题解析
    displayGameOverExplanations();
    
    // 保存成绩到排行榜（确保只提交一次）
    if (!isSubmittingScore) {
        isSubmittingScore = true;
        saveScoreToLeaderboard();
    }
    
    // 显示当前题库的排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
}

/**
 * 显示游戏结束时的解析
 */
function displayGameOverExplanations() {
    const explanationContainer = document.getElementById('game-over-explanation');
    explanationContainer.innerHTML = '<div class="explanation-header">本次答题解析</div>';
    
    if (answerHistory.length === 0) {
        explanationContainer.innerHTML += '<div class="empty-state">没有答题记录</div>';
        return;
    }
    
    // 按题目ID排序显示
    answerHistory.sort((a, b) => a.questionId - b.questionId)
                 .forEach(item => {
        const explanationItem = document.createElement('div');
        explanationItem.className = `explanation-item ${item.isCorrect ? 'explanation-correct' : 'explanation-incorrect'}`;
        
        explanationItem.innerHTML = `
            <div>第${item.questionId}题：${item.isCorrect ? '回答正确' : '回答错误'}</div>
            <div class="explanation-question">题目：${item.question}</div>
            <div class="explanation-options">
                <div class="explanation-your-option">你的选项：${item.yourAnswer}</div>
                <div class="explanation-correct-option">正确选项：${item.correctAnswer}</div>
            </div>
            <div class="explanation-text">解析：${item.explanation}</div>
        `;
        
        explanationContainer.appendChild(explanationItem);
    });
}

/**
 * 保存分数到排行榜
 */
function saveScoreToLeaderboard() {
    try {
        // 获取现有排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 创建新记录，包含答题历史用于解析显示
        const newRecord = {
            score: score,
            correct: correctAnswers,
            incorrect: incorrectAnswers,
            total: totalAnswered,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            library: currentLibrary.file,
            libraryName: currentLibrary.name,
            answers: answerHistory // 保存答题历史
        };
        
        // 检查是否是新纪录
        const isNewRecord = isRecordScore(newRecord, leaderboard);
        
        // 添加新记录
        leaderboard.push(newRecord);
        
        // 按分数排序，保留前20名
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 20);
        
        // 保存回本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        
        // 如果是新纪录，显示庆祝信息
        if (isNewRecord) {
            showCelebration();
            document.getElementById('record-message').classList.remove('hidden');
        }
    } catch (error) {
        console.error('保存成绩到排行榜失败:', error);
        showErrorMessage('保存成绩失败: ' + error.message);
    }
}

/**
 * 检查是否是记录分数
 * @param {Object} newRecord - 新记录
 * @param {Array} leaderboard - 现有排行榜
 * @returns {boolean} 是否是新纪录
 */
function isRecordScore(newRecord, leaderboard) {
    // 筛选当前题库的记录
    const libraryRecords = leaderboard.filter(
        record => record.library === newRecord.library
    );
    
    // 如果没有记录，直接是新纪录
    if (libraryRecords.length === 0) {
        return true;
    }
    
    // 检查是否能进入前五名，或者分数高于现有最高分
    const topScores = [...libraryRecords]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    
    const highestScore = Math.max(...libraryRecords.map(r => r.score));
    
    return newRecord.score > highestScore || topScores.length < 5;
}

/**
 * 显示庆祝信息
 */
function showCelebration() {
    const celebration = document.getElementById('celebration-message');
    celebration.classList.remove('hidden');
    
    // 3秒后隐藏
    setTimeout(() => {
        celebration.classList.add('hidden');
    }, 3000);
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
    updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
    
    // 清空解析区域
    const explanationContainer = document.getElementById('leaderboard-explanation');
    explanationContainer.innerHTML = `
        <div class="explanation-header">答题解析</div>
        <div class="empty-state">选择一条记录查看详细解析</div>
    `;
}

/**
 * 处理排行榜项目点击
 * @param {Event} e - 点击事件
 */
function handleLeaderboardItemClick(e) {
    const scoreItem = e.target.closest('.score-item');
    if (!scoreItem) return;
    
    // 移除其他项目的选中状态
    document.querySelectorAll('.score-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 添加当前项目的选中状态
    scoreItem.classList.add('selected');
    
    // 获取记录索引
    const index = Array.from(document.getElementById('leaderboard').children).indexOf(scoreItem);
    
    // 获取对应记录并显示解析
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const libraryFilter = document.getElementById('library-filter').value;
    
    // 应用筛选
    let filteredLeaderboard = leaderboard;
    if (libraryFilter && libraryFilter !== 'all') {
        filteredLeaderboard = leaderboard.filter(record => record.library === libraryFilter);
    }
    
    // 排序
    filteredLeaderboard.sort((a, b) => b.score - a.score);
    
    const record = filteredLeaderboard[index];
    if (record && record.answers) {
        displayLeaderboardExplanations(record.answers);
    }
}

/**
 * 显示排行榜记录的解析
 * @param {Array} answers - 答题记录数组
 */
function displayLeaderboardExplanations(answers) {
    const explanationContainer = document.getElementById('leaderboard-explanation');
    explanationContainer.innerHTML = '<div class="explanation-header">答题解析</div>';
    
    if (!answers || answers.length === 0) {
        explanationContainer.innerHTML += '<div class="empty-state">没有答题记录</div>';
        return;
    }
    
    // 按题目ID排序显示
    answers.sort((a, b) => a.questionId - b.questionId)
           .forEach(item => {
        const explanationItem = document.createElement('div');
        explanationItem.className = `explanation-item ${item.isCorrect ? 'explanation-correct' : 'explanation-incorrect'}`;
        
        explanationItem.innerHTML = `
            <div>第${item.questionId}题：${item.isCorrect ? '回答正确' : '回答错误'}</div>
            <div class="explanation-question">题目：${item.question}</div>
            <div class="explanation-options">
                <div class="explanation-your-option">你的选项：${item.yourAnswer}</div>
                <div class="explanation-correct-option">正确选项：${item.correctAnswer}</div>
            </div>
            <div class="explanation-text">解析：${item.explanation}</div>
        `;
        
        explanationContainer.appendChild(explanationItem);
    });
}

/**
 * 填充题库筛选下拉框
 */
function populateLibraryFilter() {
    const filter = document.getElementById('library-filter');
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    
    // 获取所有独特的题库
    const libraries = new Set();
    leaderboard.forEach(record => {
        libraries.add(record.library);
    });
    
    // 清空现有选项（保留"所有题库"）
    while (filter.options.length > 1) {
        filter.remove(1);
    }
    
    // 添加题库选项
    const libraryArray = Array.from(libraries);
    // 排序确保选项顺序固定
    libraryArray.sort().forEach(library => {
        // 找到题库名称
        let libraryName = library;
        const recordWithName = leaderboard.find(r => r.library === library);
        if (recordWithName && recordWithName.libraryName) {
            libraryName = recordWithName.libraryName;
        }
        
        const option = document.createElement('option');
        option.value = library;
        option.textContent = libraryName;
        filter.appendChild(option);
    });
}

/**
 * 更新排行榜显示
 * @param {string} elementId - 排行榜元素ID
 * @param {string} libraryFilter - 题库筛选条件
 */
function updateLeaderboardDisplay(elementId, libraryFilter) {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    
    // 获取排行榜数据
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    
    // 应用筛选
    if (libraryFilter && libraryFilter !== 'all') {
        leaderboard = leaderboard.filter(record => record.library === libraryFilter);
    }
    
    // 排序
    leaderboard.sort((a, b) => b.score - a.score);
    
    // 清空现有内容
    leaderboardElement.innerHTML = '';
    
    // 如果没有记录
    if (leaderboard.length === 0) {
        leaderboardElement.innerHTML = '<li class="empty-leaderboard">暂无记录</li>';
        return;
    }
    
    // 添加记录
    leaderboard.forEach((record, index) => {
        const item = document.createElement('li');
        item.className = 'score-item';
        item.dataset.index = index;
        
        // 计算正确率
        const accuracy = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;
        
        item.innerHTML = `
            <span class="score-rank">${index + 1}</span>
            <span class="score-value">${record.score}分</span>
            <span>正确率: ${accuracy}%</span>
            <span class="score-date">${record.date}</span>
        `;
        
        // 如果是当前显示的排行榜（不是游戏结束时的），添加点击事件
        if (elementId === 'leaderboard') {
            item.addEventListener('click', () => handleLeaderboardItemClick({
                target: item
            }));
        }
        
        leaderboardElement.appendChild(item);
    });
}

/**
 * 返回主菜单
 */
function backToMenu() {
    // 清除计时器
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // 隐藏所有界面，显示主菜单
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById('start-menu').classList.remove('hidden');
    
    // 隐藏庆祝信息
    document.getElementById('celebration-message').classList.add('hidden');
    document.getElementById('record-message').classList.add('hidden');
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
        
        // 清空解析区域
        const explanationContainer = document.getElementById('leaderboard-explanation');
        explanationContainer.innerHTML = `
            <div class="explanation-header">答题解析</div>
            <div class="empty-state">选择一条记录查看详细解析</div>
        `;
        
        showNotification('排行榜已清空', 'success');
    }
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

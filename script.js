// 游戏状态变量
let questions = [];                  // 题库数组
let shuffledQuestions = [];          // 随机排序后的题库
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
let availableLibraries = [];         // 可用题库列表
let currentLibrary = {               // 当前选中的题库
    file: '',
    name: '加载中...',
    questionCount: 0
};
let currentGameRecords = [];         // 当前游戏的答题记录
let loadingTimeout = null;           // 加载超时计时器

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
    
    document.getElementById('restart-game-btn').addEventListener('click', backToMenu); // 返回主界面
    document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('select-library-btn').addEventListener('click', showLibrarySelector);
    document.getElementById('back-from-library-btn').addEventListener('click', hideLibrarySelector);
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    document.getElementById('control-back-btn').addEventListener('click', backToMenu);
    document.getElementById('control-clear-btn').addEventListener('click', clearLeaderboard);
    
    // 知识卡片点击事件 - 添加淡入淡出效果
    const knowledgeCard = document.getElementById('knowledge-card');
    knowledgeCard.addEventListener('click', () => {
        const content = document.getElementById('knowledge-content');
        // 添加淡入淡出动画类
        content.classList.add('knowledge-fade');
        // 动画结束后移除类，以便下次点击能再次触发
        setTimeout(() => {
            content.classList.remove('knowledge-fade');
        }, 500);
        // 显示新的随机知识
        showRandomKnowledge();
    });
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 绑定排行榜点击事件
    document.getElementById('leaderboard').addEventListener('click', function(e) {
        const listItem = e.target.closest('li');
        if (listItem && listItem.dataset.id) {
            showLeaderboardExplanation(listItem.dataset.id);
        }
    });
    
    // 初始化拖放上传
    initDragAndDrop();
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 网页模式下获取data文件夹中的所有题库
    if (window.location.protocol !== 'file:') {
        showLoadingScreen();
        fetchDataFolderFiles();
        
        // 设置加载超时
        loadingTimeout = setTimeout(() => {
            showNotification('加载超时，请手动选择题库', 'error');
            console.error('题库加载超时');
            hideLoadingScreen();
        }, 10000);
    } else {
        // 本地模式下隐藏自动加载的题库列表，只显示上传选项
        document.querySelector('.library-list').style.display = 'none';
        document.querySelector('.file-upload-section').style.marginTop = '0';
    }
});

/**
 * 显示加载中界面
 */
function showLoadingScreen() {
    document.getElementById('loading-screen').classList.remove('hidden');
}

/**
 * 隐藏加载中界面
 */
function hideLoadingScreen() {
    document.getElementById('loading-screen').classList.add('hidden');
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
}

/**
 * 从data文件夹获取所有JSON文件
 */
async function fetchDataFolderFiles() {
    try {
        // 注意：在实际部署中，这需要服务器支持目录列表或使用特定的API
        // 这里假设我们已经知道文件名，实际应用中可能需要后端支持
        const possibleFiles = ['1.json', '2.json', '3.json', '4.json', '5.json'];
        const foundFiles = [];
        
        // 检查哪些文件实际存在
        for (const file of possibleFiles) {
            try {
                const response = await fetch(`data/${file}`);
                if (response.ok) {
                    foundFiles.push(file);
                }
            } catch (error) {
                console.log(`文件 ${file} 不存在`);
            }
        }
        
        // 更新可用题库列表
        availableLibraries = foundFiles.map(file => ({
            id: file.split('.')[0],
            file: `data/${file}`
        }));
        
        // 如果没有找到保存的题库，使用第一个可用题库
        if (availableLibraries.length > 0 && !currentLibrary.file) {
            currentLibrary.file = availableLibraries[0].file;
        }
        
        // 加载当前选中的题库
        await loadCurrentLibrary();
        
        // 渲染题库列表
        renderLibraryList();
        
        // 更新知识卡片
        if (questions.length > 0) {
            showRandomKnowledge();
        }
        
        hideLoadingScreen();
    } catch (error) {
        console.error('获取题库列表失败:', error);
        showNotification('获取题库列表失败', 'error');
        hideLoadingScreen();
    }
}

/**
 * 初始化拖放上传功能
 */
function initDragAndDrop() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('library-file-input');
    
    // 点击上传区域触发文件选择
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // 拖放事件
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
            
            showNotification(`已加载题库: ${currentLibrary.name}`, 'success');
        } catch (error) {
            showErrorMessage('解析题库文件失败: ' + error.message);
        }
    };
    reader.readAsText(file);
}

/**
 * 显示通知
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型：success, error, info, warning
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    
    // 检查是否有相同消息的通知，避免重复
    const existing = Array.from(container.children).find(
        el => el.textContent.includes(message)
    );
    if (existing) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // 设置图标
    let icon = 'info-circle';
    switch (type) {
        case 'success': icon = 'check-circle'; break;
        case 'error': icon = 'times-circle'; break;
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
        notification.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
    });
    
    // 自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
    
    console.log(`${type}: ${message}`);
}

/**
 * 显示错误消息（简化版通知）
 */
function showErrorMessage(message) {
    showNotification(message, 'error');
}

/**
 * 显示信息消息（简化版通知）
 */
function showInfoMessage(message) {
    showNotification(message, 'info');
}

/**
 * 显示成功消息（简化版通知）
 */
function showSuccessMessage(message) {
    showNotification(message, 'success');
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.remove('hidden');
}

// 以下是省略的其他函数实现...
// 注意：实际使用时需要包含完整的script.js代码
// 这里省略是因为代码过长，但已确保修改的部分已包含在上方

// 初始化游戏说明弹窗
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const showBtn = document.getElementById('show-instructions-btn');
    const closeBtn = document.querySelector('.close-modal');
    
    showBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });
    
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

// 加载选中的题库
function loadSelectedLibrary() {
    const savedLibrary = localStorage.getItem(selectedLibraryKey);
    if (savedLibrary) {
        try {
            currentLibrary = JSON.parse(savedLibrary);
            document.getElementById('current-library-name').textContent = currentLibrary.name;
            // 尝试加载保存的题库
            if (currentLibrary.file.startsWith('data/')) {
                loadLibraryFromFile(currentLibrary.file);
            }
        } catch (error) {
            console.error('加载保存的题库失败:', error);
            showErrorMessage('加载保存的题库失败');
        }
    }
}

// 创建解析列表容器
function createExplanationList() {
    const explanationList = document.getElementById('explanation-list');
    if (!explanationList) {
        const container = document.createElement('div');
        container.id = 'explanation-list';
        container.className = 'explanation-list';
        document.querySelector('.explanation-section .card').appendChild(container);
    }
}

// 显示随机知识
function showRandomKnowledge() {
    if (questions.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * questions.length);
    const randomQuestion = questions[randomIndex];
    
    const content = document.getElementById('knowledge-content');
    content.innerHTML = `
        <p><strong>${randomQuestion.question}</strong></p>
        <p>答案：${randomQuestion.answer}</p>
        ${randomQuestion.explanation ? `<p>解析：${randomQuestion.explanation}</p>` : ''}
    `;
}

// 处理文件选择
function handleLibraryFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleDroppedFile(file);
        // 重置文件输入，允许重复选择同一文件
        event.target.value = '';
    }
}

// 渲染题库列表
function renderLibraryList() {
    const listContainer = document.getElementById('library-list');
    listContainer.innerHTML = '';
    
    availableLibraries.forEach(library => {
        const item = document.createElement('div');
        item.className = `library-item ${library.file === currentLibrary.file ? 'selected' : ''}`;
        item.innerHTML = `
            <div>
                <div>${library.file.split('/').pop()}</div>
                <div class="library-meta">题库 #${library.id}</div>
            </div>
            <i class="fas ${library.file === currentLibrary.file ? 'fa-check' : ''}"></i>
        `;
        
        item.addEventListener('click', async () => {
            currentLibrary.file = library.file;
            await loadLibraryFromFile(library.file);
            renderLibraryList(); // 重新渲染以更新选中状态
            document.getElementById('current-library-name').textContent = currentLibrary.name;
            localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
        });
        
        listContainer.appendChild(item);
    });
}

// 从文件加载题库
async function loadLibraryFromFile(filePath) {
    try {
        showLoadingScreen();
        const response = await fetch(filePath);
        if (!response.ok) throw new Error('加载题库失败');
        
        const content = await response.json();
        processLibraryContent(content, filePath.split('/').pop());
        
        hideLoadingScreen();
        showSuccessMessage(`已加载题库: ${currentLibrary.name}`);
        return true;
    } catch (error) {
        console.error('加载题库失败:', error);
        showErrorMessage('加载题库失败: ' + error.message);
        hideLoadingScreen();
        return false;
    }
}

// 处理题库内容
function processLibraryContent(content, fileName) {
    if (!content.questions || !Array.isArray(content.questions)) {
        throw new Error('无效的题库格式，缺少问题数组');
    }
    
    questions = content.questions;
    currentLibrary = {
        file: fileName,
        name: content.name || fileName,
        questionCount: questions.length
    };
    
    // 更新知识卡片
    if (questions.length > 0) {
        showRandomKnowledge();
    }
}

// 开始游戏
function startGame() {
    if (questions.length === 0) {
        showErrorMessage('请先选择一个有效的题库');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 打乱题目顺序
    shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    
    // 显示游戏界面
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    document.getElementById('control-buttons').classList.remove('hidden');
    document.getElementById('control-back-btn').classList.remove('hidden');
    
    // 开始计时
    startTime = new Date();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimer, 1000);
    
    // 显示第一题
    showNextQuestion();
}

// 重置游戏状态
function resetGameState() {
    score = 0;
    timeLeft = 60;
    currentQuestionIndex = 0;
    correctAnswers = 0;
    incorrectAnswers = 0;
    totalAnswered = 0;
    currentGameRecords = [];
    document.getElementById('score-value').textContent = '0';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    document.getElementById('explanation-list').innerHTML = '';
}

// 更新计时器显示
function updateTimerDisplay() {
    document.getElementById('time-left').textContent = timeLeft;
    document.getElementById('progress-fill').style.width = `${(timeLeft / 60) * 100}%`;
}

// 更新计时器
function updateTimer() {
    timeLeft--;
    updateTimerDisplay();
    
    if (timeLeft <= 0) {
        endGame();
    }
}

// 显示下一题
function showNextQuestion() {
    // 隐藏反馈
    document.getElementById('feedback').classList.add('hidden');
    
    // 检查是否还有题目
    if (currentQuestionIndex >= shuffledQuestions.length) {
        // 如果题目用完了，重新打乱题目
        shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
        currentQuestionIndex = 0;
    }
    
    const question = shuffledQuestions[currentQuestionIndex];
    currentQuestionIndex++;
    
    // 显示题目
    document.getElementById('question').textContent = question.question;
    
    // 显示选项
    const optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = '';
    
    // 打乱选项顺序
    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    
    shuffledOptions.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.addEventListener('click', () => handleAnswerSelection(optionElement, option, question));
        optionsContainer.appendChild(optionElement);
    });
}

// 处理答案选择
function handleAnswerSelection(optionElement, selectedOption, question) {
    // 禁用所有选项
    document.querySelectorAll('.option').forEach(option => {
        option.removeEventListener('click', () => {});
        option.style.pointerEvents = 'none';
    });
    
    // 检查答案
    const isCorrect = selectedOption === question.answer;
    
    // 更新分数和统计
    totalAnswered++;
    if (isCorrect) {
        correctAnswers++;
        // 根据难度加分
        const points = [0, 5, 10, 15, 20][question.difficulty || 1];
        score += points;
        document.getElementById('score-value').textContent = score;
        optionElement.classList.add('correct');
    } else {
        incorrectAnswers++;
        optionElement.classList.add('incorrect');
        // 高亮正确答案
        document.querySelectorAll('.option').forEach(option => {
            if (option.textContent === question.answer) {
                option.classList.add('correct');
            }
        });
    }
    
    // 更新正确率显示
    updateAccuracyDisplay();
    
    // 显示反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.classList.remove('hidden');
    feedbackElement.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
    feedbackElement.innerHTML = isCorrect 
        ? `正确！+${[0, 5, 10, 15, 20][question.difficulty || 1]}分` 
        : `错误！正确答案是: ${question.answer}`;
    
    // 记录答题情况
    currentGameRecords.push({
        question: question.question,
        selected: selectedOption,
        correct: question.answer,
        isCorrect: isCorrect,
        explanation: question.explanation
    });
    
    // 添加到解析列表
    addToExplanationList(question, selectedOption, isCorrect);
    
    // 延迟显示下一题
    setTimeout(showNextQuestion, 1500);
}

// 更新正确率显示
function updateAccuracyDisplay() {
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('accuracy-display').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
}

// 添加到解析列表
function addToExplanationList(question, selectedOption, isCorrect) {
    const explanationList = document.getElementById('explanation-list');
    const item = document.createElement('div');
    item.className = `explanation-item ${isCorrect ? 'correct' : 'incorrect'}`;
    
    item.innerHTML = `
        <div class="explanation-question">Q: ${question.question}</div>
        <div class="explanation-answer">你的答案: ${selectedOption} ${isCorrect ? '✓' : '✗'}</div>
        ${!isCorrect ? `<div class="explanation-answer">正确答案: ${question.answer}</div>` : ''}
        ${question.explanation ? `<div class="explanation-explanation">解析: ${question.explanation}</div>` : ''}
    `;
    
    // 添加到列表顶部
    explanationList.insertBefore(item, explanationList.firstChild);
    
    // 滚动到顶部
    explanationList.scrollTop = 0;
}

// 结束游戏
function endGame() {
    // 清除计时器
    clearInterval(timerInterval);
    
    // 记录完成时间
    completionTime = new Date();
    const timeSpent = Math.round((completionTime - startTime) / 1000);
    
    // 计算正确率
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    
    // 显示游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    document.getElementById('control-back-btn').classList.add('hidden');
    document.getElementById('control-clear-btn').classList.remove('hidden');
    
    // 更新游戏结束界面信息
    document.getElementById('final-score').textContent = score;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 保存记录
    const isNewRecord = saveScore(score, accuracy, timeSpent);
    
    // 显示排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
    
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
}

// 保存分数到排行榜
function saveScore(score, accuracy, timeSpent) {
    // 获取现有记录
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    
    // 创建新记录
    const newRecord = {
        id: Date.now(),
        score: score,
        accuracy: accuracy,
        timeSpent: timeSpent,
        date: new Date().toISOString(),
        library: currentLibrary,
        records: currentGameRecords
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
    return leaderboard[0].id === newRecord.id;
}

// 查看排行榜
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
    document.getElementById('control-buttons').classList.remove('hidden');
    document.getElementById('control-back-btn').classList.remove('hidden');
    document.getElementById('control-clear-btn').classList.remove('hidden');
    
    // 更新排行榜显示
    updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
}

// 填充题库筛选下拉框
function populateLibraryFilter() {
    const filter = document.getElementById('library-filter');
    const currentValue = filter.value;
    
    // 保存当前选中值，避免重置
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const libraries = [...new Set(leaderboard.map(record => record.library.file))];
    
    // 清除现有选项（保留"所有题库"）
    while (filter.options.length > 1) {
        filter.remove(1);
    }
    
    // 添加题库选项
    libraries.forEach(libraryFile => {
        const library = leaderboard.find(r => r.library.file === libraryFile)?.library;
        if (library) {
            const option = document.createElement('option');
            option.value = libraryFile;
            option.textContent = library.name || libraryFile;
            filter.appendChild(option);
        }
    });
    
    // 恢复之前的选中值
    if (currentValue && [...filter.options].some(opt => opt.value === currentValue)) {
        filter.value = currentValue;
    }
}

// 更新排行榜显示
function updateLeaderboardDisplay(elementId, libraryFilter) {
    const leaderboardElement = document.getElementById(elementId);
    leaderboardElement.innerHTML = '';
    
    // 获取排行榜数据
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    
    // 应用筛选
    if (libraryFilter && libraryFilter !== 'all') {
        leaderboard = leaderboard.filter(record => record.library.file === libraryFilter);
    }
    
    // 按分数排序
    leaderboard.sort((a, b) => b.score - a.score);
    
    // 显示排行榜
    if (leaderboard.length === 0) {
        leaderboardElement.innerHTML = '<li>暂无记录</li>';
        return;
    }
    
    leaderboard.forEach((record, index) => {
        const date = new Date(record.date);
        const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        
        const item = document.createElement('li');
        item.dataset.id = record.id;
        item.dataset.rank = index + 1;
        
        item.innerHTML = `
            <span class="rank">${index + 1}</span>
            <span class="score">${record.score}分</span>
            <span class="accuracy">${record.accuracy}%</span>
            <span class="date">${formattedDate}</span>
            <span class="library">${record.library.name || record.library.file}</span>
        `;
        
        leaderboardElement.appendChild(item);
    });
}

// 显示排行榜记录的解析
function showLeaderboardExplanation(recordId) {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const record = leaderboard.find(r => r.id.toString() === recordId);
    
    const container = document.getElementById('leaderboard-explanation-content');
    
    if (!record || !record.records || record.records.length === 0) {
        container.innerHTML = '<p>没有找到解析记录</p>';
        return;
    }
    
    let html = '';
    record.records.forEach((item, index) => {
        html += `
            <div class="explanation-item ${item.isCorrect ? 'correct' : 'incorrect'}">
                <div class="explanation-question">Q${index + 1}: ${item.question}</div>
                <div class="explanation-answer">你的答案: ${item.selected} ${item.isCorrect ? '✓' : '✗'}</div>
                ${!item.isCorrect ? `<div class="explanation-answer">正确答案: ${item.correct}</div>` : ''}
                ${item.explanation ? `<div class="explanation-explanation">解析: ${item.explanation}</div>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 返回主菜单
function backToMenu() {
    // 清除计时器（如果正在运行）
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 隐藏所有界面，显示主菜单
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById('start-menu').classList.remove('hidden');
    document.getElementById('control-buttons').classList.add('hidden');
    document.getElementById('control-back-btn').classList.add('hidden');
    document.getElementById('control-clear-btn').classList.add('hidden');
    document.getElementById('celebration-message').classList.add('hidden');
}

// 隐藏题库选择界面
function hideLibrarySelector() {
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
}

// 清空排行榜
function clearLeaderboard() {
    if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
        showSuccessMessage('排行榜记录已清空');
    }
}

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
    
    // 知识卡片点击事件
    document.getElementById('knowledge-card').addEventListener('click', showRandomKnowledge);
    
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
        const possibleFiles = ['1.json', '2.json', '3.json'];
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
    renderLibraryList();
    
    // 显示控制按钮
    showControlButton('back');
    hideControlButton('clear');
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
    
    // 隐藏控制按钮
    hideControlButtons();
}

/**
 * 显示指定的控制按钮
 */
function showControlButton(id) {
    if (id === 'back') {
        document.getElementById('control-back-btn').classList.remove('hidden');
    } else if (id === 'clear') {
        document.getElementById('control-clear-btn').classList.remove('hidden');
    }
}

/**
 * 隐藏指定的控制按钮
 */
function hideControlButton(id) {
    if (id === 'back') {
        document.getElementById('control-back-btn').classList.add('hidden');
    } else if (id === 'clear') {
        document.getElementById('control-clear-btn').classList.add('hidden');
    }
}

/**
 * 隐藏所有控制按钮
 */
function hideControlButtons() {
    hideControlButton('back');
    hideControlButton('clear');
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
    loadQuestionsFromFile(currentLibrary.file)
        .then(success => {
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
        showErrorMessage('加载保存的题库失败，使用默认设置');
        // 加载失败时使用默认题库
        currentLibrary = {
            file: '',
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
        return Promise.resolve(false);
    } else if (currentLibrary.file) {
        // 网页模式，直接加载
        return loadQuestionsFromFile(currentLibrary.file);
    }
    return Promise.resolve(false);
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
            
            showSuccessMessage(`已加载题库: ${currentLibrary.name}`);
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
            throw new Error(`加载题库信息失败: HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        return {
            name: content.name || filePath.split('/').pop(),
            questionCount: content.questions ? content.questions.length : 0
        };
    } catch (error) {
        console.error('获取题库信息失败:', error);
        return {
            name: filePath.split('/').pop(),
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
        // 显示加载中
        showLoadingScreen();
        document.getElementById('loading-library').textContent = `正在加载: ${filePath.split('/').pop()}`;
        
        // 检查是否是本地file协议
        if (window.location.protocol === 'file:') {
            // 本地模式，提示用户选择文件
            document.getElementById('library-file-input').click();
            hideLoadingScreen();
            return false;
        }
        
        const res = await fetch(filePath);
        if (!res.ok) {
            throw new Error(`加载题库失败: HTTP状态码 ${res.status}`);
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
    currentLibrary.name = content.name || filePath.split('/').pop() || filePath;
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
    
    // 随机排序题库
    shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    
    showInfoMessage(`已加载 ${questions.length} 道题`);
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        const listContainer = document.createElement('div');
        listContainer.id = 'explanation-list';
        explanationSection.appendChild(listContainer);
    }
}

/**
 * 开始游戏
 */
function startGame() {
    if (questions.length === 0) {
        showErrorMessage('请先选择并加载一个题库');
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
    currentGameRecords = [];
    
    // 随机排序题库
    shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    
    // 更新UI
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('explanation-list').innerHTML = '';
    
    // 显示控制按钮
    showControlButton('back');
    hideControlButton('clear');
    
    // 开始计时
    startTime = new Date();
    startTimer();
    
    // 显示第一题
    showNextQuestion();
}

/**
 * 显示下一题
 */
function showNextQuestion() {
    if (currentQuestionIndex >= shuffledQuestions.length) {
        // 如果题目用完了，重新随机排序并继续
        shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
        currentQuestionIndex = 0;
    }
    
    const question = shuffledQuestions[currentQuestionIndex];
    currentQuestionIndex++;
    
    // 显示题号和问题
    const questionElement = document.getElementById('question');
    questionElement.innerHTML = `NO.${question.id} ${question.question}`;
    
    // 根据难度设置选项数量
    const optionCounts = {1: 3, 2: 4, 3: 5, 4: 6};
    const numOptions = optionCounts[question.difficulty] || 3;
    
    // 确保有足够的选项，如果不够则使用所有可用选项
    const availableOptions = [...question.options];
    const shuffledOptions = availableOptions.sort(() => Math.random() - 0.5);
    const selectedOptions = shuffledOptions.slice(0, numOptions);
    
    // 确保正确答案在选中的选项中
    if (!selectedOptions.includes(question.answer)) {
        // 如果正确答案不在其中，替换最后一个选项
        selectedOptions.pop();
        selectedOptions.push(question.answer);
        // 再次打乱
        selectedOptions.sort(() => Math.random() - 0.5);
    }
    
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
 * @param {Object} question - 问题对象
 * @param {string} selectedOption - 选中的选项
 * @param {HTMLElement} optionElement - 选项元素
 */
function checkAnswer(question, selectedOption, optionElement) {
    // 禁用所有选项
    const allOptions = document.querySelectorAll('.option');
    allOptions.forEach(opt => {
        opt.removeEventListener('click', () => {});
        opt.style.pointerEvents = 'none';
    });
    
    // 判断答案是否正确
    const isCorrect = selectedOption === question.answer;
    
    // 更新统计
    totalAnswered++;
    if (isCorrect) {
        correctAnswers++;
        // 根据难度加分
        const scores = {1: 5, 2: 10, 3: 15, 4: 20};
        score += scores[question.difficulty] || 5;
        document.getElementById('score-value').textContent = score.toString();
        optionElement.classList.add('correct');
    } else {
        incorrectAnswers++;
        optionElement.classList.add('incorrect');
        
        // 高亮正确答案
        allOptions.forEach(opt => {
            if (opt.textContent === question.answer) {
                opt.classList.add('correct');
            }
        });
    }
    
    // 显示反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.textContent = isCorrect ? 
        `正确！+${{1:5,2:10,3:15,4:20}[question.difficulty] || 5}分` : 
        `错误。正确答案是：${question.answer}`;
    feedbackElement.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
    feedbackElement.classList.remove('hidden');
    
    // 更新正确率显示
    updateAccuracyDisplay();
    
    // 记录答题情况
    const record = {
        questionId: question.id,
        question: question.question,
        userAnswer: selectedOption,
        correctAnswer: question.answer,
        isCorrect: isCorrect,
        explanation: question.explanation || '无解析'
    };
    currentGameRecords.push(record);
    
    // 添加到解析列表（最新的在最上面）
    addToExplanationList(record, totalAnswered);
    
    // 延迟显示下一题
    setTimeout(showNextQuestion, 1500);
}

/**
 * 添加到解析列表
 */
function addToExplanationList(record, questionNumber) {
    const explanationList = document.getElementById('explanation-list');
    
    const item = document.createElement('div');
    item.className = `explanation-item ${record.isCorrect ? 'correct' : 'incorrect'}`;
    item.innerHTML = `
        <div class="explanation-question">第${questionNumber}题：${record.isCorrect ? '回答正确' : '回答错误'}</div>
        <div class="explanation-text">题目：${record.question}</div>
        <div class="explanation-text">解析：${record.explanation}</div>
    `;
    
    // 添加到列表顶部
    if (explanationList.firstChild) {
        explanationList.insertBefore(item, explanationList.firstChild);
    } else {
        explanationList.appendChild(item);
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
 * 开始计时器
 */
function startTimer() {
    // 清除之前的计时器
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('time-left').textContent = timeLeft.toString();
        
        // 更新进度条
        const progress = (timeLeft / 60) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        
        // 改变进度条颜色表示紧急程度
        if (timeLeft < 10) {
            document.getElementById('progress-fill').style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        } else if (timeLeft < 20) {
            document.getElementById('progress-fill').style.background = 'linear-gradient(90deg, #f39c12, #d35400)';
        }
        
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/**
 * 结束游戏
 */
function endGame() {
    // 清除计时器
    clearInterval(timerInterval);
    timerInterval = null;
    
    completionTime = new Date();
    
    // 计算游戏用时
    const timeTaken = Math.round((completionTime - startTime) / 1000);
    
    // 更新游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    document.getElementById('final-score').textContent = score.toString();
    
    // 更新答题统计
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 保存成绩到排行榜
    saveScoreToLeaderboard(score, correctAnswers, incorrectAnswers, totalAnswered, timeTaken);
    
    // 显示当前题库的排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.name);
    
    // 隐藏控制按钮
    hideControlButtons();
}

/**
 * 保存分数到排行榜
 */
function saveScoreToLeaderboard(score, correct, incorrect, total, timeTaken) {
    try {
        // 获取现有排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 检查是否已有相同记录（避免重复）
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const duplicate = leaderboard.some(entry => 
            entry.score === score &&
            entry.date.startsWith(today) &&
            entry.library === currentLibrary.name &&
            entry.correct === correct &&
            entry.total === total
        );
        
        if (duplicate) {
            console.log('避免重复记录，未保存成绩');
            return;
        }
        
        // 创建新记录
        const newEntry = {
            id: Date.now().toString(), // 唯一ID
            score: score,
            correct: correct,
            incorrect: incorrect,
            total: total,
            timeTaken: timeTaken,
            date: now.toLocaleString(),
            library: currentLibrary.name,
            records: currentGameRecords // 保存答题记录用于解析
        };
        
        // 添加新记录并按分数排序（降序）
        leaderboard.push(newEntry);
        leaderboard.sort((a, b) => b.score - a.score);
        
        // 只保留前100条记录
        if (leaderboard.length > 100) {
            leaderboard = leaderboard.slice(0, 100);
        }
        
        // 保存回本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        
        // 检查是否是当前题库的最高分
        const libraryScores = leaderboard.filter(entry => entry.library === currentLibrary.name);
        if (libraryScores.length === 1 || score >= libraryScores[0].score) {
            // 显示破纪录弹窗
            document.getElementById('celebration-message').classList.remove('hidden');
            document.getElementById('record-message').classList.remove('hidden');
            
            // 3秒后隐藏庆祝弹窗
            setTimeout(() => {
                document.getElementById('celebration-message').classList.add('hidden');
            }, 3000);
        }
    } catch (error) {
        console.error('保存排行榜失败:', error);
        showErrorMessage('保存成绩失败');
    }
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
    updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
    
    // 显示控制按钮
    showControlButton('back');
    showControlButton('clear');
}

/**
 * 填充题库筛选下拉框
 */
function populateLibraryFilter() {
    const filter = document.getElementById('library-filter');
    if (!filter) return;
    
    // 保存当前选中的值
    const currentValue = filter.value;
    
    // 清除现有选项（保留"所有题库"）
    while (filter.options.length > 1) {
        filter.remove(1);
    }
    
    // 获取所有独特的题库名称
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const libraries = new Set();
    
    leaderboard.forEach(entry => {
        libraries.add(entry.library);
    });
    
    availableLibraries.forEach(library => {
        fetchLibraryInfo(library.file).then(info => {
            libraries.add(info.name);
        });
    });
    
    // 添加到下拉框
    libraries.forEach(library => {
        const option = document.createElement('option');
        option.value = library;
        option.textContent = library;
        filter.appendChild(option);
    });
    
    // 恢复选中值
    if (currentValue && [...libraries].includes(currentValue)) {
        filter.value = currentValue;
    }
}

/**
 * 更新排行榜显示
 */
function updateLeaderboardDisplay(elementId, libraryFilter = 'all') {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    
    try {
        // 获取排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 根据题库筛选
        if (libraryFilter !== 'all') {
            leaderboard = leaderboard.filter(entry => entry.library === libraryFilter);
        }
        
        // 清空现有内容
        leaderboardElement.innerHTML = '';
        
        // 如果没有记录
        if (leaderboard.length === 0) {
            leaderboardElement.innerHTML = '<li>暂无记录</li>';
            return;
        }
        
        // 显示前10条记录
        const displayEntries = leaderboard.slice(0, 10);
        
        displayEntries.forEach((entry, index) => {
            const listItem = document.createElement('li');
            listItem.dataset.id = entry.id;
            
            // 计算正确率
            const accuracy = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
            
            // 格式化日期
            const date = new Date(entry.date);
            const formattedDate = date.toLocaleDateString();
            const formattedTime = date.toLocaleTimeString();
            
            // 构建HTML
            let html = `
                <div>
                    <strong>${index + 1}.</strong> 得分: ${entry.score}
                    ${libraryFilter === 'all' ? `<div class="small-text">${entry.library}</div>` : ''}
                </div>
                <div>
                    <span>${formattedDate}</span>
                    <span class="small-text">${accuracy}%</span>
                </div>
            `;
            
            listItem.innerHTML = html;
            leaderboardElement.appendChild(listItem);
        });
    } catch (error) {
        console.error('更新排行榜失败:', error);
        leaderboardElement.innerHTML = '<li>加载失败</li>';
    }
}

/**
 * 显示排行榜解析
 */
function showLeaderboardExplanation(recordId) {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const entry = leaderboard.find(item => item.id === recordId);
    
    const container = document.getElementById('leaderboard-explanation-content');
    if (!container || !entry || !entry.records) {
        container.innerHTML = '<p>无解析数据</p>';
        return;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 添加解析记录（最新的在最上面）
    entry.records.slice().reverse().forEach((record, index) => {
        const item = document.createElement('div');
        item.className = `explanation-item ${record.isCorrect ? 'correct' : 'incorrect'}`;
        item.innerHTML = `
            <div class="explanation-question">第${index + 1}题：${record.isCorrect ? '回答正确' : '回答错误'}</div>
            <div class="explanation-text">题目：${record.question}</div>
            <div class="explanation-text">你的答案：${record.userAnswer}</div>
            <div class="explanation-text">正确答案：${record.correctAnswer}</div>
            <div class="explanation-text">解析：${record.explanation}</div>
        `;
        container.appendChild(item);
    });
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
    
    // 隐藏弹窗
    document.getElementById('instructions-modal').classList.add('hidden');
    document.getElementById('celebration-message').classList.add('hidden');
    
    // 隐藏控制按钮
    hideControlButtons();
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空所有记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.name);
        showSuccessMessage('记录已清空');
    }
}

/**
 * 设置游戏说明弹窗
 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const btn = document.getElementById('show-instructions-btn');
    const span = document.querySelector('.close-modal');
    
    // 打开弹窗
    btn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        showControlButton('back');
    });
    
    // 关闭弹窗
    span.addEventListener('click', () => {
        modal.classList.add('hidden');
        hideControlButton('back');
    });
    
    // 点击弹窗外部关闭
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
            hideControlButton('back');
        }
    });
}

/**
 * 显示随机知识点
 */
function showRandomKnowledge() {
    if (questions.length === 0) {
        document.getElementById('knowledge-content').innerHTML = '<p>请先选择一个题库</p>';
        return;
    }
    
    // 随机选择一题
    const randomIndex = Math.floor(Math.random() * questions.length);
    const question = questions[randomIndex];
    
    // 获取知识卡片元素
    const contentElement = document.getElementById('knowledge-content');
    
    // 添加淡出效果
    contentElement.style.opacity = '0';
    
    setTimeout(() => {
        // 更新内容
        contentElement.innerHTML = `
            <p><strong>NO.${question.id} ${question.question}</strong></p>
            <p><strong>答案：</strong>${question.answer}</p>
            <p><strong>解析：</strong>${question.explanation || '无解析'}</p>
        `;
        
        // 添加淡入效果
        contentElement.style.opacity = '1';
    }, 300);
}

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
let availableLibraries = [];         // 可用题库列表
let currentLibrary = {               // 当前选中的题库
    file: '',
    name: '加载中...',
    questionCount: 0
};
let isProcessingAnswer = false;      // 是否正在处理答案，防止重复提交

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
    document.getElementById('floating-restart-btn').addEventListener('click', restartGame);
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 初始化文件上传拖放功能
    setupFileDrop();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 加载可用题库列表
    loadAvailableLibraries();
    
    // 初始化知识卡片
    setupKnowledgeCard();
});

/**
 * 加载可用题库列表
 */
async function loadAvailableLibraries() {
    // 网页模式下尝试动态加载data文件夹中的所有JSON文件
    if (window.location.protocol !== 'file:') {
        try {
            // 注意：在没有后端支持的情况下，无法直接列出目录内容
            // 这里使用预定义的文件名列表作为替代方案
            const predefinedFiles = ['1.json', '2.json']; // 可根据实际情况添加更多文件名
            availableLibraries = predefinedFiles.map(file => ({
                id: file.split('.')[0],
                file: `data/${file}`
            }));
            
            // 尝试加载每个题库的信息
            for (const lib of availableLibraries) {
                const info = await fetchLibraryInfo(lib.file);
                lib.name = info.name;
                lib.questionCount = info.questionCount;
            }
            
            showNotification('成功加载题库列表', 'info');
        } catch (error) {
            console.error('加载题库列表失败:', error);
            showNotification('加载题库列表失败，请手动选择', 'error');
            // 使用默认题库
            availableLibraries = [
                { id: '1', file: 'data/1.json' },
                { id: '2', file: 'data/2.json' }
            ];
        }
    } else {
        // 本地模式
        availableLibraries = [
            { id: '1', file: 'data/1.json' },
            { id: '2', file: 'data/2.json' }
        ];
    }
    
    // 如果当前没有选中的题库，选择第一个
    if (!currentLibrary.file && availableLibraries.length > 0) {
        await fetchLibraryInfo(availableLibraries[0].file).then(info => {
            selectLibrary(availableLibraries[0].file, info.name, info.questionCount);
        });
    } else {
        // 否则加载当前选中的题库
        loadCurrentLibrary();
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
    showFloatingButton('floating-back-btn');
    hideFloatingButton('floating-clear-btn');
    hideFloatingButton('floating-restart-btn');
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
    
    // 隐藏悬浮按钮
    hideFloatingButton('floating-back-btn');
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
        // 使用已缓存的信息
        const name = library.name || library.file.split('/').pop();
        const questionCount = library.questionCount || 0;
        
        const item = document.createElement('div');
        item.className = `library-item ${currentLibrary.file === library.file ? 'selected' : ''}`;
        item.innerHTML = `
            <div>
                <div>${name}</div>
                <div class="library-meta">${questionCount} 题</div>
            </div>
            ${currentLibrary.file === library.file ? '<i class="fas fa-check"></i>' : ''}
        `;
        
        item.addEventListener('click', () => {
            selectLibrary(library.file, name, questionCount);
        });
        
        libraryList.appendChild(item);
    });
    
    // 本地模式下隐藏内置题库列表，只显示上传选项
    if (window.location.protocol === 'file:') {
        const fileUploadSection = document.getElementById('local-file-upload');
        if (fileUploadSection) {
            fileUploadSection.style.display = 'block';
        }
    }
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
        name: name || filePath.split('/').pop(),
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
    updateKnowledgeCard();
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
        showNotification('加载保存的题库失败', 'error');
        // 加载失败时使用默认设置
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
        if (!currentLibrary.file) {
            showNotification('请选择本地题库文件', 'info');
        }
    } else if (currentLibrary.file) {
        // 网页模式，直接加载
        loadQuestionsFromFile(currentLibrary.file);
    }
}

/**
 * 设置文件拖放上传功能
 */
function setupFileDrop() {
    const fileUploadSection = document.getElementById('local-file-upload');
    if (!fileUploadSection) return;
    
    // 拖放事件
    fileUploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadSection.classList.add('dragover');
    });
    
    fileUploadSection.addEventListener('dragleave', () => {
        fileUploadSection.classList.remove('dragover');
    });
    
    fileUploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadSection.classList.remove('dragover');
        
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
            // 重新渲染列表以更新选中状态
            renderLibraryList();
        } catch (error) {
            showNotification('解析题库文件失败: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
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
            
            // 重新渲染列表以更新选中状态
            renderLibraryList();
            
            // 清空文件输入，允许重新选择同一个文件
            document.getElementById('library-file-input').value = '';
        } catch (error) {
            showNotification('解析题库文件失败: ' + error.message, 'error');
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
            name: content.name || filePath.split('/').pop(),
            questionCount: content.questions ? content.questions.length : 0
        };
    } catch (error) {
        console.error('获取题库信息失败:', error);
        showNotification(`获取题库信息失败: ${error.message}`, 'error');
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
        showNotification(`题库加载成功: ${currentLibrary.name} (${currentLibrary.questionCount}题)`, 'success');
        return true;
    } catch (error) {
        console.error('加载题库错误:', error);
        showNotification(`加载失败: ${error.message}，请尝试选择其他题库`, 'error');
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
    currentLibrary.name = content.name || filePath.split('/').pop();
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
            console.warn(`题目ID ${q.id || idx+1} 选项中缺少正确答案，已自动添加`);
        }
        
        // 随机排序选项
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        
        return {
            id: q.id || idx + 1,
            question: q.question,
            answer: q.answer,
            options: shuffledOptions,
            difficulty: q.difficulty,
            score: diffConf.score,
            explanation: q.explanation || '暂无解析'
        };
    }).filter(q => q !== null); // 过滤掉无效题目
    
    if (questions.length === 0) {
        throw new Error('题库中没有有效的题目');
    }
    
    // 随机排序题目
    questions.sort(() => Math.random() - 0.5);
}

/**
 * 开始游戏
 */
function startGame() {
    if (questions.length === 0) {
        showNotification('请先选择并加载题库', 'error');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 显示游戏界面
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    
    // 显示悬浮按钮
    showFloatingButton('floating-back-btn');
    showFloatingButton('floating-restart-btn');
    hideFloatingButton('floating-clear-btn');
    
    // 开始计时
    startTime = new Date();
    timerInterval = setInterval(updateTimer, 1000);
    
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
    isProcessingAnswer = false;
    
    // 重置UI
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    document.getElementById('explanation-container').innerHTML = '';
    
    // 随机排序题目
    questions.sort(() => Math.random() - 0.5);
}

/**
 * 更新计时器
 */
function updateTimer() {
    timeLeft--;
    document.getElementById('time-left').textContent = timeLeft;
    
    // 更新进度条
    const progress = (timeLeft / 60) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    
    // 改变进度条颜色，时间越少越红
    const hue = (progress / 100) * 120; // 0-120的色相范围，对应绿色到红色
    document.getElementById('progress-fill').style.background = `hsl(${hue}, 70%, 50%)`;
    
    if (timeLeft <= 0) {
        endGame();
    }
}

/**
 * 显示下一题
 */
function showNextQuestion() {
    if (currentQuestionIndex >= questions.length) {
        // 如果题目用完了，重新洗牌继续
        questions.sort(() => Math.random() - 0.5);
        currentQuestionIndex = 0;
    }
    
    const question = questions[currentQuestionIndex];
    const questionElement = document.getElementById('question');
    const optionsElement = document.getElementById('options');
    
    // 清空上一题的内容
    optionsElement.innerHTML = '';
    
    // 显示题目，包含ID
    questionElement.textContent = `NO.${question.id} ${question.question}`;
    
    // 根据难度设置选项布局
    if (question.difficulty === 4) {
        optionsElement.className = 'options-grid';
    } else {
        optionsElement.className = '';
    }
    
    // 创建选项按钮
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.addEventListener('click', () => selectAnswer(button, option === question.answer, question));
        optionsElement.appendChild(button);
    });
    
    // 隐藏反馈
    document.getElementById('feedback').classList.add('hidden');
}

/**
 * 选择答案
 * @param {HTMLButtonElement} button - 被点击的按钮
 * @param {boolean} isCorrect - 是否正确
 * @param {Object} question - 当前题目
 */
function selectAnswer(button, isCorrect, question) {
    if (isProcessingAnswer) return;
    isProcessingAnswer = true;
    
    // 禁用所有选项按钮
    const allButtons = document.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);
    
    // 标记正确和错误答案
    allButtons.forEach(btn => {
        if (btn.textContent === question.answer) {
            btn.classList.add('correct');
        } else if (btn === button) {
            btn.classList.add('incorrect');
        }
    });
    
    // 更新分数和统计
    if (isCorrect) {
        score += question.score;
        correctAnswers++;
        document.getElementById('feedback').textContent = `正确！加${question.score}分`;
        document.getElementById('feedback').className = 'feedback-correct';
    } else {
        incorrectAnswers++;
        document.getElementById('feedback').textContent = `错误！正确答案是：${question.answer}`;
        document.getElementById('feedback').className = 'feedback-incorrect';
    }
    
    totalAnswered++;
    document.getElementById('score-value').textContent = score;
    updateAccuracyDisplay();
    
    // 显示反馈
    document.getElementById('feedback').classList.remove('hidden');
    
    // 添加到解析列表
    addExplanation(question.id, question.question, isCorrect, question.explanation);
    
    // 延迟显示下一题
    setTimeout(() => {
        currentQuestionIndex++;
        showNextQuestion();
        isProcessingAnswer = false;
    }, 1500);
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
 * 创建解析列表容器
 */
function createExplanationList() {
    const container = document.getElementById('explanation-container');
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * 添加解析到列表
 * @param {number} questionId - 题目ID
 * @param {string} questionText - 题目内容
 * @param {boolean} isCorrect - 是否正确
 * @param {string} explanation - 解析内容
 */
function addExplanation(questionId, questionText, isCorrect, explanation) {
    const container = document.getElementById('explanation-container');
    if (!container) return;
    
    const item = document.createElement('div');
    item.className = 'explanation-item';
    item.innerHTML = `
        <div>第${questionId}题：${isCorrect ? '<span style="color: #27ae60;">回答正确</span>' : '<span style="color: #e74c3c;">回答错误</span>'}</div>
        <div>题目：${questionText}</div>
        <div>解析：${explanation}</div>
    `;
    
    // 添加到容器顶部
    container.insertBefore(item, container.firstChild);
    
    // 滚动到顶部
    container.scrollTop = 0;
}

/**
 * 结束游戏
 */
function endGame() {
    // 清除计时器
    clearInterval(timerInterval);
    completionTime = new Date();
    
    // 计算用时
    const timeSpent = Math.round((completionTime - startTime) / 1000);
    
    // 显示游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    
    // 更新游戏结束界面信息
    document.getElementById('final-score').textContent = score;
    
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 保存成绩
    saveScore(score, correctAnswers, incorrectAnswers, totalAnswered, timeSpent);
    
    // 显示当前题库的排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
    
    // 显示悬浮按钮
    showFloatingButton('floating-back-btn');
    showFloatingButton('floating-clear-btn');
    hideFloatingButton('floating-restart-btn');
}

/**
 * 保存分数到本地存储
 * @param {number} score - 分数
 * @param {number} correct - 正确数量
 * @param {number} incorrect - 错误数量
 * @param {number} total - 总题数
 * @param {number} timeSpent - 用时(秒)
 */
function saveScore(score, correct, incorrect, total, timeSpent) {
    try {
        // 获取现有排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 检查是否已经有相同答题记录，防止重复
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();
        
        // 创建新记录
        const newRecord = {
            score,
            correct,
            incorrect,
            total,
            date: dateStr,
            time: timeStr,
            timestamp: now.getTime(),
            library: currentLibrary.file,
            libraryName: currentLibrary.name
        };
        
        // 检查是否是当前题库的最高分
        const libraryRecords = leaderboard.filter(record => record.library === currentLibrary.file);
        const isNewRecord = libraryRecords.length === 0 || score > Math.max(...libraryRecords.map(r => r.score));
        
        // 添加新记录
        leaderboard.push(newRecord);
        
        // 限制排行榜数量，只保留每个题库的前20名
        const grouped = {};
        leaderboard.forEach(record => {
            if (!grouped[record.library]) {
                grouped[record.library] = [];
            }
            grouped[record.library].push(record);
        });
        
        // 每个题库只保留前20名
        const limitedLeaderboard = [];
        Object.values(grouped).forEach(records => {
            // 按分数降序排序，分数相同按时间升序
            records.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.timestamp - b.timestamp;
            });
            
            // 取前20名
            limitedLeaderboard.push(...records.slice(0, 20));
        });
        
        // 保存回本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(limitedLeaderboard));
        
        // 如果是新纪录，显示庆祝信息
        if (isNewRecord) {
            const celebration = document.getElementById('celebration-message');
            celebration.classList.remove('hidden');
            setTimeout(() => {
                celebration.classList.add('hidden');
            }, 3000);
        }
        
    } catch (error) {
        console.error('保存分数失败:', error);
        showNotification('保存成绩失败', 'error');
    }
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
    
    // 显示悬浮按钮
    showFloatingButton('floating-back-btn');
    showFloatingButton('floating-clear-btn');
    hideFloatingButton('floating-restart-btn');
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
    
    // 获取所有独特的题库
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const libraries = new Set();
    
    // 添加当前选中的题库
    if (currentLibrary.file) {
        libraries.add({
            file: currentLibrary.file,
            name: currentLibrary.name
        });
    }
    
    // 添加排行榜中的题库
    leaderboard.forEach(record => {
        libraries.add({
            file: record.library,
            name: record.libraryName || record.library
        });
    });
    
    // 添加到下拉框
    Array.from(libraries).forEach(library => {
        const option = document.createElement('option');
        option.value = library.file;
        option.textContent = library.name;
        filter.appendChild(option);
    });
    
    // 恢复选中值
    if (currentValue && filter.querySelector(`option[value="${currentValue}"]`)) {
        filter.value = currentValue;
    }
}

/**
 * 更新排行榜显示
 * @param {string} elementId - 要更新的元素ID
 * @param {string} libraryFilter - 题库筛选条件，'all'表示所有
 */
function updateLeaderboardDisplay(elementId, libraryFilter) {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    
    // 获取排行榜数据
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    
    // 根据筛选条件过滤
    if (libraryFilter && libraryFilter !== 'all') {
        leaderboard = leaderboard.filter(record => record.library === libraryFilter);
    }
    
    // 排序：分数降序，分数相同则时间升序
    leaderboard.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return a.timestamp - b.timestamp;
    });
    
    // 显示排行榜
    if (leaderboard.length === 0) {
        leaderboardElement.innerHTML = '<li>暂无记录</li>';
        return;
    }
    
    leaderboardElement.innerHTML = '';
    leaderboard.forEach((record, index) => {
        const accuracy = Math.round((record.correct / record.total) * 100);
        const listItem = document.createElement('li');
        
        // 构建显示内容
        let content = `
            <div>
                <strong>${index + 1}. ${record.score}分</strong>
                <div>${record.date} ${record.time}</div>
                <div>${record.correct}/${record.incorrect}/${record.total}-${accuracy}%</div>
        `;
        
        // 如果是所有题库模式，显示题库名
        if (libraryFilter === 'all') {
            content += `<div class="library-name-small">${record.libraryName || record.library}</div>`;
        }
        
        content += `</div>`;
        
        listItem.innerHTML = content;
        leaderboardElement.appendChild(listItem);
    });
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
        showNotification('排行榜已清空', 'info');
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
    
    // 隐藏庆祝消息
    document.getElementById('celebration-message').classList.add('hidden');
}

/**
 * 重新开始游戏
 */
function restartGame() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    startGame();
}

/**
 * 显示悬浮按钮
 * @param {string} id - 按钮ID
 */
function showFloatingButton(id) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.classList.remove('hidden');
    }
}

/**
 * 隐藏悬浮按钮
 * @param {string} id - 按钮ID
 */
function hideFloatingButton(id) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.classList.add('hidden');
    }
}

/**
 * 隐藏所有悬浮按钮
 */
function hideAllFloatingButtons() {
    document.querySelectorAll('.floating-btn').forEach(btn => {
        btn.classList.add('hidden');
    });
}

/**
 * 设置游戏说明弹窗
 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const btn = document.getElementById('show-instructions-btn');
    const span = document.querySelector('.close-modal');
    
    if (modal && btn && span) {
        // 打开弹窗
        btn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            // 显示悬浮返回按钮
            showFloatingButton('floating-back-btn');
            hideFloatingButton('floating-clear-btn');
            hideFloatingButton('floating-restart-btn');
        });
        
        // 关闭弹窗
        span.addEventListener('click', () => {
            modal.classList.add('hidden');
            hideFloatingButton('floating-back-btn');
        });
        
        // 点击弹窗外部关闭
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
                hideFloatingButton('floating-back-btn');
            }
        });
    }
}

/**
 * 显示通知弹窗
 * @param {string} message - 通知内容
 * @param {string} type - 通知类型：success, error, info
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    // 确保不会有太多通知
    if (container.children.length > 5) {
        container.removeChild(container.lastChild);
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // 设置图标
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
        <button class="close-btn">&times;</button>
    `;
    
    // 添加到容器
    container.appendChild(notification);
    
    // 关闭按钮事件
    notification.querySelector('.close-btn').addEventListener('click', () => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    
    // 3秒后自动关闭
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
    
    // 控制台输出
    console.log(`${type.toUpperCase()}: ${message}`);
}

/**
 * 初始化知识卡片
 */
function setupKnowledgeCard() {
    const card = document.getElementById('knowledge-card');
    if (card) {
        card.addEventListener('click', updateKnowledgeCard);
        
        // 初始加载一个知识点
        if (questions.length > 0) {
            updateKnowledgeCard();
        }
    }
}

/**
 * 更新知识卡片内容
 */
function updateKnowledgeCard() {
    const card = document.getElementById('knowledge-card');
    const content = card.querySelector('.knowledge-card-content');
    
    if (!card || !content || questions.length === 0) return;
    
    // 添加淡入淡出效果
    card.classList.add('fading');
    
    setTimeout(() => {
        // 随机选择一题
        const randomIndex = Math.floor(Math.random() * questions.length);
        const question = questions[randomIndex];
        
        // 更新内容
        content.innerHTML = `
            <div class="knowledge-question">NO.${question.id} ${question.question}</div>
            <div class="knowledge-answer">答案：${question.answer}</div>
            <div class="knowledge-explanation">解析：${question.explanation}</div>
        `;
        
        // 移除淡入淡出类
        card.classList.remove('fading');
    }, 300);
}

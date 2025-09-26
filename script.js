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
    document.getElementById('back-to-menu-btn').addEventListener('click', backToMenu);
    document.getElementById('restart-game-btn').addEventListener('click', backToMenu); // 返回主界面
    document.getElementById('clear-leaderboard-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('select-library-btn').addEventListener('click', showLibrarySelector);
    document.getElementById('back-from-library-btn').addEventListener('click', hideLibrarySelector);
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    
    // 绑定悬浮按钮事件
    document.getElementById('float-back-btn').addEventListener('click', backToMenu);
    document.getElementById('float-clear-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('float-leaderboard-btn').addEventListener('click', () => {
        viewLeaderboard();
        populateLibraryFilter();
    });
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 绑定排行榜点击事件
    document.getElementById('leaderboard').addEventListener('click', function(e) {
        const listItem = e.target.closest('li');
        if (listItem && listItem.dataset.id) {
            showRecordDetails(listItem.dataset.id);
        }
    });
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 初始化文件上传拖放功能
    setupFileDrop();
    
    // 初始化知识卡片
    setupKnowledgeCard();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 预加载当前选中的题库
    loadCurrentLibrary();
});

/**
 * 设置文件拖放上传功能
 */
function setupFileDrop() {
    const uploadSection = document.getElementById('local-file-upload');
    const fileInput = document.getElementById('library-file-input');
    
    // 拖放事件
    uploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadSection.classList.add('drag-over');
    });
    
    uploadSection.addEventListener('dragleave', () => {
        uploadSection.classList.remove('drag-over');
    });
    
    uploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadSection.classList.remove('drag-over');
        
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
            
            showNotification(`成功加载题库: ${currentLibrary.name}`, 'success');
        } catch (error) {
            showNotification('解析题库文件失败: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

/**
 * 显示通知提示
 * @param {string} message - 通知内容
 * @param {string} type - 通知类型 (success, error, info)
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    
    // 检查是否已有相同通知，避免重复
    const existing = Array.from(container.children).find(
        el => el.textContent.includes(message) && el.classList.contains(type)
    );
    if (existing) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // 根据类型设置图标
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
        <button class="close-btn"><i class="fas fa-times"></i></button>
    `;
    
    container.appendChild(notification);
    
    // 关闭按钮事件
    notification.querySelector('.close-btn').addEventListener('click', () => {
        notification.remove();
    });
    
    // 3秒后自动消失
    setTimeout(() => {
        if (container.contains(notification)) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
    
    console.log(`${type.toUpperCase()}: ${message}`);
}

/**
 * 设置知识卡片
 */
function setupKnowledgeCard() {
    const card = document.getElementById('knowledge-card');
    card.addEventListener('click', () => {
        showRandomKnowledge();
    });
    
    // 初始显示一个知识点
    if (questions.length > 0) {
        showRandomKnowledge();
    } else {
        // 尝试加载题库后显示
        setTimeout(() => {
            if (questions.length > 0) {
                showRandomKnowledge();
            }
        }, 1000);
    }
}

/**
 * 显示随机知识点
 */
function showRandomKnowledge() {
    if (questions.length === 0) {
        showNotification('请先选择一个题库', 'info');
        return;
    }
    
    const card = document.getElementById('knowledge-card');
    const content = card.querySelector('.knowledge-card-content');
    
    // 添加淡入淡出效果
    card.classList.add('fading');
    
    setTimeout(() => {
        // 随机选择一题
        const randomIndex = Math.floor(Math.random() * questions.length);
        const question = questions[randomIndex];
        
        content.innerHTML = `
            <p><strong>NO.${question.id} ${question.question}</strong></p>
            <p class="knowledge-card-answer">答案：${question.answer}</p>
            <p class="knowledge-card-explanation">解析：${question.explanation || '无解析'}</p>
        `;
        
        card.classList.remove('fading');
    }, 300);
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.remove('hidden');
    renderLibraryList();
    
    // 显示悬浮按钮
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
        }).catch(error => {
            showNotification(`加载题库信息失败: ${error.message}`, 'error');
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
        showNotification('加载保存的题库失败，使用默认题库', 'error');
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
        // 隐藏内置题库列表，只显示上传按钮
        const libraryList = document.getElementById('library-list');
        if (libraryList) {
            libraryList.innerHTML = '<p>本地模式下请通过文件上传选择题库</p>';
        }
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
            
            showNotification(`成功加载题库: ${currentLibrary.name}`, 'success');
            
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
            throw new Error(`HTTP状态码 ${res.status}`);
        }
        
        const content = await res.json();
        processLibraryContent(content, filePath);
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
            console.warn(`题目ID ${q.id || idx+1} 选项中缺少正确答案，已自动添加`);
        }
        
        // 随机排序选项，但确保正确答案在其中
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        
        return {
            id: q.id || idx + 1,
            question: q.question,
            answer: q.answer,
            options: shuffledOptions,
            difficulty: q.difficulty,
            score: diffConf.score,
            explanation: q.explanation || '无解析'
        };
    }).filter(Boolean); // 过滤掉null值
    
    if (questions.length === 0) {
        throw new Error('未找到有效的题目，请检查题库格式');
    }
    
    console.log(`成功加载题库: ${currentLibrary.name}，共 ${questions.length} 题`);
    showNotification(`成功加载题库: ${currentLibrary.name}，共 ${questions.length} 题`, 'success');
    
    // 更新知识卡片
    showRandomKnowledge();
}

/**
 * 开始游戏
 */
function startGame() {
    if (questions.length === 0) {
        showNotification('请先选择并加载一个题库', 'error');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 显示游戏界面
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    
    // 显示返回主菜单的悬浮按钮
    showFloatingButtons(['float-back-btn']);
    
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
    completionTime = null;
    
    // 重置UI
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    document.getElementById('feedback').classList.add('hidden');
    
    // 清空解析列表
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        explanationSection.innerHTML = '';
    }
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
    
    // 改变进度条颜色，时间越少越红
    const hue = (progressPercent / 100) * 120; // 120是绿色，0是红色
    document.getElementById('progress-fill').style.background = `linear-gradient(90deg, hsl(${hue}, 70%, 50%), hsl(${hue-10}, 70%, 50%))`;
    
    if (timeLeft <= 0) {
        endGame();
    }
}

/**
 * 显示下一题
 */
function showNextQuestion() {
    // 如果所有题目都已回答，重新开始题库
    if (currentQuestionIndex >= questions.length) {
        currentQuestionIndex = 0;
    }
    
    const question = questions[currentQuestionIndex];
    currentQuestionIndex++;
    
    // 显示题目（包含ID）
    const questionElement = document.getElementById('question');
    questionElement.innerHTML = `NO.${question.id} ${question.question}`;
    
    // 显示选项
    const optionsElement = document.getElementById('options');
    optionsElement.innerHTML = '';
    
    question.options.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.addEventListener('click', () => checkAnswer(option, question));
        optionsElement.appendChild(optionElement);
    });
    
    // 隐藏反馈
    document.getElementById('feedback').classList.add('hidden');
}

/**
 * 检查答案
 * @param {string} selectedOption - 选中的选项
 * @param {Object} question - 当前题目对象
 */
function checkAnswer(selectedOption, question) {
    totalAnswered++;
    const isCorrect = selectedOption === question.answer;
    
    // 更新分数和统计
    if (isCorrect) {
        score += question.score;
        correctAnswers++;
    } else {
        incorrectAnswers++;
    }
    
    // 更新UI
    document.getElementById('score-value').textContent = score;
    updateAccuracyDisplay();
    
    // 显示反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.classList.remove('hidden');
    
    if (isCorrect) {
        feedbackElement.textContent = `正确！+${question.score}分`;
        feedbackElement.className = 'feedback-correct';
    } else {
        feedbackElement.textContent = `错误。正确答案是：${question.answer}`;
        feedbackElement.className = 'feedback-incorrect';
    }
    
    // 高亮正确和错误的选项
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        if (option.textContent === question.answer) {
            option.classList.add('correct');
        } else if (option.textContent === selectedOption) {
            option.classList.add('incorrect');
        }
        // 禁用所有选项
        option.style.pointerEvents = 'none';
    });
    
    // 添加到解析列表
    addToExplanationList(question, isCorrect);
    
    // 延迟显示下一题
    setTimeout(showNextQuestion, 1500);
}

/**
 * 更新正确率显示
 */
function updateAccuracyDisplay() {
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    const displayText = `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    document.getElementById('accuracy-display').textContent = displayText;
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        explanationSection.innerHTML = '';
    }
}

/**
 * 添加到解析列表
 * @param {Object} question - 题目对象
 * @param {boolean} isCorrect - 是否回答正确
 */
function addToExplanationList(question, isCorrect) {
    const explanationSection = document.querySelector('.explanation-section');
    if (!explanationSection) return;
    
    const explanationItem = document.createElement('div');
    explanationItem.className = `explanation-item ${isCorrect ? 'correct' : 'incorrect'}`;
    
    // 格式化解析内容
    explanationItem.innerHTML = `
        <strong>第${question.id}题：${isCorrect ? '回答正确' : '回答错误'}</strong>
        <p>题目：${question.question}</p>
        <p>解析：${question.explanation}</p>
    `;
    
    // 添加到顶部，最新的解析在上面
    explanationSection.insertBefore(explanationItem, explanationSection.firstChild);
    
    // 滚动到顶部
    explanationItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 结束游戏
 */
function endGame() {
    // 清除计时器
    clearInterval(timerInterval);
    completionTime = new Date();
    
    // 计算用时
    const timeTaken = Math.round((completionTime - startTime) / 1000);
    
    // 显示游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    
    // 更新游戏结束界面信息
    document.getElementById('final-score').textContent = score;
    
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 隐藏游戏中的悬浮按钮，显示游戏结束后的
    showFloatingButtons(['float-back-btn', 'float-leaderboard-btn', 'float-clear-btn']);
    
    // 保存成绩
    saveScore(score, correctAnswers, incorrectAnswers, totalAnswered, timeTaken);
    
    // 显示当前题库的排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
}

/**
 * 保存分数到本地存储
 */
function saveScore(score, correct, incorrect, total, timeTaken) {
    try {
        // 获取现有排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 检查是否已有相同记录（避免重复）
        const now = new Date();
        const dateString = now.toLocaleDateString();
        const timeString = now.toLocaleTimeString();
        
        // 创建新记录
        const newRecord = {
            id: Date.now(), // 使用时间戳作为唯一ID
            score: score,
            correct: correct,
            incorrect: incorrect,
            total: total,
            date: dateString,
            time: timeString,
            library: currentLibrary.file,
            libraryName: currentLibrary.name
        };
        
        // 检查是否为当前题库的最高分
        const libraryRecords = leaderboard.filter(record => record.library === currentLibrary.file);
        const isNewRecord = libraryRecords.length === 0 || score > Math.max(...libraryRecords.map(r => r.score));
        
        // 添加新记录
        leaderboard.push(newRecord);
        
        // 按分数排序，保留前100条记录
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > 100) {
            leaderboard = leaderboard.slice(0, 100);
        }
        
        // 保存回本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        
        // 如果是新纪录，显示庆祝信息
        if (isNewRecord) {
            document.getElementById('record-message').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('celebration-message').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('celebration-message').classList.add('hidden');
                }, 3000);
            }, 500);
        }
    } catch (error) {
        console.error('保存分数失败:', error);
        showNotification('保存成绩失败: ' + error.message, 'error');
    }
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game-over-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.remove('hidden');
    
    // 显示悬浮按钮
    showFloatingButtons(['float-back-btn', 'float-clear-btn']);
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
    
    // 获取所有题库
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const libraries = new Set();
    
    // 添加内置题库
    availableLibraries.forEach(library => {
        libraries.add(library.file);
    });
    
    // 添加记录中的题库
    leaderboard.forEach(record => {
        libraries.add(record.library);
    });
    
    // 添加到筛选框
    libraries.forEach(library => {
        // 查找题库名称
        let libraryName = library;
        const libInfo = availableLibraries.find(lib => lib.file === library);
        if (libInfo) {
            fetchLibraryInfo(libInfo.file).then(info => {
                const option = document.createElement('option');
                option.value = library;
                option.textContent = info.name || library;
                filter.appendChild(option);
            });
        } else {
            // 查找记录中的名称
            const recordWithLib = leaderboard.find(r => r.library === library);
            if (recordWithLib) {
                libraryName = recordWithLib.libraryName || library;
            }
            
            const option = document.createElement('option');
            option.value = library;
            option.textContent = libraryName;
            filter.appendChild(option);
        }
    });
    
    // 恢复选中值
    if (currentValue && filter.querySelector(`option[value="${currentValue}"]`)) {
        filter.value = currentValue;
    }
}

/**
 * 更新排行榜显示
 * @param {string} elementId - 要更新的排行榜元素ID
 * @param {string} libraryFilter - 题库筛选条件，'all'表示所有
 */
function updateLeaderboardDisplay(elementId, libraryFilter = 'all') {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    
    try {
        // 获取排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 筛选题库
        if (libraryFilter !== 'all') {
            leaderboard = leaderboard.filter(record => record.library === libraryFilter);
        }
        
        // 按分数排序
        leaderboard.sort((a, b) => b.score - a.score);
        
        // 清空现有内容
        leaderboardElement.innerHTML = '';
        
        // 如果没有记录
        if (leaderboard.length === 0) {
            leaderboardElement.innerHTML = '<li>暂无记录</li>';
            return;
        }
        
        // 添加记录
        leaderboard.forEach((record, index) => {
            const accuracy = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;
            const listItem = document.createElement('li');
            listItem.dataset.id = record.id;
            
            // 构建列表项内容
            let content = `
                <div>
                    <strong>${index + 1}. ${record.score}分</strong>
                    <div>${record.date} ${record.time}</div>
                    <div>${record.correct}/${record.incorrect}/${record.total}-${accuracy}%</div>
            `;
            
            // 全部题库模式下显示题库名
            if (libraryFilter === 'all') {
                content += `<div class="library-name-small">${record.libraryName || record.library}</div>`;
            }
            
            content += `</div>`;
            
            // 前三名显示奖牌图标
            if (index === 0) content += '<i class="fas fa-medal" style="color: #ffd700;"></i>';
            if (index === 1) content += '<i class="fas fa-medal" style="color: #c0c0c0;"></i>';
            if (index === 2) content += '<i class="fas fa-medal" style="color: #cd7f32;"></i>';
            
            listItem.innerHTML = content;
            leaderboardElement.appendChild(listItem);
        });
    } catch (error) {
        console.error('更新排行榜失败:', error);
        leaderboardElement.innerHTML = `<li>加载排行榜失败: ${error.message}</li>`;
    }
}

/**
 * 显示记录详情
 * @param {string} recordId - 记录ID
 */
function showRecordDetails(recordId) {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const record = leaderboard.find(r => r.id.toString() === recordId);
    
    const explanationElement = document.getElementById('record-explanation');
    if (!explanationElement || !record) {
        explanationElement.innerHTML = '<p>无法加载记录详情</p>';
        return;
    }
    
    const accuracy = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;
    
    explanationElement.innerHTML = `
        <p><strong>分数：${record.score}</strong></p>
        <p>日期：${record.date} ${record.time}</p>
        <p>题库：${record.libraryName || record.library}</p>
        <p>答题统计：${record.correct} 正确，${record.incorrect} 错误，共 ${record.total} 题</p>
        <p>正确率：${accuracy}%</p>
    `;
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空所有排行榜记录吗？此操作不可恢复。')) {
        try {
            localStorage.removeItem(leaderboardKey);
            updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
            updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
            showNotification('排行榜记录已清空', 'success');
        } catch (error) {
            console.error('清空排行榜失败:', error);
            showNotification('清空记录失败: ' + error.message, 'error');
        }
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
    
    // 显示主菜单，隐藏其他界面
    document.getElementById('start-menu').classList.remove('hidden');
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('instructions-modal').classList.add('hidden');
    document.getElementById('celebration-message').classList.add('hidden');
    
    // 隐藏所有悬浮按钮
    hideAllFloatingButtons();
}

/**
 * 显示指定的悬浮按钮
 * @param {Array} buttonIds - 按钮ID数组
 */
function showFloatingButtons(buttonIds) {
    // 先隐藏所有
    hideAllFloatingButtons();
    
    // 显示指定的
    buttonIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('hidden');
    });
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
    const showBtn = document.getElementById('show-instructions-btn');
    const closeBtn = document.querySelector('.close-modal');
    
    if (!modal || !showBtn || !closeBtn) return;
    
    // 显示弹窗
    showBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        showFloatingButtons(['float-back-btn']);
    });
    
    // 关闭弹窗
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        hideAllFloatingButtons();
    });
    
    // 点击弹窗外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            hideAllFloatingButtons();
        }
    });
}

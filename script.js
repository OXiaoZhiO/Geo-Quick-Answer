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
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 预加载当前选中的题库
    loadCurrentLibrary().then(() => {
        // 隐藏加载界面，显示主菜单
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('start-menu').classList.remove('hidden');
    });
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
    document.getElementById('current-library-name').textContent = currentLibrary.name;
    
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
    document.getElementById('current-library-name').textContent = currentLibrary.name;
}

/**
 * 加载当前选中的题库
 */
async function loadCurrentLibrary() {
    // 检查是否是本地file协议
    if (window.location.protocol === 'file:') {
        console.log('检测到本地文件协议，使用文件选择方式加载题库');
        // 不自动加载，等待用户选择
        return true;
    } else {
        // 网页模式，直接加载
        return await loadQuestionsFromFile(currentLibrary.file);
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
        
        // 随机排序选项，但确保正确答案在其中
        const shuffledOptions = shuffleArray([...q.options]);
        
        return {
            id: q.id || idx + 1,
            question: q.question,
            answer: q.answer,
            options: shuffledOptions,
            difficulty: q.difficulty,
            points: diffConf.score,
            explanation: q.explanation || '无解析'
        };
    }).filter(q => q !== null); // 过滤掉无效题目
    
    if (questions.length === 0) {
        throw new Error('未找到有效题目，请检查题库文件');
    }
    
    console.log(`成功加载题库: ${currentLibrary.name}，共 ${questions.length} 题`);
}

/**
 * 数组随机排序
 * @param {Array} array - 要排序的数组
 * @returns {Array} 排序后的数组
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
    if (!explanationSection) return;
    
    const listContainer = document.createElement('div');
    listContainer.id = 'explanation-list';
    listContainer.className = 'explanation-list';
    listContainer.innerHTML = '<h3>解析记录</h3><div class="explanation-items"></div>';
    
    explanationSection.appendChild(listContainer);
}

/**
 * 开始游戏
 */
function startGame() {
    // 检查是否有可用题目
    if (questions.length === 0) {
        showErrorMessage('未加载到题目，请先选择一个有效的题库');
        showLibrarySelector();
        return;
    }
    
    // 重置游戏状态
    resetGameState();
    
    // 显示游戏界面，隐藏其他界面
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    
    // 显示第一题
    showNextQuestion();
    
    // 开始计时
    startTimer();
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
    startTime = new Date();
    
    // 重置UI
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    document.getElementById('feedback').classList.add('hidden');
    
    // 清空解析记录
    const explanationItems = document.querySelector('.explanation-items');
    if (explanationItems) {
        explanationItems.innerHTML = '';
    }
}

/**
 * 显示下一题
 */
function showNextQuestion() {
    // 如果已经答完所有题，重新洗牌继续
    if (currentQuestionIndex >= questions.length) {
        questions = shuffleArray(questions);
        currentQuestionIndex = 0;
    }
    
    const question = questions[currentQuestionIndex];
    const questionElement = document.getElementById('question');
    const optionsElement = document.getElementById('options');
    
    // 清空之前的内容
    optionsElement.innerHTML = '';
    
    // 显示问题
    questionElement.textContent = question.question;
    
    // 显示选项
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.addEventListener('click', () => checkAnswer(option, question));
        optionsElement.appendChild(button);
    });
}

/**
 * 检查答案是否正确
 * @param {string} selectedOption - 用户选择的选项
 * @param {Object} question - 当前题目对象
 */
function checkAnswer(selectedOption, question) {
    // 禁用所有选项按钮
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach(button => {
        button.disabled = true;
        // 标记正确和错误的选项
        if (button.textContent === question.answer) {
            button.classList.add('correct');
        } else if (button.textContent === selectedOption) {
            button.classList.add('incorrect');
        }
    });
    
    // 判断答案是否正确
    const isCorrect = selectedOption === question.answer;
    
    // 更新统计数据
    totalAnswered++;
    if (isCorrect) {
        correctAnswers++;
        score += question.points;
        document.getElementById('score-value').textContent = score.toString();
    } else {
        incorrectAnswers++;
    }
    
    // 更新正确率显示
    updateAccuracyDisplay();
    
    // 显示反馈
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.classList.remove('hidden', 'feedback-correct', 'feedback-incorrect');
    
    if (isCorrect) {
        feedbackElement.textContent = `正确！+${question.points}分 - ${question.explanation}`;
        feedbackElement.classList.add('feedback-correct');
    } else {
        feedbackElement.textContent = `错误。正确答案是：${question.answer} - ${question.explanation}`;
        feedbackElement.classList.add('feedback-incorrect');
    }
    
    // 添加到解析记录
    addToExplanationList(question, isCorrect);
    
    // 延迟显示下一题
    setTimeout(() => {
        currentQuestionIndex++;
        showNextQuestion();
        feedbackElement.classList.add('hidden');
    }, 1500);
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
 * 添加到解析记录
 * @param {Object} question - 题目对象
 * @param {boolean} isCorrect - 是否回答正确
 */
function addToExplanationList(question, isCorrect) {
    const explanationItems = document.querySelector('.explanation-items');
    if (!explanationItems) return;
    
    const item = document.createElement('div');
    item.className = `explanation-item ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
    item.innerHTML = `
        <strong>${question.question}</strong>
        <div>你的答案: ${isCorrect ? question.answer : document.querySelector('.option-btn.incorrect').textContent}</div>
        <div>正确答案: ${question.answer}</div>
        <div class="explanation-text">${question.explanation}</div>
    `;
    
    // 添加淡入动画
    item.style.opacity = '0';
    explanationItems.prepend(item);
    
    // 触发重排后设置opacity为1，实现动画
    setTimeout(() => {
        item.style.transition = 'opacity 0.3s ease';
        item.style.opacity = '1';
    }, 10);
    
    // 限制解析记录数量
    if (explanationItems.children.length > 10) {
        explanationItems.removeChild(explanationItems.lastChild);
    }
}

/**
 * 开始计时器
 */
function startTimer() {
    // 清除之前的计时器
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // 设置新计时器
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('time-left').textContent = timeLeft.toString();
        
        // 更新进度条
        const progressPercent = (timeLeft / 60) * 100;
        document.getElementById('progress-fill').style.width = `${progressPercent}%`;
        
        // 改变进度条颜色表示紧急程度
        if (timeLeft < 10) {
            document.getElementById('progress-fill').style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        } else if (timeLeft < 20) {
            document.getElementById('progress-fill').style.background = 'linear-gradient(90deg, #f39c12, #d35400)';
        }
        
        // 时间到，结束游戏
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
    const timeSpent = Math.round((completionTime - startTime) / 1000);
    
    // 更新最终得分显示
    document.getElementById('final-score').textContent = score.toString();
    
    // 更新答题统计
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 保存成绩到排行榜
    const isNewRecord = saveScoreToLeaderboard(score, correctAnswers, incorrectAnswers, totalAnswered, timeSpent);
    
    // 显示游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    
    // 显示当前题库排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
    
    // 如果是新纪录，显示庆祝信息
    if (isNewRecord) {
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
 * 保存分数到排行榜
 * @param {number} score - 分数
 * @param {number} correct - 正确数量
 * @param {number} incorrect - 错误数量
 * @param {number} total - 总答题数
 * @param {number} timeSpent - 用时(秒)
 * @returns {boolean} 是否是新纪录
 */
function saveScoreToLeaderboard(score, correct, incorrect, total, timeSpent) {
    try {
        // 获取现有排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 创建新成绩记录
        const newScore = {
            score: score,
            correct: correct,
            incorrect: incorrect,
            total: total,
            accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
            timeSpent: timeSpent,
            date: new Date().toISOString(),
            library: currentLibrary.file,
            libraryName: currentLibrary.name
        };
        
        // 添加新成绩
        leaderboard.push(newScore);
        
        // 按分数排序，保留前100名
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > 100) {
            leaderboard = leaderboard.slice(0, 100);
        }
        
        // 保存回本地存储
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        
        // 检查是否是当前题库的新纪录
        const libraryScores = leaderboard.filter(entry => entry.library === currentLibrary.file);
        return libraryScores.length > 0 && libraryScores[0].score === score && libraryScores[0].date === newScore.date;
    } catch (error) {
        console.error('保存成绩到排行榜失败:', error);
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
    try {
        const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        const libraries = new Set();
        
        // 添加排行榜中存在的题库
        leaderboard.forEach(entry => {
            if (entry.library && entry.libraryName) {
                libraries.add({ id: entry.library, name: entry.libraryName });
            }
        });
        
        // 添加内置题库
        availableLibraries.forEach(library => {
            libraries.add({ id: library.file, name: library.file });
        });
        
        // 添加到筛选器
        Array.from(libraries).forEach(library => {
            const option = document.createElement('option');
            option.value = library.id;
            option.textContent = library.name;
            filter.appendChild(option);
        });
        
        // 恢复之前的选中值
        if (currentValue && filter.querySelector(`option[value="${currentValue}"]`)) {
            filter.value = currentValue;
        }
    } catch (error) {
        console.error('填充题库筛选器失败:', error);
    }
}

/**
 * 更新排行榜显示
 * @param {string} listId - 列表元素ID
 * @param {string} libraryFilter - 题库筛选器值，"all"表示所有
 */
function updateLeaderboardDisplay(listId, libraryFilter) {
    const leaderboardElement = document.getElementById(listId);
    if (!leaderboardElement) return;
    
    try {
        // 获取排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 应用筛选
        if (libraryFilter && libraryFilter !== 'all') {
            leaderboard = leaderboard.filter(entry => entry.library === libraryFilter);
        }
        
        // 清空列表
        leaderboardElement.innerHTML = '';
        
        // 如果没有记录
        if (leaderboard.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = '暂无记录';
            emptyItem.style.textAlign = 'center';
            leaderboardElement.appendChild(emptyItem);
            return;
        }
        
        // 添加记录
        leaderboard.slice(0, 10).forEach((entry, index) => {
            const date = new Date(entry.date);
            const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            
            const item = document.createElement('li');
            item.innerHTML = `
                <div>
                    <strong>${index + 1}. ${entry.score}分</strong>
                    ${entry.libraryName ? `<span class="library-meta">${entry.libraryName}</span>` : ''}
                </div>
                <div>
                    <span>${formattedDate}</span>
                    <span class="accuracy">${entry.accuracy}%</span>
                </div>
            `;
            
            leaderboardElement.appendChild(item);
        });
    } catch (error) {
        console.error('更新排行榜显示失败:', error);
        leaderboardElement.innerHTML = '<li>加载失败</li>';
    }
}

/**
 * 返回主菜单
 */
function backToMenu() {
    // 清除计时器（如果正在运行）
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // 显示主菜单，隐藏其他界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('leaderboard-menu').classList.add('hidden');
    document.getElementById('game-over-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
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
    });
    
    // 关闭弹窗
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    // 点击弹窗外部关闭
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

/**
 * 显示错误消息
 * @param {string} message - 错误消息内容
 */
function showErrorMessage(message) {
    alert(`错误: ${message}`);
}

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
let answerRecords = [];              // 答题记录，用于解析显示

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
    });
    document.getElementById('back-to-menu-btn').addEventListener('click', backToMenu);
    document.getElementById('restart-game-btn').addEventListener('click', backToMenu); // 返回主界面
    document.getElementById('clear-leaderboard-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('select-library-btn').addEventListener('click', showLibrarySelector);
    document.getElementById('back-from-library-btn').addEventListener('click', hideLibrarySelector);
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    document.getElementById('global-back-btn').addEventListener('click', backToMenu);
    document.getElementById('global-clear-btn').addEventListener('click', clearLeaderboard);
    
    // 知识卡片点击事件
    document.getElementById('knowledge-card').addEventListener('click', showRandomKnowledge);
    
    // 绑定排行榜筛选事件
    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value);
    });
    
    // 绑定排行榜项目点击事件
    document.getElementById('leaderboard').addEventListener('click', function(e) {
        const listItem = e.target.closest('li');
        if (listItem && listItem.dataset.id) {
            showLeaderboardExplanation(listItem.dataset.id);
        }
    });
    
    // 初始化拖放上传
    initDragAndDropUpload();
    
    // 初始化游戏说明弹窗
    setupInstructionsModal();
    
    // 检查本地存储的选中题库
    loadSelectedLibrary();
    
    // 加载可用题库列表
    loadAvailableLibraries();
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
}

/**
 * 显示通知弹窗
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型：success, error, info
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="close-btn"><i class="fas fa-times"></i></button>
    `;
    
    // 添加到容器
    container.appendChild(notification);
    
    // 关闭按钮事件
    notification.querySelector('.close-btn').addEventListener('click', () => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    });
    
    // 3秒后自动关闭
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    console.log(`${type.toUpperCase()}: ${message}`);
}

/**
 * 初始化拖放上传功能
 */
function initDragAndDropUpload() {
    const uploadArea = document.getElementById('upload-area');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#3498db';
        uploadArea.style.background = 'rgba(52, 152, 219, 0.1)';
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#bdc3c7';
        uploadArea.style.background = 'rgba(52, 152, 219, 0.05)';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#bdc3c7';
        uploadArea.style.background = 'rgba(52, 152, 219, 0.05)';
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                handleFileUpload(file);
            } else {
                showNotification('请上传JSON格式的题库文件', 'error');
            }
        }
    });
}

/**
 * 处理文件上传
 * @param {File} file - 上传的文件
 */
function handleFileUpload(file) {
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
            
            // 重新渲染列表以更新选中状态
            renderLibraryList();
            
            // 清空文件输入，允许重新选择同一个文件
            document.getElementById('library-file-input').value = '';
            
            showNotification(`成功加载题库: ${currentLibrary.name}`, 'success');
        } catch (error) {
            showNotification('解析题库文件失败: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

/**
 * 加载可用题库列表
 */
async function loadAvailableLibraries() {
    // 网页模式下尝试动态获取data文件夹中的所有JSON文件
    if (window.location.protocol !== 'file:') {
        try {
            // 由于没有后端接口，我们假设已知文件名模式
            // 尝试加载从1开始的JSON文件直到失败
            availableLibraries = [];
            let i = 1;
            while (true) {
                try {
                    const filePath = `data/${i}.json`;
                    const info = await fetchLibraryInfo(filePath);
                    availableLibraries.push({
                        id: i.toString(),
                        file: filePath,
                        name: info.name,
                        questionCount: info.questionCount
                    });
                    i++;
                } catch (error) {
                    break; // 加载失败，说明没有更多文件
                }
            }
            
            // 如果没有找到任何题库，使用默认设置
            if (availableLibraries.length === 0) {
                availableLibraries = [
                    { id: '1', file: 'data/1.json', name: '默认题库1', questionCount: 0 },
                    { id: '2', file: 'data/2.json', name: '默认题库2', questionCount: 0 }
                ];
            }
        } catch (error) {
            showNotification('加载题库列表失败，使用默认列表', 'error');
            availableLibraries = [
                { id: '1', file: 'data/1.json', name: '默认题库1', questionCount: 0 },
                { id: '2', file: 'data/2.json', name: '默认题库2', questionCount: 0 }
            ];
        }
    } else {
        // 本地模式下不自动加载，等待用户选择
        availableLibraries = [];
    }
    
    // 确保当前选中的题库在可用列表中，如不在则使用第一个
    if (currentLibrary.file && !availableLibraries.some(l => l.file === currentLibrary.file)) {
        if (availableLibraries.length > 0) {
            currentLibrary = {
                file: availableLibraries[0].file,
                name: availableLibraries[0].name,
                questionCount: availableLibraries[0].questionCount
            };
            localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
        }
    }
    
    // 更新当前选择显示
    document.getElementById('current-library-name').textContent = currentLibrary.name;
    
    // 预加载当前选中的题库
    await loadCurrentLibrary();
    
    // 隐藏加载界面
    hideLoadingScreen();
    
    // 显示随机知识点
    showRandomKnowledge();
}

/**
 * 显示题库选择界面
 */
function showLibrarySelector() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('library-selector').classList.remove('hidden');
    renderLibraryList();
    
    // 显示返回按钮，隐藏清空按钮
    document.getElementById('global-back-btn').classList.remove('hidden');
    document.getElementById('global-clear-btn').classList.add('hidden');
}

/**
 * 隐藏题库选择界面，返回主菜单
 */
function hideLibrarySelector() {
    document.getElementById('library-selector').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
    
    // 隐藏全局控制按钮
    document.getElementById('global-controls').classList.add('hidden');
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
        const item = document.createElement('div');
        item.className = `library-item ${currentLibrary.file === library.file ? 'selected' : ''}`;
        item.innerHTML = `
            <div>
                <div>${library.name || library.file}</div>
                <div class="library-meta">${library.questionCount || '未知'} 题</div>
            </div>
            ${currentLibrary.file === library.file ? '<i class="fas fa-check"></i>' : ''}
        `;
        
        item.addEventListener('click', () => {
            selectLibrary(library.file, library.name, library.questionCount);
        });
        
        libraryList.appendChild(item);
    });
    
    // 本地模式下只显示上传区域
    if (window.location.protocol === 'file:') {
        document.getElementById('library-list').style.display = availableLibraries.length > 0 ? 'flex' : 'none';
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
    
    // 显示随机知识点
    showRandomKnowledge();
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
        showNotification('加载保存的题库失败，使用默认设置', 'error');
        // 加载失败时使用默认题库
        currentLibrary = {
            file: 'data/1.json',
            name: '默认题库',
            questionCount: 0
        };
    }
}

/**
 * 加载当前选中的题库
 */
async function loadCurrentLibrary() {
    // 检查是否是本地file协议
    if (window.location.protocol === 'file:') {
        console.log('检测到本地文件协议，使用文件选择方式加载题库');
        // 不自动加载，等待用户选择
        if (currentLibrary.file && currentLibrary.file.includes('.json')) {
            // 如果有保存的本地文件，尝试重新加载
            return true;
        }
        return false;
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
    
    handleFileUpload(file);
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
    currentLibrary.name = content.name || filePath.split('/').pop().replace('.json', '');
    currentLibrary.questionCount = content.questions.length;
    
    // 更新可用题库列表中的信息
    const libIndex = availableLibraries.findIndex(l => l.file === filePath);
    if (libIndex !== -1) {
        availableLibraries[libIndex].name = currentLibrary.name;
        availableLibraries[libIndex].questionCount = currentLibrary.questionCount;
    }
    
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
        
        // 确保有ID
        if (!q.id) {
            q.id = idx + 1;
        }
        
        return true;
    });
    
    // 随机排序题库
    shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    
    showNotification(`题库加载完成，共 ${questions.length} 题`, 'success');
}

/**
 * 创建解析列表容器
 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        explanationSection.innerHTML = `
            <div class="card explanation-card">
                <h3>答题解析</h3>
                <div id="explanation-list" class="explanation-list">
                    <!-- 解析列表将在这里动态生成 -->
                </div>
            </div>
        `;
    }
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
    
    // 显示全局返回按钮
    document.getElementById('global-controls').classList.remove('hidden');
    document.getElementById('global-back-btn').classList.remove('hidden');
    document.getElementById('global-clear-btn').classList.add('hidden');
    
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
    answerRecords = [];
    
    // 重新随机排序题库
    shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    
    // 重置UI
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    document.getElementById('explanation-list').innerHTML = '';
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
        document.getElementById('progress-fill').style.width = `${(timeLeft / 60) * 100}%`;
        
        // 改变进度条颜色，时间越少越红
        const hue = (timeLeft / 60) * 120; // 从绿色(120)到红色(0)
        document.getElementById('progress-fill').style.background = `hsl(${hue}, 70%, 50%)`;
        
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/**
 * 显示下一题
 */
function showNextQuestion() {
    // 隐藏反馈
    document.getElementById('feedback').classList.add('hidden');
    
    // 检查是否还有题目
    if (currentQuestionIndex >= shuffledQuestions.length) {
        // 如果题目答完了，但时间还没到，重新随机题目
        shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
        currentQuestionIndex = 0;
    }
    
    const question = shuffledQuestions[currentQuestionIndex];
    currentQuestionIndex++;
    
    // 根据难度设置选项数量
    const optionsCount = {1:3, 2:4, 3:5, 4:6}[question.difficulty] || 3;
    
    // 确保有足够的选项，如果不够则使用所有可用选项
    let availableOptions = [...new Set(question.options)]; // 去重
    if (availableOptions.length < optionsCount) {
        optionsCount = availableOptions.length;
        console.warn(`题目ID ${question.id} 选项不足，使用${optionsCount}个选项`);
    }
    
    // 确保正确答案在选项中
    if (!availableOptions.includes(question.answer)) {
        availableOptions.push(question.answer);
    }
    
    // 随机选择选项并打乱顺序
    let selectedOptions = [];
    // 先添加正确答案
    selectedOptions.push(question.answer);
    // 再添加其他选项直到达到所需数量
    const otherOptions = availableOptions.filter(opt => opt !== question.answer);
    
    while (selectedOptions.length < optionsCount && otherOptions.length > 0) {
        const randomIndex = Math.floor(Math.random() * otherOptions.length);
        selectedOptions.push(otherOptions.splice(randomIndex, 1)[0]);
    }
    
    // 打乱选项顺序
    selectedOptions = selectedOptions.sort(() => Math.random() - 0.5);
    
    // 显示题目
    document.getElementById('question').innerHTML = `NO.${question.id} ${question.question}`;
    
    // 显示选项
    const optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = '';
    
    selectedOptions.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.addEventListener('click', () => {
            checkAnswer(question, option, optionElement);
        });
        optionsContainer.appendChild(optionElement);
    });
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
    
    // 标记选中的选项
    if (selectedOption === question.answer) {
        // 回答正确
        correctAnswers++;
        const points = {1:5, 2:10, 3:15, 4:20}[question.difficulty] || 5;
        score += points;
        document.getElementById('score-value').textContent = score;
        document.getElementById('feedback').textContent = `正确！+${points}分`;
        document.getElementById('feedback').className = 'feedback-correct';
        
        // 记录正确答案
        answerRecords.unshift({
            question: question,
            userAnswer: selectedOption,
            isCorrect: true,
            points: points
        });
    } else {
        // 回答错误
        incorrectAnswers++;
        optionElement.classList.add('incorrect');
        document.getElementById('feedback').textContent = `错误！正确答案是：${question.answer}`;
        document.getElementById('feedback').className = 'feedback-incorrect';
        
        // 记录错误答案
        answerRecords.unshift({
            question: question,
            userAnswer: selectedOption,
            isCorrect: false,
            points: 0
        });
    }
    
    // 更新统计
    totalAnswered++;
    updateAccuracyDisplay();
    
    // 显示反馈
    document.getElementById('feedback').classList.remove('hidden');
    
    // 显示解析
    addExplanation(question, selectedOption, selectedOption === question.answer);
    
    // 延迟显示下一题
    setTimeout(showNextQuestion, 1500);
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
 * 添加解析
 * @param {Object} question - 题目对象
 * @param {string} selectedOption - 选中的选项
 * @param {boolean} isCorrect - 是否正确
 */
function addExplanation(question, selectedOption, isCorrect) {
    const explanationList = document.getElementById('explanation-list');
    
    const explanationItem = document.createElement('div');
    explanationItem.className = 'explanation-item';
    explanationItem.innerHTML = `
        <strong>第${question.id}题：${isCorrect ? '回答正确' : '回答错误'}</strong>
        <p>题目：${question.question}</p>
        <p>你的答案：${selectedOption}</p>
        <p>正确答案：${question.answer}</p>
        ${question.explanation ? `<p>解析：${question.explanation}</p>` : ''}
    `;
    
    // 添加到列表顶部
    if (explanationList.firstChild) {
        explanationList.insertBefore(explanationItem, explanationList.firstChild);
    } else {
        explanationList.appendChild(explanationItem);
    }
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
    
    // 保存成绩
    const newRecord = saveScore(score, correctAnswers, incorrectAnswers, totalAnswered);
    
    // 更新游戏结束界面
    document.getElementById('final-score').textContent = score;
    
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    
    // 显示当前题库的排行榜
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
    
    // 显示游戏结束界面
    document.getElementById('game').classList.add('hidden');
    document.getElementById('game-over-menu').classList.remove('hidden');
    
    // 显示全局返回按钮
    document.getElementById('global-controls').classList.remove('hidden');
    document.getElementById('global-back-btn').classList.remove('hidden');
    document.getElementById('global-clear-btn').classList.add('hidden');
    
    // 如果是新纪录，显示庆祝信息
    if (newRecord) {
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
        // 获取现有排行榜数据
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        
        // 创建新记录
        const newEntry = {
            id: Date.now(), // 使用时间戳作为唯一ID
            score: score,
            correct: correct,
            incorrect: incorrect,
            total: total,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            library: currentLibrary.file,
            libraryName: currentLibrary.name,
            answers: answerRecords // 保存答题记录用于解析
        };
        
        // 检查是否是当前题库的新纪录
        const libraryEntries = leaderboard.filter(entry => entry.library === currentLibrary.file);
        const isNewRecord = libraryEntries.length === 0 || score > Math.max(...libraryEntries.map(e => e.score));
        
        // 检查是否有相同的记录（防止重复）
        const duplicate = leaderboard.some(entry => 
            entry.score === score && 
            entry.correct === correct && 
            entry.incorrect === incorrect && 
            entry.total === total && 
            entry.library === currentLibrary.file &&
            // 10秒内的相同成绩视为重复
            Math.abs(entry.id - newEntry.id) < 10000
        );
        
        if (!duplicate) {
            // 添加新记录
            leaderboard.push(newEntry);
            
            // 按分数排序，保留前100名
            leaderboard.sort((a, b) => b.score - a.score);
            if (leaderboard.length > 100) {
                leaderboard = leaderboard.slice(0, 100);
            }
            
            // 保存回本地存储
            localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        }
        
        return isNewRecord && !duplicate;
    } catch (error) {
        console.error('保存分数失败:', error);
        showNotification('保存成绩失败', 'error');
        return false;
    }
}

/**
 * 查看排行榜
 */
function viewLeaderboard() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('leaderboard-container').classList.remove('hidden');
    
    // 显示全局按钮
    document.getElementById('global-controls').classList.remove('hidden');
    document.getElementById('global-back-btn').classList.remove('hidden');
    document.getElementById('global-clear-btn').classList.remove('hidden');
}

/**
 * 更新排行榜显示
 * @param {string} elementId - 要更新的元素ID
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
            leaderboard = leaderboard.filter(entry => entry.library === libraryFilter);
        }
        
        // 按分数排序
        leaderboard.sort((a, b) => b.score - a.score);
        
        // 显示排行榜
        leaderboardElement.innerHTML = '';
        
        if (leaderboard.length === 0) {
            leaderboardElement.innerHTML = '<li>暂无记录</li>';
            return;
        }
        
        leaderboard.forEach((entry, index) => {
            const accuracy = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
            const listItem = document.createElement('li');
            listItem.dataset.id = entry.id;
            listItem.innerHTML = `
                <div>
                    <strong>${index + 1}. ${entry.score}分</strong>
                    ${libraryFilter === 'all' ? `<div class="library-name">${entry.libraryName}</div>` : ''}
                    <div>${entry.date} ${entry.time}</div>
                    <div>正确率: ${accuracy}%</div>
                </div>
            `;
            leaderboardElement.appendChild(listItem);
        });
    } catch (error) {
        console.error('更新排行榜失败:', error);
        leaderboardElement.innerHTML = '<li>加载排行榜失败</li>';
    }
}

/**
 * 显示排行榜解析
 * @param {string} entryId - 记录ID
 */
function showLeaderboardExplanation(entryId) {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const entry = leaderboard.find(e => e.id.toString() === entryId);
    
    const explanationContainer = document.getElementById('leaderboard-explanation');
    
    if (!entry || !entry.answers || entry.answers.length === 0) {
        explanationContainer.innerHTML = '<p>没有找到解析数据</p>';
        return;
    }
    
    explanationContainer.innerHTML = '';
    
    entry.answers.forEach(record => {
        const question = record.question;
        const explanationItem = document.createElement('div');
        explanationItem.className = 'explanation-item';
        explanationItem.innerHTML = `
            <strong>第${question.id}题：${record.isCorrect ? '回答正确' : '回答错误'}</strong>
            <p>题目：${question.question}</p>
            <p>你的答案：${record.userAnswer}</p>
            <p>正确答案：${question.answer}</p>
            ${question.explanation ? `<p>解析：${question.explanation}</p>` : ''}
        `;
        explanationContainer.appendChild(explanationItem);
    });
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
    while (filterElement.options.length > 1) {
        filterElement.remove(1);
    }
    
    // 获取所有独特的题库
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const libraries = [...new Set(leaderboard.map(entry => ({
        file: entry.library,
        name: entry.libraryName
    })))];
    
    // 添加到筛选框
    libraries.forEach(library => {
        const option = document.createElement('option');
        option.value = library.file;
        option.textContent = library.name || library.file;
        filterElement.appendChild(option);
    });
    
    // 恢复选中值
    if (currentValue && filterElement.querySelector(`option[value="${currentValue}"]`)) {
        filterElement.value = currentValue;
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
    document.querySelectorAll('.screen, .screen-container').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById('start-menu').classList.remove('hidden');
    
    // 隐藏全局控制按钮
    document.getElementById('global-controls').classList.add('hidden');
    
    // 隐藏庆祝消息
    document.getElementById('celebration-message').classList.add('hidden');
}

/**
 * 清空排行榜
 */
function clearLeaderboard() {
    if (confirm('确定要清空排行榜记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.file);
        showNotification('排行榜已清空', 'info');
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
        // 显示全局返回按钮
        document.getElementById('global-controls').classList.remove('hidden');
        document.getElementById('global-back-btn').classList.remove('hidden');
        document.getElementById('global-clear-btn').classList.add('hidden');
    });
    
    // 关闭弹窗
    span.addEventListener('click', () => {
        modal.classList.add('hidden');
        // 隐藏全局控制按钮
        document.getElementById('global-controls').classList.add('hidden');
    });
    
    // 点击弹窗外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
            // 隐藏全局控制按钮
            document.getElementById('global-controls').classList.add('hidden');
        }
    });
}

/**
 * 显示随机知识点
 */
function showRandomKnowledge() {
    if (questions.length === 0) {
        document.getElementById('knowledge-content').innerHTML = '<p>请先选择并加载题库以查看知识点</p>';
        return;
    }
    
    // 随机选择一题
    const randomIndex = Math.floor(Math.random() * questions.length);
    const question = questions[randomIndex];
    
    // 添加淡入淡出效果
    const contentElement = document.getElementById('knowledge-content');
    contentElement.style.opacity = '0';
    
    setTimeout(() => {
        contentElement.innerHTML = `
            <p><strong>NO.${question.id} ${question.question}</strong></p>
            <p><strong>答案：</strong>${question.answer}</p>
            ${question.explanation ? `<p><strong>解析：</strong>${question.explanation}</p>` : ''}
        `;
        contentElement.style.opacity = '1';
    }, 300);
}

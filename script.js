/**
 * Geo-Quick-Answer 游戏主脚本
 * - 支持经典/无尽模式选择
 * - 左上角按钮缩略模式图标修复
 * - 题库列表固定顺序不变
 * - 解析栏/知识卡片描述字体和颜色区分
 * - 答题后解析时暂停倒计时减少
 * - 无尽模式答题轮数、计时增减、排行榜隔离
 * - 游戏界面渐进动画切换，排行榜美化
 * - 代码健壮性与注释
 */

let questions = [];
let shuffledQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeLeft = 60;
let timerInterval = null;
let startTime = null;
let completionTime = null;
let correctAnswers = 0;
let incorrectAnswers = 0;
let totalAnswered = 0;
let currentGameRecords = [];
let endlessRound = 0; // 初始为0轮
let endlessMode = false;
let modeName = 'classic'; // classic/endless
let loadingTimeout = null;
let endlessTimerMax = 90;
let endlessTimerMin = 0;
const leaderboardKey = 'leaderboard_v2';
const selectedLibraryKey = 'selectedLibrary';
let availableLibraries = [];
let currentLibrary = { file: '', name: '加载中...', questionCount: 0 };
let lastQuestionNumber = 0; // 记录最后的题号，防止重复记录

document.addEventListener('DOMContentLoaded', () => {
    createExplanationList();
    document.getElementById('start-game-btn').addEventListener('click', () => switchScreen('start-menu', 'mode-select-menu'));
    document.getElementById('choose-classic-btn').addEventListener('click', () => chooseGameMode('classic'));
    document.getElementById('choose-endless-btn').addEventListener('click', () => chooseGameMode('endless'));
    document.getElementById('back-from-mode-btn').addEventListener('click', () => switchScreen('mode-select-menu', 'start-menu'));

    document.getElementById('view-leaderboard-btn').addEventListener('click', () => {
        switchScreen('start-menu', 'leaderboard-menu');
        viewLeaderboard();
        populateLibraryFilter();
    });
    document.getElementById('restart-game-btn').addEventListener('click', () => switchScreen('game-over-menu', 'start-menu'));
    document.getElementById('clear-records-btn').addEventListener('click', clearLeaderboard);
    document.getElementById('select-library-btn').addEventListener('click', () => switchScreen('start-menu', 'library-selector'));
    document.getElementById('back-from-library-btn').addEventListener('click', () => switchScreen('library-selector', 'start-menu'));
    document.getElementById('library-file-input').addEventListener('change', handleLibraryFileSelect);
    document.getElementById('control-back-btn').addEventListener('click', () => {
        // 动态判断当前界面返回主菜单
        const screens = document.querySelectorAll('.screen:not(.hidden)');
        let currentScreen = 'start-menu';
        screens.forEach(s => { if (!s.classList.contains('hidden')) currentScreen = s.id; });
        switchScreen(currentScreen, 'start-menu');
    });
    document.getElementById('control-clear-btn').addEventListener('click', clearLeaderboard);

    document.getElementById('knowledge-card').addEventListener('click', showRandomKnowledgeFade);

    document.getElementById('library-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', this.value, document.getElementById('leaderboard-mode-filter').value);
    });

    document.getElementById('leaderboard-mode-filter').addEventListener('change', function() {
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value, this.value);
    });

    document.getElementById('leaderboard').addEventListener('click', function(e) {
        const listItem = e.target.closest('li');
        if (listItem && listItem.dataset.id) {
            showLeaderboardExplanation(listItem.dataset.id);
        }
    });

    initDragAndDrop();
    setupInstructionsModal();
    loadSelectedLibrary();

    // 加载题库文件（如在线）
    if (window.location.protocol !== 'file:') {
        showLoadingScreen();
        fetchDataFolderFiles();
        loadingTimeout = setTimeout(() => {
            showNotification('加载超时，请手动选择题库', 'error');
            hideLoadingScreen();
        }, 10000);
    } else {
        document.querySelector('.library-list').style.display = 'none';
        document.querySelector('.file-upload-section').style.marginTop = '0';
    }
});

/** 渐进动画切换界面 */
function switchScreen(fromId, toId) {
    const fromScreen = document.getElementById(fromId);
    const toScreen = document.getElementById(toId);

    if (fromScreen && toScreen) {
        fromScreen.classList.add('fade-leave');
        setTimeout(() => {
            fromScreen.classList.add('hidden');
            fromScreen.classList.remove('fade-leave');
            toScreen.classList.remove('hidden');
            toScreen.classList.add('fade-enter');
            setTimeout(() => {
                toScreen.classList.remove('fade-enter');
            }, 350);
        }, 350);
    }
    // 控制按钮显示
    if (toId === 'library-selector' || toId === 'leaderboard-menu') {
        showControlButton('back');
    } else {
        hideControlButtons();
    }
    if (toId === 'leaderboard-menu') showControlButton('clear');
}

/** 显示加载界面 */
function showLoadingScreen() {
    document.getElementById('loading-screen').classList.remove('hidden');
}

/** 隐藏加载界面 */
function hideLoadingScreen() {
    document.getElementById('loading-screen').classList.add('hidden');
    if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
}

/** 读取data文件夹所有json文件，顺序不变 */
async function fetchDataFolderFiles() {
    try {
        const possibleFiles = ['1.json', '2.json', '3.json', '4.json', '5.json'];
        const foundFiles = [];
        for (const file of possibleFiles) {
            try {
                const response = await fetch(`data/${file}`);
                if (response.ok) foundFiles.push(file);
            } catch (error) {}
        }
        // 保持原有顺序
        availableLibraries = possibleFiles.filter(f => foundFiles.includes(f)).map(file => ({
            id: file.split('.')[0],
            file: `data/${file}`
        }));
        if (availableLibraries.length > 0 && !currentLibrary.file) {
            currentLibrary.file = availableLibraries[0].file;
        }
        await loadCurrentLibrary();
        renderLibraryList();
        if (questions.length > 0) showRandomKnowledge();
        hideLoadingScreen();
    } catch (error) {
        showNotification('获取题库列表失败', 'error');
        hideLoadingScreen();
    }
}

/** 拖放上传功能 */
function initDragAndDrop() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('library-file-input');
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault(); uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault(); uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                handleDroppedFile(file);
            } else showNotification('请上传JSON格式的题库文件', 'error');
        }
    });
}

/** 处理拖放的文件 */
function handleDroppedFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = JSON.parse(e.target.result);
            processLibraryContent(content, file.name);
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

/** 通知弹窗 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const existing = Array.from(container.children).find(el => el.textContent.includes(message));
    if (existing) return;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
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
    notification.querySelector('.close-btn').addEventListener('click', () => {
        notification.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
    });
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}
function showErrorMessage(message) { showNotification(message, 'error'); }
function showInfoMessage(message) { showNotification(message, 'info'); }
function showSuccessMessage(message) { showNotification(message, 'success'); }

/** 渲染题库列表，顺序严格保持availableLibraries顺序 */
function renderLibraryList() {
    const libraryList = document.getElementById('library-list');
    if (!libraryList) return;
    libraryList.innerHTML = '';
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

/** 选择题库 */
function selectLibrary(filePath, name, questionCount) {
    currentLibrary = {
        file: filePath,
        name: name || filePath,
        questionCount: questionCount || 0
    };
    localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
    document.getElementById('current-library-name').textContent = currentLibrary.name;
    renderLibraryList();
    loadQuestionsFromFile(currentLibrary.file)
        .then(success => {
            if (success) {
                showSuccessMessage(`已选择题库: ${currentLibrary.name}`);
                showRandomKnowledge();
            }
        });
}

/** 加载本地存储的选中题库 */
function loadSelectedLibrary() {
    try {
        const savedLibrary = localStorage.getItem(selectedLibraryKey);
        if (savedLibrary) currentLibrary = JSON.parse(savedLibrary);
    } catch (e) {
        showErrorMessage('加载保存的题库失败，使用默认设置');
        currentLibrary = { file: '', name: '默认题库', questionCount: 0 };
    }
    document.getElementById('current-library-name').textContent = currentLibrary.name;
}

/** 加载当前选中的题库 */
function loadCurrentLibrary() {
    if (window.location.protocol === 'file:') return Promise.resolve(false);
    else if (currentLibrary.file) return loadQuestionsFromFile(currentLibrary.file);
    return Promise.resolve(false);
}

/** 处理本地题库文件选择 */
function handleLibraryFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = JSON.parse(e.target.result);
            processLibraryContent(content, file.name);
            currentLibrary = {
                file: file.name,
                name: content.name || file.name,
                questionCount: content.questions ? content.questions.length : 0
            };
            localStorage.setItem(selectedLibraryKey, JSON.stringify(currentLibrary));
            document.getElementById('current-library-name').textContent = currentLibrary.name;
            document.getElementById('library-file-input').value = '';
            showSuccessMessage(`已加载题库: ${currentLibrary.name}`);
            showRandomKnowledge();
        } catch (error) {
            showErrorMessage('解析题库文件失败: ' + error.message);
        }
    };
    reader.readAsText(file);
}

/** 获取题库信息 */
async function fetchLibraryInfo(filePath) {
    try {
        const res = await fetch(filePath);
        if (!res.ok) throw new Error(`加载题库信息失败: HTTP状态码 ${res.status}`);
        const content = await res.json();
        return {
            name: content.name || filePath.split('/').pop(),
            questionCount: content.questions ? content.questions.length : 0
        };
    } catch (error) {
        return {
            name: filePath.split('/').pop(),
            questionCount: 0
        };
    }
}

/** 加载题库 */
async function loadQuestionsFromFile(filePath) {
    try {
        showLoadingScreen();
        document.getElementById('loading-library').textContent = `正在加载: ${filePath.split('/').pop()}`;
        if (window.location.protocol === 'file:') {
            document.getElementById('library-file-input').click();
            hideLoadingScreen();
            return false;
        }
        const res = await fetch(filePath);
        if (!res.ok) throw new Error(`加载题库失败: HTTP状态码 ${res.status}`);
        const content = await res.json();
        processLibraryContent(content, filePath);
        hideLoadingScreen();
        return true;
    } catch (error) {
        showErrorMessage(`加载失败: ${error.message}，请尝试选择其他题库`);
        hideLoadingScreen();
        return false;
    }
}

/** 处理题库内容 */
function processLibraryContent(content, filePath) {
    if (!content.questions || !Array.isArray(content.questions)) {
        throw new Error('题库格式错误，预期包含questions数组');
    }
    currentLibrary.name = content.name || filePath.split('/').pop() || filePath;
    currentLibrary.questionCount = content.questions.length;
    questions = content.questions.filter((q, idx) => {
        if (!q.question || !q.answer || !q.options || q.difficulty === undefined) {
            return false;
        }
        if (!q.options.includes(q.answer)) {
            q.options.push(q.answer);
        }
        return true;
    });
    shuffledQuestions = [...questions];
    showInfoMessage(`已加载 ${questions.length} 道题`);
}

/** 解析栏容器 */
function createExplanationList() {
    const explanationSection = document.querySelector('.explanation-section');
    if (explanationSection) {
        const listContainer = document.createElement('div');
        listContainer.id = 'explanation-list';
        explanationSection.appendChild(listContainer);
    }
}

/** 选择模式后开始游戏 */
function chooseGameMode(mode) {
    modeName = mode;
    endlessMode = mode === 'endless';
    switchScreen('mode-select-menu', 'game');
    startGame();
}

/** 开始游戏（经典/无尽） */
function startGame() {
    if (questions.length === 0) {
        showErrorMessage('请先选择并加载一个题库');
        switchScreen('game', 'library-selector');
        return;
    }
    score = 0; timeLeft = 60; currentQuestionIndex = 0;
    correctAnswers = 0; incorrectAnswers = 0; totalAnswered = 0;
    currentGameRecords = [];
    endlessRound = 0; // 初始为0轮
    lastQuestionNumber = 0;
    shuffledQuestions = [...questions];
    shuffleArray(shuffledQuestions);

    // 状态栏初始化
    document.getElementById('score-value').textContent = '0';
    document.getElementById('time-left').textContent = '60';
    document.getElementById('accuracy-display').textContent = '0/0/0-0%';
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('progress-fill').style.background = 'linear-gradient(90deg, #2ecc71, #3498db)';
    document.getElementById('explanation-list').innerHTML = '';
    document.getElementById('endless-round-info').style.display = endlessMode ? 'inline-block' : 'none';
    document.getElementById('endless-round-count').textContent = endlessMode ? '0' : '';
    showControlButton('back'); hideControlButton('clear');

    startTime = new Date();
    startTimer();
    showNextQuestion();
}

/** 洗牌算法 */
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/** 下一题 */
function showNextQuestion() {
    // 题库答完一轮，重新洗牌
    if (currentQuestionIndex >= shuffledQuestions.length) {
        endlessRound++;
        currentQuestionIndex = 0;
        shuffleArray(shuffledQuestions);
        if (endlessMode) {
            showNotification(`已经答完${endlessRound - 1}轮，继续挑战！`, 'info');
            document.getElementById('endless-round-count').textContent = endlessRound.toString();
        }
    }
    if (endlessMode && totalAnswered === 0) {
        document.getElementById('endless-round-count').textContent = '0';
    }
    const question = shuffledQuestions[currentQuestionIndex];
    currentQuestionIndex++;
    lastQuestionNumber = totalAnswered + 1;
    // 渲染题目和选项
    const questionElement = document.getElementById('question');
    questionElement.innerHTML = `NO.${question.id} ${question.question}`;
    const optionCounts = {1: 3, 2: 4, 3: 5, 4: 6};
    const numOptions = optionCounts[question.difficulty] || 3;
    const availableOptions = [...question.options];
    shuffleArray(availableOptions);
    let selectedOptions = availableOptions.slice(0, numOptions);
    if (!selectedOptions.includes(question.answer)) {
        selectedOptions.pop();
        selectedOptions.push(question.answer);
        shuffleArray(selectedOptions);
    }
    const optionsElement = document.getElementById('options');
    optionsElement.innerHTML = '';
    selectedOptions.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.addEventListener('click', () => {
            checkAnswer(question, option, optionElement, lastQuestionNumber);
        });
        optionsElement.appendChild(optionElement);
    });
    document.getElementById('feedback').classList.add('hidden');
}

/** 检查答案，解析后暂停时间改为700ms */
function checkAnswer(question, selectedOption, optionElement, questionNumber) {
    // 防止重复添加记录
    if (totalAnswered + 1 !== questionNumber) return;
    const allOptions = document.querySelectorAll('.option');
    allOptions.forEach(opt => {
        opt.style.pointerEvents = 'none';
    });
    const isCorrect = selectedOption === question.answer;
    totalAnswered++;
    if (isCorrect) {
        correctAnswers++;
        const scores = {1: 5, 2: 10, 3: 15, 4: 20};
        score += scores[question.difficulty] || 5;
        optionElement.classList.add('correct');
        document.getElementById('score-value').textContent = score.toString();
        if (endlessMode) {
            timeLeft = Math.min(endlessTimerMax, timeLeft + 3);
        }
    } else {
        incorrectAnswers++;
        optionElement.classList.add('incorrect');
        allOptions.forEach(opt => {
            if (opt.textContent === question.answer) {
                opt.classList.add('correct');
            }
        });
        if (endlessMode) {
            timeLeft = Math.max(endlessTimerMin, timeLeft - 2);
        }
    }
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.innerHTML = isCorrect ? 
        `<span class="explanation-desc">正确！</span> +${{1:5,2:10,3:15,4:20}[question.difficulty] || 5}分` : 
        `<span class="explanation-desc">错误。</span> 正确答案是：${question.answer}`;
    feedbackElement.className = isCorrect ? 'feedback-correct' : 'feedback-incorrect';
    feedbackElement.classList.remove('hidden');
    updateAccuracyDisplay();
    // 记录答题
    const record = {
        questionId: question.id,
        question: question.question,
        userAnswer: selectedOption,
        correctAnswer: question.answer,
        isCorrect: isCorrect,
        explanation: question.explanation || '无解析'
    };
    addToExplanationList(record, totalAnswered);
    currentGameRecords.push(record);
    setTimeout(() => {
        if (timeLeft <= 0) endGame();
        else showNextQuestion();
    }, 700);
}

/** 解析栏添加项，描述字体区分（防重复项） */
function addToExplanationList(record, questionNumber) {
    const explanationList = document.getElementById('explanation-list');
    // 防止同一题号添加多条记录
    if (explanationList.firstChild && explanationList.firstChild.dataset && explanationList.firstChild.dataset.qn == questionNumber) return;
    const item = document.createElement('div');
    item.className = `explanation-item ${record.isCorrect ? 'correct' : 'incorrect'}`;
    item.dataset.qn = questionNumber;
    item.innerHTML = `
        <div class="explanation-question">第${questionNumber}题：${record.isCorrect ? '<span class="explanation-desc">回答正确</span>' : '<span class="explanation-desc">回答错误</span>'}</div>
        <div class="explanation-text"><span>题目：</span>${record.question}</div>
        <div class="explanation-text"><span class="explanation-desc">解析：</span>${record.explanation}</div>
    `;
    if (explanationList.firstChild) {
        explanationList.insertBefore(item, explanationList.firstChild);
    } else {
        explanationList.appendChild(item);
    }
}

/** 正确率显示 */
function updateAccuracyDisplay() {
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('accuracy-display').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
}

/** 计时器 */
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('time-left').textContent = timeLeft.toString();
        // 进度条圆角与渐变
        let percent = 0;
        if (endlessMode) {
            percent = Math.max(0, Math.min(1, timeLeft / endlessTimerMax));
        } else {
            percent = Math.max(0, Math.min(1, timeLeft / 60));
        }
        document.getElementById('progress-fill').style.width = `${percent * 100}%`;
        // 颜色变化
        if (timeLeft < 10) {
            document.getElementById('progress-fill').style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        } else if (timeLeft < 20) {
            document.getElementById('progress-fill').style.background = 'linear-gradient(90deg, #f39c12, #d35400)';
        } else {
            document.getElementById('progress-fill').style.background = 'linear-gradient(90deg, #2ecc71, #3498db)';
        }
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/** 结束游戏 */
function endGame() {
    clearInterval(timerInterval);
    timerInterval = null;
    completionTime = new Date();
    const timeTaken = Math.round((completionTime - startTime) / 1000);
    switchScreen('game', 'game-over-menu');
    document.getElementById('final-score').textContent = score.toString();
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    document.getElementById('quiz-completion-time').textContent = 
        `${correctAnswers}/${incorrectAnswers}/${totalAnswered}-${accuracy}%`;
    document.getElementById('game-over-mode-tip').textContent = endlessMode ? '无尽模式' : '经典模式';
    document.getElementById('game-over-round-tip').textContent = endlessMode ? `已完成${endlessRound}轮！` : '';
    saveScoreToLeaderboard(score, correctAnswers, incorrectAnswers, totalAnswered, timeTaken);
    updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.name, modeName);
    hideControlButtons();
}

/** 排行榜保存 */
function saveScoreToLeaderboard(score, correct, incorrect, total, timeTaken) {
    try {
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        // 模式隔离
        const duplicate = leaderboard.some(entry => 
            entry.score === score &&
            entry.date.startsWith(today) &&
            entry.library === currentLibrary.name &&
            entry.correct === correct &&
            entry.total === total &&
            entry.mode === modeName
        );
        if (duplicate) return;
        const newEntry = {
            id: Date.now().toString(),
            score: score,
            correct: correct,
            incorrect: incorrect,
            total: total,
            timeTaken: timeTaken,
            date: now.toLocaleString(),
            library: currentLibrary.name,
            mode: modeName,
            endlessRound: endlessMode ? endlessRound : 0,
            records: currentGameRecords
        };
        leaderboard.push(newEntry);
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > 100) leaderboard = leaderboard.slice(0, 100);
        localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
        const libraryScores = leaderboard.filter(entry => entry.library === currentLibrary.name && entry.mode === modeName);
        if (libraryScores.length === 1 || score >= libraryScores[0].score) {
            document.getElementById('celebration-message').classList.remove('hidden');
            document.getElementById('record-message').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('celebration-message').classList.add('hidden');
            }, 3000);
        }
    } catch (error) {
        showErrorMessage('保存成绩失败');
    }
}

/** 排行榜界面 */
function viewLeaderboard() {
    updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value, document.getElementById('leaderboard-mode-filter').value);
}

/** 排行榜筛选 */
function populateLibraryFilter() {
    const filter = document.getElementById('library-filter');
    if (!filter) return;
    const currentValue = filter.value;
    while (filter.options.length > 1) { filter.remove(1);}
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const mode = document.getElementById('leaderboard-mode-filter').value;
    const libraries = new Set();
    leaderboard.filter(entry => entry.mode === mode).forEach(entry => { libraries.add(entry.library); });
    availableLibraries.forEach(library => {
        fetchLibraryInfo(library.file).then(info => {
            libraries.add(info.name);
        });
    });
    libraries.forEach(library => {
        const option = document.createElement('option');
        option.value = library;
        option.textContent = library;
        filter.appendChild(option);
    });
    if (currentValue && [...libraries].includes(currentValue)) {
        filter.value = currentValue;
    }
}

/** 排行榜显示（美化） */
function updateLeaderboardDisplay(elementId, libraryFilter = 'all', modeFilter = 'classic') {
    const leaderboardElement = document.getElementById(elementId);
    if (!leaderboardElement) return;
    try {
        let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
        leaderboard = leaderboard.filter(entry => entry.mode === modeFilter);
        if (libraryFilter !== 'all') {
            leaderboard = leaderboard.filter(entry => entry.library === libraryFilter);
        }
        leaderboardElement.innerHTML = '';
        if (leaderboard.length === 0) {
            leaderboardElement.innerHTML = '<li>暂无记录</li>';
            return;
        }
        const displayEntries = leaderboard.slice(0, 10);
        displayEntries.forEach((entry, index) => {
            const listItem = document.createElement('li');
            listItem.dataset.id = entry.id;
            const accuracy = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
            const date = new Date(entry.date);
            const formattedDate = date.toLocaleDateString();
            const formattedTime = date.toLocaleTimeString();
            let html = `
                <span class="rank-badge">${index + 1}</span>
                <span class="score-main">${entry.score}</span>
                <span class="score-detail">
                    <span class="accuracy-badge">${accuracy}%</span>
                    ${entry.mode === 'endless' && entry.endlessRound ? `<span class="round-badge">轮:${entry.endlessRound}</span>` : ''}
                    <span class="date-badge">${formattedDate}<br>${formattedTime}</span>
                </span>
                ${libraryFilter === 'all' ? `<span class="library-badge">${entry.library}</span>` : ''}
            `;
            listItem.innerHTML = html;
            leaderboardElement.appendChild(listItem);
        });
    } catch (error) {
        leaderboardElement.innerHTML = '<li>加载失败</li>';
    }
}

/** 排行榜解析 */
function showLeaderboardExplanation(recordId) {
    const leaderboard = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    const entry = leaderboard.find(item => item.id === recordId);
    const container = document.getElementById('leaderboard-explanation-content');
    if (!container || !entry || !entry.records) {
        container.innerHTML = '<p>无解析数据</p>';
        return;
    }
    container.innerHTML = '';
    entry.records.slice().reverse().forEach((record, index) => {
        const item = document.createElement('div');
        item.className = `explanation-item ${record.isCorrect ? 'correct' : 'incorrect'}`;
        item.innerHTML = `
            <div class="explanation-question">第${index + 1}题：${record.isCorrect ? '<span class="explanation-desc">回答正确</span>' : '<span class="explanation-desc">回答错误</span>'}</div>
            <div class="explanation-text">题目：${record.question}</div>
            <div class="explanation-text">你的答案：${record.userAnswer}</div>
            <div class="explanation-text">正确答案：${record.correctAnswer}</div>
            <div class="explanation-text"><span class="explanation-desc">解析：</span>${record.explanation}</div>
        `;
        container.appendChild(item);
    });
}

/** 控制按钮相关 */
function showControlButton(id) {
    if (id === 'back') document.getElementById('control-back-btn').classList.remove('hidden');
    else if (id === 'clear') document.getElementById('control-clear-btn').classList.remove('hidden');
}
function hideControlButton(id) {
    if (id === 'back') document.getElementById('control-back-btn').classList.add('hidden');
    else if (id === 'clear') document.getElementById('control-clear-btn').classList.add('hidden');
}
function hideControlButtons() { hideControlButton('back'); hideControlButton('clear'); }

/** 返回主菜单（带动画） */
function backToMenu() {
    if (timerInterval) clearInterval(timerInterval);
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById('start-menu').classList.remove('hidden');
    document.getElementById('instructions-modal').classList.add('hidden');
    document.getElementById('celebration-message').classList.add('hidden');
    hideControlButtons();
}

/** 清空排行榜 */
function clearLeaderboard() {
    if (confirm('确定要清空所有记录吗？此操作不可恢复。')) {
        localStorage.removeItem(leaderboardKey);
        updateLeaderboardDisplay('leaderboard', document.getElementById('library-filter').value, document.getElementById('leaderboard-mode-filter').value);
        updateLeaderboardDisplay('game-over-leaderboard', currentLibrary.name, modeName);
        showSuccessMessage('记录已清空');
    }
}

/** 游戏说明弹窗 */
function setupInstructionsModal() {
    const modal = document.getElementById('instructions-modal');
    const btn = document.getElementById('show-instructions-btn');
    const span = document.querySelector('.close-modal');
    btn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        showControlButton('back');
    });
    span.addEventListener('click', () => {
        modal.classList.add('hidden');
        hideControlButton('back');
    });
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
            hideControlButton('back');
        }
    });
}

/** 知识卡片淡入淡出动画，描述字体区分 */
function showRandomKnowledgeFade() {
    const contentElement = document.getElementById('knowledge-content');
    if (!questions.length) {
        contentElement.innerHTML = '<p>请先选择一个题库</p>';
        return;
    }
    contentElement.classList.add('fade-out');
    setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * questions.length);
        const question = questions[randomIndex];
        contentElement.innerHTML = `
            <p><strong>NO.${question.id} ${question.question}</strong></p>
            <p><strong>答案：</strong>${question.answer}</p>
            <p class="knowledge-desc"><strong>解析：</strong>${question.explanation || '无解析'}</p>
        `;
        contentElement.classList.remove('fade-out');
        contentElement.classList.add('fade-in');
        setTimeout(() => {
            contentElement.classList.remove('fade-in');
        }, 400);
    }, 250);
}

/** 普通知识卡片刷新（无动画） */
function showRandomKnowledge() {
    const contentElement = document.getElementById('knowledge-content');
    if (!questions.length) {
        contentElement.innerHTML = '<p>请先选择一个题库</p>';
        return;
    }
    const randomIndex = Math.floor(Math.random() * questions.length);
    const question = questions[randomIndex];
    contentElement.innerHTML = `
        <p><strong>NO.${question.id} ${question.question}</strong></p>
        <p><strong>答案：</strong>${question.answer}</p>
        <p class="knowledge-desc"><strong>解析：</strong>${question.explanation || '无解析'}</p>
    `;
}

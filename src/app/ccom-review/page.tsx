// src/app/ccom-review/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import PermissionGuard from '@/components/common/PermissionGuard';
import Navbar from '@/components/common/Navbar';
import styles from './CcomReview.module.css';
import data from './data';

interface QuestionItem {
  question: string;
  answer: string;
  type: 'chapter' | 'title';
}

const CcomReviewContent = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [timerActive, setTimerActive] = useState(false);
  const [shuffledData, setShuffledData] = useState<QuestionItem[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  
  // Audio ref
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Settings
  const [timerDuration, setTimerDuration] = useState(10);
  const [selectedChapters, setSelectedChapters] = useState<Record<string, boolean>>({
    '0': true, '1': true, '2': true, '3': true, '4': true, '5': true,
    '6': true, '7': true, '8': true, '9': true, '10': true, '11': true, '附錄': true
  });
  const [quizMode, setQuizMode] = useState<'ALL' | 'CHAPTER' | 'TITLE'>('ALL');

  const allChapters = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '附錄'];

  // Prepare questions when settings change (but don't start game)
  useEffect(() => {
    prepareQuestions();
  }, [selectedChapters, quizMode]);

  const prepareQuestions = () => {
    // Filter by selected chapters
    const filtered = data.filter(item => {
      const chapterNum = item.chapter.split('.')[0];
      return selectedChapters[chapterNum];
    });

    if (filtered.length === 0) {
      setShuffledData([]);
      return;
    }

    // Create question objects based on quiz mode
    let questionPool: QuestionItem[] = [];
    
    filtered.forEach(item => {
      if (quizMode === 'ALL') {
        // 50/50 chance for each item to be chapter or title question
        if (Math.random() < 0.5) {
          questionPool.push({ question: item.chapter, answer: item.title, type: 'chapter' });
        } else {
          questionPool.push({ question: item.title, answer: item.chapter, type: 'title' });
        }
      } else if (quizMode === 'CHAPTER') {
        // Only chapter questions
        questionPool.push({ question: item.chapter, answer: item.title, type: 'chapter' });
      } else if (quizMode === 'TITLE') {
        // Only title questions
        questionPool.push({ question: item.title, answer: item.chapter, type: 'title' });
      }
    });

    // Shuffle the pool
    const shuffled = questionPool.sort(() => Math.random() - 0.5);
    setShuffledData(shuffled);
  };

  // Play beep sound
  const playBeep = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.log('Audio play failed:', err));
    }
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            playBeep(); // Play sound ONLY when timer reaches 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  const startGame = () => {
    if (shuffledData.length === 0) return;
    setGameStarted(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setTimeRemaining(timerDuration);
    setTimerActive(true);
  };

  const handleNext = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % shuffledData.length);
    setTimeRemaining(timerDuration);
    setTimerActive(true); // Auto-start timer
  };

  const handlePrevious = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + shuffledData.length) % shuffledData.length);
    setTimeRemaining(timerDuration);
    setTimerActive(false);
  };

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
    if (!showAnswer) {
      setTimerActive(false);
    }
  };

  const stopTimer = () => {
    setTimerActive(false);
  };

  const handleChapterToggle = (chapter: string) => {
    setSelectedChapters(prev => ({
      ...prev,
      [chapter]: !prev[chapter]
    }));
  };

  const selectAllChapters = () => {
    const allSelected: Record<string, boolean> = {};
    allChapters.forEach(ch => allSelected[ch] = true);
    setSelectedChapters(allSelected);
  };

  const deselectAllChapters = () => {
    const noneSelected: Record<string, boolean> = {};
    allChapters.forEach(ch => noneSelected[ch] = false);
    setSelectedChapters(noneSelected);
  };

  const hasSelectedChapters = Object.values(selectedChapters).some(val => val);
  const currentItem = shuffledData[currentIndex];

  return (
    <div className={styles.container}>
      {/* Audio element */}
      <audio ref={audioRef} src="/audio/beep-0s.mp3" preload="auto" />
      
      <div className={styles.gameLayout}>
        {/* Left Sidebar - Settings */}
        <div className={styles.settingsSidebar}>
          <h3 className={styles.settingsTitle}>⚙️ Settings</h3>
          
          <div className={styles.settingGroupCompact}>
            <label>Timer (sec)</label>
            <input 
              type="number" 
              value={timerDuration}
              onChange={(e) => setTimerDuration(Number(e.target.value))}
              min={5}
              max={60}
              className={styles.inputCompact}
            />
          </div>
          
          <div className={styles.settingGroupCompact}>
            <label>Quiz Mode</label>
            <select 
              value={quizMode} 
              onChange={(e) => setQuizMode(e.target.value as 'ALL' | 'CHAPTER' | 'TITLE')} 
              className={styles.selectCompact}
            >
              <option value="ALL">Random</option>
              <option value="CHAPTER">Chapter → Title</option>
              <option value="TITLE">Title → Chapter</option>
            </select>
          </div>

          <div className={styles.settingGroupCompact}>
            <label>Chapters</label>
            <div className={styles.chapterActionsCompact}>
              <button className={styles.btnTiny} onClick={selectAllChapters}>All</button>
              <button className={styles.btnTiny} onClick={deselectAllChapters}>None</button>
            </div>
            <div className={styles.checkboxCompact}>
              {allChapters.map(chapter => (
                <label key={chapter} className={styles.checkboxLabelCompact}>
                  <input
                    type="checkbox"
                    checked={selectedChapters[chapter]}
                    onChange={() => handleChapterToggle(chapter)}
                  />
                  <span>{chapter}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className={styles.gameArea}>
          <h1 className={styles.gameTitle}>新生用CCOM抽問</h1>
          
          {!hasSelectedChapters ? (
            <div className={styles.warningBox}>
              <p>⚠️ Please select at least one chapter</p>
            </div>
          ) : !gameStarted ? (
            <div className={styles.startScreen}>
              <div className={styles.startInfo}>
                <p className={styles.readyCount}>{shuffledData.length} questions ready</p>
                <p className={styles.readyMode}>
                  Mode: {quizMode === 'ALL' ? 'Random' : quizMode === 'CHAPTER' ? 'Chapter → Title' : 'Title → Chapter'}
                </p>
              </div>
              <button className={styles.btnStart} onClick={startGame}>
                🚀 開始抽問
              </button>
            </div>
          ) : (
            <>
              {/* Timer and Counter */}
              <div className={styles.gameHeader}>
                <div className={styles.timerDisplay}>
                  <div className={`${styles.timerCircle} ${timeRemaining <= 3 ? styles.timerWarning : ''}`}>
                    {timeRemaining}
                  </div>
                  <div className={styles.timerControls}>
                    <button className={`${styles.btnTimerControl} ${styles.stop}`} onClick={stopTimer}>⏸</button>
                  </div>
                </div>
                
                <div className={styles.progressDisplay}>
                  <span className={styles.progressText}>{currentIndex + 1} / {shuffledData.length}</span>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill} 
                      style={{ width: `${((currentIndex + 1) / shuffledData.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Question Card */}
              <div className={styles.questionCard}>
                <div className={styles.questionTypeBadge}>
                  {currentItem.type === 'chapter' ? '📖 Chapter' : '📝 Title'}
                </div>
                <div className={styles.questionContent}>
                  <h2>{currentItem.question}</h2>
                </div>

                {showAnswer && (
                  <div className={styles.answerReveal}>
                    <div className={styles.answerLabel}>Answer:</div>
                    <div className={styles.answerContent}>{currentItem.answer}</div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className={styles.gameControls}>
                <button className={styles.btnControl} onClick={handlePrevious}>
                  ← Prev
                </button>
                
                <button className={`${styles.btnControl} ${styles.btnPrimary}`} onClick={toggleAnswer}>
                  {showAnswer ? '🙈 Hide' : '👁️ Show'}
                </button>
                
                <button className={styles.btnControl} onClick={handleNext}>
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function CcomReview() {
  return (
    <>
      <Navbar />
      <PermissionGuard app="ccom_review">
        <CcomReviewContent />
      </PermissionGuard>
    </>
  );
}
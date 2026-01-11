// src/components/mdafaat/MDAfaatGame.tsx
"use client";

import React, { useState } from 'react';
import { Shuffle, RotateCcw, Plus } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './MDAfaatGame.module.css';

interface Card {
  id: number;
  title: string;
  description: string;
  code: string;
  conflicts: number[];
}

interface CardData {
  emergency: Card[];
  passenger: Card[];
  equipment: Card[];
}

interface DrawnCard extends Card {
  type: 'emergency' | 'passenger' | 'equipment';
  originalId: number;
  timestamp: number;
  id: string;
}

interface PlayingCardProps {
  card: Partial<DrawnCard>;
  onRemove?: ((cardId: string) => void) | null;
  isInDeck?: boolean;
}

const MDAfaatGame = () => {
  const cardData: CardData = {
    emergency: [
      {
        id: 1,
        title: "客艙火災",
        description: "置物櫃旅客行李起火！",
        code: "E-01",
        conflicts: [2, 6]
      },
      {
        id: 2,
        title: "客艙失壓",
        description: "客艙破洞造成快速失壓！",
        code: "E-02",
        conflicts: [1, 4, 6, 8]
      },
      {
        id: 3,
        title: "亂流受傷",
        description: "旅客因通過無預警亂流受傷！",
        code: "E-03",
        conflicts: []
      },
      {
        id: 4,
        title: "PED電子用品起火",
        description: "手機電池發熱冒煙！",
        code: "E-04",
        conflicts: [2]
      },
      {
        id: 5,
        title: "醫療事件",
        description: "旅客昏倒，無心跳！",
        code: "E-05",
        conflicts: []
      },
      {
        id: 6,
        title: "客艙冒煙",
        description: "隱藏性火災，客艙冒煙！",
        code: "E-06",
        conflicts: [2]
      },
      {
        id: 7,
        title: "組員失能",
        description: "前艙組員失能！",
        code: "E-07",
        conflicts: []
      },
      {
        id: 8,
        title: "CPP",
        description: "雙引擎失效，準備迫降！",
        code: "E-08",
        conflicts: [1, 2, 6]
      },
      {
        id: 9,
        title: "滑出跑道",
        description: "飛機滑出跑道！",
        code: "E-09",
        conflicts: [1, 2, 6]
      }
    ],
    passenger: [
      {
        id: 1,
        title: "酒醉鬧事",
        description: "醉酒旅客開始鬧事！",
        code: "P-01",
        conflicts: [5]
      },
      {
        id: 2,
        title: "恐慌症發作",
        description: "旅客過度換氣！",
        code: "P-02",
        conflicts: []
      },
      {
        id: 3,
        title: "語言障礙",
        description: "外籍旅客聽不懂中英文！",
        code: "P-03",
        conflicts: []
      },
      {
        id: 4,
        title: "頑皮兒童",
        description: "小孩在走道奔跑！",
        code: "P-04",
        conflicts: []
      },
      {
        id: 5,
        title: "劫機威脅",
        description: "旅客發出威脅！",
        code: "P-05",
        conflicts: [1]
      },
      {
        id: 6,
        title: "密閉恐懼症",
        description: "要開啟逃生窗！",
        code: "P-06",
        conflicts: []
      },
      {
        id: 7,
        title: "身心障礙旅客",
        description: "有身心障礙旅客搭乘！",
        code: "P-07",
        conflicts: []
      },
    ],
    equipment: [
      {
        id: 1,
        title: "PA/INT系統故障",
        description: "無法正常廣播或與前艙通話！",
        code: "Q-01",
        conflicts: []
      },
      {
        id: 3,
        title: "電力系統故障",
        description: "客艙陷入黑暗！",
        code: "Q-03",
        conflicts: []
      },
      {
        id: 4,
        title: "廁所門卡死",
        description: "旅客被困在裡面！",
        code: "Q-04",
        conflicts: []
      },
      {
        id: 5,
        title: "氧氣系統故障",
        description: "面罩無法正常釋放！",
        code: "Q-05",
        conflicts: []
      },
      {
        id: 6,
        title: "艙門異常",
        description: "緊急出口無法開啟！",
        code: "Q-06",
        conflicts: []
      },
    ]
  };

  const [allDrawnCards, setAllDrawnCards] = useState<DrawnCard[]>([]);
  const [availableCards] = useState<CardData>(cardData);
  const [dealingAnimation, setDealingAnimation] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  const canDrawCard = (newCard: Card, existingCards: DrawnCard[], cardType: 'emergency' | 'passenger' | 'equipment'): boolean => {
    const existingIds = existingCards
      .filter(card => card.type === cardType)
      .map(card => card.originalId);

    if (existingIds.includes(newCard.id)) {
      return false;
    }

    for (const existingCard of existingCards) {
      if (existingCard.conflicts && existingCard.conflicts.includes(newCard.id)) {
        return false;
      }
      if (newCard.conflicts && newCard.conflicts.includes(existingCard.originalId)) {
        return false;
      }
    }

    return true;
  };

  const getAvailableCardsForType = (cardType: 'emergency' | 'passenger' | 'equipment'): Card[] => {
    return availableCards[cardType].filter(card =>
      canDrawCard(card, allDrawnCards, cardType)
    );
  };

  const getAllAvailableCards = (): (Card & { type: 'emergency' | 'passenger' | 'equipment' })[] => {
    const emergency = getAvailableCardsForType('emergency').map(card => ({ ...card, type: 'emergency' as const }));
    const passenger = getAvailableCardsForType('passenger').map(card => ({ ...card, type: 'passenger' as const }));
    const equipment = getAvailableCardsForType('equipment').map(card => ({ ...card, type: 'equipment' as const }));
    return [...emergency, ...passenger, ...equipment];
  };

  const drawRandomCard = () => {
    const allAvailable = getAllAvailableCards();

    if (allAvailable.length === 0) {
      return;
    }

    const randomCard = allAvailable[Math.floor(Math.random() * allAvailable.length)];

    const newCard: DrawnCard = {
      ...randomCard,
      originalId: randomCard.id,
      timestamp: Date.now(),
      id: `${randomCard.type}-${randomCard.id}-${Date.now()}`
    };

    setAllDrawnCards(prev => [...prev, newCard]);
  };

  const dealDefaultScenario = async () => {
    setShuffling(true);
    setDealingAnimation(true);

    await new Promise(resolve => setTimeout(resolve, 1500));
    setShuffling(false);

    const cardTypes: ('emergency' | 'passenger' | 'equipment')[] = ['emergency', 'passenger', 'equipment'];

    for (let i = 0; i < cardTypes.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));

      const cardType = cardTypes[i];
      const availableForType = getAvailableCardsForType(cardType);

      if (availableForType.length > 0) {
        const randomCard = availableForType[Math.floor(Math.random() * availableForType.length)];
        const newCard: DrawnCard = {
          ...randomCard,
          type: cardType,
          originalId: randomCard.id,
          timestamp: Date.now(),
          id: `${cardType}-${randomCard.id}-${Date.now()}`
        };

        setAllDrawnCards(prev => [...prev, newCard]);
      }
    }

    setDealingAnimation(false);
  };

  const resetAll = () => {
    setAllDrawnCards([]);
    setDealingAnimation(false);
    setShuffling(false);
  };

  const removeCard = (cardId: string) => {
    setAllDrawnCards(prev => prev.filter(card => card.id !== cardId));
  };

  const PlayingCard: React.FC<PlayingCardProps> = ({ card, onRemove = null, isInDeck = false }) => {
    const getCardClassName = () => {
      if (isInDeck) {
        return `${styles.card} ${styles.deckCard}`;
      }

      const baseClass = `${styles.card} ${styles.playingCard}`;

      switch (card.type) {
        case 'emergency':
          return `${baseClass} ${styles.emergencyCard}`;
        case 'passenger':
          return `${baseClass} ${styles.passengerCard}`;
        case 'equipment':
          return `${baseClass} ${styles.equipmentCard}`;
        default:
          return baseClass;
      }
    };

    const getCardSymbol = () => {
      if (isInDeck) return '🎴';
      switch (card.type) {
        case 'emergency': return '♦';
        case 'passenger': return '♠';
        case 'equipment': return '♣';
        default: return '♥';
      }
    };

    return (
      <div className={getCardClassName()}>
        {isInDeck ? (
          <div className={styles.deckContent}>
            <Image 
              src="/images/deckback.png" 
              alt="Deck Back" 
              className={styles.deckImage}
              width={288}
              height={384}
              priority
            />
          </div>
        ) : (
          <>
            <div className={styles.cardHeader}>
              <div className={styles.cardSymbol}>{getCardSymbol()}</div>
              <div className={styles.cardCode}>{card.code}</div>
            </div>

            <div className={styles.cardSymbolTopRight}>
              {getCardSymbol()}
            </div>

            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>
                {card.title}
              </h3>
              <p className={styles.cardDescription}>
                {card.description}
              </p>
            </div>

            <div className={styles.cardSymbolBottomLeft}>
              {getCardSymbol()}
            </div>

            <div className={styles.cardFooter}>
              <div className={styles.cardSymbolFooter}>{getCardSymbol()}</div>
              <div className={styles.cardCodeFooter}>{card.code}</div>
            </div>

            {onRemove && card.id && (
              <button
                onClick={() => onRemove(card.id as string)}
                className={styles.removeButton}
              >
                ×
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${shuffling ? styles.shuffling : ''}`}>
      <div className={styles.background}></div>

      <div className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.titleAccent}>♠</span>
            客艙組員情境演練卡牌
            <span className={styles.titleAccent}>♠</span>
          </h1>
          <p className={styles.subtitle}>🎰 組員緊急應變訓練 • 撲克牌風格 🎰</p>
        </header>

        <div className={styles.controlPanel}>
          <div className={styles.controlsRow}>
            <button
              onClick={dealDefaultScenario}
              disabled={dealingAnimation || shuffling}
              className={`${styles.button} ${styles.dealButton} ${(dealingAnimation || shuffling) ? styles.disabled : ''}`}
            >
              <Shuffle className={styles.buttonIcon} />
              發牌
            </button>

            <button
              onClick={resetAll}
              className={`${styles.button} ${styles.resetButton}`}
            >
              <RotateCcw className={styles.buttonIcon} />
              重置
            </button>

            <div className={styles.buttonDivider}></div>

            <button
              onClick={drawRandomCard}
              disabled={getAllAvailableCards().length === 0}
              className={`${styles.button} ${styles.startButton} ${getAllAvailableCards().length === 0 ? styles.disabled : ''}`}
            >
              <Plus className={styles.buttonIcon} />
              抽牌 ({getAllAvailableCards().length})
            </button>

            {allDrawnCards.length > 0 && (
              <div className={styles.statsInline}>
                <span className={styles.statEmergency}>♦{allDrawnCards.filter(card => card.type === 'emergency').length}</span>
                <span className={styles.statPassenger}>♠{allDrawnCards.filter(card => card.type === 'passenger').length}</span>
                <span className={styles.statEquipment}>♣{allDrawnCards.filter(card => card.type === 'equipment').length}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.gameArea}>
          {allDrawnCards.length === 0 ? (
            <div className={styles.deckArea}>
              <div className={styles.deckContainer}>
                <motion.div
                  className={styles.deckBase}
                  animate={shuffling ? {
                    rotateY: [0, 180, 360],
                    scale: [1, 1.05, 1],
                  } : {}}
                  transition={{
                    duration: 1.5,
                    ease: "easeInOut",
                    times: [0, 0.5, 1]
                  }}
                >
                  <PlayingCard card={{}} isInDeck={true} />
                </motion.div>

                <AnimatePresence>
                  {shuffling && (
                    <>
                      {[...Array(8)].map((_, i) => {
                        const angle = (i * 360) / 8;
                        const radius = 200;
                        return (
                          <motion.div
                            key={i}
                            className={styles.shuffleCard}
                            initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
                            animate={{
                              x: [0, Math.cos(angle * Math.PI / 180) * radius, 0],
                              y: [0, Math.sin(angle * Math.PI / 180) * radius, 0],
                              opacity: [0, 1, 0],
                              rotate: [0, 360 + (i * 45), 720],
                              scale: [1, 0.95, 1]
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                              duration: 1.5,
                              ease: "easeInOut",
                              delay: i * 0.05
                            }}
                          >
                            <PlayingCard card={{}} isInDeck={true} />
                          </motion.div>
                        );
                      })}
                    </>
                  )}
                </AnimatePresence>

                {shuffling && (
                  <motion.div
                    className={styles.statusMessage}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    🔀 洗牌中...
                  </motion.div>
                )}

                {dealingAnimation && !shuffling && (
                  <motion.div
                    className={styles.statusMessage}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    🃏 發牌中...
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.cardsContainer}>
              <AnimatePresence mode="popLayout">
                {allDrawnCards.map((card) => (
                  <motion.div
                    key={card.id}
                    initial={{
                      x: 0,
                      y: 0,
                      scale: 0.5,
                      opacity: 0,
                      rotateZ: -20
                    }}
                    animate={{
                      x: 0,
                      y: 0,
                      scale: 1,
                      opacity: 1,
                      rotateZ: 0
                    }}
                    exit={{
                      scale: 0.5,
                      opacity: 0,
                      rotateZ: 20,
                      transition: { duration: 0.3 }
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 20
                    }}
                    layout
                  >
                    <PlayingCard
                      card={card}
                      onRemove={removeCard}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MDAfaatGame;
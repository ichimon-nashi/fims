// utils/mdafaat/scenarioData.ts
// Smart Scenario System - All logic in TypeScript (no database needed!)

export interface Outcome {
	probability: number;
	description: string;
	action?: string;
	duration?: string;
	escalates?: boolean;
}

export interface OutcomeSet {
	[key: string]: Outcome;
}

export interface CardEnhancement {
	synergies?: number[];
	escalates_to?: number[];
	crew_impact?: OutcomeSet;
	passenger_impact?: OutcomeSet;
	severity_levels?: OutcomeSet;
	malfunction_outcomes?: OutcomeSet;
	escalation_chance?: number;
}

// ============================================
// EMERGENCY CARD OUTCOMES
// ============================================

export const emergencyOutcomes: Record<number, CardEnhancement> = {
	1: {
		// 客艙火災
		synergies: [6, 7],
		escalates_to: [6],
		crew_impact: {
			no_impact: {
				probability: 0.2,
				description: "組員快速撲滅，無人受傷",
			},
			minor: { probability: 0.45, description: "一名組員輕微燒傷" },
			moderate: {
				probability: 0.3,
				description: "一名組員吸入濃煙，呼吸困難",
			},
			severe: {
				probability: 0.05,
				description: "兩名組員受傷，火勢蔓延",
			},
		},
		passenger_impact: {
			calm: { probability: 0.3, description: "旅客配合疏散，秩序良好" },
			concerned: {
				probability: 0.4,
				description: "部分旅客焦慮，需安撫",
			},
			panic: { probability: 0.25, description: "多名旅客恐慌尖叫" },
			chaos: { probability: 0.05, description: "旅客集體恐慌，場面失控" },
		},
	},

	2: {
		// 客艙失壓
		synergies: [9],
		escalates_to: [5],
		crew_impact: {
			no_impact: {
				probability: 0.35,
				description: "組員及時戴上氧氣面罩，無人受傷",
			},
			minor: { probability: 0.4, description: "一名組員輕微缺氧頭暈" },
			moderate: { probability: 0.2, description: "一名組員手臂挫傷" },
			severe: { probability: 0.05, description: "組員缺氧昏倒" },
		},
		passenger_impact: {
			compliant: {
				probability: 0.4,
				description: "所有旅客正確使用氧氣面罩",
			},
			confused: {
				probability: 0.35,
				description: "部分旅客不會使用面罩",
			},
			panic: { probability: 0.2, description: "多名旅客恐慌未戴面罩" },
			medical: { probability: 0.05, description: "一名旅客缺氧昏迷" },
		},
	},

	3: {
		// 亂流受傷
		synergies: [2, 7],
		escalates_to: [5],
		crew_impact: {
			no_impact: {
				probability: 0.4,
				description: "組員及時坐好，無人受傷",
			},
			minor: { probability: 0.35, description: "一名組員手臂挫傷" },
			moderate: {
				probability: 0.2,
				description: "一名組員手臂骨折，無法執勤",
			},
			severe: { probability: 0.05, description: "兩名組員頭部撞擊受傷" },
		},
		passenger_impact: {
			no_impact: {
				probability: 0.3,
				description: "所有旅客已繫安全帶，無人受傷",
			},
			minor: { probability: 0.4, description: "2-3名旅客輕微擦傷" },
			moderate: {
				probability: 0.25,
				description: "1名旅客頭部撞擊，需要急救",
			},
			severe: {
				probability: 0.05,
				description: "3名旅客受傷，其中1人昏迷",
			},
		},
	},

	4: {
		// PED電子用品起火
		synergies: [1, 8],
		escalates_to: [1, 6],
		crew_impact: {
			contained: {
				probability: 0.5,
				description: "組員快速用水撲滅，無人受傷",
			},
			minor_burn: { probability: 0.3, description: "組員手部輕微燙傷" },
			smoke_inhalation: {
				probability: 0.15,
				description: "組員吸入有毒煙霧",
			},
			fire_spread: {
				probability: 0.05,
				description: "火勢蔓延至座椅",
				escalates: true,
			},
		},
	},

	5: {
		// 醫療事件
		synergies: [6, 8],
		crew_impact: {
			minimal: { probability: 0.6, description: "組員協助醫生處理" },
			moderate: {
				probability: 0.3,
				description: "無醫生在機上，組員獨立處理",
			},
			stressful: { probability: 0.1, description: "組員情緒壓力大" },
		},
		passenger_impact: {
			stable: {
				probability: 0.4,
				description: "旅客恢復意識，生命跡象穩定",
			},
			critical: {
				probability: 0.35,
				description: "旅客仍昏迷，需持續CPR",
			},
			deceased: {
				probability: 0.15,
				description: "旅客無反應，疑似死亡",
			},
			doctor_present: {
				probability: 0.1,
				description: "機上醫生協助，情況改善",
			},
		},
	},

	6: {
		// 客艙冒煙
		synergies: [4, 7],
		escalates_to: [1],
		crew_impact: {
			source_found: {
				probability: 0.45,
				description: "組員找到煙霧來源並處理",
			},
			searching: { probability: 0.35, description: "持續尋找煙霧源頭" },
			smoke_inhalation: {
				probability: 0.15,
				description: "組員吸入煙霧不適",
			},
			fire_discovered: {
				probability: 0.05,
				description: "發現隱藏火源",
				escalates: true,
			},
		},
	},

	7: {
		// 組員失能
		synergies: [3, 5],
		crew_impact: {
			temporary: {
				probability: 0.4,
				description: "組員暫時不適，15分鐘後恢復",
			},
			medical_issue: {
				probability: 0.35,
				description: "組員需要急救處理",
			},
			incapacitated: {
				probability: 0.2,
				description: "組員完全無法執勤",
			},
			multiple_affected: {
				probability: 0.05,
				description: "兩名組員同時失能",
			},
		},
	},

	8: {
		// CPP
		synergies: [10],
		escalates_to: [9],
		crew_impact: {
			prepared: {
				probability: 0.5,
				description: "組員完成準備，狀態良好",
			},
			stressed: {
				probability: 0.35,
				description: "組員壓力大但保持專業",
			},
			error: { probability: 0.1, description: "組員在壓力下出現小失誤" },
			panic: { probability: 0.05, description: "資淺組員過度緊張" },
		},
	},

	9: {
		// 滑出跑道
		synergies: [4, 10],
		escalates_to: [1],
		crew_impact: {
			no_injury: { probability: 0.45, description: "組員無人受傷" },
			minor: { probability: 0.4, description: "組員輕微撞擊傷" },
			injured: { probability: 0.12, description: "一名組員無法行動" },
			incapacitated: { probability: 0.03, description: "多名組員受傷" },
		},
	},

	10: {
		// 機場關閉
		synergies: [3, 8],
		crew_impact: {
			calm: { probability: 0.5, description: "組員專業處理改降" },
			stressed: { probability: 0.4, description: "組員工作量增加但應對" },
			fatigued: { probability: 0.08, description: "組員疲勞壓力大" },
			error: { probability: 0.02, description: "組員因疲勞出錯" },
		},
	},
};

// ============================================
// PASSENGER CARD OUTCOMES
// ============================================

export const passengerOutcomes: Record<number, CardEnhancement> = {
	1: {
		// 酒醉旅客
		escalation_chance: 0.4,
		escalates_to: [4],
		severity_levels: {
			level_1: {
				probability: 0.35,
				description: "旅客大聲說話，但還算配合",
				action: "口頭警告",
			},
			level_2: {
				probability: 0.4,
				description: "旅客拒絕指示，開始辱罵組員",
				action: "書面警告卡",
			},
			level_3: {
				probability: 0.2,
				description: "旅客試圖站起推擠他人",
				action: "考慮束縛",
			},
			level_4: {
				probability: 0.05,
				description: "旅客暴力攻擊組員或旅客",
				action: "立即束縛並轉降",
				escalates: true,
			},
		},
	},

	2: {
		// 嬰兒啼哭
		escalation_chance: 0.25,
		escalates_to: [4, 5],
		severity_levels: {
			mild: {
				probability: 0.4,
				description: "嬰兒間歇哭泣，父母能安撫",
				action: "提供協助",
			},
			persistent: {
				probability: 0.4,
				description: "嬰兒持續哭泣超過30分鐘",
				action: "協助父母安撫",
			},
			severe: {
				probability: 0.15,
				description: "嬰兒不停哭鬧，其他旅客不滿",
				action: "調解旅客衝突",
			},
			medical: {
				probability: 0.05,
				description: "嬰兒哭聲異常，疑似身體不適",
				action: "評估醫療需求",
			},
		},
	},

	3: {
		// 寵物脫逃
		escalation_chance: 0.3,
		escalates_to: [1, 4],
		severity_levels: {
			contained: {
				probability: 0.45,
				description: "寵物在走道，容易捕捉",
				action: "協助主人捉回",
			},
			scared: {
				probability: 0.35,
				description: "寵物受驚躲藏，難以接近",
				action: "尋找並安撫寵物",
			},
			aggressive: {
				probability: 0.15,
				description: "寵物攻擊性強，旅客害怕",
				action: "隔離區域保護旅客",
			},
			allergy: {
				probability: 0.05,
				description: "旅客對寵物嚴重過敏反應",
				action: "醫療處理並隔離",
				escalates: true,
			},
		},
	},

	4: {
		// 座位糾紛
		escalation_chance: 0.45,
		escalates_to: [1],
		severity_levels: {
			verbal: {
				probability: 0.4,
				description: "旅客禮貌討論座位問題",
				action: "協調解決",
			},
			argument: {
				probability: 0.4,
				description: "旅客爭執聲音變大",
				action: "調解並提供方案",
			},
			confrontation: {
				probability: 0.15,
				description: "旅客互相指責推擠",
				action: "強制分開並警告",
			},
			physical: {
				probability: 0.05,
				description: "旅客肢體衝突",
				action: "立即制止並記錄",
				escalates: true,
			},
		},
	},

	5: {
		// 暈機嘔吐
		escalation_chance: 0.2,
		escalates_to: [2],
		severity_levels: {
			single: {
				probability: 0.45,
				description: "一名旅客嘔吐",
				action: "提供清潔用品",
			},
			multiple: {
				probability: 0.35,
				description: "3-4名旅客陸續嘔吐",
				action: "加強清理並通風",
			},
			severe: {
				probability: 0.15,
				description: "大範圍旅客嘔吐，氣味瀰漫",
				action: "全力清理並安撫",
			},
			dehydration: {
				probability: 0.05,
				description: "旅客嘔吐後脫水虛弱",
				action: "提供水份並評估",
			},
		},
	},

	6: {
		// 過敏反應
		escalation_chance: 0.35,
		escalates_to: [5],
		severity_levels: {
			mild: {
				probability: 0.5,
				description: "輕微皮膚紅疹搔癢",
				action: "給予抗組織胺",
			},
			moderate: {
				probability: 0.3,
				description: "臉部腫脹、呼吸略困難",
				action: "給氧並準備腎上腺素",
			},
			severe: {
				probability: 0.15,
				description: "嚴重過敏性休克",
				action: "立即施打腎上腺素",
			},
			anaphylaxis: {
				probability: 0.05,
				description: "過敏性休克昏迷",
				action: "CPR並緊急轉降",
				escalates: true,
			},
		},
	},

	7: {
		// 行李掉落
		escalation_chance: 0.25,
		escalates_to: [3],
		severity_levels: {
			no_injury: {
				probability: 0.4,
				description: "行李掉落但未砸到人",
				action: "收好行李",
			},
			minor: {
				probability: 0.4,
				description: "旅客頭部輕微撞擊",
				action: "冰敷並觀察",
			},
			moderate: {
				probability: 0.15,
				description: "旅客頭部出血需包紮",
				action: "急救處理",
			},
			serious: {
				probability: 0.05,
				description: "旅客頸部受傷或昏迷",
				action: "固定頸部並緊急處理",
			},
		},
	},

	8: {
		// 恐慌發作
		escalation_chance: 0.3,
		escalates_to: [2, 5],
		severity_levels: {
			mild: {
				probability: 0.4,
				description: "旅客焦慮但能溝通",
				action: "安撫並指導呼吸",
			},
			moderate: {
				probability: 0.35,
				description: "旅客過度換氣手腳發麻",
				action: "紙袋呼吸法",
			},
			severe: {
				probability: 0.2,
				description: "旅客失控哭喊",
				action: "隔離並持續安撫",
			},
			contagious: {
				probability: 0.05,
				description: "引發周圍旅客連鎖恐慌",
				action: "控制場面並廣播",
				escalates: true,
			},
		},
	},

	9: {
		// 語言障礙
		escalation_chance: 0.2,
		escalates_to: [4],
		severity_levels: {
			minor: {
				probability: 0.5,
				description: "基本溝通可用手勢",
				action: "使用圖卡溝通",
			},
			moderate: {
				probability: 0.35,
				description: "完全無法溝通",
				action: "尋找翻譯旅客",
			},
			frustration: {
				probability: 0.12,
				description: "旅客因無法溝通而沮喪",
				action: "耐心安撫並尋求協助",
			},
			conflict: {
				probability: 0.03,
				description: "語言障礙導致誤會衝突",
				action: "找翻譯並調解",
			},
		},
	},

	10: {
		// 特殊餐點
		escalation_chance: 0.25,
		escalates_to: [4, 6],
		severity_levels: {
			accepting: {
				probability: 0.45,
				description: "旅客理解並接受替代方案",
				action: "提供其他選項",
			},
			disappointed: {
				probability: 0.4,
				description: "旅客失望但不為難",
				action: "道歉並補償",
			},
			angry: {
				probability: 0.12,
				description: "旅客憤怒投訴",
				action: "記錄並安撫",
			},
			medical: {
				probability: 0.03,
				description: "宗教或醫療因素無法進食",
				action: "緊急聯絡準備特殊餐",
			},
		},
	},
};

// ============================================
// EQUIPMENT CARD OUTCOMES
// ============================================

export const equipmentOutcomes: Record<number, CardEnhancement> = {
	1: {
		// 廁所故障
		malfunction_outcomes: {
			blockage: {
				probability: 0.5,
				description: "馬桶阻塞但可暫時關閉",
				duration: "rest_of_flight",
			},
			overflow: {
				probability: 0.35,
				description: "污水溢出地板",
				duration: "rest_of_flight",
			},
			smell: {
				probability: 0.12,
				description: "異味瀰漫整個後艙",
				duration: "rest_of_flight",
			},
			multiple: {
				probability: 0.03,
				description: "兩個廁所同時故障",
				duration: "rest_of_flight",
			},
		},
	},

	2: {
		// 娛樂系統
		malfunction_outcomes: {
			restart: {
				probability: 0.4,
				description: "系統重啟後恢復",
				duration: "10 minutes",
			},
			partial: {
				probability: 0.4,
				description: "部分座位系統失效",
				duration: "rest_of_flight",
			},
			complete: {
				probability: 0.18,
				description: "全機系統無法恢復",
				duration: "rest_of_flight",
			},
			complaints: {
				probability: 0.02,
				description: "旅客集體抱怨要求補償",
				duration: "rest_of_flight",
			},
		},
	},

	3: {
		// 空調失效
		escalates_to: [5],
		malfunction_outcomes: {
			temporary: {
				probability: 0.45,
				description: "空調暫停10分鐘後恢復",
				duration: "10 minutes",
			},
			warm: {
				probability: 0.35,
				description: "客艙溫度升高至28度",
				duration: "rest_of_flight",
			},
			hot: {
				probability: 0.15,
				description: "客艙悶熱，旅客不適",
				duration: "rest_of_flight",
			},
			medical: {
				probability: 0.05,
				description: "年長旅客因悶熱暈眩",
				duration: "rest_of_flight",
				escalates: true,
			},
		},
	},

	4: {
		// 照明故障
		escalates_to: [6],
		malfunction_outcomes: {
			flicker: {
				probability: 0.5,
				description: "照明閃爍後恢復正常",
				duration: "30 seconds",
			},
			partial: {
				probability: 0.3,
				description: "前艙照明失效，後艙正常",
				duration: "rest_of_flight",
			},
			emergency_only: {
				probability: 0.15,
				description: "僅緊急照明運作",
				duration: "rest_of_flight",
			},
			with_smoke: {
				probability: 0.05,
				description: "照明失效且伴隨燒焦氣味",
				duration: "rest_of_flight",
				escalates: true,
			},
		},
	},

	5: {
		// 座椅損壞
		malfunction_outcomes: {
			stuck: {
				probability: 0.6,
				description: "座椅卡住無法調整",
				duration: "rest_of_flight",
			},
			loose: {
				probability: 0.3,
				description: "座椅鬆脫搖晃",
				duration: "rest_of_flight",
			},
			broken: {
				probability: 0.08,
				description: "座椅倒塌需換座位",
				duration: "rest_of_flight",
			},
			injury: {
				probability: 0.02,
				description: "座椅故障造成旅客受傷",
				duration: "rest_of_flight",
			},
		},
	},

	6: {
		// 餐車卡住
		malfunction_outcomes: {
			freed: {
				probability: 0.5,
				description: "餐車輪子修復可繼續使用",
				duration: "5 minutes",
			},
			stuck: {
				probability: 0.4,
				description: "餐車卡在走道中央",
				duration: "30 minutes",
			},
			blocking: {
				probability: 0.08,
				description: "餐車阻擋緊急出口",
				duration: "30 minutes",
			},
			spill: {
				probability: 0.02,
				description: "餐車傾倒食物灑落",
				duration: "30 minutes",
			},
		},
	},

	7: {
		// 烤箱故障
		escalates_to: [1, 6],
		malfunction_outcomes: {
			stops: {
				probability: 0.6,
				description: "烤箱停止運作但無煙",
				duration: "rest_of_flight",
			},
			smoke: {
				probability: 0.3,
				description: "烤箱冒煙但無火",
				duration: "rest_of_flight",
			},
			minor_fire: {
				probability: 0.08,
				description: "烤箱內部小火",
				duration: "rest_of_flight",
				escalates: true,
			},
			major_fire: {
				probability: 0.02,
				description: "烤箱起火蔓延至廚房",
				duration: "rest_of_flight",
				escalates: true,
			},
		},
	},

	8: {
		// 門把損壞
		malfunction_outcomes: {
			loose: {
				probability: 0.6,
				description: "門把鬆脫但仍可操作",
				duration: "rest_of_flight",
			},
			stuck: {
				probability: 0.3,
				description: "門把卡住難以開啟",
				duration: "rest_of_flight",
			},
			broken: {
				probability: 0.08,
				description: "門把斷裂無法使用",
				duration: "rest_of_flight",
			},
			emergency_exit: {
				probability: 0.02,
				description: "緊急出口門把損壞",
				duration: "rest_of_flight",
			},
		},
	},

	9: {
		// 氧氣面罩
		escalates_to: [2],
		malfunction_outcomes: {
			single: {
				probability: 0.5,
				description: "一個座位面罩意外掉落",
				duration: "rest_of_flight",
			},
			row: {
				probability: 0.35,
				description: "整排座位面罩掉落",
				duration: "rest_of_flight",
			},
			malfunction: {
				probability: 0.12,
				description: "部分面罩無法正常充氧",
				duration: "rest_of_flight",
			},
			widespread: {
				probability: 0.03,
				description: "多處面罩同時掉落引發恐慌",
				duration: "rest_of_flight",
			},
		},
	},

	10: {
		// 通話系統
		malfunction_outcomes: {
			static: {
				probability: 0.45,
				description: "通話有雜音但可溝通",
				duration: "rest_of_flight",
			},
			intermittent: {
				probability: 0.35,
				description: "通話時斷時續",
				duration: "rest_of_flight",
			},
			complete: {
				probability: 0.18,
				description: "完全無法通話，需手勢溝通",
				duration: "rest_of_flight",
			},
			emergency: {
				probability: 0.02,
				description: "緊急時刻通話系統失效",
				duration: "rest_of_flight",
			},
		},
	},
};

// ============================================
// HELPER FUNCTION: Merge outcomes with cards
// ============================================

export function enhanceCard(
	card: any,
	type: "emergency" | "passenger" | "equipment",
): any {
	let enhancement: CardEnhancement | undefined;

	switch (type) {
		case "emergency":
			enhancement = emergencyOutcomes[card.id];
			break;
		case "passenger":
			enhancement = passengerOutcomes[card.id];
			break;
		case "equipment":
			enhancement = equipmentOutcomes[card.id];
			break;
	}

	return enhancement ? { ...card, ...enhancement } : card;
}

// Helper to enhance all cards
export function enhanceAllCards(cardData: any) {
	return {
		emergency: cardData.emergency.map((c: any) =>
			enhanceCard(c, "emergency"),
		),
		passenger: cardData.passenger.map((c: any) =>
			enhanceCard(c, "passenger"),
		),
		equipment: cardData.equipment.map((c: any) =>
			enhanceCard(c, "equipment"),
		),
	};
}

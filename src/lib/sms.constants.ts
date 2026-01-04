// src/lib/sms.constants.ts
// Safety Management System Constants
// Human Factors Codes and EF Attribute Codes

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface HumanFactorSubcode {
	code: string;
	description: string;
}

export interface HumanFactorCategory {
	code: string;
	name: string;
	subcodes: HumanFactorSubcode[];
}

// EF Attribute has THREE tiers (vs Human Factors' two tiers)
export interface EFSubcode {
	code: string;
	description: string;
}

export interface EFMiddleCategory {
	code: string; // e.g., "P1", "P2", "E1"
	name: string; // e.g., "客艙組員訓練", "亂流作業"
	subcodes: EFSubcode[]; // e.g., P1-01, P1-02
}

export interface EFAttributeCategory {
	code: string; // e.g., "P", "E", "C"
	name: string; // e.g., "安全程序/訓練"
	middleCategories: EFMiddleCategory[];
}

// ============================================================================
// HUMAN FACTOR CODES (75 codes across 13 categories)
// ============================================================================

export const HUMAN_FACTOR_CATEGORIES: HumanFactorCategory[] = [
	{
		code: "RM",
		name: "Resource Management",
		subcodes: [
			{
				code: "RM1",
				description:
					"Lack of availability of appropriate/competent workforce",
			},
			{
				code: "RM2",
				description:
					"Lack of availability of appropriate equipment, material, tools, parts",
			},
			{ code: "RM3", description: "Lack of appropriate support" },
		],
	},
	{
		code: "OC",
		name: "Organization Climate",
		subcodes: [
			{
				code: "OC1",
				description:
					"Inadequate reporting system, reporting culture, just culture",
			},
			{ code: "OC2", description: "Inadequate safety information" },
			{
				code: "OC3",
				description:
					"Failure to identify, track, manage risk, monitor safety",
			},
			{
				code: "OC4",
				description:
					"Inadequate awareness, safety-cultural, supervision",
			},
			{
				code: "OC5",
				description:
					"Pressure - time, delivery, schedule, commercial, cost",
			},
		],
	},
	{
		code: "OP",
		name: "Organization Processes",
		subcodes: [
			{
				code: "OP1",
				description:
					"Inadequate communications up and down organizational structure",
			},
			{
				code: "OP2",
				description:
					"Failure to correct known problems, lack of continuous improvement",
			},
			{
				code: "OP3",
				description:
					"Incompatible goals, operating procedures, or organizational structure",
			},
			{
				code: "OP4",
				description:
					"Inadequate organizational process for assuring competency",
			},
			{
				code: "OP5",
				description:
					"Inadequate Crew scheduling, duty time, fatigue, pairing",
			},
		],
	},
	{
		code: "CMG",
		name: "Change Management",
		subcodes: [
			{ code: "CMG1", description: "Inadequate Management of Change" },
		],
	},
	{
		code: "IS",
		name: "Inadequate Supervision",
		subcodes: [
			{
				code: "IS1",
				description:
					"Failed to provide proper guidance, briefing, instruction",
			},
			{
				code: "IS2",
				description:
					"Failed to provide adequate oversight, corrective action",
			},
		],
	},
	{
		code: "PA",
		name: "Planned Inappropriate Activities",
		subcodes: [
			{
				code: "PA1",
				description:
					"Inappropriate task assignment or allocation of resources",
			},
			{
				code: "PA2",
				description:
					"Inappropriate operations tempo, scheduling, crew pairings",
			},
			{
				code: "PA3",
				description:
					"Inappropriate or inadequate planning of operation/ inadequate risk assessment",
			},
		],
	},
	{
		code: "FP",
		name: "Failed to Correct a Known Problem",
		subcodes: [
			{
				code: "FP1",
				description:
					"Failed to identify risk/hazard, to correct known problem",
			},
		],
	},
	{
		code: "SV",
		name: "Supervisory Violations",
		subcodes: [
			{
				code: "SV1",
				description:
					"Authorized or condoned inappropriate, unsafe, operations, actions, processes or behaviors",
			},
		],
	},
	{
		code: "PN",
		name: "Physical Environment",
		subcodes: [
			{
				code: "PN1",
				description:
					"Weather / Icing, fog, rain, snow, sand/smoke, visibility/ wind, windshear",
			},
			{
				code: "PN2",
				description: "Terrain or obstacle, altitude, birds",
			},
			{
				code: "PN3",
				description:
					"Poor work environment (noise, heat, humidity, vibration, lighting)",
			},
			{
				code: "PN4",
				description:
					"Inadequate facilities/walk/road layout, signing, marking",
			},
		],
	},
	{
		code: "TN",
		name: "Technological Environment",
		subcodes: [
			{
				code: "TN1",
				description:
					"Inappropriate/poor design of equipment, tool, parts, material",
			},
			{
				code: "TN2",
				description: "Inappropriate automation, function, reliability",
			},
			{ code: "TN3", description: "Inappropriate interface design" },
			{ code: "TN4", description: "Inappropriate communication system" },
		],
	},
	{
		code: "PC",
		name: "Psychological and Physical Conditions",
		subcodes: [
			{
				code: "PC1",
				description:
					"Inattention, apathy, complacency, boredom, distraction, stress, exhaustion(Burnout)",
			},
			{
				code: "PC2",
				description:
					"Channelized attention and actions, confusion, disorientation",
			},
			{ code: "PC3", description: "Personality Style" },
			{ code: "PC4", description: "Illness, sickness" },
			{
				code: "PC5",
				description:
					"Effects of alcohol, drugs(before or while on duty)",
			},
			{
				code: "PC6",
				description:
					"Inadequate experience for situation, insufficient reaction time",
			},
			{
				code: "PC7",
				description:
					"Misperception of operational conditions, incorrect interpretation and understanding",
			},
		],
	},
	{
		code: "PR",
		name: "Personal Readiness",
		subcodes: [
			{ code: "PR1", description: "Inadequate Rest" },
			{
				code: "PR2",
				description:
					"Inadequate physical fitness, insufficient diet, nutrition",
			},
			{
				code: "PR3",
				description:
					"Self-medication and, unreported medical conditions",
			},
			{ code: "PR4", description: "Inadequate personal preparation" },
		],
	},
	{
		code: "CM",
		name: "CRM",
		subcodes: [
			{ code: "CM1", description: "Lack of assertiveness or leadership" },
			{
				code: "CM2",
				description:
					"Lack of planning or preparation, inadequate briefing, insufficient re-planning",
			},
			{
				code: "CM3",
				description: "Poor workload management or task delegation",
			},
			{ code: "CM4", description: "Authority gradient, poor teamwork" },
			{
				code: "CM5",
				description:
					"Lack of cross-monitoring performance, supportive feedback or acknowledgement",
			},
			{
				code: "CM6",
				description:
					"Poor communication of critical information and poor decision making",
			},
		],
	},
	{
		code: "DE",
		name: "Decision Errors",
		subcodes: [
			{
				code: "DE1",
				description:
					"Inadequate risk evaluation during operation, misjudging",
			},
			{ code: "DE2", description: "Ignored caution, warning" },
			{ code: "DE3", description: "Task misprioritization" },
		],
	},
	{
		code: "SE",
		name: "Skill Based Errors",
		subcodes: [
			{
				code: "SE1",
				description:
					"Incorrect operation/handling of equipment / inappropriate use of automation",
			},
			{
				code: "SE2",
				description: "Incorrect operations / handling equipment",
			},
			{
				code: "SE3",
				description:
					"Inadvertently activating or deactivating equipment, controls or switches",
			},
			{ code: "SE4", description: "Failure to see and react / fail" },
		],
	},
	{
		code: "PE",
		name: "Perception Errors",
		subcodes: [
			{
				code: "PE1",
				description:
					"Error due to misperception, illusion, disorientation, misjudgment",
			},
			{
				code: "PE2",
				description: "Spatial disorientation, vertigo, visual illusion",
			},
		],
	},
	{
		code: "EV",
		name: "Exception Violations",
		subcodes: [
			{ code: "EV1", description: "Lack of discipline" },
			{
				code: "EV2",
				description: "Rules, regulations, procedures not followed",
			},
			{
				code: "EV3",
				description:
					"Intentional bending the rules, procedures, policies by individual or team without cause or need",
			},
		],
	},
	{
		code: "RV",
		name: "Routine Violations",
		subcodes: [
			{
				code: "RV1",
				description:
					"Widespread, routine, systemic, habitual violation by individual or team",
			},
			{ code: "RV2", description: "Violation based on Risk Assessment" },
		],
	},
	{
		code: "OTHR",
		name: "Others",
		subcodes: [{ code: "OTHR", description: "Others" }],
	},
];

// Flatten all human factor codes for easy lookup
export const ALL_HUMAN_FACTOR_CODES = HUMAN_FACTOR_CATEGORIES.flatMap(
	(category) => category.subcodes
);

// ============================================================================
// EF ATTRIBUTE CODES - THREE TIER STRUCTURE
// Total: 258 codes across 7 main categories (P, E, C, I, T, O, M)
// ============================================================================

export const EF_ATTRIBUTE_CATEGORIES: EFAttributeCategory[] = [
	{
		code: "P",
		name: "安全程序/訓練 (Procedure/Training)",
		middleCategories: [
			{
				code: "P1",
				name: "客艙組員訓練",
				subcodes: [
					{ code: "P1-01", description: "相關資格訓練未執行" },
					{
						code: "P1-02",
						description: "相關資格訓練未達合格標準、超過訓練週期",
					},
					{ code: "P1-03", description: "相關資格訓練超過訓練週期" },
				],
			},
			{
				code: "P2",
				name: "亂流作業",
				subcodes: [
					{
						code: "P2-01",
						description: "亂流時客艙廣播及未執行、執行不確實",
					},
					{
						code: "P2-02",
						description: "亂流時旅客安全帶使用未口頭提醒",
					},
					{ code: "P2-03", description: "亂流時廚房物品未定位" },
					{ code: "P2-04", description: "中度以上亂流時組員未就座" },
					{ code: "P2-05", description: "亂流時餐車、櫃、門未鎖妥" },
					{
						code: "P2-06",
						description: "亂流前、後未檢查洗手間是否有旅客在內",
					},
					{
						code: "P2-07",
						description:
							"亂流時未勸導洗手間旅客回座或要求旅客暫時停用洗手間",
					},
					{
						code: "P2-08",
						description: "亂流時客艙組員自我安全防護不足",
					},
					{ code: "P2-09", description: "無預警亂流" },
				],
			},
			{
				code: "P3",
				name: "乘客行李",
				subcodes: [
					{
						code: "P3-01",
						description:
							"手提行李、個人物品 尺寸、數量及存放位置、其他作業規範等未符合規定",
					},
					{
						code: "P3-02",
						description:
							"客艙行李(CBBG)包裝、固定、其他作業規範等，未符合報局核准計劃",
					},
					{
						code: "P3-03",
						description: "乘客行李未於關門前妥善放置及處理",
					},
					{
						code: "P3-04",
						description: "未協助旅客行李處理、處理不當引發客怨",
					},
				],
			},
			{
				code: "P4",
				name: "出口座位",
				subcodes: [
					{
						code: "P4-01",
						description: "出口座位簡報未於關門前完成",
					},
					{ code: "P4-02", description: "出口座位簡報未實施" },
					{
						code: "P4-03",
						description: "未使用出口座位簡報標準用語",
					},
					{
						code: "P4-04",
						description: "出口座位旅客選擇未符合標準規定限制",
					},
					{
						code: "P4-05",
						description: "出口座位提示卡數量、配置、規格不正確",
					},
					{ code: "P4-06", description: "未確實執行出口座位簡報" },
					{
						code: "P4-07",
						description: "出口座位旅客安全檢查未落實(物品未淨空)",
					},
				],
			},
			{
				code: "P5",
				name: "乘客安全維謢",
				subcodes: [
					{
						code: "P5-01",
						description: "安全相關訊息未使用廣播、口頭、書面說明",
					},
					{
						code: "P5-02",
						description: "安全須知未提供正確位置、數量、機型、訊息",
					},
					{
						code: "P5-03",
						description: "安全示範(SAFETY DEMO)未確實於起飛前完成",
					},
					{
						code: "P5-04",
						description:
							"安全帶使用未在滑行、起飛、航程、降落時有效提醒",
					},
					{
						code: "P5-05",
						description:
							"安全檢查(SAFETY CHECK)未在起飛前、降落前正確執行",
					},
					{
						code: "P5-06",
						description: "乘客就坐未在滑行、起飛、降落時有效控管",
					},
					{
						code: "P5-07",
						description: "下降時安全帶燈亮未提醒就座旅客繫安全帶",
					},
				],
			},
			{
				code: "P6",
				name: "洗手間作業",
				subcodes: [
					{
						code: "P6-01",
						description:
							"未適時提供需要協助的旅客門鎖操作、設備說明",
					},
					{
						code: "P6-02",
						description: "起飛、降落未有效控管及鎖妥",
					},
					{ code: "P6-03", description: "航程中廁所安全未定時檢查" },
				],
			},
			{
				code: "P7",
				name: "特殊旅客",
				subcodes: [
					{
						code: "P7-01",
						description: "特殊旅客載運限制未符合作業標準",
					},
					{
						code: "P7-02",
						description: "特殊旅客陪同、伴護、戒護未符合作業標準",
					},
					{
						code: "P7-03",
						description: "特殊旅客個別安全簡報未執行、執行不確實",
					},
					{
						code: "P7-04",
						description: "特殊旅客相關文件、表單未符合作業標準",
					},
					{
						code: "P7-05",
						description: "特殊旅客隨身輔助器材、設備不符合規定",
					},
				],
			},
			{
				code: "P8",
				name: "危險品",
				subcodes: [
					{
						code: "P8-01",
						description: "禁止攜帶上機之物品，未符合作業標準",
					},
					{
						code: "P8-02",
						description: "可手提上機之危險物品，未符合作業標準",
					},
					{
						code: "P8-03",
						description:
							"可託運或手提上機之危險物品，未符合作業標準",
					},
					{
						code: "P8-04",
						description: "其他無法辨識或有飛安疑慮之危險品上機",
					},
				],
			},
			{
				code: "P9",
				name: "保安規定",
				subcodes: [
					{ code: "P9-01", description: "一般保安清艙檢查未執行" },
					{
						code: "P9-02",
						description: "一般保安清艙檢查執行不確實、時機不正確",
					},
					{ code: "P9-03", description: "提升保安清艙檢查未執行" },
					{
						code: "P9-04",
						description: "提升保安清艙檢查執行不確實、時機不正確",
					},
					{
						code: "P9-05",
						description: "可疑人、物未能辨識、報告、處理不確實",
					},
					{
						code: "P9-06",
						description:
							"安全區及非限制區作業規範未符合規定、進入及出入時機不正確",
					},
					{
						code: "P9-07",
						description:
							"機場限制區證件管理、使用及穿著標準未符合規範",
					},
					{
						code: "P9-08",
						description: "駕駛艙門保安規定未符合作業規範",
					},
					{ code: "P9-09", description: "其他保安規定未符合規範" },
				],
			},
			{
				code: "P10",
				name: "關門前/後標準作業",
				subcodes: [
					{
						code: "P10-01",
						description:
							"關門前組員／旅客總人數清點未確實符合簽派需求",
					},
					{
						code: "P10-02",
						description:
							"關門前飛機各區域、設施、設備、各項安全檢查未確實符合規範",
					},
					{
						code: "P10-03",
						description:
							"關門後各項客艙、旅客、設施、設備、安全檢查未執行、時機不正確",
					},
					{
						code: "P10-04",
						description: "關門前後各項標準廣播未執行或執行不確實",
					},
					{
						code: "P10-05",
						description:
							"關門前後組員座椅未坐妥、未繫安全帶或關門後未確實固定",
					},
					{
						code: "P10-06",
						description: "關門前後艙門未確實鎖妥或處於備用狀態",
					},
				],
			},
			{
				code: "P11",
				name: "開門前/後標準作業",
				subcodes: [
					{
						code: "P11-01",
						description:
							"開門前後確認窗外、走道是否淨空、防撞塊位置是否確實",
					},
					{
						code: "P11-02",
						description:
							"開門前滑梯未確實解除備用、依標準程序執行開門作業",
					},
					{
						code: "P11-03",
						description: "開門後組員未確實固定艙門、疏散滑梯未收妥",
					},
				],
			},
			{
				code: "P12",
				name: "服務用車作業",
				subcodes: [
					{
						code: "P12-01",
						description:
							"滑行、起飛、降落、亂流時服務車未鎖妥、未定位",
					},
					{
						code: "P12-02",
						description: "服務車輪剎未操作正確、未加裝固定物",
					},
					{
						code: "P12-03",
						description: "使用服務車過程未符合安全規範",
					},
				],
			},
			{
				code: "P13",
				name: "客艙缺點紀錄簿",
				subcodes: [
					{
						code: "P13-01",
						description: "客艙缺點未登錄、通報、時機不正確",
					},
					{
						code: "P13-02",
						description: "客艙缺點紀錄簿用字遣詞未確實、未符合規範",
					},
					{
						code: "P13-03",
						description: "客艙缺點紀錄簿書寫非工整、不易辨識",
					},
					{
						code: "P13-04",
						description: "客艙缺點報告（離線缺點）未符合規範",
					},
				],
			},
			{
				code: "P14",
				name: "地勤作業",
				subcodes: [
					{
						code: "P14-01",
						description: "任務通知接獲未能確認報到時間及地點",
					},
					{
						code: "P14-02",
						description:
							"個人證件、許可或執照缺少、未隨身攜帶、逾期",
					},
					{
						code: "P14-03",
						description: "簡報／任務前資訊未充分獲得及了解",
					},
					{
						code: "P14-04",
						description: "服勤前飛機相關資訊未充分獲得、了解",
					},
					{
						code: "P14-05",
						description:
							"上下機動線（登機門、機坪）交通路線不熟悉或未清楚",
					},
					{
						code: "P14-06",
						description: "乘客登機、下機未適時掌握及通報",
					},
					{
						code: "P14-07",
						description: "機艙登機路線未能清楚、未能有效引導旅客",
					},
					{
						code: "P14-08",
						description: "地面裝備、設備未能正確使用",
					},
				],
			},
			{
				code: "P15",
				name: "違規旅客處理",
				subcodes: [
					{
						code: "P15-01",
						description: "違規旅客辨識、報告、處理未確實",
					},
					{
						code: "P15-02",
						description: "違規旅客處理紀錄未符合規範",
					},
				],
			},
			{
				code: "P16",
				name: "其他異常作業",
				subcodes: [
					{
						code: "P16-01",
						description: "航機延遲或提前作業未符合程序規範",
					},
					{ code: "P16-02", description: "轉降或備降未符合程序規範" },
					{
						code: "P16-03",
						description: "緊急疏散作業(含客、貨艙)未符合程序規範",
					},
					{
						code: "P16-04",
						description: "客貨艙失火作業未符合程序規範",
					},
					{ code: "P16-05", description: "釋壓作業未符合程序規範" },
					{
						code: "P16-06",
						description: "水上迫降作業未符合程序規範",
					},
					{
						code: "P16-07",
						description: "非法干擾作業未符合程序規範",
					},
					{
						code: "P16-08",
						description: "生病/受傷旅客處理未符合程序規範",
					},
					{
						code: "P16-09",
						description: "空中事故處理未符合程序規範",
					},
					{
						code: "P16-10",
						description: "死亡事件處理未符合程序規範",
					},
					{
						code: "P16-11",
						description:
							"緊急醫療設備操作未符合作業程序規範或使用時機不當",
					},
					{
						code: "P16-12",
						description: "其他異常程序作業未符合規範",
					},
				],
			},
			{
				code: "P17",
				name: "緊急程序",
				subcodes: [
					{ code: "P17-01", description: "緊急程序不熟悉" },
					{
						code: "P17-02",
						description: "緊急裝備使用時機或方法不確實",
					},
				],
			},
			{
				code: "P18",
				name: "疲勞管理",
				subcodes: [
					{
						code: "P18-01",
						description:
							"組員未於執勤前有充分休息並保持最佳執勤狀態",
					},
					{ code: "P18-02", description: "飛航組員工作時間超時" },
				],
			},
			{
				code: "P19",
				name: "其他客艙安全作業",
				subcodes: [
					{
						code: "P19-01",
						description: "客艙內部破損、毀壞或影響旅客安全",
					},
					{ code: "P19-02", description: "其他影響客艙作業安全規範" },
				],
			},
			{
				code: "P20",
				name: "PED作業",
				subcodes: [
					{
						code: "P20-01",
						description: "PED使用時機管制未符合程序規範",
					},
					{
						code: "P20-02",
						description: "PED使用辨識未符合程序規範",
					},
				],
			},
		],
	},
	{
		code: "E",
		name: "裝備 (Equipment)",
		middleCategories: [
			{
				code: "E1",
				name: "緊急裝備",
				subcodes: [
					{
						code: "E1-01",
						description: "救生衣/Life vest安全檢查不符規定",
					},
					{
						code: "E1-02",
						description: "逃生繩/Escape Rope安全檢查不符規定",
					},
					{
						code: "E1-03",
						description: "疏散/逃生滑梯安全檢查不符規定",
					},
					{
						code: "E1-04",
						description: "救生筏/Life raft安全檢查不符規定",
					},
					{
						code: "E1-05",
						description: "滅火瓶/Fire Ext安全檢查不符規定",
					},
					{
						code: "E1-06",
						description: "防煙面罩/Smoke Hood安全檢查不符規定",
					},
					{
						code: "E1-07",
						description: "手套/Gloves安全檢查不符規定",
					},
					{
						code: "E1-08",
						description: "手電筒/Flashlight安全檢查不符規定",
					},
					{
						code: "E1-09",
						description: "小扳手/Axe安全檢查不符規定",
					},
					{
						code: "E1-10",
						description: "擴音器/Megaphone安全檢查不符規定",
					},
					{
						code: "E1-11",
						description: "醫療箱/First aid kit安全檢查不符規定",
					},
					{
						code: "E1-12",
						description: "急救包/FAK安全檢查不符規定",
					},
					{
						code: "E1-13",
						description: "緊急醫療箱/EMK安全檢查不符規定",
					},
					{
						code: "E1-14",
						description: "自動體外電擊器/AED安全檢查不符規定",
					},
					{
						code: "E1-15",
						description: "氧氣瓶/Oxygen Bottle安全檢查不符規定",
					},
					{ code: "E1-16", description: "其他緊急裝備狀況不正常" },
				],
			},
			{
				code: "E2",
				name: "客艙安全裝備",
				subcodes: [
					{
						code: "E2-01",
						description: "客艙組員椅安全檢查不符規定",
					},
					{
						code: "E2-02",
						description: "旅客座椅、客艙座位安全檢查不符規定",
					},
					{
						code: "E2-03",
						description: "安全帶/Seat Belt安全檢查不符規定",
					},
					{
						code: "E2-04",
						description: "客艙門/Door安全檢查不符規定",
					},
					{
						code: "E2-05",
						description: "緊急門Emergency Exit安全檢查不符規定",
					},
					{
						code: "E2-06",
						description: "駕駛艙門/Cockpit Door安全檢查不符規定",
					},
					{
						code: "E2-07",
						description: "緊急出口燈/Exit Sign安全檢查不符規定",
					},
					{
						code: "E2-08",
						description: "安全須知/Safety Card安全檢查不符規定",
					},
					{
						code: "E2-09",
						description: "行李櫃/Overhead Bin安全檢查不符規定",
					},
					{
						code: "E2-10",
						description:
							"洗手間煙霧偵測器/Smoke Detector安全檢查不符規定",
					},
					{
						code: "E2-11",
						description: "洗手間沖水功能/Flush安全檢查不符規定",
					},
					{
						code: "E2-12",
						description: "客艙通話系統/Interphone安全檢查不符規定",
					},
					{ code: "E2-13", description: "客艙內部有破損及安全疑慮" },
					{ code: "E2-14", description: "其他客艙裝備狀況不正常" },
				],
			},
			{
				code: "E3",
				name: "廚房安全裝備",
				subcodes: [
					{
						code: "E3-01",
						description: "廚房門/Galley Door安全檢查不符規定",
					},
					{
						code: "E3-02",
						description: "廚房鎖/Galley Lock安全檢查不符規定",
					},
					{
						code: "E3-03",
						description: "餐車/Service Cart安全檢查不符規定",
					},
					{ code: "E3-04", description: "烤箱/Oven安全檢查不符規定" },
					{
						code: "E3-05",
						description:
							"咖啡機、煮水機/Coffee Maker, Water Boiler安全檢查不符規定",
					},
					{ code: "E3-06", description: "廚房內部有破損及安全疑慮" },
					{ code: "E3-07", description: "其他廚房裝備狀況不正常" },
				],
			},
			{
				code: "E4",
				name: "廁所安全裝備",
				subcodes: [
					{
						code: "E4-01",
						description:
							"廁所門鎖/Lavatory Door Lock安全檢查不符規定",
					},
					{
						code: "E4-02",
						description:
							"廁所內滅火瓶/Fire Ext in Lavatory安全檢查不符規定",
					},
					{ code: "E4-03", description: "廁所內部有破損及安全疑慮" },
					{ code: "E4-04", description: "其他洗手間裝備狀況不正常" },
				],
			},
			{
				code: "E5",
				name: "客艙燈號/信號",
				subcodes: [
					{
						code: "E5-01",
						description:
							"安全帶燈號/Seat Belt Sign安全檢查不符規定",
					},
					{
						code: "E5-02",
						description: "禁菸燈號/No Smoking Sign安全檢查不符規定",
					},
					{
						code: "E5-03",
						description:
							"返回座位燈號/Return to Seat Sign安全檢查不符規定",
					},
					{
						code: "E5-04",
						description:
							"客艙燈光照明/Cabin Lighting安全檢查不符規定",
					},
					{
						code: "E5-05",
						description:
							"組員呼叫鈴/Crew Call Chime安全檢查不符規定",
					},
					{ code: "E5-06", description: "其他客艙燈號/信號不正常" },
				],
			},
			{
				code: "E6",
				name: "飛機狀況",
				subcodes: [
					{ code: "E6-01", description: "客艙有異味、異聲" },
					{ code: "E6-02", description: "客艙空調溫度異常" },
					{ code: "E6-03", description: "客艙氣壓異常" },
					{
						code: "E6-04",
						description: "飛機顛簸或其他飛機異常狀況",
					},
				],
			},
			{
				code: "E7",
				name: "其他非安全類客艙裝備",
				subcodes: [
					{
						code: "E7-01",
						description: "娛樂系統/IFE System狀況不正常",
					},
					{
						code: "E7-02",
						description: "公共廣播系統/PA System狀況不正常",
					},
					{
						code: "E7-03",
						description: "客艙服務用品短缺或不符規定",
					},
					{
						code: "E7-04",
						description: "其他非安全類客艙裝備狀況不正常",
					},
				],
			},
			{
				code: "E8",
				name: "場站設備",
				subcodes: [
					{
						code: "E8-01",
						description:
							"登機門設施/Boarding Gate Facility狀況不正常",
					},
					{
						code: "E8-02",
						description: "空橋/Passenger Boarding Bridge狀況不正常",
					},
					{
						code: "E8-03",
						description: "登機梯/Boarding Stairs狀況不正常",
					},
					{ code: "E8-04", description: "其他機場設施狀況不正常" },
				],
			},
		],
	},
	{
		code: "C",
		name: "溝通 (Communication)",
		middleCategories: [
			{
				code: "C1",
				name: "駕艙對客艙溝通",
				subcodes: [
					{
						code: "C1-01",
						description: "駕艙對客艙溝通不確實、時機不正確",
					},
				],
			},
			{
				code: "C2",
				name: "客艙對駕艙溝通",
				subcodes: [
					{
						code: "C2-01",
						description: "客艙對駕艙溝通不確實、時機不正確",
					},
				],
			},
			{
				code: "C3",
				name: "客艙對客艙溝通",
				subcodes: [
					{
						code: "C3-01",
						description: "客艙內溝通不確實、時機不正確",
					},
				],
			},
			{
				code: "C4",
				name: "駕駛艙門控管",
				subcodes: [
					{ code: "C4-01", description: "進入駕駛艙控管不當" },
					{ code: "C4-02", description: "駕駛艙內部監視不確實" },
				],
			},
			{
				code: "C5",
				name: "駕駛艙服務",
				subcodes: [
					{
						code: "C5-01",
						description:
							"駕駛艙餐點服務不符標準、時機不正確、過程有安全疑慮",
					},
				],
			},
		],
	},
	{
		code: "I",
		name: "個人 (Individual)",
		middleCategories: [
			{
				code: "I1",
				name: "客艙組員行為",
				subcodes: [
					{
						code: "I1-01",
						description:
							"客艙組員制服穿著、儀容、外觀、配件不符公司規定",
					},
					{
						code: "I1-02",
						description:
							"客艙組員未攜帶執行職務所需之證照、文件或有效期限不足",
					},
					{
						code: "I1-03",
						description:
							"客艙組員未經許可攜帶違反規定之物品（含寵物、危險品等）",
					},
					{
						code: "I1-04",
						description: "客艙組員於客艙內使用電子用品未符合規定",
					},
					{
						code: "I1-05",
						description: "客艙組員未依規定就座並繫妥安全帶或固定",
					},
					{
						code: "I1-06",
						description: "客艙組員未依規定使用組員休息區",
					},
					{
						code: "I1-07",
						description: "客艙組員酒測或藥物反應測試未通過",
					},
					{
						code: "I1-08",
						description:
							"客艙組員身體狀況不適任（含生病、懷孕）執勤",
					},
					{
						code: "I1-09",
						description:
							"客艙組員執勤時儀態不適當、服務技巧不佳、應對能力不足",
					},
					{
						code: "I1-10",
						description: "客艙組員值勤時睡覺、休息不當",
					},
					{
						code: "I1-11",
						description:
							"客艙組員服勤時違反公司安全、保安、紀律、作業規定或有違職務規範之行為",
					},
					{
						code: "I1-12",
						description: "客艙組員執勤時與旅客或同事有爭執、衝突",
					},
					{ code: "I1-13", description: "客艙組員於服勤時受傷" },
					{
						code: "I1-14",
						description: "其他客艙組員工作職責、行為不符規定",
					},
				],
			},
			{
				code: "I2",
				name: "客艙領導人行為",
				subcodes: [
					{ code: "I2-01", description: "艙內組員編組未符合規定" },
					{
						code: "I2-02",
						description: "艙內組員派位未符合規定或標準作業不清楚",
					},
					{
						code: "I2-03",
						description: "艙內組員工作分配不當，造成工作負荷過重",
					},
					{
						code: "I2-04",
						description: "艙內組員簡報未執行或執行不確實",
					},
					{
						code: "I2-05",
						description: "艙內組員管理監督、指揮調度不當",
					},
					{ code: "I2-06", description: "艙內組員協調、溝通不良" },
					{
						code: "I2-07",
						description: "其他客艙領導人工作職責、行為不符規定",
					},
				],
			},
		],
	},
	{
		code: "T",
		name: "交通/住宿 (Transportation)",
		middleCategories: [
			{
				code: "T1",
				name: "機上用品",
				subcodes: [
					{ code: "T1-01", description: "機上用品短缺" },
					{ code: "T1-02", description: "機上用品種類錯誤" },
					{ code: "T1-03", description: "機上用品品質不佳" },
				],
			},
			{
				code: "T2",
				name: "公司交通",
				subcodes: [
					{
						code: "T2-01",
						description:
							"接送時間、路線規劃不當，造成組員無法準時報到",
					},
					{ code: "T2-02", description: "交通安全有疑慮" },
				],
			},
			{
				code: "T3",
				name: "公司住宿",
				subcodes: [
					{
						code: "T3-01",
						description: "外站休息住宿環境不佳，影響休息品質",
					},
					{
						code: "T3-02",
						description: "外站休息住宿環境有安全疑慮",
					},
				],
			},
		],
	},
	{
		code: "O",
		name: "其他 (Others)",
		middleCategories: [
			{
				code: "O1",
				name: "客艙清潔/衛生",
				subcodes: [
					{ code: "O1-01", description: "客艙清潔不佳" },
					{
						code: "O1-02",
						description: "客艙衛生有疑慮（含機上供餐衛生）",
					},
					{
						code: "O1-03",
						description: "客艙有害蟲（蚊蟲、蟑螂等）",
					},
				],
			},
			{
				code: "O2",
				name: "工作習慣",
				subcodes: [
					{ code: "O2-01", description: "工作習慣不良，有安全疑慮" },
				],
			},
			{
				code: "O3",
				name: "燙傷",
				subcodes: [
					{
						code: "O3-01",
						description: "使用熱水、咖啡或熱飲時造成燙傷",
					},
					{
						code: "O3-02",
						description: "使用烤箱等加熱設備時造成燙傷",
					},
				],
			},
			{
				code: "O4",
				name: "其他類",
				subcodes: [
					{ code: "O4-01", description: "其他未列於上述分類之事件" },
				],
			},
		],
	},
	{
		code: "M",
		name: "管理 (Management)",
		middleCategories: [
			{
				code: "M1",
				name: "改變管理",
				subcodes: [
					{
						code: "M1-01",
						description: "公司政策、程序改變未能及時宣導、溝通",
					},
					{
						code: "M1-02",
						description: "新設備、裝備導入未能妥善規劃及訓練",
					},
				],
			},
		],
	},
];

// Flatten all EF codes for easy lookup
export const ALL_EF_ATTRIBUTE_CODES = EF_ATTRIBUTE_CATEGORIES.flatMap(
	(category) => category.middleCategories.flatMap((middle) => middle.subcodes)
);

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
							"客艙行李(CBBG)包裝、固定、其他作業規範等,未符合報局核准計劃",
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
					{
						code: "P9-03",
						description: "保安相關表單操作，未符合作業標準",
					},
					{
						code: "P9-04",
						description: "槍砲武器進入客艙未符合作業標準",
					},
					{
						code: "P9-05",
						description: "地停期間人員留守未符合保安規定",
					},
					{
						code: "P9-06",
						description:
							"航機於地面有旅客在機上時，未保留法規規定組員人數",
					},
					{
						code: "P9-07",
						description: "遣返旅客作業未符合保安規定",
					},
					{
						code: "P9-08",
						description: "地面人員上機未配戴保安規定之有效證件",
					},
					{
						code: "P9-09",
						description: "駕駛艙門保安控管未符合作業標準",
					},
					{
						code: "P9-10",
						description: "加油作業未有人員執行保安監控",
					},
				],
			},
			{
				code: "P10",
				name: "關門前/後標準作業",
				subcodes: [
					{
						code: "P10-01",
						description:
							"關門前法規規定應備文件不全、不正確、檢查不確實",
					},
					{ code: "P10-02", description: "關門前客艙置物櫃未關妥" },
					{
						code: "P10-03",
						description: "關門前地勤人員離機廣播未執行",
					},
					{
						code: "P10-04",
						description: "關門後電子用品禁用廣播、宣告未執行",
					},
					{
						code: "P10-05",
						description: "關門之艙門操作未符合標準程序",
					},
					{ code: "P10-06", description: "關門未獲機長許可" },
					{
						code: "P10-07",
						description: "艙門關妥未獲機外人員確認及回應",
					},
				],
			},
			{
				code: "P11",
				name: "開門前/後標準作業",
				subcodes: [
					{
						code: "P11-01",
						description: "開門之艙門操作未符合標準程序",
					},
					{
						code: "P11-02",
						description: "艙門開啟未獲機外人員確認及回應",
					},
					{
						code: "P11-03",
						description: "開門未獲許可(機長、座艙長)",
					},
					{
						code: "P11-04",
						description: "離機前組員未複查艙門設定正確",
					},
				],
			},
			{
				code: "P12",
				name: "服務用車作業",
				subcodes: [
					{ code: "P12-01", description: "服務用車閒置時未有人看管" },
					{
						code: "P12-02",
						description: "服務用車定位時剎車未踩、門鎖未鎖妥",
					},
					{
						code: "P12-03",
						description: "服務用車、箱故障處理未符合標準",
					},
					{
						code: "P12-04",
						description: "航機下降時未儘速將服務用車就定位放妥",
					},
					{
						code: "P12-05",
						description: "服務用車故障、規格不符、未符合檢查標準",
					},
				],
			},
			{
				code: "P13",
				name: "客艙缺點紀錄簿",
				subcodes: [
					{ code: "P13-01", description: "CLB/DD檢查未執行" },
					{
						code: "P13-02",
						description: "CLB檢查未落實、缺點未處置",
					},
					{ code: "P13-03", description: "CLB使用、紀錄未符合標準" },
				],
			},
			{
				code: "P14",
				name: "地勤作業",
				subcodes: [
					{
						code: "P14-01",
						description: "地勤作業旅客人數或身份不符",
					},
					{
						code: "P14-02",
						description: "重覆劃位、劃位疏失、未符合作業標準",
					},
					{
						code: "P14-03",
						description: "地勤登機查驗不確實、旅客上錯飛機",
					},
					{
						code: "P14-04",
						description: "地勤作業旅客登機未獲機組員同意",
					},
					{
						code: "P14-05",
						description: "地勤作業相關飛行文件及表單不全、不正確",
					},
					{
						code: "P14-06",
						description: "地勤機外人員未遵守標準開門程序",
					},
					{
						code: "P14-07",
						description: "地勤機外人員未遵守標準關門程序",
					},
					{
						code: "P14-08",
						description: "空地訊息交接未執行、執行不確實",
					},
					{ code: "P14-09", description: "地勤裝載與平衡表不符" },
					{
						code: "P14-10",
						description: "地勤標準裝載作業未符合標準",
					},
					{
						code: "P14-11",
						description: "地面作業CARGO DOOR操作力道過大",
					},
					{
						code: "P14-12",
						description: "地勤作業未經許可放行他航ACM組員上機",
					},
					{ code: "P14-13", description: "地勤人員未遵守SOP" },
				],
			},
			{
				code: "P15",
				name: "違規旅客處理",
				subcodes: [
					{ code: "P15-01", description: "旅客違規三階段程序未執行" },
					{
						code: "P15-02",
						description: "旅客違規三階段程序執行不確實",
					},
					{
						code: "P15-03",
						description: "旅客違規處理未符合標準程序引發其他事件",
					},
					{ code: "P15-04", description: "旅客於機內違規吸煙" },
					{
						code: "P15-05",
						description: "旅客於機內滋擾其他乘客或組員",
					},
					{
						code: "P15-06",
						description: "旅客違規使用電子用品、經勸導仍不願配合",
					},
					{
						code: "P15-07",
						description: "旅客違規使用電子用品干擾飛行系統",
					},
				],
			},
			{
				code: "P16",
				name: "其他異常作業",
				subcodes: [
					{ code: "P16-01", description: "旅客上機後放棄搭乘" },
					{
						code: "P16-02",
						description: "機內有旅客實施加、缷油造成安全事件",
					},
					{ code: "P16-03", description: "發生飛航中人員死亡" },
					{ code: "P16-04", description: "發生客艙失火" },
					{ code: "P16-05", description: "發生客艙失壓" },
					{ code: "P16-06", description: "發生劫機" },
					{ code: "P16-07", description: "發生無主物及爆裂物威脅" },
					{ code: "P16-08", description: "發生組員失能事件" },
					{ code: "P16-09", description: "旅客霸機、滯留於機內" },
					{
						code: "P16-10",
						description: "班機延遲長時間延誤、滯留、轉降",
					},
					{ code: "P16-11", description: "旅客於機內受傷" },
					{ code: "P16-12", description: "旅客於機內急救" },
					{ code: "P16-13", description: "乘員於機上急症" },
				],
			},
			{
				code: "P17",
				name: "緊急程序",
				subcodes: [
					{ code: "P17-01", description: "發生無預警緊急情況" },
					{ code: "P17-02", description: "發生陸上迫降" },
					{ code: "P17-03", description: "發生水上迫降" },
				],
			},
			{
				code: "P18",
				name: "疲勞管理",
				subcodes: [
					{
						code: "P18-01",
						description: "派遣人員未遵守疲勞管理法規造成違法事件",
					},
					{
						code: "P18-02",
						description: "客艙組員未遵守疲勞管理法規規定造成違法",
					},
					{ code: "P18-03", description: "客艙組員疲勞評估中度風險" },
					{ code: "P18-04", description: "客艙組員疲勞評估高度風險" },
					{
						code: "P18-05",
						description: "客艙組員因疲勞原因，主動提報取消任務",
					},
					{
						code: "P18-06",
						description: "客艙組員因疲勞原因，被動取消任務",
					},
					{
						code: "P18-07",
						description: "因疲勞致使逃生滑梯無預警充氣",
					},
					{
						code: "P18-08",
						description: "因疲勞而未依標準程序作業，造成違反內規",
					},
					{
						code: "P18-09",
						description: "因疲勞而未依標準程序規定作業，違法事件",
					},
					{
						code: "P18-10",
						description: "因疲勞造成人員操作設備不當，致人、物損傷",
					},
					{ code: "P18-11", description: "疲勞管理系統缺失" },
					{
						code: "P18-12",
						description: "客艙組員疲勞違規未自主管理、主動提報",
					},
					{ code: "P18-13", description: "作業人員疲勞管理輸入錯誤" },
					{
						code: "P18-14",
						description: "疲勞管理因外在不可抗力之因素違規",
					},
				],
			},
			{
				code: "P19",
				name: "其他客艙安全作業",
				subcodes: [
					{
						code: "P19-01",
						description: "客艙組員座椅乘坐人員資格未符合規定",
					},
					{
						code: "P19-02",
						description:
							"旅客/訂位/客服人員未遵守標準作業，有安全風險",
					},
				],
			},
			{
				code: "P20",
				name: "PED作業",
				subcodes: [
					{
						code: "P20-01",
						description: "組員無法辨識PED標示、圖示",
					},
					{
						code: "P20-02",
						description: "組員未勸阻違規旅客使用PED",
					},
					{
						code: "P20-03",
						description: "旅客未遵守組員PED安全要求",
					},
					{ code: "P20-04", description: "PED引起冒煙，失火" },
					{ code: "P20-05", description: "耳機線阻礙逃生路線" },
					{
						code: "P20-06",
						description: "旅客在關鍵飛航階段起身開置物櫃拿PED",
					},
					{ code: "P20-07", description: "PED使用造成人員受傷" },
					{ code: "P20-08", description: "PED使用造成飛機受損" },
					{ code: "P20-09", description: "PED未符合STOWED規定" },
					{ code: "P20-10", description: "PED未符合SECURED規定" },
					{ code: "P20-11", description: "PED使用干擾飛航通訊設備" },
					{ code: "P20-12", description: "PED使用引發滋擾事件" },
					{
						code: "P20-13",
						description: "PED開放及限制時機未明確廣播及宣導",
					},
					{
						code: "P20-14",
						description: "前後艙PED溝通未符合作業程序",
					},
					{
						code: "P20-15",
						description: "新科技PED未有標準作業程序",
					},
					{ code: "P20-16", description: "滅火輔助設備使用" },
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
						description: "緊急燈光功能故障、未符合檢查標準",
					},
					{
						code: "E1-02",
						description: "廚房緊急電源功能故障、未符合檢查標準",
					},
					{
						code: "E1-03",
						description: "手電筒短缺、故障、未符合檢查標準",
					},
					{
						code: "E1-04",
						description: "急救醫謢裝備短缺、失效、未符合檢查標準",
					},
					{
						code: "E1-05",
						description: "滅火器短缺、失效、未符合檢查標準",
					},
					{
						code: "E1-06",
						description: "PBE短缺、失效、符合檢查標準",
					},
					{
						code: "E1-07",
						description: "ELT短缺、失效、未符合檢查標準",
					},
					{
						code: "E1-08",
						description: "手提式擴音器短缺、失效、未符合檢查標準",
					},
					{
						code: "E1-09",
						description: "POB短缺、失效、未符合檢查標準",
					},
					{
						code: "E1-10",
						description: "救生衣短缺、失效、未符合檢查標準",
					},
					{
						code: "E1-11",
						description: "客艙氧氣系統掉落、使用、未符合檢查標準",
					},
					{
						code: "E1-12",
						description: "逃生滑梯壓力異常、檢查未符合檢查標準",
					},
					{
						code: "E1-13",
						description: "MDT/MRT故障、短缺、未符合檢查標準",
					},
				],
			},
			{
				code: "E2",
				name: "客艙安全裝備",
				subcodes: [
					{
						code: "E2-01",
						description:
							"旅客座椅及安全配件失效、未符合檢查標準。(安全帶、扶手、椅背、檔桿)",
					},
					{
						code: "E2-02",
						description: "客艙信號故障、失效、未符合檢查標準",
					},
					{
						code: "E2-03",
						description: "窗戶蓋功能故障、未符合檢查標準",
					},
					{
						code: "E2-04",
						description: "客艙置物櫃功能故障，未符合檢查標準",
					},
					{
						code: "E2-05",
						description: "艙門設備故障、失效、未符合檢查標準",
					},
					{
						code: "E2-06",
						description: "逃生窗故障、失效、未符合檢查標準",
					},
					{
						code: "E2-07",
						description: "組員座椅及安全配件失效、未符合檢查標準",
					},
					{
						code: "E2-08",
						description: "客艙PANEL故障、失效、未符合檢查標準",
					},
				],
			},
			{
				code: "E3",
				name: "廚房安全裝備",
				subcodes: [
					{
						code: "E3-01",
						description: "電氣設備故障、失效、未符合檢查標準",
					},
					{
						code: "E3-02",
						description: "斷電器故障、失效、未符合檢查標準",
					},
					{
						code: "E3-03",
						description: "垃圾筒門蓋故障、失效、未符合檢查標準",
					},
					{
						code: "E3-04",
						description: "廚房置物櫃故障、失效、未符合檢查標準",
					},
					{
						code: "E3-05",
						description: "廚房鐵製手提箱故障、未符合檢查標準",
					},
					{
						code: "E3-06",
						description: "烤架變形、規格不符、未符合檢查標準",
					},
					{
						code: "E3-07",
						description:
							"餐車、箱、櫃、門、LOCK/LATCH功能故障或未符合檢查標準",
					},
				],
			},
			{
				code: "E4",
				name: "廁所安全裝備",
				subcodes: [
					{
						code: "E4-01",
						description: "洗手間煙霧偵測器故障、未符合檢查標準",
					},
					{
						code: "E4-02",
						description: "廁所煙灰缸短缺、故障、未符合檢查標準",
					},
					{
						code: "E4-03",
						description:
							"廁所燈號及信號標誌短缺、故障、未符合檢查標準",
					},
					{
						code: "E4-04",
						description: "廁所門板及門鎖故障、未符合檢查標準",
					},
					{
						code: "E4-05",
						description: "廁所置物櫃功能故障、未符合檢查標準",
					},
				],
			},
			{
				code: "E5",
				name: "客艙燈號/信號",
				subcodes: [
					{
						code: "E5-01",
						description:
							"機內各項安全標誌及標示模糊、短缺、未符合檢查標準",
					},
					{
						code: "E5-02",
						description: "客艙燈號故障、失效、未符合檢查標準",
					},
					{
						code: "E5-03",
						description: "客艙信號及聲響異常、故障、未符合檢查標準",
					},
				],
			},
			{
				code: "E6",
				name: "飛機狀況",
				subcodes: [
					{ code: "E6-01", description: "飛機有重油味" },
					{ code: "E6-02", description: "飛機有異常聲響" },
					{ code: "E6-03", description: "飛機有蟑螂出沒" },
				],
			},
			{
				code: "E7",
				name: "其他非安全類客艙裝備",
				subcodes: [
					{
						code: "E7-01",
						description:
							"ATR 後貨艙防煙簾故障、失效、未符合檢查標準",
					},
					{
						code: "E7-02",
						description: "備用安全帶短缺、失效、未符合檢查標準",
					},
				],
			},
			{
				code: "E8",
				name: "場站設備",
				subcodes: [
					{
						code: "E8-01",
						description: "登機梯設備故障、未符合需求、操作不當",
					},
					{
						code: "E8-02",
						description: "餐服車設備故障、未符合需求、操作不當",
					},
					{
						code: "E8-03",
						description: "空橋設備故障、未符合需求、操作不當",
					},
					{
						code: "E8-04",
						description:
							"連結航機裝備故障、未符合檢查標準、操作不當 (推車、檔桿)",
					},
					{
						code: "E8-05",
						description: "機場其他設備因施工、改變，造成損失或傷害",
					},
					{
						code: "E8-06",
						description: "航站交通車故障、操作不當，造成損失或傷害",
					},
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
						description: "駕艙任務簡報未執行、未符合標準",
					},
					{
						code: "C1-02",
						description: "駕艙10000呎通知未執行、未符合標準",
					},
					{
						code: "C1-03",
						description: "駕艙準備起飛指示未執行、未符合標準",
					},
					{
						code: "C1-04",
						description: "駕艙亂流開始及結束通知未執行、未符合標準",
					},
					{
						code: "C1-05",
						description: "駕艙地面滑行速度太快造成乘員受傷",
					},
					{
						code: "C1-06",
						description: "駕艙一般狀況通知、指示未執行未符合標準",
					},
					{
						code: "C1-07",
						description: "駕艙異常狀況通知、指示，未執行未符合標準",
					},
					{
						code: "C1-08",
						description: "駕艙緊急狀況通知、指示未執行未符合標準",
					},
				],
			},
			{
				code: "C2",
				name: "客艙對駕艙溝通",
				subcodes: [
					{
						code: "C2-01",
						description: "客艙CABIN READY通報未執行、未符合標準",
					},
					{ code: "C2-02", description: "客艙檢查結果未通知駕艙" },
					{
						code: "C2-03",
						description: "客艙逃生滑梯設定完成未通報駕艙、未合標準",
					},
					{
						code: "C2-04",
						description: "客艙一般狀況通知駕艙，未執行、未符合標準",
					},
					{
						code: "C2-05",
						description: "客艙異常狀況通知駕艙，未執行、未符合標準",
					},
					{
						code: "C2-06",
						description: "客艙緊急狀況通知駕艙，未執行、未符合標準",
					},
				],
			},
			{
				code: "C3",
				name: "客艙對客艙溝通",
				subcodes: [
					{
						code: "C3-01",
						description: "客艙任務簡報未執行、未符合標準",
					},
					{
						code: "C3-02",
						description: "客艙各項檢查回報未執行、未符合標準",
					},
					{
						code: "C3-03",
						description: "客艙一般狀況通知，未執行、未符合標準",
					},
					{
						code: "C3-04",
						description: "客艙異常狀況通知，未執行、未符合標準",
					},
					{
						code: "C3-05",
						description: "客艙緊急狀況通知，未執行、未符合標準",
					},
				],
			},
			{
				code: "C4",
				name: "駕駛艙門控管",
				subcodes: [
					{
						code: "C4-01",
						description: "乘坐OBS人員資格確認，未執行、未符合標準",
					},
					{
						code: "C4-02",
						description: "駕駛艙門控管，未執行、未符合標準",
					},
					{
						code: "C4-03",
						description: "靜默駕艙未執行、未符合標準",
					},
				],
			},
			{
				code: "C5",
				name: "駕駛艙服務",
				subcodes: [
					{
						code: "C5-01",
						description: "客艙未提供駕艙餐飲服務、未符合標準",
					},
					{
						code: "C5-02",
						description: "提供駕艙服務用品擺放未符合安全規定",
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
						description: "組員證照未攜帶、不全、無效",
					},
					{
						code: "I1-02",
						description: "組員手冊未攜帶、非最新版次、維護不正確",
					},
					{
						code: "I1-03",
						description: "組員服儀及裝備不全、未符合標準",
					},
					{ code: "I1-04", description: "組員安全及公告抽問未合格" },
					{ code: "I1-05", description: "組員酒測、藥測未合於標準" },
					{
						code: "I1-06",
						description: "組員因個人行為不當影響派遣",
					},
					{
						code: "I1-07",
						description: "組員因個人行為不當違反內規",
					},
					{
						code: "I1-08",
						description: "組員因個人行為不當違反法規",
					},
					{
						code: "I1-09",
						description: "組員因個人未遵守紀律影響派遣或違反內規",
					},
					{
						code: "I1-10",
						description: "組員因個人未遵守紀律影響派遣或違反法規",
					},
					{
						code: "I1-11",
						description:
							"組員因個人操作設備不當，致人員、公司、設備損傷",
					},
					{
						code: "I1-12",
						description:
							"組員因個人未依標準程序規定作業，造成損(傷)害、違法事件",
					},
					{
						code: "I1-13",
						description:
							"組員因個人未依標準程序規定作業，造成違反內規",
					},
				],
			},
			{
				code: "I2",
				name: "客艙領導人行為",
				subcodes: [
					{
						code: "I2-01",
						description: "PR/LF證照未檢查、檢查不確實",
					},
					{
						code: "I2-02",
						description: "PR/LF公告及抽問未執行、未符合標準",
					},
					{
						code: "I2-03",
						description: "PR/LF任務提示未執行、未符合標準",
					},
					{
						code: "I2-04",
						description: "PR/LF服儀及裝備檢查不全、未符合標準",
					},
					{
						code: "I2-05",
						description: "PR/LF因未盡職責落實檢查，造成違反內規",
					},
					{
						code: "I2-06",
						description: "PR/LF因未盡職責落實檢查，造成違反法規",
					},
					{
						code: "I2-07",
						description:
							"PR/LF因個人因素無法達成職務要求，造成損傷或違紀事件",
					},
					{
						code: "I2-08",
						description: "待命組員未確實維護公告及訊息傳遞",
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
					{ code: "T1-01", description: "機上食品過期、檢驗不合格" },
					{ code: "T1-02", description: "機上食品異物危害安全" },
					{
						code: "T1-03",
						description: "機上食品衛生不良、效期標示不全",
					},
					{
						code: "T1-04",
						description: "機上廚具品質不良有安全疑慮",
					},
					{
						code: "T1-05",
						description: "機上閱讀物品質不良致旅客受傷(釘書針)",
					},
					{
						code: "T1-06",
						description: "機上服務用品包裝不當有安全疑慮",
					},
					{
						code: "T1-07",
						description: "機上服務用品短缺造成違法(安全須知卡)",
					},
					{ code: "T1-08", description: "機上裝載不適當有安全疑慮" },
					{
						code: "T1-09",
						description: "空廚人員未符合安全作業規範",
					},
				],
			},
			{
				code: "T2",
				name: "公司交通",
				subcodes: [
					{
						code: "T2-01",
						description: "公司安排交通設備延遲以致影響派遣",
					},
					{
						code: "T2-02",
						description: "公司安排交通異常，影響派遣、造成人員受傷",
					},
				],
			},
			{
				code: "T3",
				name: "公司住宿",
				subcodes: [
					{
						code: "T3-01",
						description: "公司安排住宿因軟硬體設備問題，影響派遣",
					},
					{
						code: "T3-02",
						description: "公司安排住宿因公共安全影響派遣、人員受傷",
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
					{
						code: "O1-01",
						description: "地毯磨損嚴重、脫線，有絆倒乘員或安全疑慮",
					},
					{
						code: "O1-02",
						description: "客艙清潔未符合標準，有安全疑慮",
					},
					{
						code: "O1-03",
						description: "清潔人員將毛毯完全覆蓋安全帶",
					},
				],
			},
			{
				code: "O2",
				name: "工作習慣",
				subcodes: [
					{
						code: "O2-01",
						description: "起降、滑行時未保持工作檯面淨空",
					},
					{
						code: "O2-02",
						description: "起降、滑行時未保持緊急出口周圍淨空",
					},
					{
						code: "O2-03",
						description: "起降、滑行時未將垃圾筒蓋關妥",
					},
					{
						code: "O2-04",
						description: "緊急裝備區域有行李混置未檢查、檢查不確實",
					},
					{
						code: "O2-05",
						description: "起降、滑行時提供非安全相關服務",
					},
					{
						code: "O2-06",
						description: "客艙組員座椅置放個人物品，影響安全",
					},
					{
						code: "O2-07",
						description: "組員未隨手關妥未使用之設備以致人員受傷",
					},
					{
						code: "O2-08",
						description: "組員廚房作業未正確維護自身安全",
					},
				],
			},
			{
				code: "O3",
				name: "燙傷",
				subcodes: [
					{
						code: "O3-01",
						description: "乘員燙傷，歸責為個人因素所致",
					},
					{
						code: "O3-02",
						description: "乘員燙傷，歸責為非個人因素所致",
					},
				],
			},
			{
				code: "O4",
				name: "其他類",
				subcodes: [{ code: "O4-01", description: "其他類" }],
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
					{ code: "M1-01", description: "程序改變" },
					{ code: "M1-02", description: "政策改變" },
					{ code: "M1-03", description: "法規改變" },
					{ code: "M1-04", description: "設備改變" },
					{ code: "M1-05", description: "航線改變" },
					{ code: "M1-06", description: "緊急應變" },
					{ code: "M1-07", description: "組織改變" },
					{ code: "M1-08", description: "機隊改變" },
				],
			},
		],
	},
];

// Flatten all EF codes for easy lookup
export const ALL_EF_ATTRIBUTE_CODES = EF_ATTRIBUTE_CATEGORIES.flatMap(
	(category) => category.middleCategories.flatMap((middle) => middle.subcodes)
);

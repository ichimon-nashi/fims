// src/lib/routineAudit.constants.ts
// SAM (root-cause) code taxonomy — was routine_audit_sam_codes DB table,
// moved here to match the pattern already established for EF codes in
// src/lib/sms.constants.ts. Fixed IATA taxonomy, not user-editable data,
// so no DB table (and no seed migration) is needed.

import { EF_ATTRIBUTE_CATEGORIES } from "./sms.constants";

export interface SamCodeEntry {
	code: string;
	description_en: string;
	description_zh: string;
}

export interface SamCategory {
	name: string;
	codes: SamCodeEntry[];
}

export interface SamArea {
	code: string;
	name: string;
	categories: SamCategory[];
}

export const SAM_AREAS: SamArea[] = [
	{
		code: "ORGANIZATIONAL INFLUENCES",
		name: "組織影響",
		categories: [
			{
				name: "Resource Management",
				codes: [
					{
						code: "RM01",
						description_en: "Insufficient human resources",
						description_zh: "人力資源不足",
					},
					{
						code: "RM02",
						description_en:
							"Insufficient / defective equipment/facilities available",
						description_zh: "可用設備/設施不足或有缺陷",
					},
					{
						code: "RM03",
						description_en:
							"Insufficient financial/budget resources, excessive cost cutting",
						description_zh: "財務/預算資源不足，過度削減成本",
					},
					{
						code: "RM04",
						description_en:
							"Insufficient selection process / qualification",
						description_zh: "人員甄選流程或資格審查機制不完善",
					},
					{
						code: "RM05",
						description_en: "Poor planning, prioritization",
						description_zh: "計畫與優先順序規劃不當",
					},
					{
						code: "RM06",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Organizational Climate",
				codes: [
					{
						code: "OC01",
						description_en: "Inadequate company culture",
						description_zh: "安全文化不足",
					},
					{
						code: "OC02",
						description_en: "Inadequate HR policies",
						description_zh: "人力資源政策不完善",
					},
					{
						code: "OC03",
						description_en: "Inadequate organizational structure",
						description_zh: "組織架構不完善",
					},
					{
						code: "OC04",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Organizational Processes",
				codes: [
					{
						code: "OP01",
						description_en: "Inadequate oversight resources",
						description_zh: "監控與督導資源不足",
					},
					{
						code: "OP02",
						description_en:
							"Unclear / unavailable / inadequate regulations, standard procedures",
						description_zh: "規章或標準作業程序（SOP）不明確、缺失或不完善",
					},
					{
						code: "OP03",
						description_en: "Inadequate operations",
						description_zh: "作業流程規劃不完善",
					},
					{
						code: "OP04",
						description_en: "Inadequate training",
						description_zh: "訓練不完善",
					},
					{
						code: "OP05",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
		],
	},
	{
		code: "UNSAFE SUPERVISION",
		name: "不安全督導",
		categories: [
			{
				name: "Inadequate Supervision",
				codes: [
					{
						code: "IS01",
						description_en:
							"Failed to provide leadership and guidance",
						description_zh: "未能提供領導與指導",
					},
					{
						code: "IS02",
						description_en: "Failed to track performance",
						description_zh: "未能追蹤績效表現",
					},
					{
						code: "IS03",
						description_en: "Failed to track qualification",
						description_zh: "未能追蹤資格認證與檢定狀態",
					},
					{
						code: "IS04",
						description_en:
							"Failed to provide/ensure adequate training",
						description_zh: "未能提供或確保足夠的訓練",
					},
					{
						code: "IS05",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Planned Inappropriate Activities",
				codes: [
					{
						code: "PA01",
						description_en:
							"Inappropriate employee scheduling /assigning / manning",
						description_zh: "人員排班、任務分配或人力配置不當",
					},
					{
						code: "PA02",
						description_en: "Inadequate Risk Assessment",
						description_zh: "風險評估不足",
					},
					{
						code: "PA03",
						description_en:
							"Authorization to take unnecessary risks",
						description_zh: "核准承擔不必要的風險",
					},
					{
						code: "PA04",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Failed to Correct a Known Problem",
				codes: [
					{
						code: "FP01",
						description_en:
							"Supervisor failed to identify and correct inappropriate behavior or unsafe tendencies",
						description_zh:
							"主管未能識別並改正不當行為或不安全傾向",
					},
					{
						code: "FP02",
						description_en:
							"Supervisor failed to correct known hazard / problem / error / inefficiency",
						description_zh:
							"主管未能改正已知的危險源、問題、錯誤或低效現象",
					},
					{
						code: "FP03",
						description_en:
							"Supervisor failed to report a hazard or unsafe tendencies",
						description_zh: "主管未能通報危險源或不安全傾向",
					},
					{
						code: "FP04",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Supervisory Violations",
				codes: [
					{
						code: "SV01",
						description_en:
							"Supervisor failed to enforce rules and regulations",
						description_zh: "主管未能嚴格執行規章制度",
					},
					{
						code: "SV02",
						description_en:
							"Supervisor directed / authorized subordinates to violate existing rules",
						description_zh: "主管指示或授權下屬違反既有規章",
					},
					{
						code: "SV03",
						description_en:
							"Supervisor authorized unqualified person for work",
						description_zh: "主管授權不具資格人員執行任務",
					},
					{
						code: "SV04",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
		],
	},
	{
		code: "PRECONDITIONS FOR UNSAFE ACTS",
		name: "不安全行為之前置條件",
		categories: [
			{
				name: "Physical Environment",
				codes: [
					{
						code: "PN01",
						description_en:
							"Restricted visibility, altitude, terrain, weather conditions",
						description_zh: "能見度受限、高度、地形或天候狀況不佳",
					},
					{
						code: "PN02",
						description_en: "Inadequate lighting, noise, vibration",
						description_zh: "照明不足、噪音或震動過大",
					},
					{
						code: "PN03",
						description_en:
							"Inadequate cleanliness, surface conditions",
						description_zh: "環境清潔度差或表面狀況不佳（如濕滑、鋪面損壞）",
					},
					{
						code: "PN04",
						description_en:
							"Inadequate facilities / walk / road layout, signing, marking",
						description_zh:
							"設施、動線/道路佈局、標示或標線不完善",
					},
					{
						code: "PN05",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Technological Environment",
				codes: [
					{
						code: "TN01",
						description_en:
							"Inappropriate / poor design of equipment, tool, parts, material",
						description_zh: "設備、工具、零組件或材料設計不當/有缺陷",
					},
					{
						code: "TN02",
						description_en:
							"Inappropriate automation, function, reliability",
						description_zh: "自動化系統、功能性或可靠性不適當",
					},
					{
						code: "TN03",
						description_en: "Inappropriate interface design",
						description_zh: "人機介面（Interface）設計不當",
					},
					{
						code: "TN04",
						description_en: "Inappropriate communications system",
						description_zh: "通訊系統不完善或不符需求",
					},
					{
						code: "TN05",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Psychological and Physical Conditions",
				codes: [
					{
						code: "PC01",
						description_en:
							"Inattention, apathy, complacency, boredom, distraction, stress, exhaustion",
						description_zh:
							"注意力不集中、冷漠、自滿、厭倦、分心、壓力或力竭",
					},
					{
						code: "PC02",
						description_en:
							"Channelized attention and actions, confusion, disorientation",
						description_zh: "注意力過度集中（管狀視野）、困惑或迷失方向",
					},
					{
						code: "PC03",
						description_en: "Personality style",
						description_zh: "個人性格特質因素",
					},
					{
						code: "PC04",
						description_en: "Illness, sickness",
						description_zh: "身體不適或疾病",
					},
					{
						code: "PC05",
						description_en: "Effects of alcohol, drugs",
						description_zh: "酒精或藥物影響",
					},
					{
						code: "PC06",
						description_en:
							"Inadequate experience for situation, insufficient reaction time",
						description_zh: "因應當前狀況之經驗不足，或反應時間不足",
					},
					{
						code: "PC07",
						description_en:
							"Misperception of operational conditions",
						description_zh: "對作業環境或狀況之感知誤判",
					},
					{
						code: "PC08",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Personal Readiness",
				codes: [
					{
						code: "PR01",
						description_en: "Inadequate Rest",
						description_zh: "休息不足",
					},
					{
						code: "PR02",
						description_en:
							"Inadequate physical fitness, insufficient diet, nutrition",
						description_zh: "體能狀況不佳、飲食或營養攝取不足",
					},
					{
						code: "PR03",
						description_en:
							"Self-medication and unreported medical conditions",
						description_zh: "自行用藥或未依規定通報身體不適",
					},
					{
						code: "PR04",
						description_en: "Inadequate personal preparation",
						description_zh: "個人行前準備不足",
					},
					{
						code: "PR05",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "CRM",
				codes: [
					{
						code: "CM01",
						description_en: "Lack of assertiveness or leadership",
						description_zh: "缺乏自信決斷力（Assertiveness）或領導力",
					},
					{
						code: "CM02",
						description_en:
							"Lack of planning or preparation, inadequate briefing",
						description_zh: "缺乏計畫或準備，任務簡報（Briefing）不足",
					},
					{
						code: "CM03",
						description_en:
							"Poor workload management or task delegation",
						description_zh: "工作負荷管理或任務分配不當",
					},
					{
						code: "CM04",
						description_en: "Authority gradient, poor teamwork",
						description_zh: "威權梯度（Authority Gradient）過大，團隊合作不佳",
					},
					{
						code: "CM05",
						description_en:
							"Lack of cross-monitoring performance, supportive feedback",
						description_zh: "缺乏互相監控（Cross-monitoring）與支持性回饋",
					},
					{
						code: "CM06",
						description_en:
							"Poor communication of critical information and poor decision making",
						description_zh: "關鍵資訊溝通不良及決策失誤",
					},
					{
						code: "CM07",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
		],
	},
	{
		code: "UNSAFE ACTS",
		name: "不安全行為",
		categories: [
			{
				name: "Decision Errors",
				codes: [
					{
						code: "DE01",
						description_en:
							"Inadequate risk evaluation during operation, misjudging",
						description_zh: "作業過程風險評估不足或評估錯誤",
					},
					{
						code: "DE02",
						description_en: "Ignored caution, warning",
						description_zh: "忽視警告信號或警訊",
					},
					{
						code: "DE03",
						description_en: "Task misprioritization",
						description_zh: "工作任務優先順序錯置",
					},
					{
						code: "DE04",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Skill Based Errors",
				codes: [
					{
						code: "SE01",
						description_en:
							"Incorrect operation / handling of equipment / inappropriate use of automation",
						description_zh: "設備操作或處置不當、自動化系統使用不當",
					},
					{
						code: "SE02",
						description_en:
							"Incorrect operations / handling equipment",
						description_zh: "設備操作或處理不當",
					},
					{
						code: "SE03",
						description_en:
							"Inadvertently activating or deactivating equipment, controls or switches",
						description_zh: "無意中誤觸、開啟或關閉設備、控制裝置或開關",
					},
					{
						code: "SE04",
						description_en: "Failure to see and react / fail",
						description_zh: "未能察覺並及時做出反應",
					},
					{
						code: "SE05",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Perception Errors",
				codes: [
					{
						code: "PE01",
						description_en:
							"Error due to misperception, illusion, perception misjudgment",
						description_zh: "因感知錯誤、錯覺或認知誤判所致之錯誤",
					},
					{
						code: "PE02",
						description_en:
							"Spatial disorientation, vertigo, visual illusion",
						description_zh: "空間定向障礙（迷航）、眩暈或視覺錯覺",
					},
					{
						code: "PE03",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Exceptional violations",
				codes: [
					{
						code: "EV01",
						description_en: "Lack of discipline",
						description_zh: "缺乏紀律",
					},
					{
						code: "EV02",
						description_en:
							"Rules, regulations, procedures not followed",
						description_zh: "未遵守規章、程序或規定",
					},
					{
						code: "EV03",
						description_en:
							"Intentional bending the rules, procedures, policies without cause or need",
						description_zh: "無正當理由或必要性，故意曲解或規避規章、程序與政策",
					},
					{
						code: "EV04",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
			{
				name: "Routine violations",
				codes: [
					{
						code: "RV01",
						description_en:
							"Widespread, routine, systemic, habitual violation",
						description_zh:
							"普遍存在、習慣性或系統性的常態性違規行為",
					},
					{
						code: "RV02",
						description_en: "Violation based on Risk Assessment",
						description_zh: "基於風險評估之違規行為（如自主權衡後違規）",
					},
					{
						code: "RV03",
						description_en: "Other",
						description_zh: "其他",
					},
				],
			},
		],
	},
];

// flattened lookup: code string -> full entry + resolved category/area names
export interface ResolvedSamCode extends SamCodeEntry {
	category: string;
	area: string;
	areaCode: string;
}

export const SAM_CODE_MAP: Record<string, ResolvedSamCode> = Object.fromEntries(
	SAM_AREAS.flatMap((area) =>
		area.categories.flatMap((cat) =>
			cat.codes.map((c) => [
				c.code,
				{
					...c,
					category: cat.name,
					area: area.name,
					areaCode: area.code,
				},
			]),
		),
	),
);
// EF code lookup — code string -> attribute name + description, for
// display purposes (e.g. "出口座位 / P4-03" in the entries list, mirroring
// how SAM codes show "category / code")
export interface ResolvedEfCode {
	code: string;
	description: string;
	attributeName: string; // middle category, e.g. "出口座位"
	categoryName: string; // top category, e.g. "安全程序/訓練 (Procedure/Training)"
}

export const EF_CODE_MAP: Record<string, ResolvedEfCode> = Object.fromEntries(
	EF_ATTRIBUTE_CATEGORIES.flatMap((cat) =>
		cat.middleCategories.flatMap((mid) =>
			mid.subcodes.map((s) => [
				s.code,
				{
					code: s.code,
					description: s.description,
					attributeName: mid.name,
					categoryName: cat.name,
				},
			]),
		),
	),
);
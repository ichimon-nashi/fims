// src/components/audit/firstlevel/checklistData.ts
// All 30 EF items from FMEF-06-19 Rev07

export interface SubItem {
	label: string;
}

export interface ChecklistItem {
	code: string;
	section: number;
	zhTitle: string;
	enTitle: string;
	isarp: string;
	omDm: string;
	subItems?: SubItem[];
	auditorActions?: string[];
}

export const SECTIONS = [
	{ num: 1, zh: "1. 空服科單位", en: "Department-Wide Management" },
	{ num: 2, zh: "2. 管派組", en: "Performance & Scheduling Section" },
	{ num: 3, zh: "3. 標訓組", en: "Standard & Training Section" },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = [
	{
		code: "EF1.1",
		section: 1,
		zhTitle: "空服科組織圖",
		enTitle: "Is there an organization chart for cabin operations?",
		isarp: "CAB 1.1.1",
		omDm: "",
	},
	{
		code: "EF1.2",
		section: 1,
		zhTitle: "空服科管理員及非管理員職掌定義清楚?",
		enTitle:
			"Are there clearly defined duties & responsibilities for management & non-management level personnel?",
		isarp: "CAB 1.2.1; CAB 1.2.4",
		omDm: "",
	},
	{
		code: "EF1.3",
		section: 1,
		zhTitle: "執行相關飛安及保安決策者有完成適當之訓練",
		enTitle:
			"Do personnel who make decisions related to cabin safety & security have qualified training?",
		isarp: "CAB 1.2.1",
		omDm: "",
	},
	{
		code: "EF1.4",
		section: 1,
		zhTitle: "空服科管理員設有職務代理人制度",
		enTitle:
			"Is there a process for the delegation of duties when employees are absent from the workplace?",
		isarp: "CAB 1.2.2",
		omDm: "",
	},
	{
		code: "EF1.5",
		section: 1,
		zhTitle: "體檢符合作業規定、定期實施",
		enTitle:
			"Is there a process to ensure all personnel undergo a physical examination in compliance with regulations; on a scheduled basis?",
		isarp: "CAB 1.2.2",
		omDm: "",
	},
	{
		code: "EF1.6",
		section: 1,
		zhTitle: "空服科品質文件及作業手冊符合標準化程序",
		enTitle:
			"Is there a process to ensure OMs & quality documents are subject to standardized processes?",
		isarp: "CAB 1.5.3; CAB 1.6.6; CAB 1.7.1",
		omDm: "",
		subItems: [
			{ label: "EF-01 CCTM 客艙組員訓練手冊" },
			{ label: "EF-02 CCOM 客艙組員作業手冊" },
			{ label: "EF-03 ISM 機上售賣作業手冊" },
			{ label: "EF-04 SSM 空中用品作業手冊" },
			{ label: "EF-06 CCDM 空服科管理手冊" },
			{ label: "EF-07 PA 廣播手冊" },
			{ label: "EF-08 CCSM 客艙組員服務手冊" },
		],
	},
	{
		code: "EF1.7",
		section: 1,
		zhTitle: "公司/個人電子檔資料備份程序及維護",
		enTitle:
			"Is there a process for the backup and maintenance of company/personal electronic files?",
		isarp: "CAB 1.7.2",
		omDm: "",
	},
	{
		code: "EF1.8",
		section: 1,
		zhTitle: "空服科與客艙組員溝通有程序且具時效性",
		enTitle:
			"Is there a process to ensure relevant information between office & cabin crew are communicated in a timely manner?",
		isarp: "CAB 1.3.2",
		omDm: "",
	},
	{
		code: "EF1.9",
		section: 1,
		zhTitle: "檢查員接受初訓及複訓訓練，資格符合",
		enTitle:
			"Have auditors undergone initial, recurrent training, and qualified?",
		isarp: "ORG 3.4.12; ORG 3.4.13",
		omDm: "",
	},
	{
		code: "EF1.10",
		section: 1,
		zhTitle: "品質保證查核定期實施，缺失紀錄及改善措施",
		enTitle:
			"Is there a quality assurance audit conducted on a regular basis; findings and corrective action recorded?",
		isarp: "CAB 1.9.1; CAB 1.9.3; CAB 1.9.4",
		omDm: "",
	},
	{
		code: "EF1.11",
		section: 1,
		zhTitle: "安全相關溝通會議是否定期舉行?",
		enTitle: "Are safety related meetings held regularly?",
		isarp: "CAB 1.11.1; CAB 1.11.2",
		omDm: "",
		subItems: [
			{ label: "空服季會 Cabin crew assemblies" },
			{ label: "座艙長會議 Purser meetings" },
			{ label: "SAG 會議 SAG meetings" },
		],
	},
	{
		code: "EF1.12",
		section: 1,
		zhTitle: "有安全管理(SMS)系統",
		enTitle: "Is there a safety management system that includes:",
		isarp: "CAB 1.11.1; CAB 1.11.5",
		omDm: "",
		subItems: [
			{ label: "危害辨識 Hazard identification" },
			{ label: "風險評估及管理 Risk assessment & management" },
			{
				label: "訂定/檢視單位安全績效指標及目標 Setting & review of safety performance indicators",
			},
			{ label: "安全報告分析及公告 Safety report analysis & promotion" },
		],
	},
	{
		code: "EF1.13",
		section: 1,
		zhTitle: "外包商作業查核",
		enTitle:
			"Do outsourced operations include contract, audit methodology, previous findings & corrective action record history?",
		isarp: "CAB 1.10.1; CAB 1.10.2; CAB 1.10.3; CAB 1.10.4",
		omDm: "",
		subItems: [
			{ label: "華夏餐車 Service trolley" },
			{ label: "空廚 In-flight catering" },
			{ label: "急救 First-Aid training" },
		],
	},
	{
		code: "EF1.14",
		section: 1,
		zhTitle: "個資管理/庫房管理",
		enTitle:
			"Do personal data/warehouse management fulfill criteria requirements?",
		isarp: "N/A",
		omDm: "",
		subItems: [
			{ label: "個人資料 Personal data management" },
			{ label: "資料櫃 File cabinets" },
			{ label: "倉庫 Warehouse" },
		],
	},
	{
		code: "EF1.15",
		section: 1,
		zhTitle: "網路保安作業符合標準，定期檢視關鍵系統",
		enTitle:
			"Does cyber security performed in the cabin crew department meet requirements and review system regularly?",
		isarp: "N/A",
		omDm: "",
	},
	{
		code: "EF2.1",
		section: 2,
		zhTitle: "確認每一航班均有安排具帶班資格執行飛航任務",
		enTitle:
			"Is there a process to ensure a purser or leading flight attendant is scheduled for each flight duty?",
		isarp: "CAB 3.1.2",
		omDm: "",
	},
	{
		code: "EF2.2",
		section: 2,
		zhTitle: "客艙組員證照管理符合作業規定，證照效期有效控管",
		enTitle:
			"Is there a process to monitor the validity of cabin crew identification documents?",
		isarp: "",
		omDm: "",
	},
	{
		code: "EF2.3",
		section: 2,
		zhTitle: "有疲勞管理作業程序及系統監控組員飛航時間、執勤期間、休息時間",
		enTitle:
			"Is there a fatigue risk management system to monitor cabin crew flight time, flight duty period, duty period, and rest periods?",
		isarp: "CAB 3.1.4",
		omDm: "",
	},
	{
		code: "EF2.4",
		section: 2,
		zhTitle: "客艙組員適性考核符合作業程序",
		enTitle:
			"Is there a process to ensure cabin crew line evaluation are conducted on a regular basis with records retained?",
		isarp: "CAB 3.1.4",
		omDm: "",
		subItems: [
			{ label: "定期實施 Conducted on a regular basis" },
			{ label: "考核紀錄 Records retained" },
		],
	},
	{
		code: "EF2.5",
		section: 2,
		zhTitle: "客艙組員派遣機種有效性是否符合?",
		enTitle:
			"Have dispatched cabin crew completed necessary training and are qualified?",
		isarp: "",
		omDm: "",
	},
	{
		code: "EF3.1",
		section: 3,
		zhTitle: "新進空服初始訓練依計劃實施，未完訓前不得派遣飛航任務",
		enTitle:
			"Is there a process to ensure cabin crew complete an initial training program before being assigned duties as a qualified crew?",
		isarp: "CAB 2.1.2",
		omDm: "",
	},
	{
		code: "EF3.2",
		section: 3,
		zhTitle: "客艙組員複訓依計劃實施，複訓週期符合法規要求",
		enTitle:
			"Is there a process to ensure cabin crew complete a recurrent training program in a timely manner applicable to regulations?",
		isarp: "CAB 2.1.3; CAB 2.2.3–2.2.11",
		omDm: "",
		subItems: [
			{ label: "安全管理 SMS" },
			{ label: "安全與法規 Safety & Regulations" },
			{
				label: "緊急程序與情境演練 Emergency procedures & practical training",
			},
			{ label: "緊急裝備 Emergency equipment" },
			{ label: "組員資源管理 CRM" },
			{ label: "急救 First aid" },
		],
	},
	{
		code: "EF3.3",
		section: 3,
		zhTitle: "客艙組員恢復資格訓練依計劃實施",
		enTitle:
			"Is there a process to ensure cabin crew complete a re-qualification program as a process of regaining qualification?",
		isarp: "CAB 2.1.4",
		omDm: "",
	},
	{
		code: "EF3.4",
		section: 3,
		zhTitle: "空服教師/講師資格符合要求",
		enTitle:
			"Is there a process to ensure all instructors are qualified in the areas where the instructor will deliver instruction?",
		isarp: "CAB 2.1.6",
		omDm: "",
	},
	{
		code: "EF3.5",
		section: 3,
		zhTitle: "訓練紀錄、維護及保存期間符合標準作業",
		enTitle:
			"Is there a process to ensure training records are retained for an adequate amount of time?",
		isarp: "CAB 2.1.8",
		omDm: "",
	},
	{
		code: "EF3.6",
		section: 3,
		zhTitle: "客艙組員危險品訓練符合訓練計劃",
		enTitle:
			"Do all cabin crew receive training in dangerous goods awareness in accordance with the training plan?",
		isarp: "CAB 2.2.7",
		omDm: "",
	},
	{
		code: "EF3.7",
		section: 3,
		zhTitle: "客艙組員保安訓練符合訓練計劃",
		enTitle:
			"Do all cabin crew complete security training in accordance with the training plan?",
		isarp: "CAB 2.2.12",
		omDm: "",
	},
	{
		code: "EF3.8",
		section: 3,
		zhTitle: "客艙組員機種訓練是否依計劃實施",
		enTitle:
			"Is there a process to ensure cabin crew complete an aircraft transition training program prior to being assigned duties?",
		isarp: "",
		omDm: "",
		subItems: [
			{ label: "地面訓練 Ground training" },
			{ label: "飛行訓練 In-flight training" },
		],
	},
	{
		code: "EF3.9",
		section: 3,
		zhTitle: "檢視過去連續12個月SRM中度以上風險及CAR缺失改善的有效性",
		enTitle:
			"Review effectiveness of medium or higher risk SRMs & CAR (including internal/external audit findings) within the past 12 months.",
		isarp: "CAB 1.9.3",
		omDm: "",
	},
	{
		code: "EF3.10",
		section: 3,
		zhTitle: "針對一年內公告之適用法規與標準，完成相關手冊修訂",
		enTitle:
			"Complete the revision of relevant manuals for complying with the applicable regulations and standards receiving within a year.",
		isarp: "ORG 2.1.1; 2.5.1; 2.5.2",
		omDm: "SAM 1.1",
	},
];

export type ResultType = "conformity" | "finding" | "na" | null;
export type FindingType =
	| "doc_not_impl"
	| "impl_not_doc"
	| "not_doc_not_impl"
	| null;

export interface ItemResponse {
	result: ResultType;
	finding_type: FindingType;
	car_number: string;
	comment: string;
	evidence: string;
	flagged: boolean;
}

export const EMPTY_RESPONSE: ItemResponse = {
	result: null,
	finding_type: null,
	car_number: "",
	comment: "",
	evidence: "",
	flagged: false,
};

export const RESULT_LABELS: Record<
	string,
	{ zh: string; en: string; color: string }
> = {
	conformity: { zh: "符合", en: "Conformity", color: "#22c55e" },
	finding: { zh: "缺失", en: "Finding", color: "#ef4444" },
	na: { zh: "不適用", en: "N/A", color: "#64748b" },
};

export const FINDING_TYPE_LABELS: Record<string, string> = {
	doc_not_impl: "Documented, Not Implemented",
	impl_not_doc: "Implemented, Not Documented",
	not_doc_not_impl: "Not Documented, Not Implemented",
};

export interface Recommendation {
	id: string;
	section: string;
	text: string;
}

export const SECTIONS_DEPT = ["管派組", "標訓組", "空品組"] as const;
export const RECOMMENDATION_SECTIONS = [
	"全科",
	"管派組",
	"標訓組",
	"空品組",
] as const;
export type DeptSection = (typeof SECTIONS_DEPT)[number];

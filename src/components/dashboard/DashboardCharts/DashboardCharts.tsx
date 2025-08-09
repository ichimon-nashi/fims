// src/components/dashboard/DashboardCharts/DashboardCharts.tsx
"use client";

import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
} from "recharts";
import styles from "./DashboardCharts.module.css";

interface DashboardData {
	topIncorrectQuestions: Array<{
		question: string;
		question_number?: number;
		question_title?: string;
		category: string;
		count: number;
	}>;
	examineeTesting: {
		tested: number;
		remaining: number;
		total: number;
		totalUsers?: number; // Total non-admin users
		currentYearTested?: number; // Tests in current year
		currentYearRemaining?: number; // Remaining for current year
	};
	examinerStats: Array<{
		examiner: string;
		count: number;
	}>;
	questionsByCategory?: Array<{
		category: string;
		count: number;
	}>;
}

interface DashboardChartsProps {
	data: DashboardData;
}

const COLORS = ["#667eea", "#764ba2", "#48bb78", "#ed8936", "#e53e3e", "#38b2ac", "#9f7aea", "#f56565"];

const DashboardCharts = ({ data }: DashboardChartsProps) => {
	const { topIncorrectQuestions, examineeTesting, examinerStats, questionsByCategory } = data;

	// Use the correct data from the API response
	// The API should provide the actual counts, not calculated ones
	const totalUsers = examineeTesting.totalUsers || examineeTesting.total;
	const currentYearTested = examineeTesting.currentYearTested || examineeTesting.tested;
	const currentYearRemaining = examineeTesting.currentYearRemaining || examineeTesting.remaining;

	// Calculate completion percentage (cap at 100%)
	const completionPercentage =
		totalUsers > 0
			? Math.min(100, Math.round((currentYearTested / totalUsers) * 100))
			: 0;

	// Prepare pie chart data with current year stats
	const pieData = [
		{ name: "Tested", value: currentYearTested, color: "#48bb78" },
		{ name: "Remaining", value: currentYearRemaining, color: "#e53e3e" },
	];

	// Transform questions data to show question numbers instead of full text
	const transformedQuestions = topIncorrectQuestions.map((item, index) => ({
		...item,
		displayLabel: item.question_number
			? `#${item.question_number}`
			: `Q${index + 1}`,
		fullQuestion: item.question_title || item.question,
	}));

	// Generate empty data message for questions by category if not provided or empty
	const categoryData = questionsByCategory && questionsByCategory.length > 0 
		? questionsByCategory 
		: [];

	// Check if we have any data to display
	const hasData = {
		questions: topIncorrectQuestions.length > 0,
		testing: totalUsers > 0 || currentYearTested > 0,
		examiners: examinerStats.length > 0,
		categories: categoryData.length > 0
	};

	const hasAnyData = Object.values(hasData).some(Boolean);

	// Custom tooltip for questions chart
	const QuestionTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			const data = payload[0].payload;
			return (
				<div className={styles.customTooltip}>
					<div className={styles.tooltipLabel}>
						Question #{data.question_number || "N/A"}
					</div>
					<div className={styles.tooltipValue}>
						{data.fullQuestion}
					</div>
					<div className={styles.tooltipValue}>
						Category: {data.category}
					</div>
					<div className={styles.tooltipValue}>
						Incorrect Count: {data.count}
					</div>
				</div>
			);
		}
		return null;
	};

	// Custom tooltip for examiner chart
	const ExaminerTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			return (
				<div className={styles.customTooltip}>
					<div className={styles.tooltipLabel}>{label}</div>
					<div className={styles.tooltipValue}>
						Examinees Tested: {payload[0].value}
					</div>
				</div>
			);
		}
		return null;
	};

	// Custom tooltip for category chart
	const CategoryTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			return (
				<div className={styles.customTooltip}>
					<div className={styles.tooltipLabel}>{label}</div>
					<div className={styles.tooltipValue}>
						Total Questions: {payload[0].value}
					</div>
				</div>
			);
		}
		return null;
	};

	return (
		<div className={styles.dashboardGrid}>
			{/* Data Status Alert */}
			{!hasAnyData && (
				<div className={styles.noDataAlert}>
					<div className={styles.noDataIcon}>📊</div>
					<div className={styles.noDataContent}>
						<h3>No Dashboard Data Available</h3>
						<p>Unable to retrieve data from the database. Please check your connection or contact support.</p>
					</div>
				</div>
			)}

			{/* Stats Cards */}
			<div className={styles.statsRow}>
				<div className={styles.statsCard}>
					<div className={styles.statsIcon}>👥</div>
					<div className={styles.statsContent}>
						<h3>Total Users</h3>
						<p className={styles.statsNumber}>
							{totalUsers}
							{!hasData.testing && <span className={styles.noDataBadge}>No Data</span>}
						</p>
					</div>
				</div>

				<div className={styles.statsCard}>
					<div className={styles.statsIcon}>✅</div>
					<div className={styles.statsContent}>
						<h3>Tested This Year</h3>
						<p className={styles.statsNumber}>
							{currentYearTested}
							{!hasData.testing && <span className={styles.noDataBadge}>No Data</span>}
						</p>
					</div>
				</div>

				<div className={styles.statsCard}>
					<div className={styles.statsIcon}>⏳</div>
					<div className={styles.statsContent}>
						<h3>Remaining</h3>
						<p className={styles.statsNumber}>
							{currentYearRemaining}
							{!hasData.testing && <span className={styles.noDataBadge}>No Data</span>}
						</p>
					</div>
				</div>

				<div className={styles.statsCard}>
					<div className={styles.statsIcon}>📈</div>
					<div className={styles.statsContent}>
						<h3>Completion</h3>
						<p className={styles.statsNumber}>
							{completionPercentage}%
							{!hasData.testing && <span className={styles.noDataBadge}>No Data</span>}
						</p>
					</div>
				</div>
			</div>

			{/* Charts Grid - Now with 4 charts in 2x2 grid */}
			<div className={styles.chartsGrid}>
				{/* Top Incorrect Questions Chart */}
				<div className={styles.chartCard}>
					<h2 className={styles.chartTitle}>
						Most Commonly Incorrect Questions
					</h2>
					<div className={styles.chartContainer}>
						{hasData.questions ? (
							<ResponsiveContainer width="100%" height={250}>
								<BarChart
									data={transformedQuestions}
									margin={{
										top: 20,
										right: 30,
										left: 20,
										bottom: 40,
									}}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										opacity={0.3}
									/>
									<XAxis
										dataKey="displayLabel"
										height={60}
										fontSize={11}
										interval={0}
										tick={{ textAnchor: "middle" }}
									/>
									<YAxis fontSize={11} />
									<Tooltip content={<QuestionTooltip />} />
									<Bar
										dataKey="count"
										fill="url(#colorGradient)"
										radius={[3, 3, 0, 0]}
									/>
									<defs>
										<linearGradient
											id="colorGradient"
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop
												offset="5%"
												stopColor="#667eea"
												stopOpacity={0.9}
											/>
											<stop
												offset="95%"
												stopColor="#764ba2"
												stopOpacity={0.9}
											/>
										</linearGradient>
									</defs>
								</BarChart>
							</ResponsiveContainer>
						) : (
							<div className={styles.noDataMessage}>
								<div className={styles.noDataIcon}>📊</div>
								<p>No question data available</p>
							</div>
						)}
					</div>
				</div>

				{/* Testing Progress Pie Chart */}
				<div className={styles.chartCard}>
					<h2 className={styles.chartTitle}>
						Testing Progress (Current Year)
					</h2>
					<div className={styles.chartContainer}>
						{hasData.testing ? (
							<ResponsiveContainer width="100%" height={250}>
								<PieChart>
									<Pie
										data={pieData}
										cx="50%"
										cy="50%"
										labelLine={false}
										label={({ name, value, percent }) =>
											`${name}: ${value} (${(
												percent * 100
											).toFixed(0)}%)`
										}
										outerRadius={70}
										fill="#8884d8"
										dataKey="value"
									>
										{pieData.map((entry, index) => (
											<Cell
												key={`cell-${index}`}
												fill={entry.color}
											/>
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											backgroundColor: "white",
											border: "1px solid #e2e8f0",
											borderRadius: "8px",
											boxShadow:
												"0 4px 16px rgba(0, 0, 0, 0.1)",
											fontSize: "0.9rem",
										}}
									/>
								</PieChart>
							</ResponsiveContainer>
						) : (
							<div className={styles.noDataMessage}>
								<div className={styles.noDataIcon}>📊</div>
								<p>No testing data available</p>
							</div>
						)}
					</div>
				</div>

				{/* Questions by Category Chart */}
				<div className={styles.chartCard}>
					<h2 className={styles.chartTitle}>
						Questions by Category
					</h2>
					<div className={styles.chartContainer}>
						{hasData.categories ? (
							<ResponsiveContainer width="100%" height={250}>
								<BarChart
									data={categoryData}
									margin={{
										top: 20,
										right: 30,
										left: 20,
										bottom: 60,
									}}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										opacity={0.3}
									/>
									<XAxis
										dataKey="category"
										height={80}
										fontSize={11}
										interval={0}
										tick={{
											textAnchor: "middle",
											transform: "rotate(-25)",
										}}
									/>
									<YAxis fontSize={11} />
									<Tooltip content={<CategoryTooltip />} />
									<Bar
										dataKey="count"
										fill="url(#categoryGradient)"
										radius={[3, 3, 0, 0]}
									/>
									<defs>
										<linearGradient
											id="categoryGradient"
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop
												offset="5%"
												stopColor="#38b2ac"
												stopOpacity={0.9}
											/>
											<stop
												offset="95%"
												stopColor="#319795"
												stopOpacity={0.9}
											/>
										</linearGradient>
									</defs>
								</BarChart>
							</ResponsiveContainer>
						) : (
							<div className={styles.noDataMessage}>
								<div className={styles.noDataIcon}>📊</div>
								<p>No category data available</p>
							</div>
						)}
					</div>
				</div>

				{/* Examiner Performance Chart */}
				<div className={styles.chartCard}>
					<h2 className={styles.chartTitle}>
						Tests Conducted by Examiner
					</h2>
					<div className={styles.chartContainer}>
						{hasData.examiners ? (
							<ResponsiveContainer width="100%" height={250}>
								<BarChart
									data={examinerStats}
									margin={{
										top: 20,
										right: 30,
										left: 20,
										bottom: 60,
									}}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										opacity={0.3}
									/>
									<XAxis
										dataKey="examiner"
										height={80}
										fontSize={11}
										interval={0}
										tick={{
											textAnchor: "middle",
											transform: "rotate(-25)",
										}}
									/>
									<YAxis fontSize={11} />
									<Tooltip content={<ExaminerTooltip />} />
									<Bar
										dataKey="count"
										fill="url(#examinerGradient)"
										radius={[3, 3, 0, 0]}
									/>
									<defs>
										<linearGradient
											id="examinerGradient"
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop
												offset="5%"
												stopColor="#48bb78"
												stopOpacity={0.9}
											/>
											<stop
												offset="95%"
												stopColor="#38a169"
												stopOpacity={0.9}
											/>
										</linearGradient>
									</defs>
								</BarChart>
							</ResponsiveContainer>
						) : (
							<div className={styles.noDataMessage}>
								<div className={styles.noDataIcon}>📊</div>
								<p>No examiner data available</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default DashboardCharts;
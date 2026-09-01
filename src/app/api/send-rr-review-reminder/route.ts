// src/app/api/send-rr-review-reminder/route.ts
// Location: Copy to src/app/api/send-rr-review-reminder/route.ts

import { NextResponse } from 'next/server';

interface DueItem {
	entryId: string;
	rrNumber: string;
	reviewType: 'Risk' | 'Barrier' | 'Risk+Barrier';
	riskId: string;
	barrierId?: string;
	nextReviewDate: string;
	daysRemaining: number;
	hazardNumber?: string;
	hazardDescription?: string;
}

export async function POST(request: Request) {
	try {
		console.log('=== RR Review Reminder Email API Called ===');
		console.log('Brevo API Key exists:', !!process.env.BREVO_API_KEY);
		
		const { dueItems, recipients } = await request.json() as {
			dueItems: DueItem[];
			recipients: string[];
		};
		
		console.log('Due items count:', dueItems.length);
		console.log('Recipients:', recipients);
		
		if (!dueItems || dueItems.length === 0) {
			return NextResponse.json({ 
				success: true, 
				message: '無需要審查的項目',
				itemCount: 0
			});
		}
		
		if (!process.env.BREVO_API_KEY) {
			throw new Error('Brevo API key not configured');
		}
		
		// Get today's date in Taiwan format
		const today = new Date();
		const taiwanDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
		const dateStr = taiwanDate.toLocaleDateString('zh-TW', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long'
		});
		
		// Build email subject
		const emailSubject = `[SMS提醒] 今日有 ${dueItems.length} 項Risk/Barrier需要檢視 - ${taiwanDate.toLocaleDateString('zh-TW')}`;
		
		// Build HTML content
		const emailHtmlContent = buildEmailHtml(dueItems, dateStr);
		
		// Build text content (fallback)
		const emailTextContent = buildEmailText(dueItems, dateStr);
		
		// Prepare Brevo payload
		const brevoPayload = {
			sender: {
				name: '豪神FIMS - SMS系統',
				email: 'hankengo@gmail.com'
			},
			to: recipients.map(email => ({ email })),
			subject: emailSubject,
			htmlContent: emailHtmlContent,
			textContent: emailTextContent
		};
		
		console.log('Sending email via Brevo...');
		
		const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'api-key': process.env.BREVO_API_KEY
			},
			body: JSON.stringify(brevoPayload)
		});
		
		const brevoResult = await brevoResponse.json();
		
		if (!brevoResponse.ok) {
			console.error('❌ Brevo FAILED:', brevoResult);
			throw new Error(`Brevo failed: ${brevoResult.message || 'Unknown error'}`);
		}
		
		console.log('✅ Brevo SUCCESS:', brevoResult);
		
		return NextResponse.json({ 
			success: true, 
			provider: 'Brevo',
			messageId: brevoResult.messageId,
			message: '郵件已成功發送',
			itemCount: dueItems.length,
			recipients
		});
		
	} catch (error: any) {
		console.error('=== Error sending RR review reminder ===');
		console.error('Error:', error);
		
		return NextResponse.json(
			{ 
				success: false, 
				error: error.message || '郵件發送失敗',
				errorDetails: error.toString()
			},
			{ status: 500 }
		);
	}
}

// Build HTML email content
function buildEmailHtml(dueItems: DueItem[], dateStr: string): string {
	// Group items by review type for better organization
	const riskItems = dueItems.filter(item => item.reviewType === 'Risk');
	const barrierItems = dueItems.filter(item => item.reviewType === 'Barrier');
	const combinedItems = dueItems.filter(item => item.reviewType === 'Risk+Barrier');
	
	const itemCards = dueItems.map((item, index) => `
		<div class="item-card">
			<div class="item-header">
				<span class="item-number">#${index + 1}</span>
				<span class="review-type ${getReviewTypeClass(item.reviewType)}">${item.reviewType}</span>
			</div>
			<div class="item-body">
				<div class="info-row">
					<span class="label">RR編號：</span>
					<span class="value">${item.rrNumber}</span>
				</div>
				${item.hazardNumber ? `
					<div class="info-row">
						<span class="label">危害編號：</span>
						<span class="value">${item.hazardNumber}</span>
					</div>
				` : ''}
				${item.hazardDescription ? `
					<div class="info-row">
						<span class="label">危害描述：</span>
						<span class="value">${item.hazardDescription}</span>
					</div>
				` : ''}
				<div class="info-row">
					<span class="label">Risk ID：</span>
					<span class="value highlight-risk">${item.riskId || '-'}</span>
				</div>
				${item.barrierId ? `
					<div class="info-row">
						<span class="label">Barrier ID：</span>
						<span class="value highlight-barrier">${item.barrierId}</span>
					</div>
				` : ''}
				<div class="info-row">
					<span class="label">複查截止日：</span>
					<span class="value due-date">⏰ ${formatDate(item.nextReviewDate)}</span>
				</div>
			</div>
		</div>
	`).join('');
	
	return `
		<!DOCTYPE html>
		<html>
			<head>
				<meta charset="utf-8">
				<style>
					body {
						font-family: "Microsoft JhengHei", "PingFang TC", sans-serif;
						line-height: 1.6;
						color: #1e293b;
						background-color: #f8fafc;
						margin: 0;
						padding: 0;
					}
					.container {
						max-width: 700px;
						margin: 20px auto;
						background-color: white;
						border-radius: 12px;
						overflow: hidden;
						box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
					}
					.header {
						background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
						color: white;
						padding: 30px;
						text-align: center;
					}
					.header h1 {
						margin: 0 0 10px 0;
						font-size: 24px;
						font-weight: bold;
					}
					.header .date {
						font-size: 14px;
						opacity: 0.9;
					}
					.summary {
						background-color: #fef3c7;
						border-left: 4px solid #f59e0b;
						padding: 20px;
						margin: 20px;
						border-radius: 8px;
					}
					.summary-title {
						font-size: 18px;
						font-weight: bold;
						color: #92400e;
						margin-bottom: 10px;
					}
					.summary-stats {
						display: flex;
						gap: 15px;
						flex-wrap: wrap;
					}
					.stat {
						background-color: white;
						padding: 10px 15px;
						border-radius: 6px;
						font-size: 14px;
					}
					.stat-label {
						color: #64748b;
						font-size: 12px;
					}
					.stat-value {
						font-weight: bold;
						font-size: 18px;
						color: #0f172a;
					}
					.content {
						padding: 20px;
					}
					.item-card {
						background-color: #f8fafc;
						border: 1px solid #e2e8f0;
						border-radius: 8px;
						margin-bottom: 15px;
						overflow: hidden;
						transition: box-shadow 0.2s;
					}
					.item-card:hover {
						box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
					}
					.item-header {
						background-color: #334155;
						color: white;
						padding: 12px 15px;
						display: flex;
						justify-content: space-between;
						align-items: center;
					}
					.item-number {
						font-weight: bold;
						font-size: 16px;
					}
					.review-type {
						padding: 4px 12px;
						border-radius: 20px;
						font-size: 12px;
						font-weight: bold;
					}
					.review-type.risk {
						background-color: #dc2626;
						color: white;
					}
					.review-type.barrier {
						background-color: #2563eb;
						color: white;
					}
					.review-type.combined {
						background: linear-gradient(90deg, #dc2626 0%, #2563eb 100%);
						color: white;
					}
					.item-body {
						padding: 15px;
					}
					.info-row {
						margin: 8px 0;
						display: flex;
						align-items: flex-start;
					}
					.label {
						font-weight: bold;
						color: #475569;
						min-width: 100px;
						font-size: 14px;
					}
					.value {
						color: #0f172a;
						flex: 1;
						font-size: 14px;
					}
					.highlight-risk {
						color: #dc2626;
						font-weight: bold;
					}
					.highlight-barrier {
						color: #2563eb;
						font-weight: bold;
					}
					.due-date {
						color: #f59e0b;
						font-weight: bold;
					}
					.footer {
						background-color: #f1f5f9;
						padding: 20px;
						text-align: center;
						font-size: 12px;
						color: #64748b;
						border-top: 1px solid #e2e8f0;
					}
					.footer-note {
						background-color: #dbeafe;
						border-left: 3px solid #3b82f6;
						padding: 15px;
						margin: 20px;
						border-radius: 6px;
						font-size: 13px;
					}
					@media (max-width: 600px) {
						.summary-stats {
							flex-direction: column;
						}
						.label {
							min-width: 80px;
						}
					}
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>🔔 SMS Risk/Barrier複查提醒</h1>
						<div class="date">${dateStr}</div>
					</div>
					
					<div class="summary">
						<div class="summary-title">📊 今日待複查項目統計</div>
						<div class="summary-stats">
							<div class="stat">
								<div class="stat-label">總計</div>
								<div class="stat-value">${dueItems.length} 項</div>
							</div>
							${riskItems.length > 0 ? `
								<div class="stat">
									<div class="stat-label">Risk</div>
									<div class="stat-value" style="color: #dc2626;">${riskItems.length} 項</div>
								</div>
							` : ''}
							${barrierItems.length > 0 ? `
								<div class="stat">
									<div class="stat-label">Barrier</div>
									<div class="stat-value" style="color: #2563eb;">${barrierItems.length} 項</div>
								</div>
							` : ''}
							${combinedItems.length > 0 ? `
								<div class="stat">
									<div class="stat-label">Risk+Barrier</div>
									<div class="stat-value" style="color: #7c3aed;">${combinedItems.length} 項</div>
								</div>
							` : ''}
						</div>
					</div>
					
					<div class="content">
						${itemCards}
					</div>
					
					<div class="footer-note">
						<strong>📝 提醒事項：</strong>
						<ul style="margin: 10px 0; padding-left: 20px;">
							<li>請盡快登入AQD Risk Review系統執行複查</li>
							<li>完成複查後，請更新豪神FIMS「Last Review」和「Next Review」</li>
							<li>如有任何問題，請聯繫豪神</li>
						</ul>
					</div>
					
					<div class="footer">
						<p>此郵件由豪神FIMS-SMS系統自動發送，請勿直接回覆此郵件。</p>
						<p style="margin-top: 10px; color: #94a3b8;">Generated at ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
					</div>
				</div>
			</body>
		</html>
	`;
}

// Build plain text email content
function buildEmailText(dueItems: DueItem[], dateStr: string): string {
	let text = `SMS Risk/Barrier複查提醒\n`;
	text += `${dateStr}\n`;
	text += `${'='.repeat(50)}\n\n`;
	
	text += `今日有 ${dueItems.length} 項Risk/Barrier需要檢視：\n\n`;
	
	dueItems.forEach((item, index) => {
		text += `${index + 1}. ${item.reviewType}\n`;
		text += `   RR編號：${item.rrNumber}\n`;
		if (item.hazardNumber) {
			text += `   危害編號：${item.hazardNumber}\n`;
		}
		if (item.hazardDescription) {
			text += `   危害描述：${item.hazardDescription}\n`;
		}
		text += `   Risk ID：${item.riskId || '-'}\n`;
		if (item.barrierId) {
			text += `   Barrier ID：${item.barrierId}\n`;
		}
		text += `   複查截止日：${formatDate(item.nextReviewDate)}\n\n`;
	});
	
	text += `\n提醒事項：\n`;
	text += `- 請盡快登入AQD Risk Review系統執行複查\n`;
	text += `- 完成複查後，請更新豪神FIMS「Last Review」和「Next Review」\n`;
	text += `- 如有任何問題，請聯繫豪神\n\n`;
	
	text += `此郵件由豪神FIMS-SMS系統自動發送，請勿直接回覆此郵件。\n`;
	
	return text;
}

// Helper: Get CSS class for review type
function getReviewTypeClass(reviewType: string): string {
	switch (reviewType) {
		case 'Risk':
			return 'risk';
		case 'Barrier':
			return 'barrier';
		case 'Risk+Barrier':
			return 'combined';
		default:
			return '';
	}
}

// Helper: Format date
function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('zh-TW', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}
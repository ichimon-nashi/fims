// src/app/api/cron/rr-notification-utils.ts
// Utility functions for RR review notification system
// Location: Copy to src/app/api/cron/rr-notification-utils.ts

import { createClient } from "@supabase/supabase-js";

// Create service role client (bypasses RLS)
function getServiceClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
	const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
	
	return createClient(supabaseUrl, supabaseServiceKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
}

interface RREntry {
	id: string;
	rr_number: string;
	risk_id?: string;
	barrier_id?: string;
	risk_last_review?: string;
	risk_next_review?: string;
	barrier_last_review?: string;
	barrier_next_review?: string;
	risk_id_barrier?: string;
	is_deprecated: boolean;
	srm_table_link?: {
		number: string;
		hazard_description: string;
	};
}

export interface DueItem {
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

// HARDCODED EMAIL RECIPIENTS - Edit this array to add/remove recipients
const EMAIL_RECIPIENTS = ['ichimon.nashi@gmail.com'];

// Get Taiwan date (UTC+8)
function getTaiwanDate(): Date {
	const now = new Date();
	const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
	return taiwanTime;
}

// Calculate days until review
function getDaysUntilReview(dateString: string): number {
	const today = getTaiwanDate();
	today.setHours(0, 0, 0, 0); // Reset to midnight
	
	const reviewDate = new Date(dateString);
	reviewDate.setHours(0, 0, 0, 0);
	
	const diffTime = reviewDate.getTime() - today.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
}

// Extract Risk IDs from combined field
function extractRiskId(riskIdBarrier?: string): string {
	if (!riskIdBarrier) return '';
	return riskIdBarrier
		.split(/[,;/\n]/)
		.map((s) => s.trim())
		.filter((s) => s.startsWith('R'))
		.join(', ');
}

// Extract Barrier IDs from combined field
function extractBarrierId(riskIdBarrier?: string): string {
	if (!riskIdBarrier) return '';
	return riskIdBarrier
		.split(/[,;/\n]/)
		.map((s) => s.trim())
		.filter((s) => s.toUpperCase().startsWith('B'))
		.join(', ');
}

// Get hardcoded email recipients
export async function getEmailRecipients(): Promise<string[]> {
	return EMAIL_RECIPIENTS;
}

// Main function to find items due for review TODAY
export async function findDueReviews(): Promise<DueItem[]> {
	console.log('\n=== Finding RR Reviews Due Today ===');
	const taiwanDate = getTaiwanDate();
	console.log('Taiwan date:', taiwanDate.toISOString().split('T')[0]);
	
	const supabase = getServiceClient();
	const dueItems: DueItem[] = [];
	
	// Fetch all NON-DEPRECATED RR entries with their linked hazard info
	const { data: entries, error } = await supabase
		.from('rr_sms_entries')
		.select(`
			id,
			rr_number,
			risk_id,
			barrier_id,
			risk_last_review,
			risk_next_review,
			barrier_last_review,
			barrier_next_review,
			risk_id_barrier,
			is_deprecated,
			srm_table_link:srm_table_link_id (
				number,
				hazard_description
			)
		`)
		.eq('is_deprecated', false) // ← KEY: Only get non-deprecated items
		.order('rr_number');
	
	if (error) {
		console.error('Error fetching RR entries:', error);
		throw error;
	}
	
	console.log(`Found ${entries?.length || 0} active (non-deprecated) RR entries`);
	
	if (!entries || entries.length === 0) {
		return dueItems;
	}
	
	// Process each entry
	for (const entry of entries as any[]) {
		const hasRisk = !!(entry.risk_id || entry.risk_next_review);
		const hasBarrier = !!(entry.barrier_id || entry.barrier_next_review);
		
		// Check if Risk and Barrier have matching dates
		const sameNextReview = 
			entry.risk_next_review === entry.barrier_next_review &&
			entry.risk_next_review;
		
		// Combined review (Risk + Barrier with same date)
		if (hasRisk && hasBarrier && sameNextReview) {
			const daysRemaining = getDaysUntilReview(entry.risk_next_review);
			
			// Only add if due TODAY (0 days remaining)
			if (daysRemaining === 0) {
				const riskId = entry.risk_id || extractRiskId(entry.risk_id_barrier);
				const barrierId = entry.barrier_id || extractBarrierId(entry.risk_id_barrier);
				
				dueItems.push({
					entryId: entry.id,
					rrNumber: entry.rr_number,
					reviewType: 'Risk+Barrier',
					riskId,
					barrierId,
					nextReviewDate: entry.risk_next_review,
					daysRemaining,
					hazardNumber: entry.srm_table_link?.number,
					hazardDescription: entry.srm_table_link?.hazard_description
				});
				
				console.log(`✓ Due TODAY: ${entry.rr_number} - Risk+Barrier (${riskId}, ${barrierId})`);
			}
		} else {
			// Separate Risk review
			if (hasRisk && entry.risk_next_review) {
				const daysRemaining = getDaysUntilReview(entry.risk_next_review);
				
				// Only add if due TODAY (0 days remaining)
				if (daysRemaining === 0) {
					const riskId = entry.risk_id || extractRiskId(entry.risk_id_barrier);
					
					dueItems.push({
						entryId: entry.id,
						rrNumber: entry.rr_number,
						reviewType: 'Risk',
						riskId,
						nextReviewDate: entry.risk_next_review,
						daysRemaining,
						hazardNumber: entry.srm_table_link?.number,
						hazardDescription: entry.srm_table_link?.hazard_description
					});
					
					console.log(`✓ Due TODAY: ${entry.rr_number} - Risk (${riskId})`);
				}
			}
			
			// Separate Barrier review
			if (hasBarrier && entry.barrier_next_review) {
				const daysRemaining = getDaysUntilReview(entry.barrier_next_review);
				
				// Only add if due TODAY (0 days remaining)
				if (daysRemaining === 0) {
					const riskId = entry.risk_id || extractRiskId(entry.risk_id_barrier);
					const barrierId = entry.barrier_id || extractBarrierId(entry.risk_id_barrier);
					
					dueItems.push({
						entryId: entry.id,
						rrNumber: entry.rr_number,
						reviewType: 'Barrier',
						riskId,
						barrierId,
						nextReviewDate: entry.barrier_next_review,
						daysRemaining,
						hazardNumber: entry.srm_table_link?.number,
						hazardDescription: entry.srm_table_link?.hazard_description
					});
					
					console.log(`✓ Due TODAY: ${entry.rr_number} - Barrier (${barrierId})`);
				}
			}
		}
	}
	
	console.log(`\nTotal items due for review TODAY: ${dueItems.length}`);
	return dueItems;
}
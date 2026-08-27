// Database Schema definitions matching ARCHITECTURE.md §2 exactly

export interface User {
  id: string;
  email: string;
  auth_info?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  raw_resume_text: string;
  parsed_skills: string[];
  parsed_domains: string[];
  parsed_project_summary: string;
  projects?: UserProjectItem[];
  embedding_vector?: number[];
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  url: string;
  github_repo_url: string | null;
  careers_page_url: string | null;
  last_scanned_at: string | null;
}

export interface EvidenceItem {
  id: string;
  company_id: string;
  source_type: 'reddit' | 'hacker_news' | 'github_issue' | 'x_post' | 'review' | 'job_posting';
  source_url: string;
  raw_text: string;
  author_handle: string | null;
  posted_at: string;
  fetched_at: string;
}

export interface GapCluster {
  id: string;
  company_id: string;
  label: string;
  embedding_vector?: number[];
  evidence_item_ids: string[];
  evidence_count: number;
  recency_score: number;
  rank_score: number;
}

export interface FixabilityFlags {
  id: string;
  gap_cluster_id: string;
  has_public_repo: boolean;
  has_public_api: boolean;
  has_ui_surface: boolean;
  is_buildable: boolean; // computed
}

export interface JobPosting {
  id: string;
  company_id: string;
  title: string;
  raw_text: string;
  posted_at: string;
  is_open: boolean;
}

export interface RoleMatch {
  id: string;
  gap_cluster_id: string;
  job_posting_id: string;
  match_score: number;
}

export interface Card {
  id: string;
  user_id: string;
  gap_cluster_id: string;
  profile_match_score: number;
  shown_at: string;
  status: 'new' | 'selected' | 'dismissed';
}

export interface Contact {
  id: string;
  company_id: string;
  name: string | null;
  title: string;
  source_url: string;
  contact_type: string;
}

export interface Notification {
  id: string;
  user_id: string;
  company_id: string;
  gap_cluster_id: string;
  channel: string;
  sent_at: string;
  reason: string;
}

// Frontend Composite Model for Opportunity Card display
export interface OpportunityCardView {
  card: Card;
  gap_cluster: GapCluster;
  company: Company;
  evidence_items: EvidenceItem[];
  fixability_flags: FixabilityFlags;
  role_match?: {
    job_posting: JobPosting;
    match_score: number;
  };
  why_matches_you: string; // Templated: "You listed {top_skill} — this gap involves {domain}."
}

export interface OnboardingData {
  role: string;
  years_experience: string;
  focus: string;
  tech_stack: string[];
  domains: string[];
  github_url: string;
  project_summary: string;
  target_investors: string[];
  company_values: string[];
  skills?: string[];
  experienceLevel?: string;
}

export interface BountyItem {
  id: string;
  source?: string;
  type?: string;
  title: string;
  description?: string;
  url?: string;
  deadline?: string;
  payout_amount?: string;
  payout_currency?: string;
  tags?: string[];
  location_pref?: string;
  verified?: boolean;
  last_confirmed?: string;
  source_trust?: number;
  fit_score?: number;
  fit_reason?: string;
  company_name?: string;
  company_url?: string;
  reward_amount?: string;
  tech_stack?: string[];
  est_hours?: number;
  platform_source?: string;
  source_url?: string;
  senior_build_plan?: string;
}

export interface ExtractedProject {
  name: string;
  description: string;
  stack: string[];
  status: 'built' | 'in_progress' | 'planned';
  is_production: boolean;
}

export interface ExtractedExperience {
  company: string;
  role: string;
  duration: string;
  highlights: string[];
}

export interface ParsedResumePreview {
  name?: string;
  skills: string[];
  domains: string[];
  projects: ExtractedProject[];
  experience: ExtractedExperience[];
}

export interface UserSkillItem {
  skill: string;
  source?: 'resume' | 'stated';
  confidence?: number;
}

export interface UserProjectItem {
  name: string;
  description?: string;
  stack: string[];
  status: 'built' | 'in_progress' | 'planned';
  is_production: boolean;
}

export interface UserPreferencesPayload {
  target_roles: string[];
  company_stage: string[];
  industries: string[];
  location_pref: string[];
  comp_floor?: string;
}

export interface FullOnboardingPayload {
  user_id: string;
  email?: string;
  name?: string;
  location?: string;
  years_experience?: string;
  current_role?: string;
  skills: UserSkillItem[];
  projects: UserProjectItem[];
  preferences: UserPreferencesPayload;
}


// ==========================================
// PM Accelerator Types
// ==========================================

export type BlockType = 'learn' | 'voice' | 'practice' | 'build' | 'apply' | 'network';

export const BLOCK_ORDER: BlockType[] = ['learn', 'voice', 'practice', 'build', 'apply', 'network'];

export interface QuizQuestion {
  question: string;
  rubric_hint: string;
  rubric_keywords: string[];
}

export interface LearnContent {
  concept: string;
  body: string;
  resource_url: string;
  resource_label: string;
  quiz: QuizQuestion[];
}

export interface VoiceContent {
  prompt: string;
  tool_url: string;
  duration_min: number;
}

export interface PracticeQuestion {
  type: 'product_sense' | 'estimation' | 'behavioral' | 'analytical' | 'strategy' | 'technical';
  question: string;
  time_limit_min: number;
  rubric_must_have: string[];
  rubric_good_to_have: string[];
}

export interface BuildTask {
  task: string;
  output_type: 'text' | 'url' | 'text_and_url';
  min_chars: number;
  duration_min: number;
}

export interface NetworkActionSpec {
  index: number;
  type: 'comment' | 'dm_existing' | 'new_connect' | 'post' | 'engage_founder';
  instruction: string;
}

export interface DailyBriefResponse {
  day_number: number;
  phase: string;
  phase_label: string;
  title: string;
  mentor_message: string;
  is_boss_day: boolean;
  blocks_required: BlockType[];
  blocks_done: BlockType[];
  blocks_unlocked: BlockType[];
  started_today: boolean;
  eod_submitted: boolean;
  progress_row_id: string;
  learn: LearnContent;
  voice: VoiceContent;
  practice: PracticeQuestion[];
  build: BuildTask;
  network: { actions: NetworkActionSpec[] };
}

export interface BlockStartRequest {
  user_id: string;
  day_number: number;
  block_type: BlockType;
}

export interface BlockStartResponse {
  block_log_id: string;
  started_at: string;
  time_limit_sec: number;
}

export interface BlockCompleteRequest {
  user_id: string;
  block_log_id: string;
  day_number: number;
  block_type: BlockType;
  answer_text?: string;
  self_score?: number;
  network_actions_completed?: number[];
  companies_logged?: string[];
  voice_completed?: boolean;
}

export interface BlockCompleteResponse {
  success: boolean;
  rubric_feedback: string;
  next_block_unlocked: BlockType | null;
  all_blocks_done: boolean;
}

export interface StreakResponse {
  current_streak: number;
  longest_streak: number;
  total_days_completed: number;
  last_completed_date: string | null;
  milestones_unlocked: number[];
  recovery_required: boolean;
}

export interface PMCompanyFeedItem {
  id: string;
  company_name: string;
  company_url: string;
  role_title: string;
  apply_url: string | null;
  feed_type: 'active_listing' | 'cold_target' | 'community_lead' | 'stretch';
  source: string;
  vc_backed: boolean;
  vc_name: string | null;
  india_remote: 'india' | 'remote' | 'hybrid';
}

export interface CompanyFeedResponse {
  date: string;
  companies: PMCompanyFeedItem[];
}

export interface EODSubmitRequest {
  user_id: string;
  day_number: number;
  hardest_block: BlockType | null;
  skipped_blocks: BlockType[];
  reflection: string;
}

export interface EODSubmitResponse {
  streak_updated: number;
  streak_broke: boolean;
  recovery_required: boolean;
  tomorrow_preview: {
    day_number: number;
    title: string;
    mentor_message_teaser: string;
  } | null;
}

export interface ProgressDay {
  day_number: number;
  phase: string;
  phase_label: string;
  title: string;
  status: 'done' | 'today' | 'locked' | 'missed';
  blocks_done_count: number;
  completed_at: string | null;
}

export interface ProgressMapResponse {
  total_days: number;
  days: ProgressDay[];
}





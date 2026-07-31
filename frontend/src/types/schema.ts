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
  title: string;
  company_name: string;
  company_url: string;
  reward_amount: string;
  type: 'bounty' | 'hackathon' | 'trial';
  tech_stack: string[];
  est_hours: number;
  platform_source: string;
  source_url: string;
  description: string;
  senior_build_plan: string;
}


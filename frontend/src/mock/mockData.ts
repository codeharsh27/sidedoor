import type {
  User,
  UserProfile,
  Company,
  EvidenceItem,
  GapCluster,
  FixabilityFlags,
  JobPosting,
  OpportunityCardView
} from '../types/schema';

// 1. Mock User & Profile
export const mockUser: User = {
  id: 'usr_aditya_01',
  email: 'aditya.dev@stanford.edu',
  auth_info: 'github_oauth',
  created_at: '2026-07-20T10:00:00Z',
};

export const mockUserProfile: UserProfile = {
  id: 'prof_aditya_01',
  user_id: 'usr_aditya_01',
  raw_resume_text: 'Aditya Sharma - Full Stack Developer. Skills: React, TypeScript, Node.js, Next.js, PostgreSQL, REST APIs, Tailwind CSS, Python. Built custom analytics dashboard and open-source GitHub webhook handler.',
  parsed_skills: ['React', 'TypeScript', 'Node.js', 'Next.js', 'PostgreSQL', 'REST APIs', 'Python', 'Webhooks'],
  parsed_domains: ['Developer Tools', 'Frontend Infrastructure', 'Data Visualization', 'API Integration'],
  parsed_project_summary: '2 full-stack web applications with React/Next.js and PostgreSQL, plus 1 open-source CLI utility for webhook inspection.',
  updated_at: '2026-07-25T14:22:00Z',
};

// 2. Mock Companies
export const mockCompanies: Company[] = [
  { id: 'comp_posthog', name: 'PostHog', url: 'https://posthog.com', github_repo_url: 'https://github.com/PostHog/posthog', careers_page_url: 'https://posthog.com/careers', last_scanned_at: '2026-07-25T23:15:00Z' },
  { id: 'comp_stripe', name: 'Stripe', url: 'https://stripe.com', github_repo_url: 'https://github.com/stripe/stripe-node', careers_page_url: 'https://stripe.com/jobs', last_scanned_at: '2026-07-25T21:40:00Z' },
  { id: 'comp_linear', name: 'Linear', url: 'https://linear.app', github_repo_url: null, careers_page_url: 'https://linear.app/careers', last_scanned_at: '2026-07-25T18:00:00Z' },
  { id: 'comp_vercel', name: 'Vercel', url: 'https://vercel.com', github_repo_url: 'https://github.com/vercel/vercel', careers_page_url: 'https://vercel.com/careers', last_scanned_at: '2026-07-25T19:30:00Z' }
];

// 3. Mock Evidence Items
export const mockEvidenceItems: EvidenceItem[] = [
  // PostHog
  { id: 'ev_ph_01', company_id: 'comp_posthog', source_type: 'github_issue', source_url: 'https://github.com/PostHog/posthog/issues/18420', raw_text: 'Feature Request: Add custom Webhook debugging inspector in project settings.', author_handle: 'alex', posted_at: '2026-07-10T08:30:00Z', fetched_at: '2026-07-25T23:15:00Z' },
  { id: 'ev_ph_02', company_id: 'comp_posthog', source_type: 'github_issue', source_url: 'https://github.com/PostHog/posthog/issues/19102', raw_text: 'UI Bug: Session replay timeline scrubber lags on high mutations.', author_handle: 'ninja', posted_at: '2026-07-22T11:20:00Z', fetched_at: '2026-07-25T23:15:00Z' },
  // Stripe
  { id: 'ev_st_01', company_id: 'comp_stripe', source_type: 'reddit', source_url: 'https://reddit.com/r/stripe/comments/123/', raw_text: 'Wish the Stripe CLI had a visual dashboard for local webhook testing.', author_handle: 'dev', posted_at: '2026-07-10T08:30:00Z', fetched_at: '2026-07-25T23:15:00Z' },
  { id: 'ev_st_02', company_id: 'comp_stripe', source_type: 'job_posting', source_url: 'https://stripe.com/jobs', raw_text: 'Looking for engineers to improve our internal invoicing simulation tools.', author_handle: 'stripe', posted_at: '2026-07-22T11:20:00Z', fetched_at: '2026-07-25T23:15:00Z' },
  // Linear
  { id: 'ev_ln_01', company_id: 'comp_linear', source_type: 'reddit', source_url: 'https://reddit.com/r/linear/123/', raw_text: 'We need a 1-click sprint velocity custom CSV exporter widget.', author_handle: 'ops', posted_at: '2026-07-15T12:00:00Z', fetched_at: '2026-07-25T18:00:00Z' },
  { id: 'ev_ln_02', company_id: 'comp_linear', source_type: 'github_issue', source_url: 'https://github.com/linear/issue/123', raw_text: 'Dark mode contrast issues in the custom filter dropdowns.', author_handle: 'designer', posted_at: '2026-07-15T12:00:00Z', fetched_at: '2026-07-25T18:00:00Z' },
  // Vercel
  { id: 'ev_vc_01', company_id: 'comp_vercel', source_type: 'github_issue', source_url: 'https://github.com/vercel/next.js/issues/123', raw_text: 'Vercel dashboard deployment logs lack a visual timeline view.', author_handle: 'dev', posted_at: '2026-07-15T12:00:00Z', fetched_at: '2026-07-25T18:00:00Z' },
  { id: 'ev_vc_02', company_id: 'comp_vercel', source_type: 'reddit', source_url: 'https://reddit.com/r/nextjs/123/', raw_text: 'Preview deployments could really use an integrated lighthouse score badge.', author_handle: 'perf', posted_at: '2026-07-15T12:00:00Z', fetched_at: '2026-07-25T18:00:00Z' },
];

// 4. Mock Gap Clusters
export const mockGapClusters: GapCluster[] = [
  // PostHog
  { id: 'gap_ph_webhooks', company_id: 'comp_posthog', label: 'Missing Live Webhook Replay & Inspector UI in Project Settings', evidence_item_ids: ['ev_ph_01'], evidence_count: 1, recency_score: 0.95, rank_score: 94.5 },
  { id: 'gap_ph_session_replay', company_id: 'comp_posthog', label: 'Session Replay Timeline Scrubber Lag with High DOM Mutations', evidence_item_ids: ['ev_ph_02'], evidence_count: 1, recency_score: 0.98, rank_score: 82.0 },
  // Stripe
  { id: 'gap_st_cli_ui', company_id: 'comp_stripe', label: 'Visual Dashboard for Local Webhook Testing in Stripe CLI', evidence_item_ids: ['ev_st_01'], evidence_count: 1, recency_score: 0.9, rank_score: 89.0 },
  { id: 'gap_st_invoice_sim', company_id: 'comp_stripe', label: 'Internal Invoicing Simulation Tooling', evidence_item_ids: ['ev_st_02'], evidence_count: 1, recency_score: 0.85, rank_score: 75.0 },
  // Linear
  { id: 'gap_ln_export', company_id: 'comp_linear', label: '1-Click Sprint Velocity Custom CSV Exporter Widget', evidence_item_ids: ['ev_ln_01'], evidence_count: 1, recency_score: 0.88, rank_score: 78.5 },
  { id: 'gap_ln_contrast', company_id: 'comp_linear', label: 'Dark Mode Contrast in Custom Filter Dropdowns', evidence_item_ids: ['ev_ln_02'], evidence_count: 1, recency_score: 0.95, rank_score: 81.0 },
  // Vercel
  { id: 'gap_vc_logs', company_id: 'comp_vercel', label: 'Visual Timeline View for Deployment Logs', evidence_item_ids: ['ev_vc_01'], evidence_count: 1, recency_score: 0.92, rank_score: 85.0 },
  { id: 'gap_vc_lighthouse', company_id: 'comp_vercel', label: 'Integrated Lighthouse Score Badge for Preview Deployments', evidence_item_ids: ['ev_vc_02'], evidence_count: 1, recency_score: 0.89, rank_score: 90.0 }
];

// 5. Mock Fixability Flags
export const mockFixabilityFlags: Record<string, FixabilityFlags> = {
  'gap_ph_webhooks': { id: 'fix_ph_01', gap_cluster_id: 'gap_ph_webhooks', has_public_repo: true, has_public_api: true, has_ui_surface: true, is_buildable: true },
  'gap_ph_session_replay': { id: 'fix_ph_02', gap_cluster_id: 'gap_ph_session_replay', has_public_repo: true, has_public_api: false, has_ui_surface: true, is_buildable: true },
  'gap_st_cli_ui': { id: 'fix_st_01', gap_cluster_id: 'gap_st_cli_ui', has_public_repo: true, has_public_api: true, has_ui_surface: true, is_buildable: true },
  'gap_st_invoice_sim': { id: 'fix_st_02', gap_cluster_id: 'gap_st_invoice_sim', has_public_repo: false, has_public_api: true, has_ui_surface: false, is_buildable: true },
  'gap_ln_export': { id: 'fix_ln_01', gap_cluster_id: 'gap_ln_export', has_public_repo: false, has_public_api: true, has_ui_surface: false, is_buildable: true },
  'gap_ln_contrast': { id: 'fix_ln_02', gap_cluster_id: 'gap_ln_contrast', has_public_repo: false, has_public_api: false, has_ui_surface: true, is_buildable: true },
  'gap_vc_logs': { id: 'fix_vc_01', gap_cluster_id: 'gap_vc_logs', has_public_repo: false, has_public_api: true, has_ui_surface: true, is_buildable: true },
  'gap_vc_lighthouse': { id: 'fix_vc_02', gap_cluster_id: 'gap_vc_lighthouse', has_public_repo: false, has_public_api: true, has_ui_surface: true, is_buildable: true }
};

// 6. Mock Job Postings
export const mockJobPostings: JobPosting[] = [
  { id: 'job_ph_01', company_id: 'comp_posthog', title: 'Full Stack Engineer', raw_text: 'We are looking for a Full Stack Engineer.', posted_at: '2026-07-15T00:00:00Z', is_open: true },
  { id: 'job_st_01', company_id: 'comp_stripe', title: 'Developer Tools Engineer', raw_text: 'Join our CLI team.', posted_at: '2026-07-15T00:00:00Z', is_open: true },
  { id: 'job_ln_01', company_id: 'comp_linear', title: 'Product Engineer', raw_text: 'Build features.', posted_at: '2026-07-15T00:00:00Z', is_open: true },
  { id: 'job_vc_01', company_id: 'comp_vercel', title: 'Frontend Infrastructure Engineer', raw_text: 'Improve dashboard.', posted_at: '2026-07-15T00:00:00Z', is_open: true },
];

// 7. Mock Cards
export const mockOpportunityCards: OpportunityCardView[] = [
  // PostHog
  {
    card: { id: 'card_ph_01', user_id: 'usr_aditya_01', gap_cluster_id: 'gap_ph_webhooks', profile_match_score: 96, shown_at: '2026-07-26T01:00:00Z', status: 'new' },
    gap_cluster: mockGapClusters[0], company: mockCompanies[0], evidence_items: [mockEvidenceItems[0]], fixability_flags: mockFixabilityFlags['gap_ph_webhooks'],
    role_match: { job_posting: mockJobPostings[0], match_score: 94 }, why_matches_you: 'You listed React & TypeScript — this gap involves building a frontend Inspector UI for webhooks.'
  },
  {
    card: { id: 'card_ph_02', user_id: 'usr_aditya_01', gap_cluster_id: 'gap_ph_session_replay', profile_match_score: 88, shown_at: '2026-07-26T01:00:00Z', status: 'new' },
    gap_cluster: mockGapClusters[1], company: mockCompanies[0], evidence_items: [mockEvidenceItems[1]], fixability_flags: mockFixabilityFlags['gap_ph_session_replay'],
    role_match: { job_posting: mockJobPostings[0], match_score: 82 }, why_matches_you: 'Your performance optimization experience makes you a great fit to fix this React scrubber lag.'
  },
  // Stripe
  {
    card: { id: 'card_st_01', user_id: 'usr_aditya_01', gap_cluster_id: 'gap_st_cli_ui', profile_match_score: 92, shown_at: '2026-07-26T01:00:00Z', status: 'new' },
    gap_cluster: mockGapClusters[2], company: mockCompanies[1], evidence_items: [mockEvidenceItems[2]], fixability_flags: mockFixabilityFlags['gap_st_cli_ui'],
    role_match: { job_posting: mockJobPostings[1], match_score: 90 }, why_matches_you: 'You have experience with Webhooks and Node.js. Building a local UI for Stripe CLI is right up your alley.'
  },
  {
    card: { id: 'card_st_02', user_id: 'usr_aditya_01', gap_cluster_id: 'gap_st_invoice_sim', profile_match_score: 81, shown_at: '2026-07-26T01:00:00Z', status: 'new' },
    gap_cluster: mockGapClusters[3], company: mockCompanies[1], evidence_items: [mockEvidenceItems[3]], fixability_flags: mockFixabilityFlags['gap_st_invoice_sim'],
    role_match: { job_posting: mockJobPostings[1], match_score: 78 }, why_matches_you: 'You listed PostgreSQL and Data Visualization, highly relevant for simulation tooling.'
  },
  // Linear
  {
    card: { id: 'card_ln_01', user_id: 'usr_aditya_01', gap_cluster_id: 'gap_ln_export', profile_match_score: 84, shown_at: '2026-07-26T01:00:00Z', status: 'new' },
    gap_cluster: mockGapClusters[4], company: mockCompanies[2], evidence_items: [mockEvidenceItems[4]], fixability_flags: mockFixabilityFlags['gap_ln_export'],
    role_match: { job_posting: mockJobPostings[2], match_score: 80 }, why_matches_you: 'You listed REST APIs & Python — this gap involves leveraging Linear APIs to export metrics.'
  },
  {
    card: { id: 'card_ln_02', user_id: 'usr_aditya_01', gap_cluster_id: 'gap_ln_contrast', profile_match_score: 76, shown_at: '2026-07-26T01:00:00Z', status: 'new' },
    gap_cluster: mockGapClusters[5], company: mockCompanies[2], evidence_items: [mockEvidenceItems[5]], fixability_flags: mockFixabilityFlags['gap_ln_contrast'],
    role_match: { job_posting: mockJobPostings[2], match_score: 72 }, why_matches_you: 'Your Tailwind CSS and Frontend Infrastructure skills fit this design polish task perfectly.'
  },
  // Vercel
  {
    card: { id: 'card_vc_01', user_id: 'usr_aditya_01', gap_cluster_id: 'gap_vc_logs', profile_match_score: 95, shown_at: '2026-07-26T01:00:00Z', status: 'new' },
    gap_cluster: mockGapClusters[6], company: mockCompanies[3], evidence_items: [mockEvidenceItems[6]], fixability_flags: mockFixabilityFlags['gap_vc_logs'],
    role_match: { job_posting: mockJobPostings[3], match_score: 91 }, why_matches_you: 'Your Data Visualization and Next.js experience is ideal for building a log timeline view.'
  },
  {
    card: { id: 'card_vc_02', user_id: 'usr_aditya_01', gap_cluster_id: 'gap_vc_lighthouse', profile_match_score: 89, shown_at: '2026-07-26T01:00:00Z', status: 'new' },
    gap_cluster: mockGapClusters[7], company: mockCompanies[3], evidence_items: [mockEvidenceItems[7]], fixability_flags: mockFixabilityFlags['gap_vc_lighthouse'],
    role_match: { job_posting: mockJobPostings[3], match_score: 88 }, why_matches_you: 'You have deep React & Next.js skills, perfect for integrating third-party performance metrics.'
  }
];

export const MOCK_CARDS = mockOpportunityCards;

import type {
  User,
  UserProfile,
  Company,
  EvidenceItem,
  GapCluster,
  FixabilityFlags,
  JobPosting,
  Contact,
  OpportunityCardView
} from '../types/schema';

// 1. Mock User & Profile (Aditya, CS student / early-career dev)
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
  {
    id: 'comp_posthog',
    name: 'PostHog',
    url: 'https://posthog.com',
    github_repo_url: 'https://github.com/PostHog/posthog',
    careers_page_url: 'https://posthog.com/careers',
    last_scanned_at: '2026-07-25T23:15:00Z',
  },
  {
    id: 'comp_supabase',
    name: 'Supabase',
    url: 'https://supabase.com',
    github_repo_url: 'https://github.com/supabase/supabase',
    careers_page_url: 'https://supabase.com/careers',
    last_scanned_at: '2026-07-25T21:40:00Z',
  },
  {
    id: 'comp_linear',
    name: 'Linear',
    url: 'https://linear.app',
    github_repo_url: null,
    careers_page_url: 'https://linear.app/careers',
    last_scanned_at: '2026-07-25T18:00:00Z',
  }
];

// 3. Mock Evidence Items (Real clickable sources!)
export const mockEvidenceItems: EvidenceItem[] = [
  // PostHog evidence
  {
    id: 'ev_ph_01',
    company_id: 'comp_posthog',
    source_type: 'github_issue',
    source_url: 'https://github.com/PostHog/posthog/issues/18420',
    raw_text: 'Feature Request: Add custom Webhook debugging inspector in project settings so developers can test failed payload deliveries without checking server logs manually.',
    author_handle: 'alex-dev-nyc',
    posted_at: '2026-07-10T08:30:00Z',
    fetched_at: '2026-07-25T23:15:00Z',
  },
  {
    id: 'ev_ph_02',
    company_id: 'comp_posthog',
    source_type: 'reddit',
    source_url: 'https://reddit.com/r/reactjs/comments/1e89x0p/anyone_else_struggling_with_posthog_webhook_retries/',
    raw_text: 'We love PostHog analytics, but testing custom action webhooks locally is a massive pain. Wish they had a simple UI toggle to replay failed event webhooks directly from the dashboard.',
    author_handle: 'saas_builder_99',
    posted_at: '2026-07-18T16:45:00Z',
    fetched_at: '2026-07-25T23:15:00Z',
  },
  {
    id: 'ev_ph_03',
    company_id: 'comp_posthog',
    source_type: 'github_issue',
    source_url: 'https://github.com/PostHog/posthog/issues/19102',
    raw_text: 'UI Bug: Session replay timeline scrubber lags noticeably when rendering over 50 custom DOM mutation markers in React 19 apps.',
    author_handle: 'frontend_ninja',
    posted_at: '2026-07-22T11:20:00Z',
    fetched_at: '2026-07-25T23:15:00Z',
  },
  
  // Supabase evidence
  {
    id: 'ev_sb_01',
    company_id: 'comp_supabase',
    source_type: 'github_issue',
    source_url: 'https://github.com/supabase/supabase/issues/21050',
    raw_text: 'Studio UI Request: Provide a quick SQL query performance analyzer tag directly in the Table Editor view so users know when an index is missing without switching to pg_stat_statements.',
    author_handle: 'pg_master',
    posted_at: '2026-07-14T09:15:00Z',
    fetched_at: '2026-07-25T21:40:00Z',
  },
  {
    id: 'ev_sb_02',
    company_id: 'comp_supabase',
    source_type: 'reddit',
    source_url: 'https://reddit.com/r/Supabase/comments/1ea22k1/table_editor_needs_index_hints/',
    raw_text: 'Supabase Studio is gorgeous, but junior devs on my team keep querying unindexed columns in production and freezing our database. Would kill for a visual "Missing Index" warning badge in Studio.',
    author_handle: 'techlead_sam',
    posted_at: '2026-07-19T14:10:00Z',
    fetched_at: '2026-07-25T21:40:00Z',
  },

  // Linear evidence
  {
    id: 'ev_ln_01',
    company_id: 'comp_linear',
    source_type: 'reddit',
    source_url: 'https://reddit.com/r/webdev/comments/1e77qqp/linear_api_custom_export/',
    raw_text: 'Linear is fast, but exporting sprint velocity data into custom CSV format for external agency clients requires writing custom Python scripts every Monday. Wish there was a lightweight browser extension or widget for instant custom export.',
    author_handle: 'agency_ops',
    posted_at: '2026-07-15T12:00:00Z',
    fetched_at: '2026-07-25T18:00:00Z',
  }
];

// 4. Mock Gap Clusters
export const mockGapClusters: GapCluster[] = [
  {
    id: 'gap_ph_webhooks',
    company_id: 'comp_posthog',
    label: 'Missing Live Webhook Replay & Inspector UI in Project Settings',
    evidence_item_ids: ['ev_ph_01', 'ev_ph_02'],
    evidence_count: 2,
    recency_score: 0.95,
    rank_score: 94.5,
  },
  {
    id: 'gap_ph_session_replay',
    company_id: 'comp_posthog',
    label: 'Session Replay Timeline Scrubber Lag with High DOM Mutations',
    evidence_item_ids: ['ev_ph_03'],
    evidence_count: 1,
    recency_score: 0.98,
    rank_score: 82.0,
  },
  {
    id: 'gap_sb_index_hint',
    company_id: 'comp_supabase',
    label: 'Visual "Missing Index" Warning Badge in Table Editor Studio',
    evidence_item_ids: ['ev_sb_01', 'ev_sb_02'],
    evidence_count: 2,
    recency_score: 0.92,
    rank_score: 91.0,
  },
  {
    id: 'gap_ln_export',
    company_id: 'comp_linear',
    label: '1-Click Sprint Velocity Custom CSV Exporter Widget',
    evidence_item_ids: ['ev_ln_01'],
    evidence_count: 1,
    recency_score: 0.88,
    rank_score: 78.5,
  }
];

// 5. Mock Fixability Flags
export const mockFixabilityFlags: Record<string, FixabilityFlags> = {
  'gap_ph_webhooks': {
    id: 'fix_ph_01',
    gap_cluster_id: 'gap_ph_webhooks',
    has_public_repo: true,
    has_public_api: true,
    has_ui_surface: true,
    is_buildable: true,
  },
  'gap_ph_session_replay': {
    id: 'fix_ph_02',
    gap_cluster_id: 'gap_ph_session_replay',
    has_public_repo: true,
    has_public_api: false,
    has_ui_surface: true,
    is_buildable: true,
  },
  'gap_sb_index_hint': {
    id: 'fix_sb_01',
    gap_cluster_id: 'gap_sb_index_hint',
    has_public_repo: true,
    has_public_api: true,
    has_ui_surface: true,
    is_buildable: true,
  },
  'gap_ln_export': {
    id: 'fix_ln_01',
    gap_cluster_id: 'gap_ln_export',
    has_public_repo: false,
    has_public_api: true,
    has_ui_surface: false,
    is_buildable: true,
  }
};

// 6. Mock Job Postings
export const mockJobPostings: JobPosting[] = [
  {
    id: 'job_ph_01',
    company_id: 'comp_posthog',
    title: 'Full Stack Engineer - Core Experience & Developer Tools',
    raw_text: 'We are looking for a Full Stack Engineer to build out developer workflows, API integrations, and webhook reliability in PostHog. Experience with React, TypeScript, and Python/Django required.',
    posted_at: '2026-07-15T00:00:00Z',
    is_open: true,
  },
  {
    id: 'job_sb_01',
    company_id: 'comp_supabase',
    title: 'Frontend Engineer - Supabase Studio & Dashboard',
    raw_text: 'Join our Studio team to build intuitive database management tools, query analyzers, and developer UI using Next.js, React, and TypeScript.',
    posted_at: '2026-07-10T00:00:00Z',
    is_open: true,
  }
];

// 7. Mock Cards & Composite Views
export const mockOpportunityCards: OpportunityCardView[] = [
  {
    card: {
      id: 'card_ph_01',
      user_id: 'usr_aditya_01',
      gap_cluster_id: 'gap_ph_webhooks',
      profile_match_score: 96,
      shown_at: '2026-07-26T01:00:00Z',
      status: 'new',
    },
    gap_cluster: mockGapClusters[0],
    company: mockCompanies[0],
    evidence_items: [mockEvidenceItems[0], mockEvidenceItems[1]],
    fixability_flags: mockFixabilityFlags['gap_ph_webhooks'],
    role_match: {
      job_posting: mockJobPostings[0],
      match_score: 94,
    },
    why_matches_you: 'You listed React, TypeScript, & Webhooks — this gap involves building a frontend Inspector UI for failed webhook event delivery.',
  },
  {
    card: {
      id: 'card_sb_01',
      user_id: 'usr_aditya_01',
      gap_cluster_id: 'gap_sb_index_hint',
      profile_match_score: 92,
      shown_at: '2026-07-26T01:05:00Z',
      status: 'new',
    },
    gap_cluster: mockGapClusters[2],
    company: mockCompanies[1],
    evidence_items: [mockEvidenceItems[3], mockEvidenceItems[4]],
    fixability_flags: mockFixabilityFlags['gap_sb_index_hint'],
    role_match: {
      job_posting: mockJobPostings[1],
      match_score: 89,
    },
    why_matches_you: 'You listed PostgreSQL, Next.js, & React — this gap requires building a visual UI badge in Studio to flag missing SQL indexes.',
  },
  {
    card: {
      id: 'card_ln_01',
      user_id: 'usr_aditya_01',
      gap_cluster_id: 'gap_ln_export',
      profile_match_score: 84,
      shown_at: '2026-07-26T01:10:00Z',
      status: 'new',
    },
    gap_cluster: mockGapClusters[3],
    company: mockCompanies[2],
    evidence_items: [mockEvidenceItems[5]],
    fixability_flags: mockFixabilityFlags['gap_ln_export'],
    why_matches_you: 'You listed REST APIs & Python — this gap involves leveraging Linear public GraphQL API to export sprint velocity metrics into CSV.',
  }
];

// 8. Mock Contacts (with generated LinkedIn search URLs - NO SCRAPING!)
export const mockContacts: Record<string, Contact[]> = {
  'comp_posthog': [
    {
      id: 'cnt_ph_01',
      company_id: 'comp_posthog',
      name: 'Tim Glaser',
      title: 'VP of Engineering / Co-founder',
      source_url: 'https://www.linkedin.com/search/results/people/?keywords=VP%20Engineering%20PostHog',
      contact_type: 'Engineering Leadership',
    },
    {
      id: 'cnt_ph_02',
      company_id: 'comp_posthog',
      name: null,
      title: 'Lead Developer Experience Engineer',
      source_url: 'https://www.linkedin.com/search/results/people/?keywords=Developer%20Experience%20Engineer%20PostHog',
      contact_type: 'Team Lead',
    }
  ],
  'comp_supabase': [
    {
      id: 'cnt_sb_01',
      company_id: 'comp_supabase',
      name: 'Paul Copplestone',
      title: 'Co-founder & CEO',
      source_url: 'https://www.linkedin.com/search/results/people/?keywords=Co-founder%20Supabase',
      contact_type: 'Executive',
    },
    {
      id: 'cnt_sb_02',
      company_id: 'comp_supabase',
      name: null,
      title: 'Frontend Lead - Studio',
      source_url: 'https://www.linkedin.com/search/results/people/?keywords=Frontend%20Lead%20Studio%20Supabase',
      contact_type: 'Hiring Manager',
    }
  ]
};

export const MOCK_CARDS = mockOpportunityCards;

export const GENERATED_SEARCH_URLS = [
  { title: 'Reddit Dev Discussions', url: 'https://reddit.com/r/reactjs' },
  { title: 'GitHub Issue Tracker Query', url: 'https://github.com/issues' },
  { title: 'Hacker News Architecture Search', url: 'https://hn.algolia.com' }
];


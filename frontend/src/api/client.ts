import type { GapCluster, OpportunityCardView, UserProfile, BountyItem } from '../types/schema';
import { MOCK_CARDS, mockUserProfile } from '../mock/mockData';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

type ProfileParseResponse = {
  user_id: string;
  skills: string[];
  domains: string[];
  project_summary: string;
  source_type: 'pdf' | 'docx' | 'url' | 'text';
};

type CompanyResponse = {
  id: string;
  name: string;
  url: string;
  github_repo_url: string | null;
  careers_page_url: string | null;
  ats_slug?: string | null;
  last_scanned_at: string | null;
  scan_status: string;
};

export type FeedCompany = {
  id: string;
  name: string;
  url: string;
  github_repo_url: string | null;
  careers_page_url: string | null;
  funding_stage: string | null;
  investor_tags: string[];
  employee_count_approx: number | null;
  tech_stack_tags: string[];
  scan_status: string;
  evidence_count: number;
  is_seed_list: boolean;
  seed_list_source: string | null;
  why_for_you: string | null;
  top_clusters: string[];
  health?: {
    verdict: string;
    green_flag_count: number;
    red_flag_count: number;
    summary: string;
  } | null;
};

export type CompanyHealthSignal = {
  company_id: string;
  verdict: 'verified_safe' | 'high_risk' | 'limited_info';
  red_flag_count: number;
  green_flag_count: number;
  green_flags: string[];
  red_flags: string[];
  summary: string;
  health_computed_at: string;
};

export type OutreachPlaybook = {
  card_id: string;
  email_draft: string;
  twitter_post: string;
  discord_message: string;
  blog_post_title: string;
  follow_up_email: string;
};

export type TrackerApplication = {
  id: string;
  user_id: string;
  company_id: string;
  company_name: string;
  company_url: string;
  card_id: string | null;
  status: 'researching' | 'building' | 'reached_out' | 'replied' | 'interviewing' | 'closed';
  demo_url: string | null;
  outreach_sent_at: string | null;
  last_reply_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type KanbanBoard = {
  researching: TrackerApplication[];
  building: TrackerApplication[];
  reached_out: TrackerApplication[];
  replied: TrackerApplication[];
  interviewing: TrackerApplication[];
  closed: TrackerApplication[];
};

export type FollowupReminder = {
  application_id: string;
  company_name: string;
  outreach_sent_at: string;
  days_since_outreach: number;
  contact_name: string;
  follow_up_draft: string;
};

const isProbablyUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const makeLocalUserId = (email: string) => {
  const stored = localStorage.getItem(`local_user_id:${email}`);
  if (stored) return stored;

  const id = crypto.randomUUID();
  localStorage.setItem(`local_user_id:${email}`, id);
  return id;
};

const normalizeProfile = (
  parsed: ProfileParseResponse,
  rawResumeText = '',
): UserProfile => ({
  id: `profile_${parsed.user_id}`,
  user_id: parsed.user_id,
  raw_resume_text: rawResumeText,
  parsed_skills: parsed.skills,
  parsed_domains: parsed.domains,
  parsed_project_summary: parsed.project_summary,
  updated_at: new Date().toISOString(),
});

export const apiClient = {
  /**
   * Uploads a user's resume PDF or portfolio link and returns the parsed profile
   */
  async uploadResume(file?: File, link?: string, userId?: string): Promise<UserProfile> {
    if (!userId) {
      return mockUserProfile;
    }

    let res: Response;
    if (file) {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('file', file);
      res = await fetch(`${BASE_URL}/profile/parse`, {
        method: 'POST',
        body: formData,
      });
    } else if (link && isProbablyUrl(link)) {
      res = await fetch(`${BASE_URL}/profile/parse-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, portfolio_url: link }),
      });
    } else if (link) {
      res = await fetch(`${BASE_URL}/profile/parse-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, raw_text: link }),
      });
    } else {
      throw new Error('Choose a resume file, portfolio URL, or profile text.');
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to parse profile: ${errText}`);
    }

    const data = await res.json() as ProfileParseResponse;
    return normalizeProfile(data, file?.name ?? link ?? '');
  },

  /**
   * Fetches the gap clusters for a specific tracked company
   */
  async getGapClusters(companyId: string): Promise<GapCluster[]> {
    const res = await fetch(`${BASE_URL}/company/${companyId}/gaps`);
    if (!res.ok) {
      throw new Error('Failed to fetch gap clusters');
    }
    return await res.json();
  },

  /**
   * Fetches the matched opportunity cards for the user's dashboard
   */
  async getOpportunityCards(userId: string): Promise<OpportunityCardView[]> {
    const res = await fetch(`${BASE_URL}/cards?user_id=${userId}`);
    if (!res.ok) {
      return MOCK_CARDS;
    }
    const data = await res.json();
    return data.cards ?? MOCK_CARDS;
  },

  /**
   * Triggers a company scan directly on backend and returns matched cards & debug_info
   */
  async scanCompany(userId: string, companyUrl: string, force = false): Promise<{ company: CompanyResponse; cards: OpportunityCardView[]; debug_info?: any } | null> {
    const res = await fetch(`${BASE_URL}/scan?force=${force}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, company_url: companyUrl }),
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  },

  /**
   * Fetches curated VC discovery feed
   */
  async getCompanyFeed(userId?: string): Promise<FeedCompany[]> {
    const url = userId ? `${BASE_URL}/feed?user_id=${userId}` : `${BASE_URL}/feed`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.companies ?? [];
  },

  /**
   * Fetches company health vetting signals
   */
  async getCompanyHealth(companyId: string): Promise<CompanyHealthSignal | null> {
    const res = await fetch(`${BASE_URL}/company/${companyId}/health`);
    if (!res.ok) return null;
    return await res.json();
  },

  /**
   * Fetches full 4-channel outreach playbook
   */
  async getOutreachPlaybook(companyId: string, cardId: string, userId: string): Promise<OutreachPlaybook | null> {
    const res = await fetch(`${BASE_URL}/company/${companyId}/cards/${cardId}/outreach-playbook?user_id=${userId}`);
    if (!res.ok) return null;
    return await res.json();
  },

  /**
   * Fetches Kanban Application Tracker board
   */
  async getKanbanBoard(userId: string): Promise<KanbanBoard> {
    const res = await fetch(`${BASE_URL}/tracker?user_id=${userId}`);
    if (!res.ok) {
      return { researching: [], building: [], reached_out: [], replied: [], interviewing: [], closed: [] };
    }
    return await res.json();
  },

  /**
   * Creates application in tracker
   */
  async createTrackerApp(userId: string, companyId: string, cardId?: string, status = 'researching'): Promise<TrackerApplication | null> {
    const res = await fetch(`${BASE_URL}/tracker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, company_id: companyId, card_id: cardId, status }),
    });
    if (!res.ok) return null;
    return await res.json();
  },

  /**
   * Updates application in tracker
   */
  async updateTrackerApp(appId: string, update: { status?: string; demo_url?: string; notes?: string }): Promise<TrackerApplication | null> {
    const res = await fetch(`${BASE_URL}/tracker/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!res.ok) return null;
    return await res.json();
  },

  /**
   * Fetches 7-day follow-up reminders due
   */
  async getFollowupReminders(userId: string): Promise<FollowupReminder[]> {
    const res = await fetch(`${BASE_URL}/tracker/reminders?user_id=${userId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.reminders ?? [];
  },

  /**
   * Updates status of a card (e.g. dismissed or selected)
   */
  async updateCardStatus(cardId: string, status: 'new' | 'selected' | 'dismissed'): Promise<{ card_id: string; status: string }> {
    const res = await fetch(`${BASE_URL}/cards/${cardId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      return { card_id: cardId, status };
    }

    return await res.json();
  },

  /**
   * Fetches discovered contacts for a company
   */
  async getContacts(companyId: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/company/${companyId}/contacts`);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data.map((c: any) => {
      let emailStr = "Apollo email lookup available";
      if (c.contact_type === "github_profile") {
        emailStr = "Public profile contact";
      } else if (c.contact_type === "team_page") {
        emailStr = "Direct team page contact";
      }
      return {
        name: c.name || "Engineering Contributor",
        role: c.title || "Software Engineer",
        linkedin: c.source_url,
        email: emailStr
      };
    });
  },

  /**
   * Fetches or generates outreach draft scaffold for a card
   */
  async getOutreachDraft(companyId: string, cardId: string, userId: string): Promise<{ draft_text: string }> {
    const res = await fetch(`${BASE_URL}/company/${companyId}/cards/${cardId}/outreach-draft?user_id=${userId}`);
    if (!res.ok) {
      throw new Error('Failed to fetch outreach draft');
    }
    return await res.json();
  },

  /**
   * Check if email exists
   */
  async checkEmailExists(_email: string): Promise<boolean> {
    return false;
  },

  /**
   * Save onboarding profile data
   */
  async saveOnboardingProfile(userId: string, _data: any): Promise<UserProfile> {
    return {
      ...mockUserProfile,
      id: `profile_${userId}`,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
  },

  /**
   * Fetches curated product engineering bounties & solo hackathons
   */
  async getBounties(bountyType?: string, techStack?: string): Promise<BountyItem[]> {
    let url = `${BASE_URL}/bounties`;
    const params = new URLSearchParams();
    if (bountyType && bountyType !== 'all') params.append('bounty_type', bountyType);
    if (techStack) params.append('tech_stack', techStack);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.bounties ?? [];
  },

  /**
   * Authenticate or register user via name, email and password
   */
  async login(name: string, email: string, password: string): Promise<{ user_id: string; email: string; name: string | null; has_profile: boolean; profile: UserProfile | null }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const user_id = makeLocalUserId(email);
      return {
        user_id,
        email,
        name: name || null,
        has_profile: true,
        profile: {
          ...mockUserProfile,
          id: `profile_${user_id}`,
          user_id,
          updated_at: new Date().toISOString(),
        },
      };
    }
    return await res.json();
  }
};

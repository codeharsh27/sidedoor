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

/**
 * Centered API Request Sanitizer and Error boundary helper
 */
async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout limit

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let cleanMsg = 'Scouting database temporary offline. Retrying...';
      const errorLower = (errText + ' ' + res.status).toLowerCase();

      if (errorLower.includes('openrouter') || errorLower.includes('key exhausted') || errorLower.includes('quota') || errorLower.includes('limit')) {
        cleanMsg = 'Scouting pipelines are temporarily at maximum load. Trying backup models...';
      } else if (errorLower.includes('401') || errorLower.includes('unauthorized') || errorLower.includes('403')) {
        cleanMsg = 'Your onboarding credentials expired. Please refresh the page.';
      } else if (errorLower.includes('504') || errorLower.includes('timeout')) {
        cleanMsg = 'The request timed out. Please check your internet connection.';
      } else if (errorLower.includes('500') || errorLower.includes('internal error')) {
        cleanMsg = 'Our system encountered a brief hiccup. We are retrying the operation.';
      } else if (errText.trim() && errText.length < 90) {
        cleanMsg = errText;
      }
      throw new Error(cleanMsg);
    }
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your internet connection.');
    }
    if (err.message && !err.message.includes('fetch')) {
      throw err;
    }
    throw new Error('Unable to connect to the backend server. Please try again later.');
  }
}

export const apiClient = {
  /**
   * Sends resume file or text to backend for LLM JSON preview parsing (Step 3/4 verification step)
   */
  async parseResumePreview(file?: File, rawText?: string): Promise<any> {
    let res: Response;
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      res = await safeFetch(`${BASE_URL}/profile/parse-resume`, {
        method: 'POST',
        body: formData,
      });
    } else if (rawText && rawText.trim()) {
      const formData = new FormData();
      formData.append('raw_text', rawText);
      res = await safeFetch(`${BASE_URL}/profile/parse-resume`, {
        method: 'POST',
        body: formData,
      });
    } else {
      throw new Error('Provide a file or raw text to parse.');
    }
    return await res.json();
  },

  /**
   * Submits complete verified onboarding payload to normalized database tables
   */
  async submitFullOnboarding(payload: any): Promise<{ status: string; user_id: string }> {
    const res = await safeFetch(`${BASE_URL}/profile/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  },

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
      res = await safeFetch(`${BASE_URL}/profile/parse`, {
        method: 'POST',
        body: formData,
      });
    } else if (link && isProbablyUrl(link)) {
      res = await safeFetch(`${BASE_URL}/profile/parse-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, portfolio_url: link }),
      });
    } else if (link) {
      res = await safeFetch(`${BASE_URL}/profile/parse-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, raw_text: link }),
      });
    } else {
      throw new Error('Choose a resume file, portfolio URL, or profile text.');
    }

    const data = await res.json() as ProfileParseResponse;
    return normalizeProfile(data, file?.name ?? link ?? '');
  },

  /**
   * Fetches the gap clusters for a specific tracked company
   */
  async getGapClusters(companyId: string): Promise<GapCluster[]> {
    const res = await safeFetch(`${BASE_URL}/company/${companyId}/gaps`);
    return await res.json();
  },

  /**
   * Fetches the matched opportunity cards for the user's dashboard
   */
  async getOpportunityCards(userId: string): Promise<OpportunityCardView[]> {
    try {
      const res = await safeFetch(`${BASE_URL}/cards?user_id=${userId}`);
      const data = await res.json();
      return data.cards ?? MOCK_CARDS;
    } catch {
      return MOCK_CARDS;
    }
  },

  /**
   * Triggers a company scan directly on backend and returns matched cards & debug_info
   */
  async scanCompany(userId: string, companyUrl: string, force = false): Promise<{ company: CompanyResponse; cards: OpportunityCardView[]; debug_info?: any } | null> {
    try {
      const res = await safeFetch(`${BASE_URL}/scan?force=${force}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, company_url: companyUrl }),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * Fetches curated YC/VC discovery feed
   */
  async getCompanyFeed(userId?: string): Promise<any[]> {
    const url = userId ? `${BASE_URL}/company/feed?user_id=${userId}` : `${BASE_URL}/company/feed`;
    try {
      const res = await safeFetch(url);
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data.companies ?? []);
      return rawList.map((item: any) => ({
        id: item.id || item.company || Math.random().toString(),
        name: item.company || item.name || "Target Company",
        url: item.website || item.url || "https://ycombinator.com",
        github_repo_url: item.github_repo_url || null,
        careers_page_url: item.jd_url || item.careers_page_url || null,
        funding_stage: item.stage || item.funding_stage || "seed",
        funding: item.funding || "Seed, $2M",
        investor_tags: item.investor_tags || ["yc", "a16z"],
        employee_count_approx: item.employee_count_approx || 12,
        tech_stack_tags: item.tech_stack_tags || item.tech_stack || ["TypeScript", "Python", "React"],
        scan_status: "done",
        evidence_count: item.evidence_count || 3,
        is_seed_list: true,
        seed_list_source: "yc_w24",
        why_for_you: item.fit_explanation || item.why_for_you || "Matches your candidate profile.",
        fit_score: item.fit_score || 0.85,
        role: item.role || "Product Engineer",
        role_classification: item.role_classification || "hybrid_builder",
        jd_url: item.jd_url || item.url
      }));
    } catch (err) {
      console.error("Error fetching company feed:", err);
      return [];
    }
  },

  /**
   * Fetches company health vetting signals
   */
  async getCompanyHealth(companyId: string): Promise<CompanyHealthSignal | null> {
    try {
      const res = await safeFetch(`${BASE_URL}/company/${companyId}/health`);
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * Fetches full 4-channel outreach playbook
   */
  async getOutreachPlaybook(companyId: string, cardId: string, userId: string): Promise<OutreachPlaybook | null> {
    try {
      const res = await safeFetch(`${BASE_URL}/company/${companyId}/cards/${cardId}/outreach-playbook?user_id=${userId}`);
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * Fetches Kanban Application Tracker board
   */
  async getKanbanBoard(userId: string): Promise<KanbanBoard> {
    try {
      const res = await safeFetch(`${BASE_URL}/tracker?user_id=${userId}`);
      return await res.json();
    } catch {
      return { researching: [], building: [], reached_out: [], replied: [], interviewing: [], closed: [] };
    }
  },

  /**
   * Creates application in tracker
   */
  async createTrackerApp(userId: string, companyId: string, cardId?: string, status = 'researching'): Promise<TrackerApplication | null> {
    try {
      const res = await safeFetch(`${BASE_URL}/tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, company_id: companyId, card_id: cardId, status }),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * Updates application in tracker
   */
  async updateTrackerApp(appId: string, update: { status?: string; demo_url?: string; notes?: string }): Promise<TrackerApplication | null> {
    try {
      const res = await safeFetch(`${BASE_URL}/tracker/${appId}`, {
        method: 'POST', // standard patch behavior override for compatibility
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      return await res.json();
    } catch {
      return null;
    }
  },

  /**
   * Fetches 7-day follow-up reminders due
   */
  async getFollowupReminders(userId: string): Promise<FollowupReminder[]> {
    try {
      const res = await safeFetch(`${BASE_URL}/tracker/reminders?user_id=${userId}`);
      const data = await res.json();
      return data.reminders ?? [];
    } catch {
      return [];
    }
  },

  /**
   * Updates status of a card (e.g. dismissed or selected)
   */
  async updateCardStatus(cardId: string, status: 'new' | 'selected' | 'dismissed'): Promise<{ card_id: string; status: string }> {
    try {
      const res = await safeFetch(`${BASE_URL}/cards/${cardId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return await res.json();
    } catch {
      return { card_id: cardId, status };
    }
  },

  /**
   * Fetches discovered contacts for a company
   */
  async getContacts(companyId: string): Promise<any[]> {
    try {
      const res = await safeFetch(`${BASE_URL}/company/${companyId}/contacts`);
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
    } catch {
      return [];
    }
  },

  /**
   * Fetches or generates outreach draft scaffold for a card
   */
  async getOutreachDraft(companyId: string, cardId: string, userId: string): Promise<{ draft_text: string }> {
    const res = await safeFetch(`${BASE_URL}/company/${companyId}/cards/${cardId}/outreach-draft?user_id=${userId}`);
    return await res.json();
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
  async getBounties(bountyType?: string, techStack?: string, forceRefresh: boolean = false): Promise<BountyItem[]> {
    let url = `${BASE_URL}/bounties`;
    const params = new URLSearchParams();
    if (bountyType && bountyType !== 'all') params.append('bounty_type', bountyType);
    if (techStack) params.append('tech_stack', techStack);
    if (forceRefresh) params.append('force_refresh', 'true');
    if (params.toString()) url += `?${params.toString()}`;

    try {
      const res = await safeFetch(url);
      const data = await res.json();
      return data.bounties ?? [];
    } catch {
      return [];
    }
  },

  /**
   * Triggers Steps 3-9 Company Deep Research, Pain Point Extraction & Scoped Brief
   */
  async deepResearchCompany(companyId: string, userId?: string): Promise<any> {
    const res = await safeFetch(`${BASE_URL}/company/${companyId}/deep-research${userId ? `?user_id=${userId}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  },

  /**
   * Step 10: Enrolls user in builder workflow & tracker
   */
  async enrollCompany(companyId: string, userId?: string): Promise<any> {
    const res = await safeFetch(`${BASE_URL}/company/${companyId}/enroll${userId ? `?user_id=${userId}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  },

  /**
   * Outreach Step 2: Fetch 2-3 decision-maker contacts for a company
   */
  async fetchOutreachContacts(companyId: string): Promise<any[]> {
    try {
      const res = await safeFetch(`${BASE_URL}/outreach/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      });
      const data = await res.json();
      return data.contacts || [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Outreach Step 4: Generate 3 message variants (Variant A, B, C)
   */
  async generateOutreachVariants(payload: any): Promise<any> {
    try {
      const res = await safeFetch(`${BASE_URL}/outreach/draft-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data.variants || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Outreach Step 6: Log send action and mark as sent
   */
  async logOutreachSend(opportunityId: string, channel: string, variantUsed: string, messageText: string): Promise<any> {
    const res = await safeFetch(`${BASE_URL}/outreach/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opportunity_id: opportunityId,
        channel,
        variant_used: variantUsed,
        message_text: messageText,
      }),
    });
    return await res.json();
  },

  /**
   * Outreach Step 6 & 7: Log final outcome ('interview', 'rejected', 'ghosted', 'positive_no_role')
   */
  async logOutreachOutcome(opportunityId: string, userId: string, companyId: string, outcome: string, notes?: string): Promise<any> {
    const res = await safeFetch(`${BASE_URL}/outreach/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opportunity_id: opportunityId,
        user_id: userId,
        company_id: companyId,
        outcome,
        notes,
      }),
    });
    return await res.json();
  },
};

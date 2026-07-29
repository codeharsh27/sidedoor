import type { EvidenceItem, GapCluster, JobPosting, OpportunityCardView, UserProfile } from '../types/schema';
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

const inferCompanyName = (companyUrl: string) => {
  try {
    const host = new URL(companyUrl).hostname.replace(/^www\./, '');
    const firstSegment = host.split('.')[0];
    return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
  } catch {
    const cleaned = companyUrl.replace(/^https?:\/\//i, '').split('/')[0].split('.')[0];
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Target Company';
  }
};

const buildCardsFromEvidence = (
  userId: string,
  company: CompanyResponse,
  evidenceItems: EvidenceItem[],
  jobs: JobPosting[],
): OpportunityCardView[] => {
  return evidenceItems.slice(0, 3).map((evidence, index) => {
    const role = jobs[index % Math.max(jobs.length, 1)];
    const label = evidence.raw_text.split(/\r?\n/)[0]?.slice(0, 96) || 'Public evidence-backed product gap';

    return {
      card: {
        id: `card_${company.id}_${index}`,
        user_id: userId,
        gap_cluster_id: `gap_${company.id}_${index}`,
        profile_match_score: Math.max(70, 92 - index * 7),
        shown_at: new Date().toISOString(),
        status: 'new',
      },
      company: {
        id: company.id,
        name: company.name,
        url: company.url,
        github_repo_url: company.github_repo_url,
        careers_page_url: company.careers_page_url,
        last_scanned_at: company.last_scanned_at,
      },
      gap_cluster: {
        id: `gap_${company.id}_${index}`,
        company_id: company.id,
        label,
        evidence_item_ids: [evidence.id],
        evidence_count: 1,
        recency_score: 0.85,
        rank_score: 80 - index * 5,
      },
      evidence_items: [evidence],
      fixability_flags: {
        id: `fix_${company.id}_${index}`,
        gap_cluster_id: `gap_${company.id}_${index}`,
        has_public_repo: Boolean(company.github_repo_url),
        has_public_api: Boolean(company.github_repo_url || company.careers_page_url),
        has_ui_surface: true,
        is_buildable: true,
      },
      role_match: role
        ? {
            job_posting: role,
            match_score: 75,
          }
        : undefined,
      why_matches_you: `You listed relevant builder skills; this card is backed by ${evidence.source_type} evidence from ${company.name}.`,
    };
  });
};

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
   * Triggers a company scan and returns the matched cards
   */
  async scanCompany(userId: string, companyUrl: string): Promise<{ company: CompanyResponse; cards: OpportunityCardView[] } | null> {
    const name = inferCompanyName(companyUrl);
    const createRes = await fetch(`${BASE_URL}/company/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url: companyUrl }),
    });

    if (!createRes.ok) {
      return null;
    }

    const company = await createRes.json() as CompanyResponse;
    const scanRes = await fetch(`${BASE_URL}/company/${company.id}/scan`, { method: 'POST' });
    if (!scanRes.ok) return { company, cards: [] };

    const [evidenceRes, jobsRes] = await Promise.all([
      fetch(`${BASE_URL}/company/${company.id}/evidence`),
      fetch(`${BASE_URL}/company/${company.id}/jobs`),
    ]);

    const evidence = evidenceRes.ok ? await evidenceRes.json() as EvidenceItem[] : [];
    const jobs = jobsRes.ok ? await jobsRes.json() as JobPosting[] : [];

    return {
      company,
      cards: buildCardsFromEvidence(userId, company, evidence, jobs),
    };
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

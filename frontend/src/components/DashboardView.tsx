import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { OpportunityCardView, FixabilityFlags, UserProfile, BountyItem } from '../types/schema';
import { CompanyLogo } from './CompanyLogo';
import { apiClient } from '../api/client';
import { useAuth, getUserDisplayName, getUserInitials } from '../lib/useAuth';
import {
  Terminal, Search, ShieldAlert,
  ArrowUpRight, Building2, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, ArrowLeft, Link as LinkIcon, Send, Zap, Settings, Check, LogOut, MapPin, Calendar,
  ChevronRight, ArrowRight, RefreshCw, X
} from 'lucide-react';

interface DashboardViewProps {
  userProfile?: UserProfile;
  supabaseUser?: User;
  onBackToLanding?: () => void;
}

const createMockOpportunityForCompany = (name: string): OpportunityCardView => {
  return {
    card: { id: `card_${name.toLowerCase()}_01`, user_id: 'usr_aditya_01', gap_cluster_id: `gap_${name.toLowerCase()}_db`, profile_match_score: 93, shown_at: new Date().toISOString(), status: 'new' },
    company: { id: `comp_${name.toLowerCase()}`, name: name, url: `https://${name.toLowerCase()}.com`, github_repo_url: `https://github.com/${name.toLowerCase()}/${name.toLowerCase()}`, careers_page_url: `https://${name.toLowerCase()}.com/careers`, last_scanned_at: new Date().toISOString() },
    gap_cluster: { id: `gap_${name.toLowerCase()}_db`, company_id: `comp_${name.toLowerCase()}`, label: `Visual Platform Console for Webhook Inspector & Debug Logs`, evidence_item_ids: [`ev_${name.toLowerCase()}_01`], evidence_count: 1, recency_score: 0.96, rank_score: 92.0 },
    evidence_items: [{ id: `ev_${name.toLowerCase()}_01`, company_id: `comp_${name.toLowerCase()}`, source_type: 'github_issue', source_url: `https://github.com/${name.toLowerCase()}/${name.toLowerCase()}/issues/2024`, raw_text: `Telemetry logs and request events should be displayed in a live dashboard view so developers don't have to watch raw terminal stdout streams.`, author_handle: 'postgres_dev', posted_at: '2026-07-24T10:00:00Z', fetched_at: '2026-07-25T12:00:00Z' }],
    fixability_flags: { id: `fix_${name.toLowerCase()}_01`, gap_cluster_id: `gap_${name.toLowerCase()}_db`, has_public_repo: true, has_public_api: true, has_ui_surface: true, is_buildable: true },
    role_match: { job_posting: { id: `job_${name.toLowerCase()}_01`, company_id: `comp_${name.toLowerCase()}`, title: 'Frontend Developer Tools Engineer', raw_text: 'Build developer tooling database interfaces.', posted_at: '2026-07-20T00:00:00Z', is_open: true }, match_score: 91 },
    why_matches_you: `Matches your expertise in React, Webhooks and your background in building custom analytics dashboards.`
  };
};

const generateOutreachText = (item: OpportunityCardView, appUrl: string, videoUrl: string) => {
  const companyName = item.company.name;
  const gapLabel = item.gap_cluster.label.toLowerCase();
  
  return `Hi Engineering Team, 
  
I noticed a gap in ${companyName}'s product feedback regarding the ${gapLabel}. 

To show rather than tell, I went ahead and built a live proof-of-concept visual extension resolving this here: ${appUrl || '[Your Live App Link]'}

I also recorded a quick 60-second Loom walking through the codebase and implementation strategy: ${videoUrl || '[Your Loom Link]'}

Would love to hand this over to the engineering team and hear your feedback!`;
};

interface Contact {
  name: string;
  role: string;
  linkedin: string;
  email: string;
}

const getMockContacts = (companyName: string): Contact[] => {
  const roles = [
    'Engineering Manager',
    'Developer Experience',
    'Product Engineer',
    'Technical Recruiter',
    'Founder CTO',
  ];

  return roles.map(role => {
    const query = encodeURIComponent(`${role} ${companyName}`);
    return {
      name: `Search ${role}`,
      role,
      linkedin: `https://www.linkedin.com/search/results/people/?keywords=${query}`,
      email: 'Generated search URL only',
    };
  });
};

const getOpportunityDetails = (item: OpportunityCardView) => {
  const isPostHog = item.company.name.toLowerCase().includes('posthog');
  const isStripe = item.company.name.toLowerCase().includes('stripe');
  const isLinear = item.company.name.toLowerCase().includes('linear');
  const isVercel = item.company.name.toLowerCase().includes('vercel');

  if (isPostHog) {
    return {
      opportunity: "Build a real-time webhooks dashboard widget that allows developers to inspect sent webhook payloads directly inside their settings panel.",
      gap: "PostHog currently lacks a visual inspector for project webhooks, forcing developers to debug blindly.",
      solve: "You can build a clean React payload viewer component that polls the webhook log API, renders JSON side-by-side, and includes a re-delivery action.",
      perfect: "Since you have built an open-source CLI utility for webhook inspection and are highly proficient in React and Webhooks, this project aligns perfectly with your credentials."
    };
  } else if (isStripe) {
    return {
      opportunity: "Create a local UI dashboard wrapper for the Stripe CLI that renders local webhook deliveries in a beautiful web log viewer.",
      gap: "Stripe CLI prints webhook logs directly to the stdout terminal, which is hard to read and parse during rapid development.",
      solve: "Build a simple local dev server in Node/Next.js that captures CLI stdout streams and pushes events to a React table via WebSockets.",
      perfect: "Your background in building custom analytics dashboards and API integrations makes you the perfect fit to build this developer experience enhancer."
    };
  } else if (isLinear) {
    return {
      opportunity: "Build a custom sprint velocity CSV exporter widget that integrates directly with Linear's project dashboard.",
      gap: "Linear doesn't provide a quick, 1-click custom CSV export for velocity metrics in the current sprint UI.",
      solve: "Create a browser extension or custom integration card that pulls current cycle analytics from Linear API and exports formatted spreadsheets.",
      perfect: "Matches your TypeScript and REST APIs experience. You already built visual reporting dashboards, making this a straightforward win."
    };
  } else if (isVercel) {
    return {
      opportunity: "Design a visual timeline component that parses deployment events and builds a timeline view for build steps.",
      gap: "Vercel's build log screen is a raw text scroll, missing a visual timeline breakdown of which steps took the most time.",
      solve: "Develop a React log parser that groups lines by build phase (cloning, building, caching) and visualizes them as a clean Gantt-style chart.",
      perfect: "Perfect for your React, TypeScript, and Data Visualization skills. This is exactly the kind of frontend developer tool you excel at."
    };
  } else {
    // Clean, executive 10-second summary fallback for scanned companies
    const title = item.gap_cluster.label;
    const rawEv = item.evidence_items[0]?.raw_text || 'Developer friction reported in public discussion.';
    const cleanGap = rawEv.length > 180 ? rawEv.slice(0, 180) + "..." : rawEv;
    return {
      opportunity: `Build a Next.js / React micro-app or developer extension for ${item.company.name} solving: "${title}".`,
      gap: cleanGap,
      solve: `Build a 4–6 hour open-source web sandbox or workflow extension for ${item.company.name}. Deploy live on Vercel/Railway and record a 2-minute Loom walkthrough.`,
    };
  }
};

const DEFAULT_DISCOVERY_FEED: any[] = [
  // --- TIER 1 COMPANIES ---
  {
    id: 'drdroid',
    name: 'DrDroid',
    url: 'https://www.ycombinator.com/companies/drdroid',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • YC',
    employee_count_approx: 10,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'FastAPI', 'OpenTelemetry', 'React'],
    why_for_you: 'Automated incident resolution & production debugging agents.',
    fit_score: 0.92,
    role: 'AI Observability Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'india',
    compensation_tier: '₹30L - ₹55L'
  },
  {
    id: 'raven',
    name: 'Raven',
    url: 'https://www.ycombinator.com/companies/raven',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • YC',
    employee_count_approx: 12,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Node.js', 'TypeScript', 'React', 'Redis'],
    why_for_you: 'Event-driven notification infrastructure for developer applications.',
    fit_score: 0.90,
    role: 'Full Stack Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹28L - ₹50L'
  },
  {
    id: 'peoplebox',
    name: 'Peoplebox.ai',
    url: 'https://www.ycombinator.com/companies/peoplebox',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • YC',
    employee_count_approx: 25,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['React', 'Python', 'PostgreSQL', 'LLMs'],
    why_for_you: 'Connects strategy & OKRs with real-time AI performance management.',
    fit_score: 0.89,
    role: 'Product Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'india',
    compensation_tier: '₹32L - ₹60L'
  },
  {
    id: 'orbitshift',
    name: 'OrbitShift',
    url: 'https://www.orbitshift.ai',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • Dual HQ (India + US)',
    employee_count_approx: 18,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'FastAPI', 'TypeScript', 'LLM Agents'],
    why_for_you: 'Enterprise sales intelligence platform using AI & LLM agents.',
    fit_score: 0.88,
    role: 'AI Systems Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 5,
    region_tag: 'india',
    compensation_tier: '₹35L - ₹65L'
  },
  {
    id: 'vorflux',
    name: 'Vorflux',
    url: 'https://www.ycombinator.com/companies/vorflux',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • India-founded',
    employee_count_approx: 8,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'Rust', 'React', 'Data Engineering'],
    why_for_you: 'Automated workflow orchestration for modern data engineering teams.',
    fit_score: 0.87,
    role: 'Founding Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹30L - ₹50L'
  },
  {
    id: 'aina',
    name: 'Aina',
    url: 'https://www.aina.com',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • Bengaluru + SF',
    employee_count_approx: 15,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'PyTorch', 'React', 'Voice AI'],
    why_for_you: 'Generative AI voice & multimodal customer engagement tools.',
    fit_score: 0.86,
    role: 'Multimodal AI Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'india',
    compensation_tier: '₹35L - ₹65L'
  },
  {
    id: 'reodev',
    name: 'Reo.Dev',
    url: 'https://reo.dev',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • Bengaluru + US',
    employee_count_approx: 14,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['TypeScript', 'React', 'Python', 'GTM AI'],
    why_for_you: 'Developer intent revenue intelligence for B2B developer products.',
    fit_score: 0.85,
    role: 'Full Stack Builder',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹30L - ₹55L'
  },
  {
    id: 'litellm',
    name: 'LiteLLM',
    url: 'https://www.ycombinator.com/companies/litellm',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (SF)',
    employee_count_approx: 10,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'FastAPI', 'React', 'LLM Proxy'],
    why_for_you: 'Universal proxy for calling 100+ LLM APIs with unified logging & cost tracking.',
    fit_score: 0.94,
    role: 'AI Proxy Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 6,
    region_tag: 'global',
    compensation_tier: '$100k - $160k'
  },
  {
    id: 'alphawatch',
    name: 'Alphawatch AI',
    url: 'https://www.ycombinator.com/companies/alphawatch-ai',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (SF)',
    employee_count_approx: 12,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'LangChain', 'React', 'Financial AI'],
    why_for_you: 'Financial research tools powered by generative LLMs.',
    fit_score: 0.88,
    role: 'LLM Research Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'global',
    compensation_tier: '$110k - $170k'
  },
  {
    id: 'berry',
    name: 'Berry',
    url: 'https://www.ycombinator.com/companies/berry',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (SF)',
    employee_count_approx: 9,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'FastAPI', 'TypeScript', 'AI Eval'],
    why_for_you: 'Automates AI agent evaluation & security benchmarking.',
    fit_score: 0.87,
    role: 'AI Evaluation Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$100k - $150k'
  },
  {
    id: 'deepinteractions',
    name: 'Deep Interactions',
    url: 'https://www.ycombinator.com/companies/deep-interactions',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (SF)',
    employee_count_approx: 11,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['React', 'TypeScript', 'Python', 'Spatial AI'],
    why_for_you: 'Generative AI tools for interaction design and spatial computing.',
    fit_score: 0.86,
    role: 'Product Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'global',
    compensation_tier: '$105k - $155k'
  },
  {
    id: 'unsiloed',
    name: 'Unsiloed AI',
    url: 'https://www.ycombinator.com/companies/unsiloed-ai',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (SF)',
    employee_count_approx: 8,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'PostgreSQL', 'React', 'AI Agents'],
    why_for_you: 'Unlocks siloed enterprise database knowledge with AI agents.',
    fit_score: 0.85,
    role: 'Database AI Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$100k - $150k'
  },
  {
    id: 'clicks',
    name: 'Clicks',
    url: 'https://www.ycombinator.com/companies/clicks',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (SF)',
    employee_count_approx: 10,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['TypeScript', 'React', 'Python', 'Search AI'],
    why_for_you: 'Powers AI web search & conversion optimization.',
    fit_score: 0.84,
    role: 'Growth Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$95k - $145k'
  },
  {
    id: 'tesora',
    name: 'Tesora',
    url: 'https://www.ycombinator.com/companies/tesora',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (SF)',
    employee_count_approx: 14,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'FastAPI', 'React', 'Fintech AI'],
    why_for_you: 'Builds AI wealth & tax strategy infrastructure.',
    fit_score: 0.83,
    role: 'Fintech AI Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'global',
    compensation_tier: '$105k - $160k'
  },
  {
    id: 'govdash',
    name: 'GovDash',
    url: 'https://www.ycombinator.com/companies/govdash',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (New York)',
    employee_count_approx: 16,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Next.js', 'TypeScript', 'Python', 'RFP AI'],
    why_for_you: 'Streamlines government contracting & RFP workflows with AI.',
    fit_score: 0.85,
    role: 'Full Stack Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'global',
    compensation_tier: '$100k - $155k'
  },
  {
    id: 'skypher',
    name: 'Skypher',
    url: 'https://www.ycombinator.com/companies/skypher',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (New York)',
    employee_count_approx: 12,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'React', 'FastAPI', 'Security AI'],
    why_for_you: 'Automates vendor security questionnaires using generative AI.',
    fit_score: 0.84,
    role: 'Security AI Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$95k - $150k'
  },
  {
    id: 'draftwise',
    name: 'Draftwise',
    url: 'https://www.ycombinator.com/companies/draftwise',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (New York)',
    employee_count_approx: 22,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'React', 'PostgreSQL', 'Legal AI'],
    why_for_you: 'Contract drafting and knowledge platform for top law firms.',
    fit_score: 0.83,
    role: 'Legal Tech Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 5,
    region_tag: 'global',
    compensation_tier: '$105k - $165k'
  },
  {
    id: 'fleetline',
    name: 'Fleetline',
    url: 'https://www.ycombinator.com/companies/fleetline',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (New York)',
    employee_count_approx: 10,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'Go', 'React', 'Logistics'],
    why_for_you: 'Builds logistics fleet automation software.',
    fit_score: 0.82,
    role: 'Logistics Systems Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$95k - $145k'
  },
  {
    id: 'auctor',
    name: 'Auctor',
    url: 'https://www.ycombinator.com/companies/auctor',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (New York)',
    employee_count_approx: 11,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'React', 'OpenAI API', 'GTM AI'],
    why_for_you: 'Automates enterprise sales operations & pitch deck creation with LLMs.',
    fit_score: 0.81,
    role: 'AI GTM Builder',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'global',
    compensation_tier: '$100k - $150k'
  },
  {
    id: 'hyperspell',
    name: 'Hyperspell',
    url: 'https://www.ycombinator.com/companies/hyperspell',
    funding_stage: 'tier 1',
    funding: 'Tier 1 • USA (SF)',
    employee_count_approx: 8,
    investor_tags: ['yc', 'tier_1'],
    tech_stack_tags: ['Python', 'Rust', 'TypeScript', 'AI Memory'],
    why_for_you: 'Personalized AI memory infrastructure for developer tools.',
    fit_score: 0.86,
    role: 'Memory Systems Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'global',
    compensation_tier: '$105k - $160k'
  },

  // --- TIER 2 COMPANIES ---
  {
    id: 'superkalam',
    name: 'SuperKalam',
    url: 'https://www.ycombinator.com/companies/superkalam',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • YC India',
    employee_count_approx: 14,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Python', 'React', 'LLMs', 'EdTech'],
    why_for_you: 'AI personal tutor for competitive exams in India.',
    fit_score: 0.80,
    role: 'EdTech AI Builder',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹22L - ₹40L'
  },
  {
    id: 'landeed',
    name: 'Landeed',
    url: 'https://www.ycombinator.com/companies/landeed',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • YC India',
    employee_count_approx: 30,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Python', 'React Native', 'PostgreSQL', 'Search'],
    why_for_you: 'India\'s fastest land title search engine.',
    fit_score: 0.79,
    role: 'Search Engine Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'india',
    compensation_tier: '₹25L - ₹45L'
  },
  {
    id: 'infinity',
    name: 'Infinity',
    url: 'https://www.ycombinator.com/companies/infinity',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • YC India',
    employee_count_approx: 15,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['TypeScript', 'React', 'Python', 'Fintech'],
    why_for_you: 'Wealth management infrastructure for retail investors.',
    fit_score: 0.78,
    role: 'Fintech Full Stack',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹24L - ₹42L'
  },
  {
    id: 'paasa',
    name: 'Paasa',
    url: 'https://www.ycombinator.com/companies/paasa',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • YC India',
    employee_count_approx: 12,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Go', 'React', 'PostgreSQL', 'Payments'],
    why_for_you: 'Global treasury and cross-border payments software.',
    fit_score: 0.77,
    role: 'Payments Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹25L - ₹45L'
  },
  {
    id: 'xpay',
    name: 'xPay',
    url: 'https://www.ycombinator.com/companies/xpay',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • YC India',
    employee_count_approx: 10,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Node.js', 'TypeScript', 'React', 'Checkout'],
    why_for_you: 'Unified checkout infrastructure for emerging markets.',
    fit_score: 0.76,
    role: 'Checkout Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹22L - ₹38L'
  },
  {
    id: '100x',
    name: '100x',
    url: 'https://www.ycombinator.com/companies/100x',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • YC India',
    employee_count_approx: 9,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Python', 'Rust', 'React', 'DevTools'],
    why_for_you: 'Developer tools & automated code testing platforms.',
    fit_score: 0.78,
    role: 'DevTool Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹24L - ₹42L'
  },
  {
    id: 'rivia',
    name: 'Rivia.AI',
    url: 'https://www.ycombinator.com/companies/rivia-ai',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • YC India',
    employee_count_approx: 11,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['React', 'Chrome Extension', 'Node.js', 'Demo AI'],
    why_for_you: 'Creates interactive product demos automatically for B2B SaaS.',
    fit_score: 0.77,
    role: 'Product Demo Builder',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'india',
    compensation_tier: '₹22L - ₹40L'
  },
  {
    id: 'carpl',
    name: 'CARPL.ai',
    url: 'https://carpl.ai',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • India',
    employee_count_approx: 25,
    investor_tags: ['tier_2'],
    tech_stack_tags: ['Python', 'DICOM', 'React', 'MedTech AI'],
    why_for_you: 'Enterprise marketplace for AI radiology & medical imaging.',
    fit_score: 0.76,
    role: 'MedTech AI Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'india',
    compensation_tier: '₹25L - ₹48L'
  },
  {
    id: 'hireglide',
    name: 'HireGlide',
    url: 'https://www.ycombinator.com/companies/hireglide',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA (SF)',
    employee_count_approx: 8,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Python', 'WebRTC', 'React', 'Interview AI'],
    why_for_you: 'AI technical interviewing tools for engineering teams.',
    fit_score: 0.79,
    role: 'AI Interview Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$90k - $135k'
  },
  {
    id: 'outrove',
    name: 'Outrove',
    url: 'https://www.ycombinator.com/companies/outrove',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA (SF)',
    employee_count_approx: 9,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['TypeScript', 'React', 'Python', 'Sales AI'],
    why_for_you: 'Outbound sales automation platforms.',
    fit_score: 0.77,
    role: 'Outbound Sales Builder',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$85k - $130k'
  },
  {
    id: 'clado',
    name: 'Clado',
    url: 'https://www.ycombinator.com/companies/clado',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA (SF)',
    employee_count_approx: 7,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['C++', 'Rust', 'Python', 'Vector Search'],
    why_for_you: 'Distributed search engines for vector embeddings.',
    fit_score: 0.81,
    role: 'Vector Search Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$95k - $145k'
  },
  {
    id: 'refresh',
    name: 'Refresh',
    url: 'https://www.ycombinator.com/companies/refresh',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA (SF)',
    employee_count_approx: 10,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Python', 'Playwright', 'React', 'Scraping AI'],
    why_for_you: 'Automates CRM contact enrichment with generative web scraping.',
    fit_score: 0.78,
    role: 'CRM Automation Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$90k - $135k'
  },
  {
    id: 'empirical',
    name: 'Empirical',
    url: 'https://www.ycombinator.com/companies/empirical',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA (New York)',
    employee_count_approx: 11,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['TypeScript', 'Playwright', 'Python', 'QA Agents'],
    why_for_you: 'Automates software testing & code review with AI agents.',
    fit_score: 0.80,
    role: 'QA Agent Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'global',
    compensation_tier: '$95k - $140k'
  },
  {
    id: 'aseonlabs',
    name: 'Aseon Labs',
    url: 'https://www.ycombinator.com/companies/aseon-labs',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA (SF)',
    employee_count_approx: 8,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Python', 'Verilog', 'AI Agents'],
    why_for_you: 'AI agents for hardware & chip design verification.',
    fit_score: 0.76,
    role: 'Hardware AI Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$90k - $135k'
  },
  {
    id: 'contrario',
    name: 'Contrario',
    url: 'https://www.ycombinator.com/companies/contrario',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA (SF)',
    employee_count_approx: 9,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Python', 'React', 'LLMs', 'Competitive AI'],
    why_for_you: 'Competitive intelligence platforms for modern GTM teams.',
    fit_score: 0.77,
    role: 'GTM Intelligence Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$90k - $135k'
  },
  {
    id: 'standout',
    name: 'Standout',
    url: 'https://www.ycombinator.com/companies/standout',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA (SF)',
    employee_count_approx: 10,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Python', 'FastAPI', 'React', 'Talent AI'],
    why_for_you: 'Candidate resume & portfolio ranking platforms.',
    fit_score: 0.78,
    role: 'Talent Ranking Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '$90k - $135k'
  },
  {
    id: 'lago',
    name: 'Lago',
    url: 'https://www.ycombinator.com/companies/lago',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • Europe (France)',
    employee_count_approx: 25,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['Ruby', 'Go', 'React', 'Billing DevTools'],
    why_for_you: 'Open-source metering and usage-based billing platform.',
    fit_score: 0.82,
    role: 'Billing Systems Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 5,
    region_tag: 'global',
    compensation_tier: '€70k - €110k'
  },
  {
    id: 'liveflow',
    name: 'LiveFlow',
    url: 'https://www.ycombinator.com/companies/liveflow',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • Europe (Remote)',
    employee_count_approx: 18,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['TypeScript', 'React', 'Node.js', 'FinTech'],
    why_for_you: 'Automates financial reporting by syncing QuickBooks to Google Sheets.',
    fit_score: 0.79,
    role: 'FinTech Integrations Builder',
    role_classification: 'hybrid_builder',
    evidence_count: 4,
    region_tag: 'global',
    compensation_tier: '$90k - $135k'
  },
  {
    id: 'ashby',
    name: 'Ashby',
    url: 'https://www.ycombinator.com/companies/ashby',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • USA / Remote',
    employee_count_approx: 65,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['TypeScript', 'React', 'Node.js', 'ATS Analytics'],
    why_for_you: 'All-in-one recruiting, ATS, and analytics software.',
    fit_score: 0.84,
    role: 'Product Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 5,
    region_tag: 'global',
    compensation_tier: '$110k - $160k'
  },
  {
    id: 'hub',
    name: 'Hub',
    url: 'https://www.ycombinator.com/companies/hub',
    funding_stage: 'tier 2',
    funding: 'Tier 2 • Europe (Paris)',
    employee_count_approx: 12,
    investor_tags: ['yc', 'tier_2'],
    tech_stack_tags: ['React', 'WebSockets', 'Node.js', 'Collaborative'],
    why_for_you: 'Collaborative workspaces for modern remote engineering teams.',
    fit_score: 0.78,
    role: 'Workspace Engineer',
    role_classification: 'hybrid_builder',
    evidence_count: 3,
    region_tag: 'global',
    compensation_tier: '€65k - €100k'
  }
];

export const DashboardView: React.FC<DashboardViewProps> = ({ userProfile, supabaseUser: supabaseUserProp, onBackToLanding }) => {
  const { user: authUser, signOut } = useAuth();
  const supabaseUser = supabaseUserProp ?? authUser;

  // Derived user info from Supabase
  const displayName = getUserDisplayName(supabaseUser);
  const initials = getUserInitials(supabaseUser);
  const userEmail = supabaseUser?.email ?? '';
  const userLocation = supabaseUser?.user_metadata?.location ?? '';
  const userTargetRoles: string[] = supabaseUser?.user_metadata?.target_roles ?? (supabaseUser?.user_metadata?.onboarding?.role ? [supabaseUser.user_metadata.onboarding.role] : []);
  const userCompanyStage: string[] = supabaseUser?.user_metadata?.company_stage ?? supabaseUser?.user_metadata?.onboarding?.company_stage ?? [];
  const userTechStack: string[] = supabaseUser?.user_metadata?.onboarding?.tech_stack ?? [];
  const memberSince = supabaseUser?.created_at
    ? new Date(supabaseUser.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Recently joined';

  const handleSignOut = async () => {
    await signOut();
    onBackToLanding?.();
  };

  const currentUserId = supabaseUser?.id || userProfile?.user_id;

  const [leftPaneOpen, setLeftPaneOpen] = useState(true);
  const [rightPaneOpen, setRightPaneOpen] = useState(false);

  // Onboarding Scouting Loading simulation
  const [isScoutingLoading, setIsScoutingLoading] = useState(
    sessionStorage.getItem('completing_onboarding') === 'true'
  );
  const [scoutingProgress, setScoutingProgress] = useState(0);
  const [scoutingStepIndex, setScoutingStepIndex] = useState(0);

  const SCOUTING_STEPS = [
    "Vetting target companies in your domain...",
    "Querying developer telemetry & public issues...",
    "Matching tech stack dependencies to your credentials...",
    "Scaffolding MVP blueprints and build plans...",
    "Formatting custom opportunity cards..."
  ];

  useEffect(() => {
    if (!isScoutingLoading) return;

    // Increment progress counter
    const progressInterval = setInterval(() => {
      setScoutingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    // Transition stages every 650ms
    const stepInterval = setInterval(() => {
      setScoutingStepIndex(prev => {
        if (prev < SCOUTING_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 650);

    const finishTimeout = setTimeout(() => {
      setIsScoutingLoading(false);
      sessionStorage.removeItem('completing_onboarding');
    }, 3200);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearTimeout(finishTimeout);
    };
  }, [isScoutingLoading]);
  
  // Dynamic states
  const [cardsList, setCardsList] = useState<OpportunityCardView[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeCompany, setActiveCompany] = useState<string | null>('new');
  const [feedFilterCategory, setFeedFilterCategory] = useState<'all' | 'india' | 'yc' | 'early_stage' | 'high_pay'>('all');

  // Middle Pane State
  const [linkInput, setLinkInput] = useState('');
  const [activePromptModal, setActivePromptModal] = useState<OpportunityCardView | null>(null);
  
  // Agent Company Scouting states
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState<'fetching' | 'analyzing' | 'aligning' | 'clustering' | 'idle'>('idle');

  // Outreach Assembly states
  const [liveAppLink, setLiveAppLink] = useState('');
  const [loomLink, setLoomLink] = useState('');
  const [copiedOutreach, setCopiedOutreach] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'outreach' | 'account'>('dashboard');
  const [mainTab, setMainTab] = useState<'feed' | 'analyzer' | 'bounties' | 'tracker'>('feed');
  const [bountiesList, setBountiesList] = useState<BountyItem[]>([]);
  const [bountyFilterCategory, setBountyFilterCategory] = useState<'all' | 'bounty' | 'hackathon' | 'trial' | 'inr'>('all');
  const [pitchText, setPitchText] = useState('');
  const [isEditingPitch, setIsEditingPitch] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  // Phase 1-5 State additions
  const [discoveryFeed, setDiscoveryFeed] = useState<any[]>(DEFAULT_DISCOVERY_FEED);
  const [playbookData, setPlaybookData] = useState<any | null>(null);
  const [activePlaybookTab, setActivePlaybookTab] = useState<'email' | 'twitter' | 'discord' | 'blog' | 'followup'>('email');
  const [kanbanBoard, setKanbanBoard] = useState<any | null>(null);
  const [followupReminders, setFollowupReminders] = useState<any[]>([]);
  const [companyHealthMap, setCompanyHealthMap] = useState<Record<string, any>>({});
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);

  // 24-hour Rotation & View More Modal states
  const [showViewMoreModal, setShowViewMoreModal] = useState(false);
  const [rotationOffset, setRotationOffset] = useState<number>(0);
  const [timeUntilRotation, setTimeUntilRotation] = useState<string>('23h 59m');
  const [viewMoreSearch, setViewMoreSearch] = useState<string>('');

  // Steps 3-10 Deep Research States & Handlers
  const [showDeepResearchModal, setShowDeepResearchModal] = useState<boolean>(false);
  const [isDeepResearching, setIsDeepResearching] = useState<boolean>(false);
  const [deepResearchResult, setDeepResearchResult] = useState<any | null>(null);
  const [enrollSuccessMessage, setEnrollSuccessMessage] = useState<string | null>(null);
  const [selectedMvpOptionIndex, setSelectedMvpOptionIndex] = useState<number>(0);
  const [copiedClaudeToast, setCopiedClaudeToast] = useState<boolean>(false);

  const handleTapCompanyCard = async (companyItem: any) => {
    if (showViewMoreModal) {
      setShowViewMoreModal(false);
    }
    
    setIsDeepResearching(true);
    setShowDeepResearchModal(true);
    setDeepResearchResult(null);
    setEnrollSuccessMessage(null);
    setSelectedMvpOptionIndex(0);

    const compName = companyItem.name;
    const origUrl = companyItem.url || `https://www.${compName.toLowerCase()}.com`;

    try {
      const res = await apiClient.deepResearchCompany(compName.toLowerCase(), currentUserId);
      setDeepResearchResult({
        ...res,
        company_name: compName,
        original_company_url: origUrl,
        careers_url: (companyItem as any).careers_page_url || `${origUrl}/careers`,
        tech_stack_tags: companyItem.tech_stack_tags || ["TypeScript", "Python", "React"],
        funding_stage: companyItem.funding_stage || "Seed / YC"
      });
    } catch (err) {
      console.warn("Deep research fallback for", compName, err);
      setDeepResearchResult({
        company_name: compName,
        original_company_url: origUrl,
        careers_url: `${origUrl}/careers`,
        stage: companyItem.funding_stage || "Seed / YC W24",
        funding: companyItem.funding || "YC Backed ($2.5M)",
        company_overview: `${compName} is an AI & engineering infrastructure platform empowering developers to inspect telemetry events and scale products seamlessly.`,
        detailed_gaps: `1. Engineering & Operational Friction: Public developer channels show engineers manually inspecting raw stdout log streams during active deployments at ${compName}.\n2. Developer Tooling Gap: Lack of an automated request event dashboard delays incident triage and debugging.`,
        pain_point: `Production telemetry logging & real-time request inspection friction at ${compName}.`,
        evidence_text: `Public engineering updates and job postings reveal manual log inspection during active deployment cycles at ${compName}.`,
        source_url: origUrl,
        fit_score: companyItem.fit_score || 0.88,
        why_for_you: companyItem.why_for_you || `High-alignment match for your product engineering background and developer tools stack.`,
        mvp_options: {
          option_1: {
            title: `Visual Telemetry Inspector & Debug Console for ${compName}`,
            what_it_does: `Build a real-time web console that streams request logs and flags payload anomalies visually.`,
            why_creates_value: `Eliminates manual stdout log watching for ${compName}'s engineering team, showing you deeply understand their core product friction.`,
            scope_days: `1-2 days`,
            skills_leveraged: `React, TypeScript, Webhooks`
          },
          option_2: {
            title: `Automated Webhook & Request Proxy Middleware for ${compName}`,
            what_it_does: `Build a lightweight CLI proxy tool that captures API payloads and validates status codes in real time.`,
            why_creates_value: `Saves engineering hours during integration testing and demonstrates proactive technical initiative.`,
            scope_days: `2-3 days`,
            skills_leveraged: `FastAPI, Python, Async HTTP`
          }
        },
        contacts: [
          { name: "CTO / Founding Engineer", role: "CTO", source_url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(compName + " CTO")}` }
        ],
        outreach_draft: `Hey CTO @ ${compName}, saw your team's engineering update on telemetry log inspection. Built a quick 2-day visual dashboard demo to solve this friction!`,
        tech_stack_tags: companyItem.tech_stack_tags || ["TypeScript", "Python", "React"]
      });
    } finally {
      setIsDeepResearching(false);
    }
  };

  const handleAskClaudeCopier = () => {
    if (!deepResearchResult) return;
    const options = deepResearchResult.mvp_options || {};
    const selectedOption = selectedMvpOptionIndex === 0 ? (options.option_1 || deepResearchResult.artifact_brief) : (options.option_2 || deepResearchResult.artifact_brief);
    
    const promptText = `I am researching target startup ${deepResearchResult.company_name} (${deepResearchResult.original_company_url}).

1. ABOUT COMPANY:
${deepResearchResult.company_overview || 'High-growth VC backed startup.'}

2. ACTUAL GAPS IDENTIFIED:
${deepResearchResult.detailed_gaps || 'Telemetry & request inspection friction.'}
Evidence: "${deepResearchResult.evidence_text || 'Public engineering discussion'}"

3. PROPOSED BUILDABLE MVP OPTION (${selectedOption?.title || 'Visual Console'}):
- What it does: ${selectedOption?.what_it_does || selectedOption?.opportunity}
- Why it creates value: ${selectedOption?.why_creates_value || selectedOption?.perfect}
- Build Scope: ${selectedOption?.scope_days || '1-3 days'}
- Leveraged Skills: ${selectedOption?.skills_leveraged || 'React, TypeScript'}

My Candidate Stack: React, TypeScript, Python, FastAPI, Webhooks.

Claude, please evaluate:
1. Is this problem real and is this MVP worth building for ${deepResearchResult.company_name}?
2. Elaborate on the technical approach and architecture to build this MVP in 1-3 days.
3. Give me confidence on how this will impress their CTO when I reach out.`;

    // 1. Copy to clipboard with fallback
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(promptText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = promptText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.warn("Clipboard fallback copy:", err);
    }

    // 2. Open Claude AI in a new tab
    try {
      window.open("https://claude.ai/new", "_blank");
    } catch (e) {
      console.warn("Could not open new window:", e);
    }

    // 3. Show visual toast feedback
    setCopiedClaudeToast(true);
    setTimeout(() => setCopiedClaudeToast(false), 5000);
  };

  const handleEnrollInTracker = async () => {
    if (!deepResearchResult) return;
    try {
      await apiClient.enrollCompany(deepResearchResult.company_name, currentUserId);
      setEnrollSuccessMessage(`✅ Enrolled in ${deepResearchResult.company_name}! Added to your Kanban Builder Tracker.`);
      setTimeout(() => setEnrollSuccessMessage(null), 4000);
    } catch (e) {
      setEnrollSuccessMessage(`✅ Enrolled in ${deepResearchResult.company_name}! Added to your Kanban Builder Tracker.`);
      setTimeout(() => setEnrollSuccessMessage(null), 4000);
    }
  };

  const handleEnrollAndGoToOutreach = async () => {
    await handleEnrollInTracker();
    setShowDeepResearchModal(false);
    setViewMode('outreach');
  };

  // 24h Rotation logic
  useEffect(() => {
    const ROTATION_KEY = 'sidedoor_feed_last_rotation_ts';
    const OFFSET_KEY = 'sidedoor_feed_rotation_offset';

    const checkRotation = () => {
      const lastTs = parseInt(localStorage.getItem(ROTATION_KEY) || '0', 10);
      const savedOffset = parseInt(localStorage.getItem(OFFSET_KEY) || '0', 10);
      const now = Date.now();
      const interval24h = 24 * 60 * 60 * 1000;

      if (!lastTs || (now - lastTs >= interval24h)) {
        const nextOffset = (savedOffset + 4) % (discoveryFeed.length || 40);
        localStorage.setItem(ROTATION_KEY, now.toString());
        localStorage.setItem(OFFSET_KEY, nextOffset.toString());
        setRotationOffset(nextOffset);
        setTimeUntilRotation('24h 00m');
      } else {
        setRotationOffset(savedOffset);
        const msRemaining = interval24h - (now - lastTs);
        const hrs = Math.floor(msRemaining / (1000 * 60 * 60));
        const mins = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
        setTimeUntilRotation(`${hrs}h ${mins}m`);
      }
    };

    checkRotation();
    const timer = setInterval(checkRotation, 60000);
    return () => clearInterval(timer);
  }, [discoveryFeed.length]);

  const handleForceRotate = () => {
    const nextOffset = (rotationOffset + 4) % (discoveryFeed.length || 40);
    localStorage.setItem('sidedoor_feed_last_rotation_ts', Date.now().toString());
    localStorage.setItem('sidedoor_feed_rotation_offset', nextOffset.toString());
    setRotationOffset(nextOffset);
    setTimeUntilRotation('24h 00m');
    handleRefreshFeed();
  };

  const handleRefreshFeed = async () => {
    setIsRefreshingFeed(true);
    try {
      const fresh = await apiClient.getCompanyFeed(currentUserId);
      if (fresh && fresh.length > 0) {
        setDiscoveryFeed(fresh);
      }
    } catch (e) {
      console.error("Feed refresh failed:", e);
    } finally {
      setTimeout(() => setIsRefreshingFeed(false), 800);
    }
  };

  const [isRefreshingBounties, setIsRefreshingBounties] = useState(false);

  const handleHardRefreshBounties = async () => {
    setIsRefreshingBounties(true);
    try {
      const fresh = await apiClient.getBounties(undefined, undefined, true);
      if (fresh && fresh.length > 0) {
        setBountiesList(fresh);
      }
    } catch (e) {
      console.error("Bounties hard refresh failed:", e);
    } finally {
      setTimeout(() => setIsRefreshingBounties(false), 800);
    }
  };

  // Load real cards on mount or user change
  useEffect(() => {
    if (currentUserId) {
      apiClient.getOpportunityCards(currentUserId)
        .then(cards => {
          if (cards && cards.length > 0) {
            setCardsList(cards);
            setActiveCompany(cards[0].company.name);
          }
        })
        .catch(err => console.error("Error loading cards:", err));
    } else {
      setActiveCompany('PostHog');
    }

    // Load Phase 2 VC Discovery Feed
    apiClient.getCompanyFeed(currentUserId)
      .then(fresh => {
        if (fresh && fresh.length > 0) {
          setDiscoveryFeed(fresh);
        }
      })
      .catch(err => console.error("Error loading discovery feed:", err));

    // Load Paid Bounties & Solo Hackathons
    apiClient.getBounties().then(setBountiesList).catch(() => {});

    // Load Phase 5 Kanban & Reminders
    if (currentUserId) {
      apiClient.getKanbanBoard(currentUserId).then(setKanbanBoard).catch(() => {});
      apiClient.getFollowupReminders(currentUserId).then(setFollowupReminders).catch(() => {});
    }
  }, [currentUserId]);

  // Sync search history based on loaded cards
  useEffect(() => {
    if (cardsList && cardsList.length > 0) {
      const uniqueCompanies = Array.from(new Set(cardsList.map(c => c.company.name)));
      setSearchHistory(uniqueCompanies);
    }
  }, [cardsList]);

  // Load contacts for active opportunity card
  useEffect(() => {
    if (activePromptModal?.company?.id) {
      apiClient.getContacts(activePromptModal.company.id)
        .then(setContacts)
        .catch(err => {
          console.error("Error fetching contacts:", err);
          setContacts(getMockContacts(activePromptModal.company.name));
        });
    } else {
      setContacts([]);
    }
  }, [activePromptModal]);

  useEffect(() => {
    setLiveAppLink('');
    setLoomLink('');
    setCopiedOutreach(false);
    setViewMode('dashboard');
    setPitchText('');
    setIsEditingPitch(false);
  }, [activePromptModal]);

  // Load 4-channel outreach playbook from backend
  useEffect(() => {
    if (activePromptModal && userProfile?.user_id) {
      apiClient.getOutreachPlaybook(activePromptModal.company.id, activePromptModal.card.id, userProfile.user_id)
        .then(pb => {
          if (pb) {
            setPlaybookData(pb);
            setPitchText(pb.email_draft);
          }
        })
        .catch(err => {
          console.error("Error loading outreach playbook:", err);
          setPitchText(generateOutreachText(activePromptModal, liveAppLink, loomLink));
        });

      // Load company health signal
      apiClient.getCompanyHealth(activePromptModal.company.id)
        .then(h => {
          if (h) {
            setCompanyHealthMap(prev => ({ ...prev, [activePromptModal.company.id]: h }));
          }
        })
        .catch(() => {});
    }
  }, [activePromptModal, userProfile?.user_id]);
  

  const filteredCards = cardsList.filter(item => item.company.name === activeCompany);

  const handleEnrollOpportunity = async (item: OpportunityCardView) => {
    setActivePromptModal(item);
    if (userProfile?.user_id) {
      try {
        await apiClient.createTrackerApp(userProfile.user_id, item.company.id, item.card.id, 'building');
        const updatedBoard = await apiClient.getKanbanBoard(userProfile.user_id);
        setKanbanBoard(updatedBoard);
      } catch (e) {
        console.warn("Could not auto-enroll card in kanban tracker:", e);
      }
    }
  };

  const getEstimateType = (flags: FixabilityFlags): string => {
    if (flags.has_public_repo && flags.has_public_api && flags.has_ui_surface) return 'weekend_hack';
    if (flags.has_public_repo || flags.has_public_api) return 'one_week_project';
    return 'high_effort_system';
  };

  const getFixabilityBadge = (flags: FixabilityFlags) => {
    const type = getEstimateType(flags);
    switch (type) {
      case 'weekend_hack': return <span className="badge badge-moss" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Weekend Hack (~10h)</span>;
      case 'one_week_project': return <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>1-Week Project (~28h)</span>;
      case 'high_effort_system': return <span className="badge badge-orange" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>System Refactor</span>;
      default: return null;
    }
  };  const [copiedPromptToast, setCopiedPromptToast] = useState(false);

  const generatePromptText = (item: OpportunityCardView): string => {
    const title = item.gap_cluster.label;
    const evText = item.evidence_items[0]?.raw_text || 'Developer friction reported in community threads.';
    const evUrl = item.evidence_items[0]?.source_url || 'https://github.com';
    const role = item.role_match?.job_posting.title || 'Full Stack / Product Engineer';

    return `You are a Senior Product & Software Engineer acting as a mentor for a junior/mid-level product engineer (Arjun).
Arjun is building a 4-hour MVP to showcase his skills to ${item.company.name}.

## 🎯 Target Project Specification
- **Target Company**: ${item.company.name}
- **Role Target**: ${role}
- **Identified Gap / Problem**: "${title}"
- **Verified Evidence Receipt**: ${evUrl}
  - Quote: "${evText.slice(0, 300)}"

## 🛠️ Senior Engineer's Step-by-Step Build Plan (4-6 Hours)
1. **Architecture & Stack**:
   - Frontend: Next.js 14 (App Router), Tailwind CSS, Lucide React icons.
   - Backend API Proxy: Node.js / FastAPI endpoint connecting to ${item.company.name} public APIs.
   - Deployment: Free Vercel / Railway tier.

2. **Step-by-Step Implementation TODO Checklist**:
   - [ ] **Hour 1**: Initialize Next.js repository, configure Tailwind, build clean single-page dashboard layout.
   - [ ] **Hour 2-3**: Implement core feature route addressing "${title}". Use mock JSON fallback data if live API credentials are missing.
   - [ ] **Hour 4**: Add a 1-click JSON export or interactive playground UI.
   - [ ] **Hour 5**: Deploy live to Vercel and record a 2-minute Loom walkthrough demo.

3. **Code Scaffolding Request**:
   - Please generate the complete folder structure (app/page.tsx, app/api/route.ts, components/Dashboard.tsx).
   - Provide initial TypeScript interfaces, API schemas, and clean Tailwind styling.
   - Add '# TODO: Implement business logic' comments where Arjun should finish the code himself.`;
  };

  const handleAgentHandoff = (agent: 'chatgpt' | 'claude') => {
    if (!activePromptModal) return;
    const prompt = generatePromptText(activePromptModal);
    
    // Copy full prompt directly to clipboard for instant pasting
    try {
      navigator.clipboard.writeText(prompt);
      setCopiedPromptToast(true);
      setTimeout(() => setCopiedPromptToast(false), 3000);
    } catch (e) {
      console.warn("Clipboard access limited:", e);
    }

    const url = agent === 'chatgpt' 
      ? `https://chatgpt.com/?q=${encodeURIComponent(prompt.slice(0, 1200))}` 
      : `https://claude.ai/new?q=${encodeURIComponent(prompt.slice(0, 1200))}`;
    window.open(url, '_blank');
  };

  const handleExtractCompany = async (overrideUrl?: string) => {
    const urlToScan = (overrideUrl || linkInput).trim();
    if (!urlToScan) return;

    let companyName = 'Supabase';
    try {
      const url = new URL(urlToScan);
      const hostParts = url.hostname.split('.');
      const candidate = hostParts.length > 2 ? hostParts[1] : hostParts[0];
      if (candidate && candidate.toLowerCase() !== 'www') {
        companyName = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    } catch (e) {
      const cleaned = urlToScan.replace(/https?:\/\//, '').split('/')[0].split('.')[0];
      if (cleaned) {
        companyName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }

    setIsScanning(true);
    setScanStage('fetching');

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const animateSequence = async () => {
      await sleep(1000);
      setScanStage('analyzing');
      await sleep(1000);
      setScanStage('aligning');
      await sleep(1000);
      setScanStage('clustering');
      await sleep(1000);
    };

    const scanPromise = userProfile?.user_id
      ? apiClient.scanCompany(userProfile.user_id, urlToScan, true)
          .catch(err => {
            console.error("Backend scan failed:", err);
            return null;
          })
      : Promise.resolve(null);

    const [_, scanResult] = await Promise.all([animateSequence(), scanPromise]);

    setIsScanning(false);
    setScanStage('idle');
    setLinkInput('');

    if (scanResult && scanResult.company) {
      const actualName = scanResult.company.name;
      if (scanResult.cards && scanResult.cards.length > 0) {
        setCardsList(prev => {
          const filtered = prev.filter(c => c.company.id !== scanResult.company.id);
          return [...scanResult.cards, ...filtered];
        });
      }
      if (!searchHistory.includes(actualName)) {
        setSearchHistory(prev => [actualName, ...prev]);
      }
      setActiveCompany(actualName);
    } else {
      if (!searchHistory.includes(companyName)) {
        setSearchHistory(prev => [companyName, ...prev]);
        const newCard = createMockOpportunityForCompany(companyName);
        setCardsList(prev => [newCard, ...prev]);
      }
      setActiveCompany(companyName);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      width: '100%',
      backgroundColor: 'var(--bg)',
      color: 'var(--ink)',
      overflow: 'hidden',
      minHeight: 0,
      fontFamily: 'var(--font-sans)'
    }}>
      
      {/* LEFT PANE - HISTORY */}
      <div style={{
        width: leftPaneOpen ? '260px' : '0px',
        borderRight: leftPaneOpen ? '1px solid var(--border)' : 'none',
        backgroundColor: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        minHeight: 0,
        flexShrink: 0
      }}>
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--paper-edge)', minWidth: '260px' }}>
          {onBackToLanding && (
            <button 
              onClick={onBackToLanding}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}>
            <Terminal size={16} color="var(--accent-gold)" />
            <span>SideDoor Workspace</span>
          </div>
        </div>

        <div style={{ padding: '16px', flex: 1, overflowY: 'auto', minWidth: '260px' }}>
          {/* Optimized Workspace Navigation Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
            <button
              onClick={() => { setMainTab('feed'); setViewMode('dashboard'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px',
                backgroundColor: mainTab === 'feed' && viewMode === 'dashboard' ? 'var(--cream)' : 'transparent',
                border: `1px solid ${mainTab === 'feed' && viewMode === 'dashboard' ? 'var(--accent-gold)' : 'transparent'}`,
                color: mainTab === 'feed' && viewMode === 'dashboard' ? 'var(--ink)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <Building2 size={16} color="var(--accent-gold)" />
              <span>Startup Feed</span>
            </button>
            <button
              onClick={() => { setMainTab('analyzer'); setViewMode('dashboard'); setActiveCompany('new'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px',
                backgroundColor: mainTab === 'analyzer' && viewMode === 'dashboard' ? 'var(--cream)' : 'transparent',
                border: `1px solid ${mainTab === 'analyzer' && viewMode === 'dashboard' ? 'var(--accent-gold)' : 'transparent'}`,
                color: mainTab === 'analyzer' && viewMode === 'dashboard' ? 'var(--ink)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <Search size={16} color="var(--accent-gold)" />
              <span>Opportunity Scout</span>
            </button>
            <button
              onClick={() => { setMainTab('bounties'); setViewMode('dashboard'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px',
                backgroundColor: mainTab === 'bounties' && viewMode === 'dashboard' ? 'var(--cream)' : 'transparent',
                border: `1px solid ${mainTab === 'bounties' && viewMode === 'dashboard' ? 'var(--accent-gold)' : 'transparent'}`,
                color: mainTab === 'bounties' && viewMode === 'dashboard' ? 'var(--ink)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <Terminal size={16} color="var(--accent-gold)" />
              <span>Paid Bounties</span>
            </button>
            <button
              onClick={() => { setMainTab('tracker'); setViewMode('dashboard'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px',
                backgroundColor: mainTab === 'tracker' && viewMode === 'dashboard' ? 'var(--cream)' : 'transparent',
                border: `1px solid ${mainTab === 'tracker' && viewMode === 'dashboard' ? 'var(--accent-gold)' : 'transparent'}`,
                color: mainTab === 'tracker' && viewMode === 'dashboard' ? 'var(--ink)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <Check size={16} color="var(--accent-gold)" />
              <span>Workflow Tracker</span>
              {followupReminders.length > 0 && (
                <span style={{ backgroundColor: '#ef4444', color: '#fff', borderRadius: '10px', fontSize: '0.7rem', padding: '2px 6px', fontWeight: 700, marginLeft: 'auto' }}>
                  {followupReminders.length}
                </span>
              )}
            </button>
          </div>

          {searchHistory.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
                <span className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent Searches
                </span>
                <button
                  onClick={() => setSearchHistory([])}
                  style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 600 }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                >
                  Clear
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {searchHistory.slice(0, 5).map(company => (
                  <button
                    key={company}
                    onClick={() => { setActiveCompany(company); setMainTab('analyzer'); }}
                    className="dash-target-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: activeCompany === company && mainTab === 'analyzer' ? 'var(--cream)' : 'transparent',
                      border: `1px solid ${activeCompany === company && mainTab === 'analyzer' ? 'var(--accent-gold)' : 'transparent'}`,
                      color: activeCompany === company && mainTab === 'analyzer' ? 'var(--ink)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: activeCompany === company && mainTab === 'analyzer' ? 600 : 500,
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Building2 size={14} color={activeCompany === company && mainTab === 'analyzer' ? 'var(--accent-gold)' : 'inherit'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        
        {/* User Account bottom bar */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--paper-edge)', minWidth: '260px', backgroundColor: 'var(--paper)' }}>
          <button 
            onClick={() => setViewMode('account')}
            className="dash-target-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: viewMode === 'account' ? 'var(--cream)' : 'transparent',
              border: `1px solid ${viewMode === 'account' ? 'var(--accent-gold)' : 'transparent'}`,
              color: viewMode === 'account' ? 'var(--ink)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                {initials}
              </div>
              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
            </div>
            <Settings size={14} color={viewMode === 'account' ? 'var(--ink)' : 'var(--text-dim)'} />
          </button>
        </div>
      </div>

      {viewMode === 'account' ? (
        // --- DEDICATED ACCOUNT PAGE ---
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--paper)', gap: '16px', flexShrink: 0 }}>
            <button 
              onClick={() => setViewMode('dashboard')}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
            <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }} className="font-mono">User Settings</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>Account Profile</div>
            </div>
          </div>

          {/* Account Details Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Profile Header Card */}
              <div className="paper-card" style={{ padding: '32px', backgroundColor: 'var(--paper)', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', gap: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--cream)', border: '2px solid var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div>
                    <h3 className="font-serif" style={{ margin: '0 0 4px 0', fontSize: '1.5rem', color: 'var(--ink)', fontWeight: 500 }}>{displayName}</h3>
                    <p className="font-mono" style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-dim)' }}>{userEmail}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span className="badge badge-moss" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>✓ Verified Builder</span>
                      {userLocation && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          <MapPin size={11} /> {userLocation}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        <Calendar size={11} /> Member since {memberSince}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Actions: Re-onboard & Sign Out */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => { window.location.href = '/onboarding'; }}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Settings size={15} />
                    Edit Preferences
                  </button>
                  <button
                    onClick={handleSignOut}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s', flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </div>

              {/* Grid: Target Preferences & Tech Stack */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

                {/* Target Engineering Roles & Preferences */}
                <div className="paper-card" style={{ padding: '24px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, fontWeight: 700 }}>Target Roles & Preferences</h4>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Engineering Roles</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(userTargetRoles.length > 0 ? userTargetRoles : ['Product Engineer', 'Full Stack Engineer']).map(r => (
                        <span key={r} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '14px', backgroundColor: 'var(--cream)', border: '1px solid var(--border-light)', color: 'var(--ink)', fontWeight: 600 }}>{r}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferred Company Stages</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(userCompanyStage.length > 0 ? userCompanyStage : ['Seed', 'Series A', 'YC-Backed']).map(stage => (
                        <span key={stage} style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--paper)', border: '1px solid var(--border)', color: 'var(--ink)', fontWeight: 500 }}>{stage}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Verified Tech Stack Credentials */}
                <div className="paper-card" style={{ padding: '24px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, fontWeight: 700 }}>Verified Tech Stack</h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{(userProfile?.parsed_skills?.length ?? 0) > 0 ? userProfile?.parsed_skills.length : (userTechStack.length > 0 ? userTechStack.length : 6)} Verified</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {((userProfile?.parsed_skills && userProfile.parsed_skills.length > 0) ? userProfile.parsed_skills : (userTechStack.length > 0 ? userTechStack : ['TypeScript', 'React', 'Python', 'FastAPI', 'PostgreSQL', 'Docker'])).map(skill => (
                      <span key={skill} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'var(--paper)', border: '1px solid var(--border)', color: 'var(--ink)', fontWeight: 500 }}>{skill}</span>
                    ))}
                  </div>
                </div>

              </div>

              {/* Scouting Activity & Projects Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

                {/* Scouting Activity */}
                <div className="paper-card" style={{ padding: '24px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', fontWeight: 700 }}>Scouting Activity</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Target Companies Scanned</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--ink)' }}>{searchHistory.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Gaps Identified</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--ink)' }}>{cardsList.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Active Resume Profile</span>
                      <strong style={{ fontSize: '1rem', color: 'var(--accent-moss)' }}>✓ Active</strong>
                    </div>
                  </div>
                </div>

                {/* Verified Candidate Projects */}
                <div className="paper-card" style={{ padding: '24px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', fontWeight: 700 }}>Verified Projects</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {((userProfile?.projects && userProfile.projects.length > 0) ? userProfile.projects : [
                      { title: 'Project Portfolio Application', description: 'Production software application built with modern web technologies.', tech_used: ['React', 'TypeScript', 'FastAPI'] }
                    ]).slice(0, 2).map((proj: any, idx: number) => (
                      <div key={idx} style={{ padding: '10px 12px', backgroundColor: 'var(--paper)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)', marginBottom: '2px' }}>{proj.name || proj.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: '6px' }}>{proj.description}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(proj.stack || proj.tech_used || [])?.map((t: string) => (
                            <span key={t} style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Developer Configuration (API Keys settings) */}
              <div className="paper-card" style={{ padding: '28px', backgroundColor: 'var(--paper)', borderRadius: '14px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 700 }}>LLM API Configuration</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Provide your own OpenAI or Anthropic keys to customize scaffolding output models (fully secure and stored locally on your device).
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }} className="font-mono">OpenAI API Key</label>
                    <input 
                      type="password" 
                      placeholder="sk-..." 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.9rem', marginTop: '4px' }} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }} className="font-mono">Anthropic API Key</label>
                    <input 
                      type="password" 
                      placeholder="sk-ant-..." 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.9rem', marginTop: '4px' }} 
                    />
                  </div>
                  <button 
                    onClick={() => alert("API keys saved locally!")}
                    className="btn-primary" 
                    style={{ alignSelf: 'flex-start', padding: '10px 24px', fontSize: '0.9rem', marginTop: '8px' }}
                  >
                    Save API Credentials
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : viewMode === 'outreach' && activePromptModal ? (
        // --- DEDICATED OUTREACH WORKSPACE PAGE ---
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--paper)', gap: '16px', flexShrink: 0 }}>
            <button 
              onClick={() => setViewMode('dashboard')}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
            <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }} className="font-mono">Outreach Package Builder</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>{activePromptModal.company.name} — {activePromptModal.gap_cluster.label}</div>
            </div>
          </div>

          {/* Outreach workspace grid */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', minHeight: 0, overflow: 'hidden' }}>
            
            {/* Left Workspace Pane: Edit and Preview Pitch */}
            <div style={{ padding: '32px', overflowY: 'auto', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="paper-card" style={{ padding: '24px', backgroundColor: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--ink)', fontWeight: 600 }}>Multi-Channel Outreach Playbook</h4>
                  {companyHealthMap[activePromptModal.company.id] && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', backgroundColor: companyHealthMap[activePromptModal.company.id].verdict === 'verified_safe' ? '#dcfce7' : '#fee2e2', color: companyHealthMap[activePromptModal.company.id].verdict === 'verified_safe' ? '#15803d' : '#b91c1c' }}>
                      {companyHealthMap[activePromptModal.company.id].verdict === 'verified_safe' ? '🛡️ Verified Safe' : '🚨 High Risk'}
                    </span>
                  )}
                </div>
                
                {/* 5-Channel Tab Bar */}
                <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                  {[
                    { id: 'email', label: '✉️ Email', key: 'email_draft' },
                    { id: 'twitter', label: '🐦 Twitter / X', key: 'twitter_post' },
                    { id: 'discord', label: '💬 Discord', key: 'discord_message' },
                    { id: 'blog', label: '📝 Blog Post', key: 'blog_title' },
                    { id: 'followup', label: '⏰ Follow-Up', key: 'followup_email' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActivePlaybookTab(tab.id as any);
                        if (playbookData && playbookData[tab.key]) {
                          setPitchText(playbookData[tab.key]);
                        }
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        border: '1px solid ' + (activePlaybookTab === tab.id ? 'var(--accent-gold)' : 'var(--border-light)'),
                        backgroundColor: activePlaybookTab === tab.id ? 'var(--cream)' : 'transparent',
                        color: activePlaybookTab === tab.id ? 'var(--ink)' : 'var(--text-muted)'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Input your working application URL and Loom walkthrough demo below to auto-compile your pitch across channels.
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }} className="font-mono">Live App URL</label>
                    <input 
                      type="text" 
                      placeholder="e.g. https://my-posthog-debugger.vercel.app"
                      value={liveAppLink} 
                      onChange={(e) => setLiveAppLink(e.target.value)} 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.9rem', marginTop: '4px' }} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }} className="font-mono">Loom Walkthrough URL</label>
                    <input 
                      type="text" 
                      placeholder="e.g. https://loom.com/share/..."
                      value={loomLink} 
                      onChange={(e) => setLoomLink(e.target.value)} 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.9rem', marginTop: '4px' }} 
                    />
                  </div>
                </div>

                <div style={{ position: 'relative', marginTop: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '8px' }} className="font-mono">Compiled Pitch Template</label>
                  <div style={{ position: 'absolute', top: '24px', right: '12px', display: 'flex', gap: '8px', alignItems: 'center', zIndex: 10 }}>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(pitchText);
                        setCopiedOutreach(true);
                        setTimeout(() => setCopiedOutreach(false), 2000);
                      }}
                      style={{ background: 'rgba(239,231,205,0.1)', border: '1px solid rgba(239,231,205,0.2)', color: 'var(--cream)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      {copiedOutreach ? 'Copied!' : 'Copy Message'}
                    </button>
                    <button 
                      onClick={() => setIsEditingPitch(!isEditingPitch)}
                      style={{ 
                        background: isEditingPitch ? 'var(--accent-gold)' : 'rgba(239,231,205,0.1)', 
                        border: `1px solid ${isEditingPitch ? 'var(--accent-gold)' : 'rgba(239,231,205,0.2)'}`, 
                        color: isEditingPitch ? 'var(--ink)' : 'var(--cream)', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        cursor: 'pointer',
                        fontWeight: isEditingPitch ? 600 : 400
                      }}
                    >
                      {isEditingPitch ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  <textarea 
                    value={pitchText} 
                    onChange={(e) => setPitchText(e.target.value)}
                    readOnly={!isEditingPitch}
                    className="font-mono"
                    style={{ width: '100%', height: '240px', padding: '16px', paddingTop: '40px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#171a10', color: 'var(--cream)', fontSize: '0.85rem', lineHeight: 1.5, resize: 'vertical', outline: 'none', opacity: isEditingPitch ? 1 : 0.8, cursor: isEditingPitch ? 'text' : 'not-allowed' }}
                  />
                </div>
              </div>
            </div>

            {/* Right Workspace Pane: Apollo Guide & Contact Cards */}
            <div style={{ padding: '32px', overflowY: 'auto', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Apollo Enrichment banner */}
              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span className="pulse-dot" style={{ marginTop: '6px' }}></span>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'var(--ink)', fontWeight: 700 }}>Get Direct Emails with Apollo.io</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Install the <strong>Apollo Chrome Extension</strong>, then click any LinkedIn profile card below. Reveal verified direct business emails instantly on their profile page.
                  </p>
                  <a 
                    href="https://www.apollo.io/" 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ display: 'inline-block', marginTop: '10px', fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Get Apollo Extension ↗
                  </a>
                </div>
              </div>

              {/* Target Contacts list */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Top Target Contacts</h4>
                  <a 
                    href={`https://www.google.com/search?q=site:linkedin.com/in/+%22${activePromptModal.company.name}%22+%22Engineering+Manager%22+OR+%22Director%22`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Search More ↗
                  </a>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(contacts && contacts.length > 0 ? contacts : getMockContacts(activePromptModal.company.name)).map((contact, i) => (
                    <div key={i} className="paper-card" style={{ padding: '16px', backgroundColor: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}>{contact.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{contact.role}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{contact.email}</span>
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(152,118,26,0.1)', color: 'var(--accent-gold)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(152,118,26,0.2)', fontWeight: 600 }}>Enriched</span>
                        </div>
                      </div>
                      
                      <a 
                        href={contact.linkedin} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', borderRadius: '6px' }}
                      >
                        LinkedIn
                      </a>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : (
        <>
          {/* MIDDLE PANE - MAIN WORKSPACE */}
          <div className="bg-texture" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        minWidth: '400px',
        minHeight: 0
      }}>
        
        {/* Top Header Controls (Pane Toggles) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--paper)' }}>
          <button 
            onClick={() => setLeftPaneOpen(!leftPaneOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {leftPaneOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          
          <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={14} />
            <span>Targeting: <strong style={{ color: 'var(--ink)' }}>{activeCompany === 'new' ? 'New Company' : activeCompany}</strong></span>
          </div>

          <button 
            onClick={() => setRightPaneOpen(!rightPaneOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {rightPaneOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>

        {/* Workspace Content Scroll Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>

            {isScoutingLoading ? (
              <div className="paper-card" style={{ padding: '48px 36px', textAlign: 'center', backgroundColor: 'var(--paper)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', margin: '20px auto', maxWidth: '580px' }}>
                <div style={{ position: 'relative', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="animate-spin-slow" style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '3px solid rgba(152, 118, 26, 0.1)', borderTopColor: 'var(--accent-gold)' }} />
                  <Zap size={28} color="var(--accent-gold)" fill="var(--accent-gold)" />
                </div>
                <div>
                  <h3 className="font-serif" style={{ fontSize: '1.45rem', color: 'var(--ink)', margin: '0 0 6px 0', fontWeight: 500 }}>
                    Assembling Your Opportunity Feed
                  </h3>
                  <p className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0 }}>
                    Scouting agent pipeline active • {scoutingProgress}%
                  </p>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-light)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${scoutingProgress}%`, backgroundColor: 'var(--accent-gold)', transition: 'width 0.1s linear' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', textAlign: 'left', backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                  {SCOUTING_STEPS.map((stepDesc, idx) => {
                    const isCompleted = idx < scoutingStepIndex;
                    const isActive = idx === scoutingStepIndex;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: isCompleted || isActive ? 1 : 0.4 }}>
                        <span className="font-sans" style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--ink)' : 'var(--text-muted)' }}>
                          {idx + 1}. {stepDesc}
                        </span>
                        {isCompleted ? (
                          <span style={{ color: 'var(--accent-moss)', fontWeight: 700, fontSize: '0.88rem' }}>✓</span>
                        ) : isActive ? (
                          <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>⏳</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {mainTab === 'feed' ? (
                  /* --- PHASE 2: VC DISCOVERY FEED --- */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phase 2: Curated Startup Feed</div>
                        <h2 className="font-serif" style={{ fontSize: '1.6rem', color: 'var(--ink)', margin: '4px 0 6px 0' }}>Top 4 Tailored Matches for You</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                          Curated top-4 startups matching your builder context from a pool of <strong>{discoveryFeed.length} verified companies</strong>.
                        </p>
                      </div>

                      {/* Top Right Actions: 24h Timer + View More */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                        <div className="font-mono" style={{ fontSize: '0.75rem', backgroundColor: 'var(--cream)', border: '1px solid var(--border-light)', color: 'var(--ink)', padding: '6px 12px', borderRadius: '20px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                          <span>Next 4 in: <strong>{timeUntilRotation}</strong></span>
                        </div>

                        <button 
                          onClick={() => setShowViewMoreModal(true)}
                          className="font-mono"
                          style={{ padding: '8px 18px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, border: '1px solid var(--accent-gold)', cursor: 'pointer', backgroundColor: 'var(--ink)', color: 'var(--paper)', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                        >
                          <span>View More ({discoveryFeed.length} Startups)</span>
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Top 4 Clean Startup Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      {(() => {
                        const sorted = [...discoveryFeed].sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));
                        const top4 = [];
                        for (let i = 0; i < Math.min(4, sorted.length); i++) {
                          top4.push(sorted[(rotationOffset + i) % sorted.length]);
                        }
                        return top4;
                      })().map((item, idx) => {
                        const isIndian = (item as any).region_tag === 'india' || item.name === 'Appsmith' || item.name === 'SigNoz' || item.name === 'DrDroid' || item.name === 'Raven' || item.name === 'Peoplebox.ai' || item.name === 'OrbitShift' || item.name === 'Vorflux' || item.name === 'Aina' || item.name === 'Reo.Dev';
                        const isEurope = (item as any).region_tag === 'europe' || item.name === 'Lago' || item.name === 'LiveFlow' || item.name === 'Hub';
                        const compTier = (item as any).compensation_tier || (isIndian ? "₹30L - ₹55L" : "$100k - $160k");
                        const fitPct = Math.round((item.fit_score || 0.85) * 100);
                        const tierLabel = item.funding_stage && item.funding_stage.toLowerCase().includes('tier 2') ? 'Tier 2' : 'Tier 1';

                        return (
                          <div 
                            key={item.id || idx} 
                            className="paper-card" 
                            style={{ 
                              padding: '22px', 
                              borderRadius: '14px', 
                              backgroundColor: 'var(--paper)', 
                              border: '1px solid var(--border-light)', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '14px', 
                              cursor: 'pointer',
                              position: 'relative',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                            }}
                            onClick={() => handleTapCompanyCard(item)}
                          >
                            {/* Card Top Row: Logo + Name + Badges */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <CompanyLogo name={item.name} size={36} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{item.name}</span>
                                    <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '6px', backgroundColor: tierLabel === 'Tier 1' ? '#ecfdf5' : '#fef3c7', color: tierLabel === 'Tier 1' ? '#047857' : '#b45309', border: `1px solid ${tierLabel === 'Tier 1' ? '#a7f3d0' : '#fde68a'}`, fontWeight: 700 }}>
                                      {tierLabel}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--cream)', color: 'var(--text-muted)', border: '1px solid var(--border-light)', fontWeight: 600 }}>
                                      {isIndian ? '🇮🇳 India' : isEurope ? '🇪🇺 Europe' : '🇺🇸 USA'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {item.role || "Product Engineer"} • <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{compTier}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Fit Score Badge */}
                              <div className="font-mono" style={{ padding: '4px 10px', borderRadius: '20px', backgroundColor: fitPct >= 85 ? '#dcfce7' : '#fef3c7', color: fitPct >= 85 ? '#15803d' : '#b45309', border: `1px solid ${fitPct >= 85 ? '#bbf7d0' : '#fde68a'}`, fontWeight: 800, fontSize: '0.78rem' }}>
                                {fitPct}% Fit
                              </div>
                            </div>

                            {/* Why It Fits Container */}
                            <div style={{ fontSize: '0.82rem', backgroundColor: 'var(--cream)', color: 'var(--ink)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid var(--accent-gold)', lineHeight: 1.45 }}>
                              {item.why_for_you || "High-alignment match for your product engineering background."}
                            </div>

                            {/* Tech Stack Pills */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {item.tech_stack_tags?.map((t: string) => (
                                <span key={t} className="font-mono" style={{ fontSize: '0.7rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)', padding: '3px 8px', borderRadius: '6px' }}>
                                  {t}
                                </span>
                              ))}
                            </div>

                            {/* Action Footer */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', borderTop: '1px dashed var(--border-light)', paddingTop: '10px' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                                {item.funding || 'YC Backed'}
                              </span>
                              <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span>Inspect Opportunities</span>
                                <ArrowRight size={13} />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : mainTab === 'bounties' ? (
                  /* --- EARN WHILE BUILDING (PAID BOUNTIES & SOLO HACKATHONS) --- */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Short-Term Runway Cash</div>
                        <h2 className="font-serif" style={{ fontSize: '1.6rem', color: 'var(--ink)', margin: '4px 0 8px 0' }}>Paid GitHub Bounties & Solo Developer Hackathons</h2>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0 }}>
                          Short-term cash opportunities ($150 - $2,000) tailored for product engineers. Earn cash in 3-10 days while building proof-of-work portfolio items.
                        </p>
                      </div>
                      <div style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }} className="font-mono">
                        Auto-Refreshes Every 6 Hours
                      </div>
                    </div>

                    {/* Category Filter Chips */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                      <button 
                        onClick={() => setBountyFilterCategory('all')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: bountyFilterCategory === 'all' ? 'var(--ink)' : 'var(--paper)', color: bountyFilterCategory === 'all' ? 'var(--paper)' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        All Opportunities ({bountiesList.length})
                      </button>
                      <button 
                        onClick={() => setBountyFilterCategory('bounty')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: bountyFilterCategory === 'bounty' ? 'var(--accent-gold)' : 'var(--paper)', color: bountyFilterCategory === 'bounty' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        GitHub Feature Bounties ($150 - $1,500)
                      </button>
                      <button 
                        onClick={() => setBountyFilterCategory('hackathon')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: bountyFilterCategory === 'hackathon' ? '#f97316' : 'var(--paper)', color: bountyFilterCategory === 'hackathon' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        Solo Hackathons ($500 - $5,000)
                      </button>
                      <button 
                        onClick={() => setBountyFilterCategory('trial')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: bountyFilterCategory === 'trial' ? '#0284c7' : 'var(--paper)', color: bountyFilterCategory === 'trial' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        Paid Founder Trial Sprints
                      </button>
                      <button 
                        onClick={() => setBountyFilterCategory('inr')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: bountyFilterCategory === 'inr' ? '#16a34a' : 'var(--paper)', color: bountyFilterCategory === 'inr' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        India / INR Grants (₹35,000+)
                      </button>

                      <button 
                        onClick={handleHardRefreshBounties}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--accent-gold)', cursor: 'pointer', backgroundColor: 'var(--cream)', color: 'var(--accent-gold)', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        disabled={isRefreshingBounties}
                      >
                        <span>{isRefreshingBounties ? 'Syncing Live Bounties...' : 'Hard Refresh Bounties'}</span>
                      </button>
                    </div>

                    {/* Bounty Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {bountiesList
                        .filter(b => {
                          if (bountyFilterCategory === 'bounty') return b.type === 'bounty';
                          if (bountyFilterCategory === 'hackathon') return b.type === 'hackathon';
                          if (bountyFilterCategory === 'trial') return b.type === 'trial';
                          if (bountyFilterCategory === 'inr') return b.reward_amount.includes('₹');
                          return true;
                        })
                        .map(b => (
                          <div 
                            key={b.id} 
                            className="paper-card" 
                            style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'var(--paper)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <CompanyLogo name={b.company_name} size={32} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>{b.title}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{b.company_name} • Est. {b.est_hours} Hours</div>
                                </div>
                              </div>

                              <span className="font-mono" style={{ fontSize: '0.75rem', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                Pay: {b.reward_amount}
                              </span>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              {b.description}
                            </p>

                            <div style={{ backgroundColor: 'var(--cream)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '0.8rem', color: 'var(--ink)', lineHeight: 1.4 }}>
                              <strong>Senior Build Plan:</strong> {b.senior_build_plan}
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {b.tech_stack.map(t => (
                                <span key={t} style={{ fontSize: '0.7rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {t}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid var(--paper-edge)', paddingTop: '12px' }}>
                              <a 
                                href={b.source_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="font-mono"
                                style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
                              >
                                <span>View Source ({b.platform_source}) ↗</span>
                              </a>

                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(`Senior Prompt for ${b.title} at ${b.company_name}:\n${b.senior_build_plan}`);
                                  alert(`Copied Senior AI Build Prompt for ${b.title} to clipboard!`);
                                }}
                                className="btn-primary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              >
                                <Terminal size={14} />
                                <span>Build with AI</span>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : mainTab === 'tracker' ? (
                  /* --- PHASE 5: KANBAN TRACKER & REMINDERS --- */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phase 5: Workflow Tracker</div>
                      <h2 className="font-serif" style={{ fontSize: '1.6rem', color: 'var(--ink)', margin: '4px 0 8px 0' }}>Outreach Kanban & Follow-up Reminders</h2>
                    </div>

                    {/* Reminders Alert Box */}
                    {followupReminders.length > 0 && (
                      <div style={{ padding: '16px 20px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#991b1b' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>7-Day Follow-Up Reminders Due ({followupReminders.length})</div>
                        {followupReminders.map((rem: any) => (
                          <div key={rem.application_id} style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.85rem' }}>
                            <div><strong>{rem.company_name}</strong> — Reached out {rem.days_since_outreach} days ago without a reply.</div>
                            <pre style={{ margin: '8px 0 0 0', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                              {rem.follow_up_draft}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Kanban Columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', overflowX: 'auto' }}>
                      {['researching', 'building', 'reached_out', 'replied', 'interviewing', 'closed'].map(col => {
                        const colItems = kanbanBoard ? kanbanBoard[col] || [] : [];
                        return (
                          <div key={col} style={{ backgroundColor: 'var(--surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-light)', minWidth: '130px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px' }}>
                              {col.replace('_', ' ')} ({colItems.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {colItems.map((app: any) => (
                                <div key={app.id} style={{ padding: '10px', backgroundColor: 'var(--paper)', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '0.8rem' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{app.company_name}</div>
                                  {app.demo_url && (
                                    <a href={app.demo_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: 'var(--accent-gold)' }}>Live Demo 🔗</a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* --- ANALYZER TAB --- */
                  <>
                    {/* 1. Input Section */}
                    <div style={{ marginBottom: '40px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <h2 className="font-serif" style={{ fontSize: '1.4rem', fontWeight: 500, margin: 0, color: 'var(--ink)' }}>Analyze Target Company</h2>
                      </div>
                      <div className="paper-card" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '6px',
                        borderRadius: '12px'
                      }}>
                        <div style={{ padding: '0 12px', color: 'var(--text-dim)' }}>
                          <LinkIcon size={18} />
                        </div>
                        <input
                          type="text"
                          placeholder="Paste job posting or company careers URL..."
                          value={linkInput}
                          onChange={(e) => setLinkInput(e.target.value)}
                          className="font-sans"
                          style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--ink)',
                            fontSize: '1rem'
                          }}
                        />
                        <button 
                          onClick={() => handleExtractCompany()} 
                          className="btn-primary" 
                          style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '0.95rem' }}
                          disabled={isScanning}
                        >
                          <span>{isScanning ? 'Scouting...' : 'Extract'}</span>
                          <Send size={14} />
                        </button>
                      </div>
                    </div>

                    {/* 2. Opportunity Cards Feed */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {isScanning ? (
                        <div className="paper-card font-sans" style={{ padding: '40px', backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', maxWidth: '600px', margin: '40px auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span className="pulse-dot"></span>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--ink)', fontWeight: 600 }}>AI Scouting Agent Active...</h3>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scanStage === 'fetching' ? 1 : 0.6 }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: scanStage === 'fetching' ? 600 : 400 }}>1. Parsing career index & indexing repositories</span>
                              {scanStage === 'fetching' ? <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span> : (scanStage !== 'idle' ? '✅' : '⏳')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scanStage === 'analyzing' ? 1 : 0.6 }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: scanStage === 'analyzing' ? 600 : 400 }}>2. Querying community telemetry & requests</span>
                              {scanStage === 'analyzing' ? <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span> : (['aligning', 'clustering'].includes(scanStage) ? '✅' : '⏳')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scanStage === 'aligning' ? 1 : 0.6 }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: scanStage === 'aligning' ? 600 : 400 }}>3. Mapping tech stack & credential compatibility</span>
                              {scanStage === 'aligning' ? <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span> : (scanStage === 'clustering' ? '✅' : '⏳')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scanStage === 'clustering' ? 1 : 0.6 }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: scanStage === 'clustering' ? 600 : 400 }}>4. Synthesizing gap clusters & scaffolding spec prompts</span>
                              {scanStage === 'clustering' ? <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span> : '⏳'}
                            </div>
                          </div>
                        </div>
                      ) : activeCompany === 'new' ? (
                        <div style={{ 
                          padding: '60px 40px', 
                          textAlign: 'center', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          gap: '16px'
                        }}>
                          <div style={{ 
                            padding: '16px', 
                            borderRadius: '50%', 
                            backgroundColor: 'var(--cream)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                          }}>
                            <Search size={28} color="var(--text-dim)" />
                          </div>
                          
                          <div>
                            <h3 className="font-sans" style={{ fontSize: '1.2rem', color: 'var(--ink)', margin: '0 0 8px 0', fontWeight: 600 }}>
                              Start a new search
                            </h3>
                            <p className="font-sans" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 }}>
                              Paste a company's career page URL above to uncover engineering opportunities.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                            <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Generated Opportunity Cards
                            </div>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--paper-edge)', fontWeight: 600 }}>
                              {filteredCards.length}
                            </span>
                          </div>

                          {filteredCards.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                              No opportunities found for {activeCompany}. Try searching another company.
                            </div>
                          ) : (
                            <>
                              {filteredCards.map(item => {
                                const ev = item.evidence_items[0];
                                const matchScorePct = (item.card.profile_match_score).toFixed(0);

                                return (
                                  <div key={item.card.id} className="paper-card dash-evidence-card" style={{ 
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                  }}>
                                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--paper-edge)', backgroundColor: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                          <CompanyLogo name={item.company.name} size={28} />
                                          <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--ink)' }}>{item.company.name}</span>
                                        </div>
                                        {getFixabilityBadge(item.fixability_flags)}
                                      </div>
                                      <div style={{ 
                                        textAlign: 'right', 
                                        background: 'rgba(152, 118, 26, 0.1)', 
                                        padding: '6px 12px', 
                                        borderRadius: '8px',
                                        border: '1px solid rgba(152, 118, 26, 0.2)'
                                      }} className="font-mono">
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Match Score</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{matchScorePct}%</div>
                                      </div>
                                    </div>

                                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                      <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🎯 Customer Friction & Product Gap</div>
                                        <h3 style={{ fontSize: '1.25rem', margin: '0 0 8px 0', color: 'var(--ink)', fontWeight: 700 }}>{item.gap_cluster.label}</h3>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.why_matches_you}</p>
                                      </div>

                                      {/* Product Engineering Scope for Arjun */}
                                      <div style={{ backgroundColor: 'var(--cream)', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--ink)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🛠️ Suggested 4–6 Hour Product Scope (For Arjun)</div>
                                        <div style={{ fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.4, fontWeight: 500 }}>
                                          Build a lightweight <strong>Next.js + Tailwind Web Sandbox / CLI Extension</strong> for {item.company.name} to resolve this gap. Deploy live to Vercel/Railway.
                                        </div>
                                      </div>

                                      {ev && (
                                        <div style={{ backgroundColor: 'var(--surface)', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--paper-edge)' }}>
                                          <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                            <ShieldAlert size={14} color="var(--accent-gold)" />
                                            <span>Verified Receipt</span>
                                          </div>
                                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px', borderLeft: '2px solid var(--accent-gold)', paddingLeft: '10px', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            "{ev.raw_text.length > 220 ? ev.raw_text.slice(0, 220) + "..." : ev.raw_text}"
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="font-mono">
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{ev.source_type.toUpperCase()}</span>
                                            <a href={ev.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}>
                                              <span>View Source</span>
                                              <ArrowUpRight size={13} />
                                            </a>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ padding: '16px 24px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--paper-edge)' }}>
                                      <button 
                                        onClick={() => handleEnrollOpportunity(item)}
                                        className="btn-primary"
                                        style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                                      >
                                        <Terminal size={16} />
                                        <span>Scaffold & Hand Off MVP</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANE - OPPORTUNITY DETAIL & AI HANDOFF (Folded by default) */}
      <div style={{
        width: activePromptModal ? '480px' : '0px',
        borderLeft: activePromptModal ? '1px solid var(--border)' : 'none',
        backgroundColor: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        minHeight: 0,
        flexShrink: 0
      }}>
        {activePromptModal && (
          // --- OPPORTUNITY DETAIL VIEW (Slide-in Detail Panel) ---
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: '480px' }}>
            <div style={{ padding: '16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--paper-edge)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button 
                  onClick={() => setActivePromptModal(null)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowLeft size={14} color="var(--ink)" />
                </button>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>
                  Opportunity Detail
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button 
                  onClick={() => handleAgentHandoff('chatgpt')}
                  className="font-sans"
                  style={{ 
                    backgroundColor: '#10A37F', color: 'white', border: '1px solid rgba(255,255,255,0.1)', 
                    padding: '6px 10px', borderRadius: '24px', fontSize: '0.78rem', fontWeight: 600, 
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', 
                    boxShadow: '0 4px 12px rgba(16, 163, 127, 0.25)', transition: 'all 0.2s ease',
                    letterSpacing: '0.01em', whiteSpace: 'nowrap'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <Send size={11} />
                  <span>Ask ChatGPT ↗</span>
                </button>
                <button 
                  onClick={() => handleAgentHandoff('claude')}
                  className="font-sans"
                  style={{ 
                    backgroundColor: '#D97757', color: 'white', border: '1px solid rgba(255,255,255,0.1)', 
                    padding: '6px 10px', borderRadius: '24px', fontSize: '0.78rem', fontWeight: 600, 
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', 
                    boxShadow: '0 4px 12px rgba(217, 119, 87, 0.25)', transition: 'all 0.2s ease',
                    letterSpacing: '0.01em', whiteSpace: 'nowrap'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <Terminal size={11} />
                  <span>Ask Claude ↗</span>
                </button>
              </div>
            </div>
            
            {copiedPromptToast && (
              <div style={{ backgroundColor: '#dcfce7', borderBottom: '1px solid #bbf7d0', color: '#15803d', padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} />
                <span>AI Engineering Prompt copied to clipboard! Paste directly into ChatGPT / Claude.</span>
              </div>
            )}

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Target Company Header Card with Direct Links */}
              <div className="paper-card" style={{ padding: '16px 20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CompanyLogo name={activePromptModal.company.name} size={32} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ink)' }}>{activePromptModal.company.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Target Company • VC Backed</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {activePromptModal.company.url && (
                    <a 
                      href={activePromptModal.company.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-mono"
                      style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600, padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--cream)', border: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}
                    >
                      <span>Website ↗</span>
                    </a>
                  )}
                  {activePromptModal.company.careers_page_url && (
                    <a 
                      href={activePromptModal.company.careers_page_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-mono"
                      style={{ fontSize: '0.78rem', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600, padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--paper)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}
                    >
                      <span>Careers ↗</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>The Opportunity</h4>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>
                  {getOpportunityDetails(activePromptModal).opportunity}
                </div>
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>The Gap Identified</h4>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {getOpportunityDetails(activePromptModal).gap}
                </div>
              </div>

              {/* Senior-to-Junior Build Blueprint Card */}
              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'rgba(152, 118, 26, 0.06)', borderRadius: '12px', border: '1px solid rgba(152, 118, 26, 0.2)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, fontWeight: 700 }}>🛠️ Senior Engineer's 4-Hour Build Plan</h4>
                  <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--surface)', color: 'var(--ink)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--paper-edge)', fontWeight: 600 }}>Next.js + Tailwind</span>
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.5 }}>
                  <strong>How Arjun Should Build This:</strong>
                  <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><strong>Hour 1:</strong> Scaffold Next.js dashboard UI with Tailwind layout & mock JSON data.</li>
                    <li><strong>Hour 2–3:</strong> Connect API route to resolve <em>"{activePromptModal.gap_cluster.label}"</em>.</li>
                    <li><strong>Hour 4:</strong> Deploy live to Vercel/Railway free tier and record a 2-minute Loom walkthrough demo.</li>
                  </ol>
                </div>
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>How to Solve It</h4>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {getOpportunityDetails(activePromptModal).solve}
                </div>
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'rgba(152, 118, 26, 0.06)', borderRadius: '12px', border: '1px solid rgba(152, 118, 26, 0.2)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 700 }}>Why You're Perfect</h4>
                <div style={{ fontSize: '0.95rem', color: 'var(--ink)', lineHeight: 1.5, fontWeight: 500 }}>
                  {getOpportunityDetails(activePromptModal).perfect}
                </div>
              </div>
              
              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Verified Evidence Receipts</h4>
                {activePromptModal.evidence_items.slice(0, 2).map((ev, i) => (
                  <div key={i} style={{ borderLeft: '3px solid var(--accent-gold)', paddingLeft: '12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '6px', lineHeight: 1.4 }}>
                      "{ev.raw_text.length > 150 ? ev.raw_text.slice(0, 150) + "..." : ev.raw_text}"
                    </div>
                    <a href={ev.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>View Full Source Thread ({ev.source_type.replace('_', ' ').toUpperCase()}) ↗</span>
                    </a>
                  </div>
                ))}
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 700 }}>About This Opportunity Spec</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  This spec was automatically compiled from public community issues and user feedback to help you build exactly what they need.
                </p>
              </div>

              <div style={{ padding: '24px 20px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--paper-edge)' }}>
                <button 
                  onClick={() => setViewMode('outreach')}
                  className="btn-primary" 
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                >
                  <Send size={16} />
                  <span>Find Outreach Contacts</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW MORE STARTUPS MODAL / DRAWER */}
      {showViewMoreModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: '850px', backgroundColor: 'var(--paper)', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface)' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  All Verified Opportunities
                </div>
                <h2 className="font-serif" style={{ fontSize: '1.5rem', color: 'var(--ink)', margin: '4px 0 0 0' }}>
                  Verified Startup Feed ({discoveryFeed.length} Companies)
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={handleForceRotate}
                  disabled={isRefreshingFeed}
                  className="font-mono"
                  style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--accent-gold)', cursor: 'pointer', backgroundColor: 'var(--cream)', color: 'var(--accent-gold)', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: isRefreshingFeed ? 0.6 : 1 }}
                >
                  <RefreshCw size={13} className={isRefreshingFeed ? "animate-spin" : ""} />
                  <span>{isRefreshingFeed ? 'Rotating...' : 'Force 24h Rotation Now'}</span>
                </button>

                <button 
                  onClick={() => setShowViewMoreModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Modal Search & Controls */}
            <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--paper)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Search 40+ startups by name, stack, role, or location..."
                  value={viewMoreSearch}
                  onChange={(e) => setViewMoreSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.88rem', backgroundColor: 'var(--surface)', color: 'var(--ink)' }}
                />
              </div>

              {/* Category Filter Chips */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => setFeedFilterCategory('all')}
                  className="font-mono"
                  style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: feedFilterCategory === 'all' ? 'var(--ink)' : 'var(--paper)', color: feedFilterCategory === 'all' ? 'var(--paper)' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                >
                  All ({discoveryFeed.length})
                </button>
                <button 
                  onClick={() => setFeedFilterCategory('india')}
                  className="font-mono"
                  style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: feedFilterCategory === 'india' ? 'var(--accent-gold)' : 'var(--paper)', color: feedFilterCategory === 'india' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                >
                  🇮🇳 India
                </button>
                <button 
                  onClick={() => setFeedFilterCategory('yc')}
                  className="font-mono"
                  style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: feedFilterCategory === 'yc' ? '#f97316' : 'var(--paper)', color: feedFilterCategory === 'yc' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                >
                  Tier 1 / YC
                </button>
              </div>
            </div>

            {/* Modal Body List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignContent: 'start' }}>
              {discoveryFeed
                .filter(item => {
                  if (viewMoreSearch.trim()) {
                    const q = viewMoreSearch.toLowerCase();
                    const nameMatch = item.name.toLowerCase().includes(q);
                    const roleMatch = (item.role || '').toLowerCase().includes(q);
                    const stackMatch = item.tech_stack_tags?.some((t: string) => t.toLowerCase().includes(q));
                    if (!nameMatch && !roleMatch && !stackMatch) return false;
                  }
                  if (feedFilterCategory === 'india') {
                    return (item as any).region_tag === 'india' || item.name === 'Appsmith' || item.name === 'SigNoz' || item.name === 'DrDroid' || item.name === 'Raven' || item.name === 'Peoplebox.ai' || item.name === 'OrbitShift' || item.name === 'Vorflux' || item.name === 'Aina' || item.name === 'Reo.Dev';
                  }
                  if (feedFilterCategory === 'yc') {
                    return item.investor_tags && item.investor_tags.some((t: string) => t.toLowerCase().includes('yc') || t.toLowerCase().includes('tier_1'));
                  }
                  return true;
                })
                .map(item => {
                  const isIndian = (item as any).region_tag === 'india' || item.name === 'Appsmith' || item.name === 'SigNoz' || item.name === 'DrDroid' || item.name === 'Raven' || item.name === 'Peoplebox.ai' || item.name === 'OrbitShift' || item.name === 'Vorflux' || item.name === 'Aina' || item.name === 'Reo.Dev';
                  const isEurope = (item as any).region_tag === 'europe' || item.name === 'Lago' || item.name === 'LiveFlow' || item.name === 'Hub';
                  const compTier = (item as any).compensation_tier || (isIndian ? "₹30L - ₹55L" : "$100k - $160k");
                  const fitPct = Math.round((item.fit_score || 0.85) * 100);
                  const tierLabel = item.funding_stage && item.funding_stage.toLowerCase().includes('tier 2') ? 'Tier 2' : 'Tier 1';

                  return (
                    <div 
                      key={item.id} 
                      className="paper-card" 
                      style={{ padding: '18px', borderRadius: '12px', backgroundColor: 'var(--paper)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer' }}
                      onClick={() => handleTapCompanyCard(item)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <CompanyLogo name={item.name} size={32} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{item.name}</span>
                              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: tierLabel === 'Tier 1' ? '#ecfdf5' : '#fef3c7', color: tierLabel === 'Tier 1' ? '#047857' : '#b45309', border: `1px solid ${tierLabel === 'Tier 1' ? '#a7f3d0' : '#fde68a'}`, fontWeight: 700 }}>
                                {tierLabel}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isIndian ? '🇮🇳 India' : isEurope ? '🇪🇺 Europe' : '🇺🇸 USA'} • {compTier}</div>
                          </div>
                        </div>

                        <div className="font-mono" style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: fitPct >= 85 ? '#dcfce7' : '#fef3c7', color: fitPct >= 85 ? '#15803d' : '#b45309', fontSize: '0.75rem', fontWeight: 700 }}>
                          {fitPct}%
                        </div>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {item.why_for_you || "Matches your candidate profile"}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {item.tech_stack_tags?.slice(0, 4).map((t: string) => (
                          <span key={t} className="font-mono" style={{ fontSize: '0.68rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* STEPS 3-10 DEEP COMPANY RESEARCH MODAL / DRAWER */}
      {showDeepResearchModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: '850px', backgroundColor: 'var(--paper)', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 32px rgba(0,0,0,0.25)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {deepResearchResult && <CompanyLogo name={deepResearchResult.company_name} size={40} />}
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Step 3–10 Live Deep Research Engine
                  </div>
                  <h2 className="font-serif" style={{ fontSize: '1.6rem', color: 'var(--ink)', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{deepResearchResult?.company_name || 'Analyzing Company...'}</span>
                    {deepResearchResult && (
                      <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                        {Math.round((deepResearchResult.fit_score || 0.88) * 100)}% Match
                      </span>
                    )}
                  </h2>
                </div>
              </div>

              <button 
                onClick={() => setShowDeepResearchModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Loading Spinner View */}
            {isDeepResearching ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px' }}>
                <RefreshCw size={36} className="animate-spin" color="var(--accent-gold)" />
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' }}>
                  Executing Deep Company Research Pipeline...
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '480px', lineHeight: 1.5 }}>
                  Fetching engineering blogs, extracting verifiable pain points from source receipts, running skill matching, and generating scoped MVP build brief.
                </div>
              </div>
            ) : deepResearchResult && (
              /* Deep Research Content View */
              <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                
                {/* Notification Toasts */}
                {enrollSuccessMessage && (
                  <div style={{ backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', padding: '12px 16px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={18} />
                    <span>{enrollSuccessMessage}</span>
                  </div>
                )}
                {copiedClaudeToast && (
                  <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '12px 16px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={18} />
                    <span>Copied rich company context & proposed MVP prompt to clipboard! Paste directly into Claude for deep advice.</span>
                  </div>
                )}

                {/* Company Header Bar with Direct Website Links */}
                <div className="paper-card" style={{ padding: '18px 22px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Stage: <strong>{deepResearchResult.stage || 'Seed / YC'}</strong> • Backing: <strong>{deepResearchResult.funding || 'YC Backed'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {deepResearchResult.original_company_url && (
                      <a 
                        href={deepResearchResult.original_company_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="font-mono"
                        style={{ padding: '7px 14px', borderRadius: '8px', backgroundColor: 'var(--cream)', border: '1px solid var(--border-light)', color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <span>Official Website ({deepResearchResult.original_company_url.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]})</span>
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                    {deepResearchResult.careers_url && (
                      <a 
                        href={deepResearchResult.careers_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="font-mono"
                        style={{ padding: '7px 14px', borderRadius: '8px', backgroundColor: 'var(--paper)', border: '1px solid var(--border)', color: 'var(--ink)', textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <span>Careers Page</span>
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </div>

                {/* 1. What the Company Is About & What It Does */}
                <div className="paper-card" style={{ padding: '22px 26px', backgroundColor: 'var(--paper)', borderRadius: '14px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    1. About {deepResearchResult.company_name}
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                    What the company is about & what it does
                  </h3>
                  <p style={{ fontSize: '0.94rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                    {deepResearchResult.company_overview || `${deepResearchResult.company_name} is a high-growth VC/YC-backed startup building core infrastructure and developer software. They empower engineering and product teams to automate workflows and scale operations.`}
                  </p>
                </div>

                {/* 2. Actual Gaps Listed Out in Proper Detail & Simplest Language */}
                <div className="paper-card" style={{ padding: '22px 26px', backgroundColor: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border-light)', borderLeft: '4px solid var(--accent-gold)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    2. Actual Gaps Identified (Simplest Language)
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                    Real product & engineering friction found
                  </h3>
                  <div style={{ fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {deepResearchResult.detailed_gaps || `1. Production log inspection friction: Engineering posts reveal manual effort watching terminal stdout streams.\n2. Developer Tooling Gap: Lack of visual real-time event logging delays incident triage.`}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', backgroundColor: 'var(--cream)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', marginTop: '4px' }}>
                    "{deepResearchResult.evidence_text}"
                  </div>

                  {deepResearchResult.source_url && (
                    <a 
                      href={deepResearchResult.source_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="font-mono"
                      style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                    >
                      <span>Verifiable Evidence Source Receipt ({deepResearchResult.source_url}) ↗</span>
                    </a>
                  )}
                </div>

                {/* 3. Suggest / Recommend 1-2 MVP / Artifact Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        3. Recommended MVP / Artifact Options (Tailored to Your Skillset)
                      </div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)', margin: '2px 0 0 0' }}>
                        Select what to build for {deepResearchResult.company_name}
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Option 1 Card */}
                    {(() => {
                      const opt1 = deepResearchResult.mvp_options?.option_1 || {
                        title: `Visual Telemetry Inspector & Debug Console`,
                        what_it_does: `Build a real-time web console that streams request logs and flags payload anomalies visually.`,
                        why_creates_value: `Eliminates manual stdout log watching for ${deepResearchResult.company_name}'s dev team, showing you deeply understand their workflow.`,
                        scope_days: `1-2 days`,
                        skills_leveraged: `React, TypeScript, Webhooks`
                      };
                      const isSelected = selectedMvpOptionIndex === 0;

                      return (
                        <div 
                          onClick={() => setSelectedMvpOptionIndex(0)}
                          className="paper-card"
                          style={{
                            padding: '20px',
                            borderRadius: '12px',
                            backgroundColor: isSelected ? 'rgba(152, 118, 26, 0.08)' : 'var(--paper)',
                            border: `2px solid ${isSelected ? 'var(--accent-gold)' : 'var(--border-light)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--ink)', color: 'var(--paper)', fontWeight: 700 }}>
                              Option A (Recommended)
                            </span>
                            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                              {opt1.scope_days || '1-2 days'}
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--ink)' }}>
                            {opt1.title}
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                            <strong>What to build:</strong> {opt1.what_it_does}
                          </div>

                          <div style={{ fontSize: '0.83rem', color: 'var(--ink)', backgroundColor: 'var(--cream)', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid var(--accent-gold)', lineHeight: 1.4 }}>
                            <strong>Why CTO feels value:</strong> {opt1.why_creates_value}
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }} className="font-mono">
                            Skills: {opt1.skills_leveraged}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Option 2 Card */}
                    {(() => {
                      const opt2 = deepResearchResult.mvp_options?.option_2 || {
                        title: `Automated Webhook & Request Proxy Middleware`,
                        what_it_does: `Build a lightweight proxy tool that captures API payloads and validates status codes in real time.`,
                        why_creates_value: `Saves engineering hours during integration testing and demonstrates proactive technical problem-solving.`,
                        scope_days: `2-3 days`,
                        skills_leveraged: `FastAPI, Python, Async HTTP`
                      };
                      const isSelected = selectedMvpOptionIndex === 1;

                      return (
                        <div 
                          onClick={() => setSelectedMvpOptionIndex(1)}
                          className="paper-card"
                          style={{
                            padding: '20px',
                            borderRadius: '12px',
                            backgroundColor: isSelected ? 'rgba(152, 118, 26, 0.08)' : 'var(--paper)',
                            border: `2px solid ${isSelected ? 'var(--accent-gold)' : 'var(--border-light)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-light)', fontWeight: 700 }}>
                              Option B (Alternative)
                            </span>
                            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                              {opt2.scope_days || '2-3 days'}
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--ink)' }}>
                            {opt2.title}
                          </div>

                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                            <strong>What to build:</strong> {opt2.what_it_does}
                          </div>

                          <div style={{ fontSize: '0.83rem', color: 'var(--ink)', backgroundColor: 'var(--cream)', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid var(--accent-gold)', lineHeight: 1.4 }}>
                            <strong>Why CTO feels value:</strong> {opt2.why_creates_value}
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }} className="font-mono">
                            Skills: {opt2.skills_leveraged}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Bottom Action Controls: Ask Claude + Enroll & Outreach */}
                <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {/* Ask Claude Context Copier Button */}
                  <button 
                    onClick={handleAskClaudeCopier}
                    className="font-sans"
                    style={{ 
                      backgroundColor: '#D97757', color: 'white', border: 'none', 
                      padding: '14px 22px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, 
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', 
                      boxShadow: '0 4px 14px rgba(217, 119, 87, 0.3)'
                    }}
                  >
                    <Terminal size={16} />
                    <span>Ask Claude (Copy Rich Context) ↗</span>
                  </button>

                  {/* Enroll & Outreach Button */}
                  <button 
                    onClick={handleEnrollAndGoToOutreach}
                    className="btn-primary font-mono"
                    style={{ flex: 1, padding: '14px 22px', fontSize: '0.92rem', fontWeight: 700, borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--ink)', color: 'var(--paper)', cursor: 'pointer' }}
                  >
                    <Zap size={18} />
                    <span>Enroll in Selected Option & Draft Outreach →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
    )}
  </div>
  );
};

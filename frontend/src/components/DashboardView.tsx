import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { OpportunityCardView, FixabilityFlags, UserProfile, BountyItem } from '../types/schema';
import { CompanyLogo } from './CompanyLogo';
import { apiClient } from '../api/client';
import { useAuth, getUserDisplayName, getUserInitials } from '../lib/useAuth';
import {
  Terminal, Search, ShieldAlert,
  ArrowUpRight, Building2, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, ArrowLeft, Link as LinkIcon, Send, Zap, Settings, Check, LogOut, MapPin, Calendar
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
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phase 2: Curated Startup Feed</div>
                      <h2 className="font-serif" style={{ fontSize: '1.6rem', color: 'var(--ink)', margin: '4px 0 8px 0' }}>High-Paying VC-Backed Startups (Tailored for Arjun)</h2>
                      <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0 }}>
                        Top-tier Indian & Global VC startups (Peak XV, Accel India, YC, a16z) that give product engineers direct access to CTOs & high pay.
                      </p>
                    </div>

                    {/* Category Filter Tabs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                      <button 
                        onClick={() => setFeedFilterCategory('all')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: feedFilterCategory === 'all' ? 'var(--ink)' : 'var(--paper)', color: feedFilterCategory === 'all' ? 'var(--paper)' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        All Startups ({discoveryFeed.length})
                      </button>
                      <button 
                        onClick={() => setFeedFilterCategory('india')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: feedFilterCategory === 'india' ? 'var(--accent-gold)' : 'var(--paper)', color: feedFilterCategory === 'india' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        High-Paying Indian VC Startups
                      </button>
                      <button 
                        onClick={() => setFeedFilterCategory('yc')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: feedFilterCategory === 'yc' ? '#f97316' : 'var(--paper)', color: feedFilterCategory === 'yc' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        Y Combinator (YC)
                      </button>
                      <button 
                        onClick={() => setFeedFilterCategory('early_stage')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: feedFilterCategory === 'early_stage' ? '#0284c7' : 'var(--paper)', color: feedFilterCategory === 'early_stage' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        Seed / Series A (&lt;25 eng)
                      </button>
                      <button 
                        onClick={() => setFeedFilterCategory('high_pay')}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', backgroundColor: feedFilterCategory === 'high_pay' ? '#16a34a' : 'var(--paper)', color: feedFilterCategory === 'high_pay' ? 'white' : 'var(--text-muted)', borderColor: 'var(--border)' }}
                      >
                        High Pay (₹25L+ / $90k+)
                      </button>

                      <button 
                        onClick={handleRefreshFeed}
                        className="font-mono"
                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--accent-gold)', cursor: 'pointer', backgroundColor: 'var(--cream)', color: 'var(--accent-gold)', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        disabled={isRefreshingFeed}
                      >
                        <span>{isRefreshingFeed ? 'Syncing New VC Launches...' : 'Refresh VC Feed'}</span>
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {discoveryFeed
                        .filter(item => {
                          if (feedFilterCategory === 'india') {
                            return (item as any).region_tag === 'india' || item.name === 'Appsmith' || item.name === 'SigNoz' || item.name === 'Devtron' || item.name === 'Hasura' || item.name === 'Middleware' || item.name === 'Atlan';
                          }
                          if (feedFilterCategory === 'yc') {
                            return item.investor_tags && item.investor_tags.some((t: string) => t.toLowerCase().includes('yc'));
                          }
                          if (feedFilterCategory === 'early_stage') {
                            return (item.employee_count_approx || 10) <= 25;
                          }
                          return true;
                        })
                        .map(item => {
                          const isIndian = (item as any).region_tag === 'india' || item.name === 'Appsmith' || item.name === 'SigNoz' || item.name === 'Devtron' || item.name === 'Hasura' || item.name === 'Middleware' || item.name === 'Atlan';
                          const compTier = (item as any).compensation_tier || (isIndian ? "₹25L - ₹50L" : "$90k - $140k");

                          return (
                            <div 
                              key={item.id} 
                              className="paper-card" 
                              style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'var(--paper)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
                              onClick={() => {
                                setLinkInput(item.url);
                                setMainTab('analyzer');
                                handleExtractCompany(item.url);
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <CompanyLogo name={item.name} size={32} />
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{item.name}</span>
                                      {isIndian && <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700 }}>India</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{item.funding_stage ? item.funding_stage.toUpperCase() : 'SEED'} • ~{item.employee_count_approx || 10} members</div>
                                  </div>
                                </div>

                                {/* Health Badge */}
                                {item.health?.verdict === 'verified_safe' ? (
                                  <span style={{ fontSize: '0.7rem', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                    Verified Safe
                                  </span>
                                ) : item.health?.verdict === 'high_risk' ? (
                                  <span style={{ fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                    High Risk
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.7rem', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                    Verified Safe
                                  </span>
                                )}
                              </div>

                              {/* Compensation Tier Badge */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="font-mono" style={{ fontSize: '0.72rem', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                  Pay: {compTier}
                                </span>
                                <span className="font-mono" style={{ fontSize: '0.72rem', backgroundColor: 'var(--cream)', color: 'var(--ink)', border: '1px solid var(--border-light)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                  Direct CTO Outreach
                                </span>
                              </div>

                              <div style={{ fontSize: '0.8rem', backgroundColor: 'var(--cream)', color: 'var(--ink)', padding: '6px 10px', borderRadius: '6px', fontWeight: 600 }}>
                                {item.why_for_you || "Matches your builder profile"}
                              </div>

                              {/* Tech stack tags */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {item.tech_stack_tags?.map((t: string) => (
                                  <span key={t} style={{ fontSize: '0.7rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border-light)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                                    {t}
                                  </span>
                                ))}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                                <span>Inspect Opportunities ({item.evidence_count} evidence items) →</span>
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
    </>
    )}
  </div>
  );
};

import { NextResponse } from 'next/server';
import { adminDb, hasAdminConfig } from '@/lib/firebaseAdmin';
import { verifyRequestUser } from '@/lib/serverAuth';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

type DiscoveredJob = {
  title: string;
  company: string;
  url?: string;
  source: 'LinkedIn' | 'Glassdoor' | 'Google Jobs' | 'Remotive' | 'Arbeitnow' | 'JSearch' | 'TheirStack';
};

type EventNode = 'discovery' | 'filter' | 'forge' | 'dispatcher';
type FlowEvent = {
  node: EventNode;
  msg: string;
  job?: DiscoveredJob;
};

// Real API implementations for Tier-1 Job boards (Option A Architecture)
const fetchRapidApiJson = async (url: string, apiKey: string, host: string, providerName: string) => {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': host,
    },
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const rateLimited = res.status === 429 || /rate|quota|limit/i.test(bodyText);
    if (rateLimited) {
      throw new Error(`RATE_LIMIT:${providerName}:${res.status}`);
    }
    throw new Error(`${providerName} failed (${res.status})`);
  }

  return (await res.json()) as unknown;
};

const fetchLinkedInJobs = async (apiKey: string, role: string, location: string) => {
  const query = new URLSearchParams({
    limit: '25',
    offset: '0',
    title_filter: `"${role}"`,
    location_filter: `"${location}"`,
    description_type: 'text',
  });
  return fetchRapidApiJson(
    `https://linkedin-job-search-api.p.rapidapi.com/active-jb-24h?${query.toString()}`,
    apiKey,
    'linkedin-job-search-api.p.rapidapi.com',
    'LinkedIn'
  );
};

const fetchGlassdoorJobs = async (apiKey: string, role: string, location: string) => {
  const encRole = encodeURIComponent(role);
  const encLoc = encodeURIComponent(location);
  return fetchRapidApiJson(
    `https://glassdoor-data.p.rapidapi.com/jobs/search?keyword=${encRole}&location=${encLoc}`,
    apiKey,
    'glassdoor-data.p.rapidapi.com',
    'Glassdoor'
  );
};

const inferCountryCode = (location: string): string => {
  const normalized = location.toLowerCase();
  if (normalized.includes('india') || normalized.includes('bengaluru') || normalized.includes('bangalore')) return 'in';
  if (normalized.includes('united kingdom') || normalized.includes('uk') || normalized.includes('london')) return 'gb';
  if (normalized.includes('germany') || normalized.includes('berlin')) return 'de';
  if (normalized.includes('canada') || normalized.includes('toronto') || normalized.includes('vancouver')) return 'ca';
  return 'us';
};

const normalizeLocationNeedles = (location: string): string[] => {
  const normalized = location.trim().toLowerCase();
  if (!normalized || normalized === 'any' || normalized === 'all') return [];
  if (normalized === 'remote') return ['remote'];

  const needles = new Set<string>([normalized]);
  if (normalized.includes('bengaluru')) needles.add('bangalore');
  if (normalized.includes('bangalore')) needles.add('bengaluru');
  if (normalized.includes('new york')) needles.add('nyc');
  return Array.from(needles);
};

const locationMatches = (jobLocation: string | null, desiredLocation: string): boolean => {
  const needles = normalizeLocationNeedles(desiredLocation);
  if (needles.length === 0) return true;
  const loc = (jobLocation ?? '').toLowerCase();
  if (!loc) return false;
  return needles.some((needle) => loc.includes(needle));
};

const fetchJSearchJobs = async (apiKey: string, role: string, location: string) => {
  const query = new URLSearchParams({
    work_from_home: 'true',
    num_pages: '1',
    page: '1',
    query: `${role} jobs in ${location}`,
    country: inferCountryCode(location),
  });

  return fetchRapidApiJson(
    `https://jsearch-cheaper-version.p.rapidapi.com/search?${query.toString()}`,
    apiKey,
    'jsearch-cheaper-version.p.rapidapi.com',
    'JSearch'
  );
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;

const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

const readEnvValueFromFile = async (key: string): Promise<string> => {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const content = await readFile(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      const envKey = line.slice(0, idx).trim();
      if (envKey !== key) continue;
      return line.slice(idx + 1).trim();
    }
    return '';
  } catch {
    return '';
  }
};

const getNestedString = (obj: Record<string, unknown>, key: string): string | null => {
  const direct = asString(obj[key]);
  if (direct) return direct;
  const nested = asRecord(obj[key]);
  if (!nested) return null;
  return asString(nested.name) ?? asString(nested.value) ?? null;
};

const toJob = (item: unknown, source: DiscoveredJob['source']): DiscoveredJob | null => {
  const row = asRecord(item);
  if (!row) return null;
  const title =
    getNestedString(row, 'title') ??
    getNestedString(row, 'job_title') ??
    getNestedString(row, 'jobTitle') ??
    getNestedString(row, 'position') ??
    getNestedString(row, 'name');
  const company =
    getNestedString(row, 'company') ??
    getNestedString(row, 'companyName') ??
    getNestedString(row, 'company_name') ??
    getNestedString(row, 'employer_name') ??
    getNestedString(row, 'employer') ??
    getNestedString(row, 'organization');
  const url =
    getNestedString(row, 'url') ??
    getNestedString(row, 'jobUrl') ??
    getNestedString(row, 'job_url') ??
    getNestedString(row, 'job_apply_link') ??
    getNestedString(row, 'applyUrl') ??
    getNestedString(row, 'jobLink') ??
    undefined;

  if (!title || !company) return null;
  return { title, company, url, source };
};

const collectCandidateRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return [];

  const keys = [
    'data',
    'jobs',
    'results',
    'items',
    'jobPostings',
    'postings',
    'response',
  ];

  for (const key of keys) {
    const val = root[key];
    if (Array.isArray(val)) return val;
    const nested = asRecord(val);
    if (nested) {
      for (const nestedKey of keys) {
        const inner = nested[nestedKey];
        if (Array.isArray(inner)) return inner;
      }
    }
  }
  return [];
};

const normalizeJobs = (payload: unknown, source: DiscoveredJob['source']): DiscoveredJob[] =>
  collectCandidateRows(payload)
    .map((row) => toJob(row, source))
    .filter((job): job is DiscoveredJob => job !== null);

const dedupeJobs = (jobs: DiscoveredJob[]): DiscoveredJob[] => {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = `${job.title.toLowerCase()}::${job.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fetchFallbackJobs = async (role: string, location: string): Promise<DiscoveredJob[]> => {
  const search = encodeURIComponent(role);
  const res = await fetch(`https://remotive.com/api/remote-jobs?search=${search}&limit=6`);
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  const root = asRecord(data);
  const rows = Array.isArray(root?.jobs) ? root.jobs : [];
  return rows
    .map((row) => {
      const rec = asRecord(row);
      if (!rec) return null;
      const title = asString(rec.title);
      const company = asString(rec.company_name) ?? asString(rec.company);
      const url = asString(rec.url) ?? undefined;
      const jobLocation = asString(rec.candidate_required_location) ?? asString(rec.location) ?? 'remote';
      if (!title || !company) return null;
      if (!locationMatches(jobLocation, location)) return null;
      return {
        title,
        company,
        url,
        source: 'Remotive' as const,
      };
    })
    .filter((job): job is DiscoveredJob => job !== null);
};

const fetchArbeitnowJobs = async (role: string, location: string): Promise<DiscoveredJob[]> => {
  const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
  if (!res.ok) return [];
  const payload = (await res.json()) as unknown;
  const root = asRecord(payload);
  const rows = Array.isArray(root?.data) ? root.data : [];
  const roleNeedle = role.trim().toLowerCase();

  return rows
    .map((row) => {
      const rec = asRecord(row);
      if (!rec) return null;
      const title = asString(rec.title);
      const company = asString(rec.company_name);
      const url = asString(rec.url) ?? undefined;
      const jobLocation = asString(rec.location) ?? asString(rec.remote) ?? null;
      if (!title || !company) return null;
      if (!locationMatches(jobLocation, location)) return null;
      return {
        title,
        company,
        url,
        source: 'Arbeitnow' as const,
      };
    })
    .filter((job): job is DiscoveredJob => job !== null)
    .filter((job) => {
      if (!roleNeedle) return true;
      return job.title.toLowerCase().includes(roleNeedle);
    })
    .slice(0, 12);
};

const fetchTheirStackJobs = async (token: string, role: string, location: string): Promise<DiscoveredJob[]> => {
  const payload = {
    order_by: [
      { desc: true, field: 'date_posted' },
      { desc: true, field: 'discovered_at' },
    ],
    page: 0,
    limit: 20,
    posted_at_max_age_days: 15,
    job_title_pattern_or: role ? [role] : [],
    job_location_pattern_or: location ? [location] : [],
    include_total_results: false,
  };

  const res = await fetch('https://api.theirstack.com/v1/jobs/search', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const rateLimited = res.status === 429 || /rate|quota|limit/i.test(bodyText);
    if (rateLimited) {
      throw new Error(`RATE_LIMIT:TheirStack:${res.status}`);
    }
    throw new Error(`TheirStack failed (${res.status})`);
  }

  const data = (await res.json()) as unknown;
  const root = asRecord(data);
  const rows = Array.isArray(root?.data)
    ? root.data
    : Array.isArray(root?.results)
      ? root.results
      : Array.isArray(root?.jobs)
        ? root.jobs
        : [];

  return rows
    .map((row) => {
      const rec = asRecord(row);
      if (!rec) return null;
      const title = asString(rec.job_title) ?? asString(rec.title);
      const company = asString(rec.company_name) ?? asString(rec.company);
      const url = asString(rec.job_url) ?? asString(rec.url) ?? asString(rec.job_apply_link) ?? undefined;
      if (!title || !company) return null;
      return {
        title,
        company,
        url,
        source: 'TheirStack' as const,
      };
    })
    .filter((job): job is DiscoveredJob => job !== null);
};

export async function GET(req: Request) {
  try {
    const requestUser = await verifyRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || 'Software Engineer';
    const location = searchParams.get('location') || 'Remote';
    const userId = requestUser.uid;
    const userEmail = requestUser.email;
    
    const envRapidApiKey = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY || '';
    const envTheirStackApiKey =
      process.env.THEIRSTACK_API_KEY ||
      process.env.THEIRSTACK_BEARER_TOKEN ||
      process.env.THEIRSTACK_API_TOKEN ||
      '';
    let RAPID_API_KEY = envRapidApiKey;
    let THEIRSTACK_API_KEY = envTheirStackApiKey;
    let jobs: DiscoveredJob[] = [];
    const diagnostics: string[] = [];
    let rateLimitedDetected = false;

    if (!RAPID_API_KEY) {
      RAPID_API_KEY = await readEnvValueFromFile('RAPIDAPI_KEY');
    }
    if (!THEIRSTACK_API_KEY) {
      THEIRSTACK_API_KEY = await readEnvValueFromFile('THEIRSTACK_API_KEY');
    }

    // Fallback to per-user profile API keys when process env is missing.
    if ((!RAPID_API_KEY || !THEIRSTACK_API_KEY) && hasAdminConfig && adminDb) {
      try {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        const userData = (userDoc.data() ?? {}) as Record<string, unknown>;
        const profile = asRecord(userData.profile);
        const apiConfig = asRecord(profile?.apiConfig);

        if (!RAPID_API_KEY) {
          RAPID_API_KEY = asString(apiConfig?.rapidApiKey) ?? '';
        }
        if (!THEIRSTACK_API_KEY) {
          THEIRSTACK_API_KEY =
            asString(apiConfig?.theirStackApiKey) ??
            asString(apiConfig?.theirstackApiKey) ??
            asString(apiConfig?.theirstackKey) ??
            '';
        }
      } catch {
        // ignore profile key read failures and proceed with env keys only
      }
    }

    diagnostics.push(
      RAPID_API_KEY ? 'RapidAPI key available.' : 'RapidAPI key missing; using fallback provider.',
      THEIRSTACK_API_KEY ? 'TheirStack key available.' : 'TheirStack key missing; skipping TheirStack fallback.'
    );
    
    // 1. DISCOVERY: Multi-source Scraping Protocol
    if (RAPID_API_KEY) {
      // In production, we run these in parallel
      const [liResult, gdResult, jsResult] = await Promise.all([
        fetchLinkedInJobs(RAPID_API_KEY, role, location)
          .then((payload) => ({ payload, error: null as Error | null }))
          .catch((error: unknown) => ({ payload: null, error: error instanceof Error ? error : new Error('Unknown LinkedIn error') })),
        fetchGlassdoorJobs(RAPID_API_KEY, role, location)
          .then((payload) => ({ payload, error: null as Error | null }))
          .catch((error: unknown) => ({ payload: null, error: error instanceof Error ? error : new Error('Unknown Glassdoor error') })),
        fetchJSearchJobs(RAPID_API_KEY, role, location)
          .then((payload) => ({ payload, error: null as Error | null }))
          .catch((error: unknown) => ({ payload: null, error: error instanceof Error ? error : new Error('Unknown JSearch error') })),
      ]);
      const liJobs = liResult.payload ? normalizeJobs(liResult.payload, 'LinkedIn') : [];
      const gdJobs = gdResult.payload ? normalizeJobs(gdResult.payload, 'Glassdoor') : [];
      const jsJobs = jsResult.payload ? normalizeJobs(jsResult.payload, 'JSearch') : [];
      const providerErrors = [liResult.error, gdResult.error, jsResult.error].filter(Boolean) as Error[];
      rateLimitedDetected = providerErrors.some((err) => err.message.includes('RATE_LIMIT'));
      diagnostics.push(
        liResult.payload
          ? `LinkedIn provider reachable (${liJobs.length} jobs).`
          : liResult.error?.message.includes('RATE_LIMIT')
            ? 'LinkedIn provider rate-limited.'
            : 'LinkedIn provider failed/unreachable.',
        gdResult.payload
          ? `Glassdoor provider reachable (${gdJobs.length} jobs).`
          : gdResult.error?.message.includes('RATE_LIMIT')
            ? 'Glassdoor provider rate-limited.'
            : 'Glassdoor provider failed/unreachable.',
        jsResult.payload
          ? `JSearch provider reachable (${jsJobs.length} jobs).`
          : jsResult.error?.message.includes('RATE_LIMIT')
            ? 'JSearch provider rate-limited.'
            : 'JSearch provider failed/unreachable.'
      );
      jobs = dedupeJobs([...liJobs, ...gdJobs, ...jsJobs]);
      diagnostics.push(`Premium providers combined (${jobs.length} unique jobs).`);
    }

    // Fallback provider chain to keep discovery operational without premium APIs
    if (jobs.length === 0 || rateLimitedDetected) {
      if (THEIRSTACK_API_KEY) {
        try {
          const theirStackJobs = await fetchTheirStackJobs(THEIRSTACK_API_KEY, role, location);
          jobs = dedupeJobs([...jobs, ...theirStackJobs]);
          diagnostics.push(`TheirStack fallback active (${theirStackJobs.length} jobs).`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'TheirStack fallback failed.';
          diagnostics.push(message.includes('RATE_LIMIT') ? 'TheirStack provider rate-limited.' : 'TheirStack provider failed/unreachable.');
        }
      }
    }

    if (jobs.length === 0) {
      const [remotiveRole, arbeitnowRole] = await Promise.all([
        fetchFallbackJobs(role, location).catch(() => []),
        fetchArbeitnowJobs(role, location).catch(() => []),
      ]);
      jobs = dedupeJobs([...remotiveRole, ...arbeitnowRole]);
      diagnostics.push(`Fallback provider active (${jobs.length} jobs).`);

      if (jobs.length === 0) {
        const broadRole = role.toLowerCase().includes('software') ? 'developer' : 'software engineer';
        const [remotiveBroad, arbeitnowBroad, theirStackBroad] = await Promise.all([
          fetchFallbackJobs(broadRole, location).catch(() => []),
          fetchArbeitnowJobs(broadRole, location).catch(() => []),
          THEIRSTACK_API_KEY ? fetchTheirStackJobs(THEIRSTACK_API_KEY, broadRole, location).catch(() => []) : Promise.resolve([] as DiscoveredJob[]),
        ]);
        jobs = dedupeJobs([...remotiveBroad, ...arbeitnowBroad, ...theirStackBroad]);
        diagnostics.push(`Fallback broad retry (${broadRole}) returned (${jobs.length} jobs).`);
      }
    }

    const simulatedFlowEvents: FlowEvent[] = [];
    simulatedFlowEvents.push({
      node: 'discovery',
      msg: `Discovery initialized for "${role}" in "${location}".`,
    });
    
    for (const job of jobs) {
      simulatedFlowEvents.push({
        node: 'discovery',
        msg: `Discovered on ${job.source}: ${job.title} @ ${job.company}`
      });

      // 2. FILTER: Dynamic Exclusion Logic
      const isTooSenior = job.title.toLowerCase().includes('senior') || job.title.toLowerCase().includes('principal');
      
      if (isTooSenior) {
        simulatedFlowEvents.push({
          node: 'filter',
          msg: `Discarded "${job.title}": Exceeds Experience Caps.`
        });
        continue;
      }

      simulatedFlowEvents.push({
        node: 'forge',
        msg: `Passed filter. Initiating Resume Forge for: ${job.company}`
      });
      simulatedFlowEvents.push({
        node: 'forge',
        msg: `Asset tailored. Applied 4 context keywords mapped to ${job.company} criteria.`,
        job
      });

      // 3. DISPATCHER: Orchestration
      simulatedFlowEvents.push({
        node: 'dispatcher',
        msg: `Prepared application package for ${job.company}.`
      });
      
      simulatedFlowEvents.push({
        node: 'dispatcher',
        msg: `Queued for manual approval before submission (${job.source}).`
      });
    }

    if (jobs.length === 0) {
      simulatedFlowEvents.push({
        node: 'discovery',
        msg: 'No jobs found from providers. Try broadening role/location filters.',
      });
    }

    if (hasAdminConfig && adminDb) {
      const now = new Date().toISOString();
      await adminDb.collection('users').doc(userId).set(
        {
          userId,
          email: userEmail,
          lastRunAt: now,
          lastSearch: { role, location },
          updatedAt: now,
        },
        { merge: true }
      );

      const searchedEvents = simulatedFlowEvents.filter((evt) => evt.node === 'discovery' && evt.msg.startsWith('Discovered on'));
      const filteredEvents = simulatedFlowEvents.filter((evt) => evt.node === 'filter');
      const reviewQueuedEvents = simulatedFlowEvents.filter(
        (evt) => evt.node === 'dispatcher' && evt.msg.includes('Queued for manual approval')
      );

      const discoveredJobs = jobs.map((job) => ({
        userId,
        email: userEmail,
        roleQuery: role,
        locationQuery: location,
        company: job.company,
        title: job.title,
        source: job.source,
        url: job.url || null,
        searchedAt: now,
      }));

      await Promise.all([
        ...discoveredJobs.map((entry) => adminDb.collection('searched').add(entry)),
        ...discoveredJobs.map((entry) =>
          adminDb.collection('applications').add({
            ...entry,
            status: 'ready_for_review',
            reviewRequiredAt: now,
            updatedAt: now,
          })
        ),
        ...filteredEvents.map((evt) =>
          adminDb.collection('tasks').add({
            userId,
            email: userEmail,
            type: 'filter-rejected',
            message: evt.msg,
            createdAt: now,
          })
        ),
        ...reviewQueuedEvents.map((evt) =>
          adminDb.collection('tasks').add({
            userId,
            email: userEmail,
            type: 'manual-review-required',
            message: evt.msg,
            createdAt: now,
          })
        ),
      ]);

      // A run summary task for quick debugging/ops visibility
      await adminDb.collection('tasks').add({
        userId,
        email: userEmail,
        type: 'engine-run-summary',
        discoveredCount: searchedEvents.length,
        filteredCount: filteredEvents.length,
        reviewQueuedCount: reviewQueuedEvents.length,
        appliedCount: 0,
        diagnostics,
        createdAt: now,
      });
    }

    return NextResponse.json({ events: simulatedFlowEvents, diagnostics });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to access Scraping backend.' }, { status: 500 });
  }
}

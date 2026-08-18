import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase';
import { AIProposal, MatchResult } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o-mini';

/**
 * Generate AI-powered job-freelancer match scores
 */
export async function generateMatchScores(jobId: string): Promise<MatchResult[]> {
  const supabase = createAdminClient();

  // Fetch job with embedding
  const { data: job } = await supabase
    .from('jobs')
    .select('*, job_embeddings(*)')
    .eq('id', jobId)
    .single();

  if (!job) throw new Error('Job not found');

  // Fetch eligible freelancers
  const { data: freelancers } = await supabase
    .from('freelancers')
    .select('*, profiles(name)')
    .eq('availability_status', 'available')
    .limit(100);

  if (!freelancers || freelancers.length === 0) return [];

  const results: MatchResult[] = [];

  for (const freelancer of freelancers) {
    // Calculate component scores
    const skillMatch = calculateSkillMatch(job.skills || [], freelancer.skills || []);
    const rateMatch = calculateRateMatch(
      job.budget_min,
      job.budget_max,
      job.budget_type,
      freelancer.hourly_rate
    );
    const experienceMatch = calculateExperienceMatch(
      freelancer.rating,
      freelancer.review_count,
      freelancer.jss_score
    );
    const availabilityMatch = calculateAvailabilityMatch(freelancer.weekly_hours_available);

    // Weighted composite score
    const score = Math.round(
      skillMatch * 0.35 +
      rateMatch * 0.25 +
      experienceMatch * 0.25 +
      availabilityMatch * 0.15
    );

    results.push({
      freelancerId: freelancer.id,
      score: Math.min(100, score),
      skillMatch: Math.round(skillMatch),
      rateMatch: Math.round(rateMatch),
      experienceMatch: Math.round(experienceMatch),
      availabilityMatch: Math.round(availabilityMatch),
      aiReasoning: generateReasoning(skillMatch, rateMatch, experienceMatch, availabilityMatch, job.skills, freelancer.skills),
    });
  }

  // Store results
  const matches = results
    .filter((r) => r.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  if (matches.length > 0) {
    await supabase.from('match_scores').upsert(
      matches.map((m) => ({
        job_id: jobId,
        freelancer_id: m.freelancerId,
        score: m.score,
        skill_match: m.skillMatch,
        rate_match: m.rateMatch,
        experience_match: m.experienceMatch,
        availability_match: m.availabilityMatch,
        ai_reasoning: m.aiReasoning,
      }))
    );
  }

  return matches;
}

function calculateSkillMatch(jobSkills: string[], freelancerSkills: string[]): number {
  if (!jobSkills.length || !freelancerSkills.length) return 0;
  const normalizedJob = jobSkills.map((s) => s.toLowerCase().trim());
  const normalizedFree = freelancerSkills.map((s) => s.toLowerCase().trim());
  const matches = normalizedJob.filter((s) => normalizedFree.includes(s)).length;
  return (matches / normalizedJob.length) * 100;
}

function calculateRateMatch(budgetMin: number, budgetMax: number, budgetType: string, hourlyRate: number): number {
  if (budgetType === 'hourly') {
    if (hourlyRate <= budgetMax && hourlyRate >= budgetMin) return 100;
    if (hourlyRate < budgetMin) return Math.max(0, 100 - ((budgetMin - hourlyRate) / budgetMin) * 100);
    return Math.max(0, 100 - ((hourlyRate - budgetMax) / budgetMax) * 100);
  }
  // Fixed budget: estimate hourly equivalent (assume 40h week)
  const estimatedHourly = budgetMax / 40;
  return calculateRateMatch(estimatedHourly * 0.5, estimatedHourly * 1.5, 'hourly', hourlyRate);
}

function calculateExperienceMatch(rating: number, reviewCount: number, jss: number): number {
  const ratingScore = (rating / 5) * 40;
  const reviewScore = Math.min(reviewCount / 50, 1) * 30;
  const jssScore = (jss / 100) * 30;
  return ratingScore + reviewScore + jssScore;
}

function calculateAvailabilityMatch(weeklyHours: number): number {
  return Math.min((weeklyHours / 40) * 100, 100);
}

function generateReasoning(
  skillMatch: number,
  rateMatch: number,
  expMatch: number,
  availMatch: number,
  jobSkills: string[],
  freelancerSkills: string[]
): string {
  const parts: string[] = [];
  if (skillMatch >= 80) parts.push('Strong skill alignment');
  else if (skillMatch >= 50) parts.push('Good skill overlap');

  if (rateMatch >= 80) parts.push('Rate within budget');
  else if (rateMatch >= 50) parts.push('Rate close to budget');

  if (expMatch >= 80) parts.push('Highly experienced');
  else if (expMatch >= 50) parts.push('Solid track record');

  if (availMatch >= 80) parts.push('High availability');

  const matchedSkills = jobSkills.filter((s) =>
    freelancerSkills.some((fs) => fs.toLowerCase().includes(s.toLowerCase()))
  );
  if (matchedSkills.length > 0) {
    parts.push(`Matches: ${matchedSkills.slice(0, 3).join(', ')}`);
  }

  return parts.join('. ') || 'Moderate overall match';
}

/**
 * Generate AI-powered proposal for a freelancer bidding on a job
 */
export async function generateProposal(
  jobDescription: string,
  jobTitle: string,
  freelancerProfile: {
    name: string;
    title: string;
    skills: string[];
    bio: string;
    hourlyRate: number;
  }
): Promise<AIProposal> {
  const prompt = `You are an expert freelance proposal writer. Write a compelling, personalized bid proposal.

JOB: ${jobTitle}
JOB DESCRIPTION: ${jobDescription}

FREELANCER:
- Name: ${freelancerProfile.name}
- Title: ${freelancerProfile.title}
- Skills: ${freelancerProfile.skills.join(', ')}
- Bio: ${freelancerProfile.bio}
- Hourly Rate: $${freelancerProfile.hourlyRate}

Write a proposal that:
1. Opens with a personalized hook referencing the job
2. Shows relevant experience with specific skills
3. Proposes a clear approach/methodology
4. Includes a competitive rate suggestion
5. Ends with a call to action

Respond in JSON format:
{
  "subject": "Short, compelling subject line",
  "body": "The full proposal text (2-3 paragraphs, professional but warm)",
  "suggestedRate": number,
  "estimatedDuration": "e.g., 2-3 weeks",
  "keyPoints": ["3-4 bullet points of key value propositions"]
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are an expert freelance career coach and proposal writer.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('AI response empty');

  const parsed = JSON.parse(content);
  return {
    subject: parsed.subject || `Proposal for ${jobTitle}`,
    body: parsed.body || '',
    suggestedRate: Number(parsed.suggestedRate) || freelancerProfile.hourlyRate,
    estimatedDuration: parsed.estimatedDuration || 'TBD',
    keyPoints: parsed.keyPoints || [],
  };
}

/**
 * Generate AI summary of a job description
 */
export async function generateJobSummary(description: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Summarize job descriptions into 2-3 concise sentences highlighting key requirements and scope.',
      },
      { role: 'user', content: description },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate embedding for semantic search
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

/**
 * AI-powered fraud detection for profiles
 */
export async function detectProfileFraud(profile: {
  name: string;
  bio: string;
  skills: string[];
  title: string;
}): Promise<{ isSuspicious: boolean; confidence: number; reasons: string[] }> {
  const redFlags: string[] = [];
  let score = 0;

  // Check for generic/boilerplate content
  const genericPhrases = [
    'hardworking', 'team player', 'detail oriented', 'self motivated',
    'quick learner', 'results driven', 'go getter',
  ];
  const bioLower = profile.bio.toLowerCase();
  const genericCount = genericPhrases.filter((p) => bioLower.includes(p)).length;
  if (genericCount >= 3) {
    score += 20;
    redFlags.push('Generic bio with common buzzwords');
  }

  // Check for unrealistic skill count
  if (profile.skills.length > 30) {
    score += 25;
    redFlags.push('Unusually high number of skills');
  }

  // Check for suspicious name patterns
  if (/^[A-Z][a-z]+[0-9]+$/.test(profile.name)) {
    score += 30;
    redFlags.push('Name appears auto-generated');
  }

  // Check for empty or very short bio
  if (profile.bio.length < 50) {
    score += 15;
    redFlags.push('Bio is unusually short');
  }

  return {
    isSuspicious: score >= 40,
    confidence: Math.min(score, 100),
    reasons: redFlags,
  };
}

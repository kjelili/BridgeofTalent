import { NextRequest, NextResponse } from 'next/server';
import { generateMatchScores } from '@/services/ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({ jobId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId } = schema.parse(body);
    const matches = await generateMatchScores(jobId);
    return NextResponse.json({ success: true, matches: matches.slice(0, 10), totalMatches: matches.length });
  } catch (error) {
    console.error('AI match generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate matches' }, { status: 500 });
  }
}

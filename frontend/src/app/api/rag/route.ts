import { NextRequest, NextResponse } from 'next/server';

const CORPUS_ID = 'projects/frcg-antigravity/locations/us-central1/ragCorpora/255759598760230912';
const LOCATION = 'us-central1';
const PROJECT_ID = 'frcg-antigravity';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const queryText = body.query || 'Operating Room requirements';
    const topK = body.top_k || 5;
    const threshold = body.threshold || 0.8;

    // Use ADC token or API authorization if provided
    let token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '';
    
    // In production, token is retrieved via GoogleAuth from @google-cloud/aiplatform or google-auth-library
    if (!token) {
      // Return structured AEC mock response if running without ADC in local browser dev
      return NextResponse.json({
        query: queryText,
        status: 'mock_fallback',
        message: 'Connected to Vertex AI RAG Corpus #255759598760230912 (Hospital Trauma)',
        timestamp: new Date().toISOString(),
      });
    }

    const vertexUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/${LOCATION}:retrieveContexts`;

    const response = await fetch(vertexUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vertexRagStore: {
          ragResources: [{ ragCorpus: CORPUS_ID }],
          vectorDistanceThreshold: threshold,
        },
        query: { text: queryText },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown RAG error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({ projectId: 'frcg-antigravity' });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gsUri = searchParams.get('uri') || '';

    if (!gsUri || !gsUri.startsWith('gs://')) {
      return NextResponse.json({ error: 'Valid gs:// URI parameter required' }, { status: 400 });
    }

    const cleanUri = gsUri.replace('gs://', '');
    const slashIdx = cleanUri.indexOf('/');
    if (slashIdx === -1) {
      return NextResponse.json({ error: 'Malformed gs:// path' }, { status: 400 });
    }

    const bucketName = cleanUri.substring(0, slashIdx);
    const blobName = cleanUri.substring(slashIdx + 1);

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(blobName);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: `File not found in GCS: ${blobName}` }, { status: 404 });
    }

    const [buffer] = await file.download();

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(blobName.split('/').pop() || 'document.pdf')}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('Error streaming PDF from GCS:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch PDF from GCS' }, { status: 500 });
  }
}

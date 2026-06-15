// Wasabi AiR — REST API adapter
//
// Auth is determined by which env vars are present:
//   WASABI_AIR_API_TOKEN   → Bearer token  (if Wasabi AIR issues a single token)
//   WASABI_AIR_ACCESS_KEY_ID + WASABI_AIR_SECRET_ACCESS_KEY → AWS SigV4
//
// Endpoint: https://air.wasabisys.com/api/v1  (confirmed via probe)

import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 }      from '@aws-crypto/sha256-js';

const AIR_BASE    = 'https://air.wasabisys.com/api/v1';
const AIR_SERVICE = 's3';
const AIR_REGION  = 'us-east-1';

export type AirAnalysis =
  | 'face_detection'
  | 'logo_detection'
  | 'object_detection'
  | 'scene_description'
  | 'ocr'
  | 'person_detection';

export type AirJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface AirFace {
  confidence: number;
  bounding_box?: { top: number; left: number; width: number; height: number };
}

export interface AirLogo {
  name: string;
  confidence: number;
}

export interface AirObject {
  name: string;
  confidence: number;
}

export interface AirPerson {
  confidence: number;
  count?: number;
}

export interface AirResult {
  faces?: AirFace[];
  logos?: AirLogo[];
  objects?: AirObject[];
  persons?: AirPerson[];
  description?: string;
  text?: string[];
}

export interface AirJobResponse {
  id: string;
  status: AirJobStatus;
  result?: AirResult;
  error?: string;
}

function getBucket(): string {
  const bucket = process.env.WASABI_BUCKET;
  if (!bucket) throw new Error('Missing WASABI_BUCKET env var');
  return bucket;
}

async function airFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url    = `${AIR_BASE}${path}`;
  const parsed = new URL(url);
  const body   = init.body as string | undefined;
  const method = (init.method ?? 'GET').toUpperCase();

  // Bearer token path — set WASABI_AIR_API_TOKEN
  const bearerToken = process.env.WASABI_AIR_API_TOKEN;
  if (bearerToken) {
    return fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
    });
  }

  // SigV4 path — set WASABI_AIR_ACCESS_KEY_ID + WASABI_AIR_SECRET_ACCESS_KEY
  const accessKeyId     = process.env.WASABI_AIR_ACCESS_KEY_ID;
  const secretAccessKey = process.env.WASABI_AIR_SECRET_ACCESS_KEY;
  if (accessKeyId && secretAccessKey) {
    const signer = new SignatureV4({
      service:     AIR_SERVICE,
      region:      AIR_REGION,
      credentials: { accessKeyId, secretAccessKey },
      sha256:      Sha256,
    });

    const signed = await signer.sign({
      method,
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      headers:  { host: parsed.host, ...(body ? { 'content-type': 'application/json' } : {}) },
      body,
      protocol: 'https:',
    });

    return fetch(url, {
      method,
      headers: signed.headers as Record<string, string>,
      body,
    });
  }

  throw new Error(
    'No Wasabi AIR credentials found. Set either WASABI_AIR_API_TOKEN (Bearer) ' +
    'or WASABI_AIR_ACCESS_KEY_ID + WASABI_AIR_SECRET_ACCESS_KEY (SigV4).',
  );
}

export async function submitAirJob(
  objectKey: string,
  analyses: AirAnalysis[] = [
    'face_detection',
    'logo_detection',
    'object_detection',
    'scene_description',
    'ocr',
    'person_detection',
  ],
): Promise<string> {
  const bucket = getBucket();

  const res = await airFetch('/jobs', {
    method: 'POST',
    body: JSON.stringify({ input: { bucket, key: objectKey }, analyses }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AIR job submission failed ${res.status}: ${text}`);
  }

  const data = await res.json() as { id: string };
  return data.id;
}

export async function getAirJob(jobId: string): Promise<AirJobResponse> {
  const res = await airFetch(`/jobs/${jobId}`);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AIR job fetch failed ${res.status}: ${text}`);
  }

  return res.json() as Promise<AirJobResponse>;
}

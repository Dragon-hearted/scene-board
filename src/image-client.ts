/**
 * Typed HTTP client for ImageEngine API.
 * SceneBoard communicates with ImageEngine exclusively over HTTP.
 * All types are locally declared — no imports from image-engine internals.
 */

// ─── Local types matching ImageEngine API shapes ───

type WisGateModel =
	| "gemini-3-pro-image-preview"
	| "gemini-3.1-flash-image-preview"
	| "gemini-2.5-flash-image";

type OpenAIImageModel = "gpt-image-2" | "gpt-image-1.5";

type ImageModel = WisGateModel | OpenAIImageModel;

type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";

interface TokenUsage {
	promptTokens: number;
	candidateTokens: number;
	totalTokens: number;
}

export interface GenerationRequest {
	prompt: string;
	model?: ImageModel;
	referenceImageIds?: string[];
	aspectRatio?: AspectRatio;
	imageSize?: string;
	forceImage?: boolean;
	systemInstruction?: string;
	sceneId?: string;
	/** OpenAI-only quality knob. Ignored by WisGate models. */
	openaiQuality?: "low" | "medium" | "high";
}

export interface GenerationResult {
	id: string;
	imageUrl: string;
	model: string;
	prompt: string;
	tokenUsage: TokenUsage;
	sceneId?: string;
	createdAt: string;
}

export interface BatchRequest {
	items: GenerationRequest[];
	dependencies?: { sceneId: string; dependsOn: string[] }[];
}

export interface BatchResult {
	results: Record<string, GenerationResult | { error: string }>;
	totalTokens: number;
}

export interface BudgetStatus {
	tokenCeiling: number;
	tokensSpent: number;
	tokensRemaining: number;
	percentUsed: number;
	isActive: boolean;
}

// ─── Client ───

const BASE_URL = process.env.IMAGE_ENGINE_URL || "http://localhost:3002";

async function handleError(res: Response): Promise<never> {
	const err = await res.json().catch(() => ({ error: res.statusText }));
	throw new Error(
		`ImageEngine error ${res.status}: ${(err as Record<string, string>).error || res.statusText}`,
	);
}

export async function generateSingle(req: GenerationRequest): Promise<GenerationResult> {
	const res = await fetch(`${BASE_URL}/api/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(req),
	});
	if (!res.ok) await handleError(res);
	return res.json() as Promise<GenerationResult>;
}

export async function generateBatch(req: BatchRequest): Promise<BatchResult> {
	const res = await fetch(`${BASE_URL}/api/generate/batch`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(req),
	});
	if (!res.ok) await handleError(res);
	return res.json() as Promise<BatchResult>;
}

export async function getGallery(limit = 20, offset = 0): Promise<GenerationResult[]> {
	const res = await fetch(`${BASE_URL}/api/gallery?limit=${limit}&offset=${offset}`);
	if (!res.ok) await handleError(res);
	return res.json() as Promise<GenerationResult[]>;
}

export async function getImage(id: string): Promise<Buffer> {
	const res = await fetch(`${BASE_URL}/api/gallery/${encodeURIComponent(id)}/image`);
	if (!res.ok) await handleError(res);
	return Buffer.from(await res.arrayBuffer());
}

export async function getImageAsReference(id: string): Promise<{ data: string; mimeType: string }> {
	const res = await fetch(`${BASE_URL}/api/gallery/${encodeURIComponent(id)}/use-as-reference`, {
		method: "POST",
	});
	if (!res.ok) await handleError(res);
	return res.json() as Promise<{ data: string; mimeType: string }>;
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
	const res = await fetch(`${BASE_URL}/api/budget`);
	if (!res.ok) await handleError(res);
	return res.json() as Promise<BudgetStatus>;
}

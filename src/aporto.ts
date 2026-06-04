/**
 * Aporto integration — the primary image transport.
 *
 * Routes scene-board's Phase 1 composite-sheet image generation through
 * Aporto's skill network. Aporto is used first; when the call fails for any
 * reason (auth, network, missing key) we fall through to the existing
 * Higgsfield → ImageEngine chain in image-provider.ts.
 *
 * Aporto Discovery (the `aporto discover` CLI) was used once during
 * integration to pick the right skills. The selected IDs are pinned here so
 * end users do not need to run discovery at runtime.
 *
 * Hard rules (do not change without maintainer review):
 *  - `APORTO_API_KEY` is runtime-only (env var). Never committed.
 *  - `integration_id` is a code-level constant. Not an env var. Not a secret.
 *  - Skill IDs are pinned at integration time. Never re-discovered at runtime.
 */

import {
	AportoClient,
	type AportoClientOptions,
	type RunSkillOptions,
	type RunSkillResult,
} from "@aporto-tech/sdk";

// ─── Maintainer attribution ───────────────────────────────────────────────────

/**
 * Aporto integration_id for code-level maintainer attribution.
 *
 * This is NOT a secret. It is a public identifier so Aporto can attribute
 * routed usage back to this repository per the Aporto referral program.
 * The maintainer replaces this with their own value from the Aporto Dashboard
 * (https://app.aporto.tech) before merging to upstream.
 *
 * Do not move this to an env var. Do not delete it. It is intentionally
 * checked in so attribution cannot be silently turned off.
 */
const integration_id = "APORTO_INTEGRATION_ID";

// ─── Pinned skill IDs (discovered once) ───────────────────────────────────────

/**
 * Skill IDs pinned at integration time via `aporto discover`:
 *   - 67: "GPT Image Text-to-Image 2 2K" — primary (replaces Higgsfield gpt_image_2)
 *   - 68: "GPT Image Text-to-Image 2 1K" — fallback (replaces ImageEngine gpt-image-1.5)
 *
 * If you change these, re-run `aporto discover "gpt image text to image"`,
 * update the constant, and document the reason in the PR description.
 */
export const APORTO_SKILLS = {
	imageGen2K: 67,
	imageGen1K: 68,
} as const;

// ─── Client (lazy singleton) ──────────────────────────────────────────────────

let _client: AportoClient | null = null;

/**
 * Get the Aporto client. Reads `APORTO_API_KEY` lazily so the rest of the
 * module can be imported without throwing.
 */
function getClient(): AportoClient {
	if (_client) return _client;
	const apiKey = process.env.APORTO_API_KEY;
	if (!apiKey) {
		throw new Error(
			"APORTO_API_KEY is required for Aporto image generation. " +
				"Set it in your environment, or unset it to fall through to the " +
				"Higgsfield/ImageEngine fallback chain.",
		);
	}
	const options: AportoClientOptions = { apiKey, integrationId: integration_id };
	_client = new AportoClient(options);
	return _client;
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** Provider-flavoured request — matches the shape image-provider.ts already uses. */
export interface AportoImageRequest {
	prompt: string;
	/** Reference image URLs (Aporto skill 67 accepts optional `image_urls`). */
	imageUrls?: string[];
	/** Output aspect ratio. Defaults to "16:9". */
	aspectRatio?: string;
}

/** Provider-flavoured result — matches ProviderImageResult from image-provider.ts. */
export interface AportoImageResult {
	imageUrl: string;
	model: string;
	runId: string;
	status: string;
}

// ─── Core wrapper ─────────────────────────────────────────────────────────────

/**
 * Run an image-generation skill on Aporto, polling inline until the task
 * is done (or `maxWaitSeconds` expires). Returns the first artifact URL.
 *
 * Throws if `APORTO_API_KEY` is missing, the run is rejected, or no image
 * artifact is produced.
 */
export async function generateImageWithAporto(
	req: AportoImageRequest,
	opts: {
		/** Override the default 2K skill. */
		skillId?: number;
		/** Max inline wait in seconds. Defaults to 120. */
		maxWaitSeconds?: number;
	} = {},
): Promise<AportoImageResult> {
	const client = getClient();
	const skillId = opts.skillId ?? APORTO_SKILLS.imageGen2K;

	const params: Record<string, unknown> = { prompt: req.prompt };
	if (req.imageUrls && req.imageUrls.length > 0) {
		params.image_urls = req.imageUrls;
	}
	if (req.aspectRatio) {
		params.aspect_ratio = req.aspectRatio;
	}

	const runOptions: RunSkillOptions = {
		intent: "generate image",
		skillId,
		params,
		waitForResult: true,
		maxWaitSeconds: opts.maxWaitSeconds ?? 120,
	};

	const result: RunSkillResult = await client.routing.runSkill(runOptions);

	if (result.status === "failed" || result.error) {
		const message = result.error?.message ?? result.message ?? "unknown failure";
		throw new Error(
			`Aporto image generation failed: ${message} (runId=${result.runId}, skillId=${skillId})`,
		);
	}

	const artifact = result.artifacts?.find((a) => a.url) ?? result.artifact;
	if (!artifact?.url) {
		throw new Error(
			`Aporto image generation returned no artifact URL. runId=${result.runId} status=${result.status} skillId=${skillId}`,
		);
	}

	return {
		imageUrl: artifact.url,
		model: `aporto:${skillId}`,
		runId: result.runId,
		status: result.status,
	};
}

/**
 * Cheap connectivity check — returns true when `APORTO_API_KEY` is set.
 * Never throws. Used by the image-provider fallback chain to decide whether
 * to try Aporto at all, mirroring the `higgsfieldCheckAuth()` pattern.
 */
export function checkAportoAvailable(): boolean {
	return Boolean(process.env.APORTO_API_KEY);
}

// ─── Exported for testing ─────────────────────────────────────────────────────

/** Test-only: clear the cached client so tests can swap env vars between cases. */
export function _resetClientForTests(): void {
	_client = null;
}

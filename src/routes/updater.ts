import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';

const router = Router();

/**
 * Checks if a URL points to a local file that actually exists on disk.
 * External URLs (GitHub Releases, AWS S3, Cloudflare R2, etc.) are always considered available.
 */
function isUrlAvailable(url?: string | null): boolean {
  if (!url) return false;
  if (url.includes('/api/v1/updater/download/')) {
    const fileName = url.split('/api/v1/updater/download/')[1]?.split('?')[0];
    if (!fileName) return false;
    const filePath = path.join(__dirname, '../../uploads/releases', path.basename(fileName));
    return fs.existsSync(filePath);
  }
  return true;
}

// GET /api/v1/updater/download/:fileName (Secure file download stream)
router.get('/download/:fileName', (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    const sanitizedFileName = path.basename(fileName);
    const filePath = path.join(__dirname, '../../uploads/releases', sanitizedFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Release installer payload file not found.',
        message: 'This binary was uploaded directly to the local server disk which was reset during a cloud redeployment. Please provide a permanent GitHub Releases or CDN URL in the Admin Panel.'
      });
    }

    return res.sendFile(filePath);
  } catch (err: any) {
    console.error('Error streaming update payload file:', err);
    return res.status(500).json({ error: 'Failed to stream update payload file.' });
  }
});

// Build Tauri JSON Payload for a release
function buildTauriPayload(release: any) {
  const platforms: Record<string, { url: string; signature?: string }> = {};

  if (release.winUrl) {
    platforms['windows-x86_64'] = {
      url: release.winUrl,
      ...(release.winSignature ? { signature: release.winSignature } : {}),
    };
    platforms['x86_64-pc-windows-msvc'] = platforms['windows-x86_64'];
  }

  if (release.macX64Url) {
    platforms['darwin-x86_64'] = {
      url: release.macX64Url,
      ...(release.macX64Signature ? { signature: release.macX64Signature } : {}),
    };
    platforms['x86_64-apple-darwin'] = platforms['darwin-x86_64'];
  }

  if (release.macArmUrl) {
    platforms['darwin-aarch64'] = {
      url: release.macArmUrl,
      ...(release.macArmSignature ? { signature: release.macArmSignature } : {}),
    };
    platforms['aarch64-apple-darwin'] = platforms['darwin-aarch64'];
  }

  if (release.linuxUrl) {
    platforms['linux-x86_64'] = {
      url: release.linuxUrl,
      ...(release.linuxSignature ? { signature: release.linuxSignature } : {}),
    };
    platforms['x86_64-unknown-linux-gnu'] = platforms['linux-x86_64'];
  }

  return {
    version: release.version,
    notes: release.notes || `OrBit Desktop Release ${release.version}`,
    pub_date: release.pubDate instanceof Date ? release.pubDate.toISOString() : new Date(release.pubDate || Date.now()).toISOString(),
    mandatory: !!release.mandatory,
    platforms,
  };
}

/**
 * Resolves the active release by merging platform URLs across all releases in descending order.
 * This guarantees that releasing a single platform update (e.g. Linux) never breaks or hides
 * the latest available Windows or macOS builds for users.
 */
async function getResolvedActiveRelease() {
  const allReleases = await prisma.appRelease.findMany({
    orderBy: { createdAt: 'desc' },
  });

  if (!allReleases || allReleases.length === 0) {
    return null;
  }

  const activeReleases = allReleases.filter((r) => r.isActive);
  const primaryRelease = activeReleases.length > 0 ? activeReleases[0] : allReleases[0];

  let winUrl: string | null = null;
  let winSignature: string | null = null;
  let macX64Url: string | null = null;
  let macX64Signature: string | null = null;
  let macArmUrl: string | null = null;
  let macArmSignature: string | null = null;
  let linuxUrl: string | null = null;
  let linuxSignature: string | null = null;

  // Pass 1: Merge from active releases first
  for (const rel of activeReleases) {
    if (!winUrl && rel.winUrl) {
      winUrl = rel.winUrl;
      winSignature = rel.winSignature;
    }
    if (!macX64Url && rel.macX64Url) {
      macX64Url = rel.macX64Url;
      macX64Signature = rel.macX64Signature;
    }
    if (!macArmUrl && rel.macArmUrl) {
      macArmUrl = rel.macArmUrl;
      macArmSignature = rel.macArmSignature;
    }
    if (!linuxUrl && rel.linuxUrl) {
      linuxUrl = rel.linuxUrl;
      linuxSignature = rel.linuxSignature;
    }
  }

  // Pass 2: For any platform still missing, fall back to the most recent published release
  for (const rel of allReleases) {
    if (!winUrl && rel.winUrl) {
      winUrl = rel.winUrl;
      winSignature = rel.winSignature;
    }
    if (!macX64Url && rel.macX64Url) {
      macX64Url = rel.macX64Url;
      macX64Signature = rel.macX64Signature;
    }
    if (!macArmUrl && rel.macArmUrl) {
      macArmUrl = rel.macArmUrl;
      macArmSignature = rel.macArmSignature;
    }
    if (!linuxUrl && rel.linuxUrl) {
      linuxUrl = rel.linuxUrl;
      linuxSignature = rel.linuxSignature;
    }
  }

  return {
    version: primaryRelease.version,
    notes: primaryRelease.notes,
    pubDate: primaryRelease.pubDate,
    mandatory: primaryRelease.mandatory,
    winUrl,
    winSignature,
    macX64Url,
    macX64Signature,
    macArmUrl,
    macArmSignature,
    linuxUrl,
    linuxSignature,
  };
}

// GET /api/v1/updater/latest.json
router.get('/latest.json', async (req: Request, res: Response) => {
  try {
    const resolvedRelease = await getResolvedActiveRelease();

    if (!resolvedRelease) {
      return res.status(204).send(); // 204 No Content if no update available
    }

    const payload = buildTauriPayload(resolvedRelease);
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('Error serving Tauri latest.json:', err);
    return res.status(500).json({ error: 'Failed to retrieve update specification.' });
  }
});

// GET /api/v1/updater/:target/:current_version (Tauri v2 target path syntax)
router.get('/:target/:current_version', async (req: Request, res: Response) => {
  try {
    const { target, current_version } = req.params;

    const resolvedRelease = await getResolvedActiveRelease();

    if (!resolvedRelease || resolvedRelease.version === current_version) {
      return res.status(204).send();
    }

    const payload = buildTauriPayload(resolvedRelease);

    // If specific target platform requested, filter payload
    if (target && payload.platforms[target]) {
      return res.status(200).json({
        version: payload.version,
        notes: payload.notes,
        pub_date: payload.pub_date,
        mandatory: payload.mandatory,
        url: payload.platforms[target].url,
        signature: payload.platforms[target].signature || '',
      });
    }

    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('Error serving target update:', err);
    return res.status(500).json({ error: 'Failed to process updater check.' });
  }
});

export default router;

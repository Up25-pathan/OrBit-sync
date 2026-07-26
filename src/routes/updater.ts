import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';

const router = Router();

// GET /api/v1/updater/download/:fileName (Secure file download stream)
router.get('/download/:fileName', (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    const sanitizedFileName = path.basename(fileName);
    const filePath = path.join(__dirname, '../../uploads/releases', sanitizedFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Release installer payload file not found.' });
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
    pub_date: release.pubDate.toISOString(),
    mandatory: release.mandatory,
    platforms,
  };
}

// GET /api/v1/updater/latest.json
router.get('/latest.json', async (req: Request, res: Response) => {
  try {
    const latestRelease = await prisma.appRelease.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestRelease) {
      return res.status(204).send(); // 204 No Content if no update available
    }

    const payload = buildTauriPayload(latestRelease);
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

    const latestRelease = await prisma.appRelease.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestRelease || latestRelease.version === current_version) {
      return res.status(204).send();
    }

    const payload = buildTauriPayload(latestRelease);

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

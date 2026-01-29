import { NextResponse } from 'next/server';
import path from 'path';
import { execFile } from 'child_process';
import { z } from 'zod';
import { getWorkspaceRoot, safeResolve, isUiApplyEnabled } from '../_utils';

const payloadSchema = z.object({
  target: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (!isUiApplyEnabled()) {
      return NextResponse.json(
        { error: 'UI Apply is disabled. Set HARDENER_UI_APPLY=1 in dashboard/.env.local' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const workspaceRoot = getWorkspaceRoot();
    const targetPath = safeResolve(workspaceRoot, parsed.data.target);

    const cliPath = path.join(workspaceRoot, 'dist', 'cli.js');

    const output = await new Promise<string>((resolve, reject) => {
      execFile(
        process.execPath,
        [cliPath, '--apply', '--enable-rollback', '--target', targetPath],
        { cwd: workspaceRoot, timeout: 5 * 60 * 1000 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || stdout || error.message));
          } else {
            resolve(stdout || '');
          }
        }
      );
    });

    return NextResponse.json({ ok: true, output });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

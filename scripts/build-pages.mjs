import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const scriptPath = fileURLToPath(import.meta.url);
const workspace = realpathSync(resolve(dirname(scriptPath), '..'));
const require = createRequire(import.meta.url);

/** Structural validation only; no credentials or accounts are fabricated here. */
export function isPublicSupabaseKey(key) {
  if (typeof key !== 'string' || key.startsWith('sb_secret_')) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)) return true;
  const pieces = key.split('.');
  if (pieces.length !== 3 || !pieces.every((piece) => /^[A-Za-z0-9_-]+$/.test(piece))) return false;
  try {
    const header = JSON.parse(Buffer.from(pieces[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8'));
    return (
      typeof header?.alg === 'string' &&
      header.alg.toLowerCase() !== 'none' &&
      payload?.role === 'anon'
    );
  } catch {
    return false;
  }
}

/** @param {Record<string, string | undefined>} [environment] */
export function readPagesConfiguration(environment = process.env) {
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const suppliedKeys = [
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || '',
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '',
  ].filter(Boolean);
  const supabaseKey = suppliedKeys[0] || '';
  if (Boolean(supabaseUrl) !== Boolean(supabaseKey))
    throw new Error(
      'Supabase configuration is incomplete. Set NEXT_PUBLIC_SUPABASE_URL and a public Supabase key together, or leave both empty to publish the setup page.',
    );
  let backendOrigin = '';
  if (supabaseUrl) {
    let backend;
    try {
      backend = new URL(supabaseUrl);
    } catch {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL must be an HTTPS origin.');
    }
    if (
      backend.protocol !== 'https:' ||
      backend.username ||
      backend.password ||
      backend.pathname !== '/' ||
      backend.search ||
      backend.hash
    )
      throw new Error('NEXT_PUBLIC_SUPABASE_URL must be an HTTPS origin.');
    backendOrigin = backend.origin;
  }
  if (suppliedKeys.some((key) => !isPublicSupabaseKey(key)))
    throw new Error(
      'Only a Supabase publishable key or anon JWT may enter a Pages build. Secret and service-role keys are forbidden.',
    );

  const basePath =
    environment.NEXT_PUBLIC_BASE_PATH === undefined
      ? '/linkboard'
      : environment.NEXT_PUBLIC_BASE_PATH.trim();
  if (basePath && !/^\/(?:[a-zA-Z0-9_-]+\/?)*[a-zA-Z0-9_-]$/.test(basePath))
    throw new Error(
      'NEXT_PUBLIC_BASE_PATH must be a path such as /linkboard, without a trailing slash.',
    );
  const siteUrl = environment.NEXT_PUBLIC_SITE_URL?.trim() || '';
  if (siteUrl) {
    let site;
    try {
      site = new URL(siteUrl);
    } catch {
      throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTPS origin without a project path.');
    }
    if (
      site.protocol !== 'https:' ||
      site.username ||
      site.password ||
      site.pathname !== '/' ||
      site.search ||
      site.hash
    )
      throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTPS origin without a project path.');
  }
  return {
    supabaseUrl: backendOrigin,
    supabaseKey,
    configured: Boolean(backendOrigin && supabaseKey),
    basePath,
    siteUrl,
  };
}

function assertWorkspacePath(path) {
  const target = resolve(path);
  const remainder = relative(workspace, target);
  if (!remainder || remainder.startsWith(`..${sep}`) || remainder === '..' || isAbsolute(remainder))
    throw new Error('Refusing to change a build path outside the project.');
  if (existsSync(target)) {
    const realRemainder = relative(workspace, realpathSync(target));
    if (
      !realRemainder ||
      realRemainder.startsWith(`..${sep}`) ||
      realRemainder === '..' ||
      isAbsolute(realRemainder)
    )
      throw new Error('Refusing to change a build path that resolves outside the project.');
  }
  return target;
}

function removeGenerated(path) {
  const target = assertWorkspacePath(path);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

function runNextBuild(stage, environment) {
  return new Promise((resolveBuild, reject) => {
    const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'build', stage], {
      cwd: stage,
      env: environment,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveBuild();
      else
        reject(
          new Error(
            `The static build failed (${signal || code}). The previous Pages output was preserved.`,
          ),
        );
    });
  });
}

export async function buildPages() {
  require('@next/env').loadEnvConfig(workspace, false);
  const configuration = readPagesConfiguration();
  if (!existsSync(join(workspace, 'node_modules', 'next', 'package.json')))
    throw new Error('Install the project dependencies with npm ci before building Pages.');

  const buildRoot = assertWorkspacePath(join(workspace, '.pages-build'));
  mkdirSync(buildRoot, { recursive: true });
  assertWorkspacePath(buildRoot);
  const stage = assertWorkspacePath(mkdtempSync(join(buildRoot, 'stage-')));
  const modules = join(stage, 'node_modules');
  const output = assertWorkspacePath(join(workspace, 'out-pages'));
  let previousOutput;
  try {
    const omitted = new Set(['app/api', 'app/u/[username]', 'lib/server']);
    for (const name of [
      'app',
      'components',
      'lib',
      'public',
      'next.config.ts',
      'tsconfig.json',
      'next-env.d.ts',
      'package.json',
      'package-lock.json',
    ]) {
      const source = join(workspace, name);
      if (!existsSync(source)) continue;
      cpSync(source, join(stage, name), {
        recursive: true,
        filter: (path) => !omitted.has(relative(workspace, path).split(sep).join('/')),
      });
    }
    // Resolve installed packages within the same Turbopack root, without an
    // install, external requests, or changes to the self-hosted source tree.
    symlinkSync(
      join(workspace, 'node_modules'),
      modules,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await runNextBuild(stage, {
      ...process.env,
      NEXT_PUBLIC_STATIC_EXPORT: 'true',
      NEXT_PUBLIC_BASE_PATH: configuration.basePath,
      NEXT_PUBLIC_SITE_URL: configuration.siteUrl,
      NEXT_PUBLIC_SUPABASE_URL: configuration.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configuration.supabaseKey,
      // Do not copy an unused, potentially private legacy value into the bundle.
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      LINKBOARD_BUILD_ROOT: workspace,
      LINKBOARD_STANDALONE: '',
      NEXT_TELEMETRY_DISABLED: '1',
    });
    const exported = assertWorkspacePath(join(stage, 'out'));
    for (const file of ['index.html', 'login/index.html', 'setup/index.html', 'u/index.html', '404.html']) {
      if (!existsSync(join(exported, file)))
        throw new Error(`The Pages build is missing its ${file} entry point.`);
    }
    if (existsSync(join(exported, 'api')))
      throw new Error('The Pages output unexpectedly contains server API routes.');
    writeFileSync(join(exported, '.nojekyll'), '');
    if (existsSync(output)) {
      if (lstatSync(output).isSymbolicLink())
        throw new Error('Refusing to replace an output directory that is a symbolic link.');
      previousOutput = assertWorkspacePath(join(buildRoot, `previous-output-${randomUUID()}`));
      renameSync(output, previousOutput);
    }
    try {
      renameSync(exported, output);
    } catch (error) {
      if (previousOutput && existsSync(previousOutput) && !existsSync(output))
        renameSync(previousOutput, output);
      throw error;
    }
    if (previousOutput) removeGenerated(previousOutput);
    console.log(
      configuration.configured
        ? 'GitHub Pages export is ready in out-pages/. Accounts and data use the configured Supabase project.'
        : 'GitHub Pages export is ready in out-pages/. The app displays setup instructions until Supabase is configured; accounts and profile data are unavailable.',
    );
  } finally {
    // Detach the dependency junction first; never recursively traverse it.
    if (existsSync(modules) && lstatSync(modules).isSymbolicLink()) unlinkSync(modules);
    removeGenerated(stage);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  buildPages().catch((error) => {
    console.error(error instanceof Error ? error.message : 'The Pages build failed.');
    process.exitCode = 1;
  });
}

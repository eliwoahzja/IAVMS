#!/usr/bin/env node
/**
 * Installs the design and UI skills this project leans on into ./skills.
 *
 * Skills are installed artifacts, not source: everything under skills/ is
 * gitignored except skills/README.md, so the app repo and its Vercel build stay
 * small. Run `node scripts/install-skills.mjs` after a fresh clone.
 *
 * Every source is pinned to a commit so two runs produce the same files.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEST = join(ROOT, 'skills')

const RAW = 'https://raw.githubusercontent.com'

const SKILLS = [
  {
    name: 'frontend-design',
    repo: 'anthropics/claude-code',
    commit: 'a6e289a2e772a17b3614a9ef43303003de5cd887',
    license: 'All rights reserved (Anthropic PBC)',
    note: 'Not redistributed here: the claude-code repo grants no redistribution rights, so this is fetched into the local install instead of committed.',
    files: [{ from: 'plugins/frontend-design/skills/frontend-design/SKILL.md', as: 'SKILL.md' }],
  },
  {
    name: 'apple-design',
    repo: 'emilkowalski/skills',
    commit: '2d228630ba1446365f614a108cb8252f1feda202',
    license: 'MIT (c) 2026 Emil Kowalski',
    files: [
      { from: 'skills/apple-design/SKILL.md', as: 'SKILL.md' },
      { from: 'LICENSE', as: 'LICENSE' },
    ],
  },
  {
    name: 'no-ai-slop',
    repo: 'petergyang/no-ai-slop',
    commit: '000650b156983f5159695b441477f4e63b25dc85',
    license: 'MIT (c) 2026 Peter Yang',
    files: [
      { from: 'skills/no-ai-slop/SKILL.md', as: 'SKILL.md' },
      { from: 'LICENSE', as: 'LICENSE' },
    ],
  },
  {
    name: 'impeccable',
    repo: 'pbakaus/impeccable',
    commit: '374a0e179bb36725283a612462131705ba4780ae',
    license: 'Apache-2.0',
    dir: '.agent/skills/impeccable',
    extras: [
      { from: 'LICENSE', as: 'LICENSE' },
      { from: 'NOTICE.md', as: 'NOTICE.md' },
    ],
  },
  {
    name: 'ui-ux-pro-max',
    repo: 'nextlevelbuilder/ui-ux-pro-max-skill',
    commit: '56ea9cf174ed86786187daa9de0e6247cb0747e4',
    license: 'MIT (c) 2024 Next Level Builder',
    dir: '.claude/skills',
    extras: [{ from: 'LICENSE', as: 'LICENSE' }],
  },
]

function run(cmd, args, cwd) {
  const out = spawnSync(cmd, args, { cwd, encoding: 'utf8' })
  if (out.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed\n${out.stderr || out.stdout}`)
  }
  return (out.stdout || '').trim()
}

async function downloadFile(url, target) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  writeFileSync(target, await res.text())
}

/** Sparse-clone a repo at a pinned commit so we never pull its full history or assets. */
function checkout(repo, commit, dir) {
  const tmp = mkdtempSync(join(tmpdir(), 'skill-'))
  try {
    run('git', ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--sparse', `https://github.com/${repo}`, tmp])
    // Cone mode only takes directories, which is all we need here. Loose root files
    // such as LICENSE are fetched by URL instead of widening the sparse checkout.
    run('git', ['-C', tmp, 'sparse-checkout', 'set', dir])

    if (run('git', ['-C', tmp, 'rev-parse', 'HEAD']) !== commit) {
      // The branch moved since this pin. Ask for the exact commit so the install stays reproducible.
      run('git', ['-C', tmp, 'fetch', '--quiet', '--depth', '1', 'origin', commit])
      run('git', ['-C', tmp, 'checkout', '--quiet', commit])
    }
    return tmp
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    throw err
  }
}

async function install(skill) {
  const target = join(DEST, skill.name)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })

  if (skill.files) {
    for (const file of skill.files) {
      await downloadFile(`${RAW}/${skill.repo}/${skill.commit}/${file.from}`, join(target, file.as))
    }
  } else {
    const tmp = checkout(skill.repo, skill.commit, skill.dir)
    try {
      cpSync(join(tmp, skill.dir), target, { recursive: true })
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
    for (const extra of skill.extras ?? []) {
      await downloadFile(`${RAW}/${skill.repo}/${skill.commit}/${extra.from}`, join(target, extra.as))
    }
  }

  writeFileSync(
    join(target, 'SOURCE.md'),
    [
      `# ${skill.name}`,
      '',
      `- Upstream: https://github.com/${skill.repo}`,
      `- Commit: ${skill.commit}`,
      `- License: ${skill.license}`,
      '',
      skill.note ?? '',
      '',
      'Installed by `scripts/install-skills.mjs`. Edits here are overwritten on the next install.',
      '',
    ].join('\n'),
  )

  return target
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const queue = only.length ? SKILLS.filter((s) => only.includes(s.name)) : SKILLS
if (!queue.length) {
  console.error(`No matching skill. Known: ${SKILLS.map((s) => s.name).join(', ')}`)
  process.exit(1)
}

/** A skill is either one SKILL.md or a bundle of them one level down. */
function describe(target) {
  const single = join(target, 'SKILL.md')
  if (existsSync(single)) {
    return readFileSync(single, 'utf8').split('\n').find((l) => l.startsWith('name:')) ?? ''
  }
  const bundled = readdirSync(target, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(target, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
  return `${bundled.length} skills: ${bundled.join(', ')}`
}

let failed = 0
for (const skill of queue) {
  try {
    const target = await install(skill)
    console.log(`ok   ${skill.name.padEnd(18)} ${describe(target)}`)
  } catch (err) {
    failed += 1
    console.error(`FAIL ${skill.name.padEnd(18)} ${err.message.split('\n')[0]}`)
  }
}

console.log(`\n${queue.length - failed}/${queue.length} skills installed into skills/`)
process.exit(failed ? 1 : 0)

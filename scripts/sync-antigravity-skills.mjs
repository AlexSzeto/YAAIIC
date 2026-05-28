import { cp, mkdir, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(scriptDir, "..");

const syncSets = [
  {
    label: "skills",
    source: path.join(projectRoot, ".claude", "skills"),
    targets: [
      path.join(projectRoot, ".agents", "skills"),
    ],
    includeEntry: (entry) => entry.isDirectory(),
  },
  {
    label: "rules",
    source: path.join(projectRoot, ".claude", "rules"),
    targets: [
      path.join(projectRoot, ".agents", "rules"),
    ],
    includeEntry: () => true,
  },
];

async function pathExists(directory) {
  try {
    await realpath(directory);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function isInsideProject(resolvedTarget, resolvedProject) {
  const relative = path.relative(resolvedProject, resolvedTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function syncTree({ label, source, target, includeEntry }) {
  await mkdir(path.dirname(target), { recursive: true });

  if (await pathExists(target)) {
    const resolvedProject = await realpath(projectRoot);
    const resolvedTarget = await realpath(target);

    if (!isInsideProject(resolvedTarget, resolvedProject)) {
      throw new Error(`Refusing to remove target outside project root: ${resolvedTarget}`);
    }

    await rm(target, { recursive: true, force: true });
  }

  await mkdir(target, { recursive: true });

  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (!includeEntry(entry)) {
      continue;
    }

    await cp(path.join(source, entry.name), path.join(target, entry.name), {
      recursive: true,
    });
  }

  console.log(`Synced ${label} from ${source} to ${target}`);
}

for (const syncSet of syncSets) {
  if (!(await pathExists(syncSet.source))) {
    throw new Error(`Claude ${syncSet.label} directory not found: ${syncSet.source}`);
  }

  for (const target of syncSet.targets) {
    await syncTree({ ...syncSet, target });
  }
}

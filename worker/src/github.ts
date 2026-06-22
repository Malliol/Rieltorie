import yaml from "js-yaml";

interface FileEntry {
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
}

interface RepoRef {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rieltorie-worker",
  };
}

// Декодировать base64-содержимое файла GitHub в UTF-8 строку
function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface ObjectSummary {
  id: string;
  title: string;
  price: number;
}

// Список опубликованных объектов (id, заголовок, цена)
export async function listObjects(opts: RepoRef): Promise<ObjectSummary[]> {
  const { token, owner, repo, branch } = opts;
  const headers = ghHeaders(token);
  const dirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/content/objects?ref=${branch}`;
  const res = await fetch(dirUrl, { headers });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`List objects: ${await res.text()}`);
  const items = await res.json() as Array<{ name: string; url: string }>;
  const yamls = items.filter((i) => i.name.endsWith(".yaml"));

  return Promise.all(yamls.map(async (it) => {
    const fr = await fetch(it.url, { headers });
    const j = await fr.json() as { content: string };
    const parsed = yaml.load(decodeBase64Utf8(j.content)) as { id?: string; title?: string; price?: number };
    return {
      id: parsed.id ?? it.name.replace(/\.yaml$/, ""),
      title: parsed.title ?? "(без названия)",
      price: parsed.price ?? 0,
    };
  }));
}

// Получить профиль риелтора (распарсенный content/realtor.yaml)
export async function getRealtor(opts: RepoRef): Promise<unknown> {
  const { token, owner, repo, branch } = opts;
  const headers = ghHeaders(token);
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/content/realtor.yaml?ref=${branch}`, { headers });
  if (!res.ok) throw new Error(`Get realtor: ${await res.text()}`);
  const j = await res.json() as { content: string };
  return yaml.load(decodeBase64Utf8(j.content));
}

// Получить полный объект (распарсенный YAML) по id
export async function getObject(opts: RepoRef & { id: string }): Promise<unknown> {
  const { token, owner, repo, branch, id } = opts;
  const headers = ghHeaders(token);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/content/objects/${id}.yaml?ref=${branch}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Get object: ${await res.text()}`);
  const j = await res.json() as { content: string };
  return yaml.load(decodeBase64Utf8(j.content));
}

// Удалить объект (yaml) по id
export async function deleteObject(opts: RepoRef & { id: string }): Promise<void> {
  const { token, owner, repo, branch, id } = opts;
  const headers = ghHeaders(token);
  const path = `content/objects/${id}.yaml`;
  const base = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const getRes = await fetch(`${base}?ref=${branch}`, { headers });
  if (!getRes.ok) throw new Error(`Get for delete: ${await getRes.text()}`);
  const { sha } = await getRes.json() as { sha: string };

  const delRes = await fetch(base, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ message: `chore: remove object ${id}`, sha, branch }),
  });
  if (!delRes.ok) throw new Error(`Delete: ${await delRes.text()}`);
}

export async function atomicCommit(opts: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: FileEntry[];
}): Promise<string> {
  const { token, owner, repo, branch, message, files } = opts;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = ghHeaders(token);

  // 1. Get current branch ref
  const refRes = await fetch(`${base}/git/ref/heads/${branch}`, { headers });
  if (!refRes.ok) throw new Error(`GitHub ref: ${await refRes.text()}`);
  const { object: { sha: latestSha } } = await refRes.json() as { object: { sha: string } };

  // 2. Create blobs
  const blobs = await Promise.all(
    files.map(async (f) => {
      const res = await fetch(`${base}/git/blobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: f.content, encoding: f.encoding }),
      });
      if (!res.ok) throw new Error(`Blob ${f.path}: ${await res.text()}`);
      const { sha } = await res.json() as { sha: string };
      return { path: f.path, sha, mode: "100644", type: "blob" };
    })
  );

  // 3. Get base tree sha
  const commitRes = await fetch(`${base}/git/commits/${latestSha}`, { headers });
  const { tree: { sha: baseTree } } = await commitRes.json() as { tree: { sha: string } };

  // 4. Create tree
  const treeRes = await fetch(`${base}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ base_tree: baseTree, tree: blobs }),
  });
  if (!treeRes.ok) throw new Error(`Tree: ${await treeRes.text()}`);
  const { sha: treeSha } = await treeRes.json() as { sha: string };

  // 5. Create commit
  const commitCreateRes = await fetch(`${base}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, tree: treeSha, parents: [latestSha] }),
  });
  if (!commitCreateRes.ok) throw new Error(`Commit: ${await commitCreateRes.text()}`);
  const { sha: commitSha } = await commitCreateRes.json() as { sha: string };

  // 6. Update branch ref
  const updateRes = await fetch(`${base}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ sha: commitSha }),
  });
  if (!updateRes.ok) throw new Error(`Update ref: ${await updateRes.text()}`);

  return commitSha;
}

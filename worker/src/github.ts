interface FileEntry {
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
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
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rieltorie-worker",
  };

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

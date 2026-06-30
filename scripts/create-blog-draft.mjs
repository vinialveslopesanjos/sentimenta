#!/usr/bin/env node

const args = process.argv.slice(2);

function readArg(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

const apiBase = readArg("api", process.env.SENTIMENTA_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const token = readArg("token", process.env.SENTIMENTA_ADMIN_TOKEN || "");
const inputPath = readArg("input", "");

if (!token) {
  console.error("Missing admin token. Set SENTIMENTA_ADMIN_TOKEN or pass --token.");
  process.exit(1);
}

if (!inputPath) {
  console.error("Missing input JSON. Pass --input output/blog-briefs/weekly-blog-brief.json.");
  process.exit(1);
}

const { readFileSync } = await import("node:fs");
const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const payload = raw.adminPayload || raw;

const response = await fetch(`${apiBase}/api/v1/admin/blog/posts`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  console.error(`Failed to create blog draft: ${response.status}`);
  console.error(await response.text());
  process.exit(1);
}

const post = await response.json();
console.log(JSON.stringify({ id: post.id, slug: post.slug, status: post.status }, null, 2));

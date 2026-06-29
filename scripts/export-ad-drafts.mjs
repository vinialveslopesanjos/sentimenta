#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const source = "docs/aquisicao/ads-campaign-drafts.json";
const outDir = "output/ads";

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function writeCsv(path, rows) {
  mkdirSync(dirname(path), { recursive: true });
  if (rows.length === 0) {
    writeFileSync(path, "", "utf8");
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const draft = JSON.parse(readFileSync(source, "utf8"));

const googleRows = [];
for (const campaign of draft.google_search) {
  for (const headline of campaign.headlines) {
    googleRows.push({
      platform: "google_search",
      campaign: campaign.campaign,
      daily_budget_brl: campaign.daily_budget_brl,
      landing_url: campaign.landing_url,
      asset_type: "headline",
      text: headline,
    });
  }
  for (const description of campaign.descriptions) {
    googleRows.push({
      platform: "google_search",
      campaign: campaign.campaign,
      daily_budget_brl: campaign.daily_budget_brl,
      landing_url: campaign.landing_url,
      asset_type: "description",
      text: description,
    });
  }
  for (const keyword of campaign.keywords_phrase_match) {
    googleRows.push({
      platform: "google_search",
      campaign: campaign.campaign,
      daily_budget_brl: campaign.daily_budget_brl,
      landing_url: campaign.landing_url,
      asset_type: "phrase_match_keyword",
      text: keyword,
    });
  }
}

const metaRows = [];
for (const campaign of draft.meta_ads) {
  for (const primaryText of campaign.primary_texts) {
    metaRows.push({
      platform: "meta_ads",
      campaign: campaign.campaign,
      daily_budget_brl: campaign.daily_budget_brl,
      landing_url: campaign.landing_url,
      asset_type: "primary_text",
      text: primaryText,
    });
  }
  for (const headline of campaign.headlines) {
    metaRows.push({
      platform: "meta_ads",
      campaign: campaign.campaign,
      daily_budget_brl: campaign.daily_budget_brl,
      landing_url: campaign.landing_url,
      asset_type: "headline",
      text: headline,
    });
  }
  metaRows.push({
    platform: "meta_ads",
    campaign: campaign.campaign,
    daily_budget_brl: campaign.daily_budget_brl,
    landing_url: campaign.landing_url,
    asset_type: "creative_prompt",
    text: campaign.creative_prompt,
  });
}

writeCsv(`${outDir}/google-search-drafts.csv`, googleRows);
writeCsv(`${outDir}/meta-ads-drafts.csv`, metaRows);

console.log(`Wrote ${googleRows.length} Google rows and ${metaRows.length} Meta rows to ${outDir}`);

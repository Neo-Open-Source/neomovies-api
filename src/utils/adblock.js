const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Lazy-loaded in-memory set of ad domains
let adDomains = null;

function loadAdDomains() {
  if (adDomains) return adDomains;
  adDomains = new Set();
  try {
    const listPath = path.join(__dirname, '..', '..', 'easylist.txt');
    const data = fs.readFileSync(listPath, 'utf8');
    const lines = data.split('\n');
    const domainRegex = /^\|\|([^\/^]+)\^/; // matches ||domain.com^
    for (const line of lines) {
      const m = domainRegex.exec(line.trim());
      if (m) {
        adDomains.add(m[1].replace(/^www\./, ''));
      }
    }
    console.log(`Adblock: loaded ${adDomains.size} domains from easylist.txt`);
  } catch (e) {
    console.error('Adblock: failed to load easylist.txt', e);
    adDomains = new Set();
  }
  return adDomains;
}

function cleanHtml(html) {
  const domains = loadAdDomains();
  const $ = cheerio.load(html);
  const removed = [];
  $('script[src], iframe[src], img[src], link[href]').each((_, el) => {
    const attr = $(el).attr('src') || $(el).attr('href');
    if (!attr) return;
    try {
      const host = new URL(attr, 'https://dummy-base/').hostname.replace(/^www\./, '');
      if (domains.has(host)) {
        removed.push(host);
        $(el).remove();
      }
    } catch (_) {
      // ignore invalid URLs
    }
  });
  if (removed.length) {
    const unique = [...new Set(removed)];
    console.log(`Adblock removed resources from: ${unique.join(', ')}`);
  }
  return $.html();
}

module.exports = { cleanHtml };

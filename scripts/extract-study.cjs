const fs = require('fs');
const path = require('path');

const INTERVIEW = '/Users/liyang/Deepseek/projects/interview';
const SITE_HTML = path.join(INTERVIEW, 'site/index.html');
const SITE_JSON = path.join(INTERVIEW, 'tools/site.json');
const OUT_DIR = path.join(__dirname, '../data/study');

function extractData(source) {
  const marker = 'const DATA';
  const idx = source.indexOf(marker);
  if (idx < 0) throw new Error('DATA marker not found');
  const start = source.indexOf('{', idx);
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return JSON.parse(source.slice(start, end));
}

function rewriteAssets(html) {
  if (!html) return '';
  return html
    .replace(/src=(["'])([^"']*?\/?assets\/)/g, (_m, quote, rest) => `src=${quote}/study/${rest}`)
    .replace(/href=(["'])([^"']*?\/?assets\/)/g, (_m, quote, rest) => `href=${quote}/study/${rest}`);
}

function main() {
  const html = fs.readFileSync(SITE_HTML, 'utf8');
  const data = extractData(html);
  const siteConfig = JSON.parse(fs.readFileSync(SITE_JSON, 'utf8'));
  const slugById = new Map(siteConfig.topics.map((t) => [t.id, t.slug]));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const indexTopics = [];

  for (const topic of data.topics) {
    const slug = slugById.get(topic.id) || topic.id;
    const questions = topic.questions.map((q) => {
      const evidence = (q.evidence || []).map((group) => ({
        ...group,
        files: (group.files || []).map((file) => ({
          ...file,
          file: file.file ? `/study/${file.file}` : '',
        })),
      }));

      return {
        key: q.key,
        no: q.no,
        id: q.id,
        title: q.title,
        aliases: q.aliases || [],
        summary: q.summary || [],
        note: q.note || '',
        pages: q.pages || '',
        firstPage: q.firstPage || 0,
        answer: rewriteAssets(q.answer),
        evidence,
        search: q.search || '',
      };
    });

    const full = {
      id: topic.id,
      no: topic.no,
      slug,
      title: topic.title,
      label: topic.label,
      subtitle: topic.subtitle,
      accent: topic.accent,
      pages: topic.pages,
      count: topic.count,
      pdf: '',
      questions,
    };

    fs.writeFileSync(path.join(OUT_DIR, `${topic.id}.json`), JSON.stringify(full, null, 2));

    indexTopics.push({
      id: topic.id,
      no: topic.no,
      slug,
      title: topic.title,
      label: topic.label,
      subtitle: topic.subtitle,
      accent: topic.accent,
      pages: topic.pages,
      count: questions.length,
      questions: questions.map((q) => ({
        key: q.key,
        no: q.no,
        id: q.id,
        title: q.title,
        aliases: q.aliases,
        summary: q.summary,
        note: q.note,
        pages: q.pages,
        firstPage: q.firstPage,
        search: q.search,
      })),
    });

    console.log(`  ${topic.no} ${topic.id} -> ${slug} (${questions.length} q)`);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(
      {
        meta: {
          title: 'Java 面试宝典 · 原文精读',
          subtitle: '42 个专题 · 题干原文逐字还原 · PDF 截图取证',
          pages: data.meta.pages,
          topics: indexTopics.length,
          count: indexTopics.reduce((sum, t) => sum + t.count, 0),
        },
        topics: indexTopics,
      },
      null,
      2,
    ),
  );

  console.log(`done: ${indexTopics.length} topics`);
}

main();

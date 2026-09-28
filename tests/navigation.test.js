import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages, pageUrl } from '../src/navigation.js';

test('links mantêm demonstração e ID do rascunho em subpastas do GitHub Pages', () => {
  const path = pageUrl('compose', { draft: 'abc-123' }, '?demo=1');
  const url = new URL(path, 'https://example.com/devnox/campanhas.html');
  assert.equal(url.pathname, '/devnox/nova-campanha.html');
  assert.equal(url.searchParams.get('demo'), '1');
  assert.equal(url.searchParams.get('draft'), 'abc-123');
  assert.equal(pageUrl('contacts', {}, ''), './contatos.html');
  assert.equal(pageUrl('https://outro-site.com', {}, ''), './contatos.html');
});

test('cada destino tem HTML próprio e todos os recursos locais existem', async () => {
  for (const [page, file] of Object.entries(pages)) {
    const html = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    assert.ok(html.includes(`data-page="${page}"`), file);
    assert.ok(html.includes('src="./src/main.js"'), file);
    for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)) {
      await readFile(new URL('../' + match[1], import.meta.url));
    }
    assert.ok(!/href="#(?:contacts|compose|campaigns|profile|settings|channels)"/.test(html));
    if (!['login', 'signup'].includes(page)) assert.ok(html.includes('id="page-content"'), file);
  }
  const contacts = await readFile(new URL('../contatos.html', import.meta.url), 'utf8');
  assert.ok(contacts.includes('id="contact-form"'));
});

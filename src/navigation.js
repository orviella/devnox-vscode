// Cada tela tem um arquivo HTML. Os caminhos relativos também funcionam no GitHub Pages.
export const pages = {
  login: 'login.html',
  signup: 'cadastro.html',
  contacts: 'contatos.html',
  compose: 'nova-campanha.html',
  campaigns: 'campanhas.html',
  channels: 'canais.html',
  settings: 'configuracoes.html',
  profile: 'perfil.html',
};

export function pageUrl(page, parameters = {}, search = location.search) {
  const query = new URLSearchParams(parameters);
  // A demonstração deve continuar local ao trocar de página.
  if (new URLSearchParams(search).get('demo') === '1') query.set('demo', '1');
  return `./${pages[page] || pages.contacts}${query.size ? `?${query}` : ''}`;
}

export function navigate(page, parameters = {}) {
  location.assign(pageUrl(page, parameters));
}

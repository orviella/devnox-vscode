import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContact } from '../src/domain.js';

test('contato: recusa nomes vazios e destinos ou links inválidos', () => {
  for (const contact of [{name:'  '}, {name:'A',phone:'123'}, {name:'A',telegram_chat_id:'@nome'}, {name:'A',link:'javascript:alert(1)'}]) {
    assert.throws(() => validateContact(contact));
  }
  assert.equal(validateContact({name:' Ana ',telegram_chat_id:' -123 ', consent:true}).name,'Ana');
});

test('CRUD de demonstração: criação, leitura, edição e exclusão persistem', async () => {
  const previous = {supabase:globalThis.supabase,location:globalThis.location,localStorage:globalThis.localStorage};
  const memory = new Map();
  globalThis.supabase = { createClient:() => { throw new Error('Demo não deve conectar ao Supabase'); } };
  globalThis.location = {search:'?demo=1'};
  globalThis.localStorage = {getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
  try {
    const api = await import('../src/data.js?test=demo');
    await api.saveContact({name:'Teste CRUD',telegram_chat_id:'123'});
    const contact = (await api.load()).contacts.find(c=>c.name==='Teste CRUD');
    assert.ok(contact.id);
    await api.saveContact({...contact,name:'Teste editado'});
    assert.equal((await api.load()).contacts.find(c=>c.id===contact.id).name,'Teste editado');
    await api.deleteContact(contact.id);
    assert.equal((await api.load()).contacts.some(c=>c.id===contact.id),false);
    await assert.rejects(api.deleteContact(contact.id), /não encontrado/);
    await assert.rejects(api.saveContact({...contact,name:'Não recriar'}), /não encontrado/);
    assert.equal((await api.load()).contacts.some(c=>c.id===contact.id),false);
  } finally {
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key]=value;
    }
  }
});

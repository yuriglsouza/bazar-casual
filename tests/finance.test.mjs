import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, localDate, scheduledDate, whatsappLink } from '../src/lib/finance.ts';
import { readAll, readWithAuthRetry } from '../src/lib/read-all.ts';

test('moeda aceita centavos com ponto ou vírgula sem multiplicar o valor', () => {
  for (const [input, expected] of [['406,82',40682],['406.82',40682],['2.034,10',203410],['1.000',100000],['0,01',1],['R$ 12,5',1250]]) assert.equal(parseMoney(input),expected);
  for (const input of ['1,234.56','1e3','-10','12.3456','', 'Infinity']) assert.ok(Number.isNaN(parseMoney(input)));
});
test('mensal respeita fevereiro, ano bissexto e o dia original', () => {
  assert.equal(scheduledDate('2026-01-31',1,'monthly'),'2026-02-28');
  assert.equal(scheduledDate('2024-01-31',1,'monthly'),'2024-02-29');
  assert.equal(scheduledDate('2026-01-31',2,'monthly'),'2026-03-31');
  assert.equal(scheduledDate('2026-12-31',1,'monthly'),'2027-01-31');
  assert.equal(scheduledDate('2026-09-30',1,'weekly'),'2026-10-07');
  assert.equal(scheduledDate('2026-09-30',1,'biweekly'),'2026-10-15');
});
test('data de São Paulo não adianta mês à noite', () => {
  assert.equal(localDate('2026-10-01T01:00:00Z'),'2026-09-30');
  assert.equal(localDate('2026-10-01T03:00:00Z'),'2026-10-01');
});
test('telefone internacional não recebe DDI duplicado', () => {
  assert.equal(whatsappLink('+55 (11) 99999-1234'),whatsappLink('(11) 99999-1234'));
});
test('leitura inclui registros além do limite por página', async () => {
  const rows = Array.from({length:1203},(_,id)=>({id}));
  const result = await readAll(async (from,to)=>({data:rows.slice(from,to+1),error:null}));
  assert.deepEqual(result.data,rows);
});
test('falha parcial não vira resultado vazio ou total incompleto', async () => {
  await assert.rejects(readAll(async (from)=>from===0 ? {data:Array(500).fill(1),error:null} : {data:null,error:new Error('offline')}));
});

test('erro temporário de sessão é tentado novamente sem perder parcelas', async () => {
  let calls = 0;
  const result = await readAll(async () => {
    calls++;
    return calls === 1 ? { data: null, error: { code: 'PGRST303' } } : { data: [{ id: 1 }], error: null };
  }, 'parcelas');
  assert.equal(calls, 2);
  assert.deepEqual(result.data, [{ id: 1 }]);
});

test('outras falhas de leitura não são repetidas', async () => {
  let calls = 0;
  const result = await readWithAuthRetry(async () => { calls++; return { data: null, error: { code: '42501' } }; }, 'teste');
  assert.equal(calls, 1);
  assert.equal(result.error.code, '42501');
});

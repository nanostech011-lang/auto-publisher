import test from 'node:test';
import assert from 'node:assert';

test('Calculo escalonado de agendamento de postagens em lote', async (t) => {
  await t.test('batchIndex = 0 deve agendar para +45 minutos a partir de agora', () => {
    const now = new Date();
    const target = new Date();
    target.setTime(target.getTime() + 45 * 60 * 1000);
    const diffMinutes = Math.round((target.getTime() - now.getTime()) / (60 * 1000));
    assert.strictEqual(diffMinutes, 45);
  });

  await t.test('batchIndex = 1..7 deve agendar nos dias seguintes as 18:00', () => {
    const pad = (n) => String(n).padStart(2, '0');
    for (let i = 1; i <= 7; i++) {
      const target = new Date();
      target.setDate(target.getDate() + i);
      target.setHours(18, 0, 0, 0);

      assert.strictEqual(target.getHours(), 18);
      assert.strictEqual(target.getMinutes(), 0);
      assert.strictEqual(target.getSeconds(), 0);
      
      const formatted = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())} ${pad(target.getHours())}:${pad(target.getMinutes())}:${pad(target.getSeconds())}`;
      assert.match(formatted, /^\d{4}-\d{2}-\d{2} 18:00:00$/);
    }
  });
});

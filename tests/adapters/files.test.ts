import { BrowserTextFileReader } from '@/adapters/files/BrowserTextFileReader';
import { JsonTextParser } from '@/adapters/parsing/JsonTextParser';
import { PapaCsvParser } from '@/adapters/parsing/PapaCsvParser';

const fileOf = (name: string, bytes: Uint8Array) => ({
  name,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

describe('lecture de fichiers', () => {
  const reader = new BrowserTextFileReader();

  it('lit un fichier UTF-8', async () => {
    const file = fileOf('releve.csv', new TextEncoder().encode('Libellé;Montant'));
    expect(await reader.read(file)).toEqual({ ok: true, value: 'Libellé;Montant' });
  });

  it('lit un export bancaire encodé en Windows-1252', async () => {
    const file = fileOf('releve.csv', new Uint8Array([0x43, 0x61, 0x66, 0xe9]));
    expect(await reader.read(file)).toEqual({ ok: true, value: 'Café' });
  });

  it('renvoie une erreur nommant le fichier illisible', async () => {
    const broken = {
      name: 'abime.csv',
      arrayBuffer: async () => {
        throw new Error('lecture impossible');
      },
    };
    expect(await reader.read(broken)).toEqual({
      ok: false,
      error: { code: 'file-unreadable', detail: 'abime.csv' },
    });
  });

  it('refuse un objet qui n’est pas un fichier', async () => {
    expect(await reader.read({ name: 'faux' })).toMatchObject({
      ok: false,
      error: { code: 'file-unreadable' },
    });
  });
});

describe('analyse CSV', () => {
  const parser = new PapaCsvParser();

  it('détecte le séparateur point-virgule des exports bancaires', () => {
    expect(parser.parse('﻿Date;Libellé;Montant\n05/11/2026;"Café; terrasse";-2,50\n')).toEqual({
      ok: true,
      value: [
        ['Date', 'Libellé', 'Montant'],
        ['05/11/2026', 'Café; terrasse', '-2,50'],
      ],
    });
  });

  it('signale un CSV vide', () => {
    expect(parser.parse('   \n')).toEqual({ ok: false, error: { code: 'empty-csv' } });
  });
});

describe('analyse JSON', () => {
  const parser = new JsonTextParser();

  it('lit un JSON valide', () => {
    expect(parser.parse('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('remonte une erreur typée pour un JSON invalide', () => {
    expect(parser.parse('{oops')).toEqual({ ok: false, error: { code: 'invalid-json' } });
  });
});

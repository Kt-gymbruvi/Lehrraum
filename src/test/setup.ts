import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { schliesseFuerTests } from '../speicher/datenbank.ts'

// Jeder Test beginnt mit leerem Gerätespeicher.
beforeEach(async () => {
  await schliesseFuerTests()
  globalThis.indexedDB = new IDBFactory()
  window.localStorage.clear()
})

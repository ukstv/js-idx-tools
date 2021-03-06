import type { IDXDefinitionName, IDXPublishedSchemas } from '@ceramicstudio/idx-constants'
import type { DID } from 'dids'

import { signIDXDefinitions } from './signing'
import type { Definition, IDXSignedDefinitions } from './types'

export function createIDXDefinitions(
  schemas: IDXPublishedSchemas
): Record<IDXDefinitionName, Definition> {
  return {
    basicProfile: {
      name: 'Basic Profile',
      description: 'Basic profile information for a DID',
      schema: schemas.BasicProfile,
    },
    cryptoAccounts: {
      name: 'Crypto Accounts',
      description: 'Crypto accounts linked to your DID',
      schema: schemas.CryptoAccounts,
    },
    threeIdKeychain: {
      name: '3ID Keychain',
      description: 'Key data for 3ID',
      schema: schemas.ThreeIdKeychain,
    },
  }
}

export async function createIDXSignedDefinitions(
  did: DID,
  schemas: IDXPublishedSchemas
): Promise<IDXSignedDefinitions> {
  const definitions = createIDXDefinitions(schemas)
  return await signIDXDefinitions(did, schemas.Definition, definitions)
}

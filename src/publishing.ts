import type { CeramicApi, DocMetadata } from '@ceramicnetwork/ceramic-common'
import type DocID from '@ceramicnetwork/docid'
import type { DagJWSResult } from 'dids'
import isEqual from 'fast-deep-equal'

import { publishedSchemas } from './constants'
import { signedDefinitions, signedDID, signedSchemas } from './signed'
import type {
  Definition,
  DefinitionDoc,
  IDXDefinitionName,
  IDXPublishedConfig,
  IDXPublishedDefinitions,
  IDXPublishedSchemas,
  IDXSchemaName,
  IDXSignedDefinitions,
  IDXSignedSchemas,
  PublishDoc,
  SchemaDoc,
} from './types'
import { promiseMap, docIDToString } from './utils'
import { validateSchema } from './validate'

export async function createTile<T = unknown>(
  ceramic: CeramicApi,
  content: T,
  metadata: Partial<DocMetadata> = {}
): Promise<DocID> {
  if (ceramic.did == null) {
    throw new Error('Ceramic instance is not authenticated')
  }

  if (metadata.controllers == null || metadata.controllers.length === 0) {
    metadata.controllers = [ceramic.did.id]
  }

  const doc = await ceramic.createDocument('tile', { content, metadata: metadata as DocMetadata })
  await ceramic.pin.add(doc.id)
  return doc.id
}

export async function publishDoc<T = unknown>(
  ceramic: CeramicApi,
  doc: PublishDoc<T>
): Promise<DocID> {
  if (doc.id == null) {
    return await createTile(ceramic, doc.content, {
      controllers: doc.controllers,
      schema: doc.schema ? docIDToString(doc.schema) : undefined,
    })
  }

  const loaded = await ceramic.loadDocument(doc.id)
  if (!isEqual(loaded.content, doc.content)) {
    await loaded.change({ content: doc.content })
  }
  return loaded.id
}

export async function createDefinition(
  ceramic: CeramicApi,
  definition: Definition
): Promise<DocID> {
  return await createTile(ceramic, definition, { schema: publishedSchemas.Definition })
}

export async function updateDefinition(ceramic: CeramicApi, doc: DefinitionDoc): Promise<boolean> {
  const loaded = await ceramic.loadDocument(doc.id)
  if (loaded.metadata.schema !== publishedSchemas.Definition) {
    throw new Error('Document is not a valid Definition')
  }

  if (!isEqual(loaded.content, doc.content)) {
    await loaded.change({ content: doc.content })
    return true
  }
  return false
}

export async function publishRecords(
  ceramic: CeramicApi,
  [genesis, ...updates]: Array<DagJWSResult>
): Promise<DocID> {
  const doc = await ceramic.createDocumentFromGenesis(genesis)
  await ceramic.pin.add(doc.id)
  for (const record of updates) {
    await ceramic.applyRecord(doc.id, record, { applyOnly: true })
  }
  return doc.id
}

export async function publishSchema(ceramic: CeramicApi, doc: SchemaDoc): Promise<DocID> {
  if (!validateSchema(doc.content)) {
    throw new Error(`Schema ${doc.name} is invalid or not secure`)
  }
  return await publishDoc(ceramic, doc)
}

export async function publishSignedMap<T extends string = string>(
  ceramic: CeramicApi,
  signed: Record<T, Array<DagJWSResult>>
): Promise<Record<T, DocID>> {
  return await promiseMap(signed, async (records) => await publishRecords(ceramic, records))
}

export async function publishIDXSignedDefinitions(
  ceramic: CeramicApi,
  definitions: IDXSignedDefinitions = signedDefinitions
): Promise<IDXPublishedDefinitions> {
  const signedMap = await publishSignedMap(ceramic, definitions)
  return Object.entries(signedMap).reduce((acc, [key, id]) => {
    acc[key as IDXDefinitionName] = id.toString()
    return acc
  }, {} as IDXPublishedDefinitions)
}

export async function publishIDXSignedDID(
  ceramic: CeramicApi,
  records: Array<DagJWSResult> = signedDID
): Promise<DocID> {
  return await publishRecords(ceramic, records)
}

export async function publishIDXSignedSchemas(
  ceramic: CeramicApi,
  schemas: IDXSignedSchemas = signedSchemas
): Promise<IDXPublishedSchemas> {
  const signedMap = await publishSignedMap(ceramic, schemas)
  return Object.entries(signedMap).reduce((acc, [key, id]) => {
    acc[key as IDXSchemaName] = id.toUrl('base36')
    return acc
  }, {} as IDXPublishedSchemas)
}

export async function publishIDXConfig(ceramic: CeramicApi): Promise<IDXPublishedConfig> {
  await publishIDXSignedDID(ceramic)
  const [definitions, schemas] = await Promise.all([
    publishIDXSignedDefinitions(ceramic),
    publishIDXSignedSchemas(ceramic),
  ])
  return { definitions, schemas }
}

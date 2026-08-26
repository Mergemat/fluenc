import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import * as schema from './schema'
import { getTursoCredentials } from './config'

const client = createClient(getTursoCredentials())

export const db = drizzle(client, { schema })

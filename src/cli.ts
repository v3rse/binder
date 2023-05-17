#!/usr/bin/env node
import { argv } from 'process'
import { run, createEntry } from './index'

const [, , ...args] = argv

function usage(message) {
  console.error(`binder: ${message ? message + " ": ""}
Usage: binder <src> <obj> | entry <entry-name>`)
  process.exit(1)
}

async function cli() {
  if(args[0] === 'entry') {
    if(!args[1]) {
      usage('entry name required')
    }
    await createEntry(args[1])
  }else {
    console.time('binder')
    if (args.length < 2) {
      usage('not enough args')
    }

    const ctx = {
      src: args[0],
      dest: args[1]
    }
    await run(ctx)
    console.timeEnd('binder')
  }
}

cli().catch(err => {
    if(!process.env.DEBUG) {
      console.error('binder:', err.message)
    }else {
      throw err
    }
})

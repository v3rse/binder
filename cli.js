#!/usr/bin/env node

const {argv} = require('process')
const {run} = require('./index')
const {parseFile} = require('./parser')

const [, , ...args] = argv

function usage(message) {
  console.error(`binder: ${message ? message + " ": ""}
Usage: binder [parse] [src] [obj]`)
  process.exit(1)
}

async function cli() {
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

cli().catch(err => {
    if(!process.env.DEBUG) {
      console.error('binder:', err.message)
    }else {
      throw err
    }
})

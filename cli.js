#!/usr/bin/env node

const {argv} = require('process')
const {generatePage, run} = require('./index')
const {parseFile} = require('./parser')

const [, , ...args] = argv

function usage(message) {
  console.error(`binder: ${message ? message + " ": ""}
Usage: binder [parse] [src] [obj]`)
  process.exit(1)
}

async function cli() {
  if (args[0] === 'parse') {
    if (!args[1]) {
      usage('bndr file path required')
    }
    const parsed = await parseFile(args[1])
    console.log(generatePage(parsed))
  } else {
    if (args.length < 2) {
      usage('not enough args')
    }

    const ctx = {
      src: args[0],
      dest: args[1]
    }
    await run(ctx)
  }
}

cli().catch(err => {
    if(!process.env.DEBUG) {
      console.error('binder:', err.message)
    }else {
      throw err
    }
})

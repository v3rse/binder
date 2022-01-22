#!/usr/bin/env node

const {argv} = require('process')
const main = require('./index')
const {parseFile, generatePage} = require('./parser')

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
    const {header, body} = await parseFile(args[1])
    console.log(generatePage(header, body, '', '.'))
  } else {
    if (args.length < 2) {
      usage('not enough args')
    }
    await main(args)
  }
}

cli().catch(err => console.error('binder:', err.message))

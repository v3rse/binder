#!/usr/bin/env node

const {argv} = require('process')
const main = require('./index')

const [, , ...args] = argv
main(args).catch(err => console.error('binder:', err.message))

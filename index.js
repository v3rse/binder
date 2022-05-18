const path = require('path')
const { constants } = require('fs')
const {
  access,
  mkdir,
  readdir,
  readFile,
  writeFile,
  stat
} = require('fs/promises')
const { readdirSync, existsSync } = require('fs')
const { parseFile } = require('./parser')
const { composeAsync, isUndefined } = require('./utils')

const BNDREXTENSION = '.bndr'
const LINKSDIR = 'links'
const MEDIADIR = 'media'

const isBndrFile = file => path.extname(file) === BNDREXTENSION
const dateFormater = new Intl.DateTimeFormat(
  'en-US',
  {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
)

async function exists(path) {
  try {
    await access(path, constants.F_OK)
  } catch (err) {
    return false
  }
  return true
}

async function indexSource(src) {
  const dir = readdirSync(src)

  // create parallel operations for collecting file details
  const jobs = dir.map(async item => {
    const srcPath = path.join(src, item)
    const stats = await stat(srcPath)

    if (stats.isFile() && isBndrFile) {
      return {
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
        srcPath,
        name: path.basename(item, BNDREXTENSION)
      }
    }
  })

  // filter out empty entries cause by directories
  return (await Promise.all(jobs)).filter(details => !isUndefined(details))
}

function generatePage(file) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <title>${file.header.title}</title>
        <link href="${LINKSDIR}/main.css" rel="stylesheet">
      </head>
      <body>
        <header> <h1>${file.header.title}</h1> </header>
        <nav>
          ${file.nav}
        </nav>
        <main>${file.body}</main>
        <footer>
          ${file.createdAt && file.updatedAt ?
      `
              <p>Created on ${dateFormater.format(file.createdAt).toLowerCase()}</p>
              <p>Updated on ${dateFormater.format(file.updatedAt).toLowerCase()}</p>
            `
      : ""
    }
        </footer>
      </body>
    </html>
    `
}

function generateCurrentNav(parent = "default", name, links) {
  const neighbours = links[parent].children

  return `<ul>${neighbours.map(li => `<li><a href="${li}.html">${li === name ? `<em>${li}</em>` : li}</a></li>`).join('')}</ul>`
}

function generateOtherNav(name = 'default', links) {
  const { children = [] } = links[name] || {}
  return `<ul>${children.map(li => `<li><a href="${li}.html">${li}</a></li>`).join('')}</ul>`
}

function generateNav(parent, parentsParent, name, links) {
  return `
  ${!parent ? '' : generateOtherNav(parentsParent, links)}
  ${generateCurrentNav(parent, name, links)}
  ${generateOtherNav(name, links)}
  `
}

async function mkdirCond(path) {
  if (!await exists(path)) {
    return mkdir(path, { recursive: true })
  }
}

async function copyDir(from, to) {
  await mkdirCond(to)

  const items = await readdir(from)
  const ops = []

  for (const item of items) {
    const stats = await stat(path.join(from, item))

    // check if directory and copy recursively
    if (stats.isDirectory()) {
      const src = path.join(from, item)
      const dest = path.join(to, item)
      ops.push(copyDir(src, dest))
    } else {
      // read and write file to new location
      // TODO: might do this with a stream to see the performance diff
      const file = await readFile(path.join(from, item))
      op = writeFile(path.join(to, item), file)
      ops.push(op)
    }
  }

  return Promise.all(ops)
}

async function pre(ctx) {
  console.time('pre')
  // clean paths
  const pathRegex = new RegExp(`${path.sep}$`)
  ctx.src = ctx.src.replace(pathRegex, '')
  ctx.dest = ctx.dest.replace(pathRegex, '')

  // scan the src directory for binder files
  ctx.index = await indexSource(ctx.src)

  console.timeEnd('pre')
  return ctx
}

async function parse(ctx) {
  console.time('parse')
  for (let i = 0; i < ctx.index.length; i++) {
    const page = await parseFile(ctx.index[i].srcPath)
    ctx.index[i] = {
      ...ctx.index[i],
      ...page
    }
  }

  console.timeEnd('parse')
  return ctx
}

async function map(ctx) {
  console.time('map')
  const pageMap = { default: { children: [] } }

  for (const entry of ctx.index) {
    const parent = entry.header.parent || 'default'
    if (!pageMap[parent]) {
      pageMap[parent] = { children: [] }
    }

    pageMap[parent].children.push(entry.name)
  }

  ctx.pageMap = pageMap
  console.timeEnd('map')
  return ctx
}

function findEntry(name, entries) {
  return entries.filter(entry => entry.name === name)[0] || {}
}

async function build(ctx) {
  console.time('build')
  let writeOps = []

  await mkdirCond(ctx.dest)

  for (let entry of ctx.index) {
    const parentsParent = findEntry(entry.header.parent, ctx.index).header?.parent
    entry.nav = generateNav(entry.header.parent, parentsParent, entry.name, ctx.pageMap)

    const objPath = path.join(ctx.dest, `${entry.name}.html`)
    writeOps.push(writeFile(
      objPath,
      generatePage(entry)
    ))
  }

  await Promise.all(writeOps)
  console.timeEnd('build')
  return ctx
}

async function post(ctx) {
  console.time('post')
  // copy asset directories
  const rootPaths = [ctx.src, ctx.dest]

  // construct source and destination paths
  const linkPaths = rootPaths.map(p => path.join(p, LINKSDIR))
  const mediaPaths = rootPaths.map(p => path.join(p, MEDIADIR))

  // copy for both folders
  await Promise.all([linkPaths, mediaPaths].map(paths => copyDir(...paths)))

  console.timeEnd('post')
  console.log(`site built in ${ctx.dest}`)
}

function run(ctx) {
  if (!existsSync(path.join(ctx.src, LINKSDIR))) {
    throw new Error(`expected "${LINKSDIR}" directory to exist`)
  }
  if (!existsSync(path.join(ctx.src, MEDIADIR))) {
    throw new Error(`expected "${MEDIADIR}" directory to exist`)
  }

  return composeAsync(
    pre,
    parse,
    map,
    build,
    post
  )(ctx)
}

module.exports = {
  run,
}

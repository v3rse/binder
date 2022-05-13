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
const HIDDENINMENU = ['CNAME']
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

async function scanSource(src) {
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
        fileName: path.basename(item, BNDREXTENSION)
      }
    }
  })

  // filter out empty entries cause by directories
  return (await Promise.all(jobs)).filter(details => !isUndefined(details))
}

async function buildObj(file, dest) {
  const objPath = path.join(dest, `${file.fileName}.html`)
  return writeFile(
    objPath,
    generatePage(file)
  )
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
          <ul>
            <!--MENU-->
          </ul>
        </nav>
        <main>${file.body}</main>
        <footer>
          ${
            file.createdAt && file.updatedAt ?
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
    const stats =  await stat(path.join(from, item))

    // check if directory and copy recursively
    if(stats.isDirectory()) {
      const src =  path.join(from, item)
      const dest = path.join(to, item)
      ops.push(copyDir(src, dest))
    }else{
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
  // clean paths
  const pathRegex = new RegExp(`${path.sep}$`)
  ctx.src = ctx.src.replace(pathRegex, '')
  ctx.dest = ctx.dest.replace(pathRegex, '')

  // scan the src directory for binder files
  ctx.srcFileLists = await scanSource(ctx.src)

  return ctx
}

async function build(ctx) {
  let writeOps = []

  // create destination is it doesn't exist
  await mkdirCond(ctx.dest) 
  for (let i = 0; i < ctx.srcFileLists.length; i++) {
    const page = await parseFile(ctx.srcFileLists[i].srcPath)

    ctx.srcFileLists[i] = {
      ...ctx.srcFileLists[i],
      ...page
    }

    console.log('entry one ==>', ctx.srcFileLists[i])

    op = buildObj(ctx.srcFileLists[i], ctx.dest)
    writeOps.push(op)
  }

  await Promise.all(writeOps)
  return ctx
}

async function post(ctx) {
  // copy asset directories
  const rootPaths = [ctx.src, ctx.dest]

  // construct source and destination paths
  const linkPaths = rootPaths.map(p => path.join(p, LINKSDIR))
  const mediaPaths = rootPaths.map(p => path.join(p, MEDIADIR))

  // copy for both folders
  await Promise.all([linkPaths, mediaPaths].map(paths => copyDir(...paths)))

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
    build,
    post
  )(ctx)
}

module.exports = {
  generatePage,
  run,
}

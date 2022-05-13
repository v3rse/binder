const path = require('path')
const { constants } = require('fs')
const {
  access,
  mkdir,
  readFile,
  writeFile,
  stat
} = require('fs/promises')
const { readdirSync } = require('fs')
const { parseFile } = require('./parser')
const { composeAsync, isUndefined } = require('./utils')

const BNDREXTENSION = '.bndr'
const HIDDENINMENU = ['CNAME']
const LINKSDIR = 'links'

const isBndrFile = file => path.extname(file) === BNDREXTENSION
const dateFormater = new Intl.DateTimeFormat(
  'en-US',
  {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
)



async function pre(ctx) {
  // clean paths
  const pathRegex = new RegExp(`${path.sep}$`)
  ctx.src = ctx.src.replace(pathRegex, '')
  ctx.dest = ctx.dest.replace(pathRegex, '')

  // scan the src directory for binder files
  ctx.srcFileLists = await scanSource(ctx.src)

  return ctx
}

async function post({ args, indexBody }) {
  const [, obj] = args
  await writeFile(
    path.join(obj, `index.html`),
    generatePage(
      { title: 'Index', date: new Date() },
      `
      <ul>
        ${indexBody}
      </ul>
      `,
      '',
      '.'
    )
  )

  console.log(`site built in ${obj}`)
}

async function exists(path) {
  try {
    await access(path, constants.F_OK)
  } catch (err) {
    return false
  }
  return true
}

async function build(ctx) {
  let writeOps = []

  // create destination is it doesn't exist
  if (!await exists(ctx.dest)) await mkdir(ctx.dest, { recursive: true })
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

function buildMenu(metaEntry, metaData, homeDepth) {
  const neighbours = metaData.filter(
    entry => entry.parent === metaEntry.parent && !HIDDENINMENU.includes(entry.fileName)
  )

  return neighbours.reduce(
    (prev, curr) =>
      curr.fileName === metaEntry.fileName
        ? `${prev}<li><strong><em>${curr.fileName}</strong></em></li>`
        : `${prev}<li><a href="${curr.fileName}.html"><strong>${curr.fileName}</strong></a></li>`
    , `<li><a href="${homeDepth}/index.html">back to index</a></li>`)
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

function run(ctx) {
  return composeAsync(
    pre,
    build,
    // post
  )(ctx)
}

module.exports = {
  generatePage,
  run,
}



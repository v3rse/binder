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
const { parseFile, generatePage } = require('./parser')

const ROOTPARENTNAME = 'home'
const dateFormater = new Intl.DateTimeFormat(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  )

module.exports = async function main(args) {
  let [src, obj] = args
  src = src.replace(/\/$/, '')
  obj = obj.replace(/\/$/, '')

  const indexBody = await build(src, obj)
  await writeFile(
    path.join(obj, `index.html`),
    generatePage(
      {title: 'Index', date: new Date()},
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

async function build(src, obj) {
  let indexBody = ''
  let meta = await collectMetaData(src, obj)

  let writeOps = []

  for (const entry of meta) {
    if(!await exists(entry.destPath)) await mkdir(entry.destPath, {recursive: true})

    const homeDepth = entry.parent === ROOTPARENTNAME ? '.' : entry.destPath
    .split(path.sep)
    .filter(pt => pt !== entry.parent )
    .map(_ => '..')
    .join(path.sep)

    if(entry.extension !== '.bndr') {
      const resource = await readFile(path.join(
        entry.srcPath,
        `${entry.fileName}${entry.extension}`
      ))
      op = writeFile(
        path.join(entry.destPath, `${entry.fileName}${entry.extension}`),
        resource
      )
      writeOps.push(op)
    }else {
     const sheet = await parseFile(
      path.join(
        entry.srcPath,
        `${entry.fileName}.bndr`
      ))

      const menu = buildMenu(entry, meta, homeDepth)

      op = buildObj(sheet, entry, menu, homeDepth)
      writeOps.push(op)
      indexBody += `
      <li>
        <time datetime="${sheet.header.date}">
          ${dateFormater.format(sheet.header.date)}
        </time>
        <a href="${path.join(entry.nav, entry.fileName)}.html">
          ${sheet.header.title}
        </a>\n
      </li>
      `
    }
  }

  await Promise.all(writeOps)
  return indexBody
}

function buildMenu(metaEntry, metaData, homeDepth) {
  const neighbours = metaData.filter(entry => entry.parent === metaEntry.parent)

  return neighbours.reduce(
    (prev, curr) => 
    curr.fileName === metaEntry.fileName 
    ? `${prev}<li><strong><em>${curr.fileName}</strong></em></li>`
    : `${prev}<li><a href="${curr.fileName}.html"><strong>${curr.fileName}</strong></a></li>`
  , `<li><a href="${homeDepth}/index.html">back to index</a></li>`)
}

async function collectMetaData(src, obj) {
  const items = await readdir(src)

  let fileMetaData = []

  for (const item of items) {
    const itemPath = path.join(src, item)
    const stats = await stat(itemPath)

    if(stats.isDirectory()) {
      const root =  path.join(src, item)
      const dest = path.join(obj, item)
      const meta = await collectMetaData(root, dest)
      fileMetaData.push(...meta)
    } else {
      const meta =  getMetaData(item, src, obj)
      fileMetaData.push(meta)
    }
  }

  return fileMetaData
}

function getMetaData(file, src, obj) {
  let meta = {}
  let srcParts = src.split(path.sep)
  const [, ...navParts] = srcParts
  const nav = navParts.join(path.sep)
  const ext = path.extname(file)

  meta['parent'] = srcParts.length === 1 ? ROOTPARENTNAME : srcParts[srcParts.length - 1]
  meta['srcPath'] = src
  meta['destPath'] = obj
  meta['nav'] = nav
  meta['fileName'] = path.basename(file, ext)
  meta['extension'] = ext

  return meta
}

async function buildObj(sheet, meta, menu, homeDepth) {
  return writeFile(
    path.join(meta.destPath, `${meta.fileName}.html`),
    generatePage(sheet.header, sheet.body, menu, homeDepth)
  )
}


const path = require('path')
const { constants } = require('fs')
const readline = require('readline/promises')
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
const RECENTLIMIT = 10
const SITENAME = 'nanaadane\'s wiki'
const SITEDESCRIPTION = 'this is my small corner of the universe'
const SITEURL = 'https://www.nanaadane.com/'
const SITERSSPATH = path.join(LINKSDIR, 'rss.xml')
const SITEAUTHOR = 'Nana Adane'


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

    if (stats.isFile() && isBndrFile(item)) {
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
        <link rel=alternate title="${SITENAME}" type=application/rss+xml href="${SITERSSPATH}">
      </head>
      <body>
        <div class="container">
          <header>
            <nav>
              ${file.nav}
            </nav>
            <a href="index.html">${SITENAME}</a>
          </header>
          <main>
            <h1>${file.name != 'home'? file.header.title : ''}</h1>
            ${file.body}
            ${file.header.isportal ? (file.portalEntries || "") : ""}


            ${file.sources?.int.length > 0 ?
        `<h5>wiki links\n</h5><ol>${file.sources.int.map(s => `<li><a href="${s.src}" >${s.text}</a></li>`).join('')}</ol>` : ""}
            ${file.sources?.ext.length > 0 ?
        `<h5>external sources\n</h5><ol>${file.sources.ext.map(s => `<li>${s.text}: <a href="${s.src}" target="_blank" rel="noopener noreferrer">${s.src}</a></li>`).join('')}</ol>` : ""}
          </main>
          <footer>
            ${file.createdAt && file.updatedAt ?
        `
                <p>Created on ${dateFormater.format(file.header.crtdate || file.createdAt).toLowerCase()}</p>
                <p>Updated on ${dateFormater.format(file.updatedAt).toLowerCase()}</p>
              `
        : ""
      }
          <p><a href="${SITERSSPATH}" id="rss-link">RSS Feed</a></p>
          </footer>
      </div>
      </body>
    </html>
    `
}

function generateCurrentNav(parent = "default", name, links) {
  const neighbours = links[parent].children

  return `<ul>${neighbours.map(li => `<li><a href="${li === 'home' ? 'index' : li}.html">${li === name ? `<em>${li}</em>` : li}</a></li>`).join('')}</ul>`
}

function generateOtherNav(name, links) {
  const { children } = links[name]
  return `<ul>${children.map(li => `<li><a href="${li === 'home' ? 'index' : li}.html">${li}</a></li>`).join('')}</ul>`
}

function generateNav(parent, parentsParent = "default", parentsParentsParent = "default", name, links) {
  const navList = []

  if (!parent) {
    navList.push(generateCurrentNav("default", name, links))
  } else {
    navList.push(generateOtherNav(parentsParent, links))
    navList.push(generateCurrentNav(parent, name, links))
  }

  // has children
  if (links[name]) {
    navList.push(generateOtherNav(name, links))
  } else {
    // if parent has a parent when it has no childre add that
    // except for root level
    if (parentsParent && parentsParent !== 'default') {
      navList.unshift(generateOtherNav(parentsParentsParent, links))
    }
  }

  return navList.join('\n')
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
  const pageMap = {
    default: { children: ['meta'] }
  }

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

async function buildPage(entry, dest, index, pageMap) {
  const parentsParent = findEntry(entry.header.parent, index).header?.parent
  const parentsParentsParent = findEntry(parentsParent, index).header?.parent
  entry.nav = generateNav(entry.header.parent, parentsParent, parentsParentsParent, entry.name, pageMap)

  return writeFile(
    dest,
    generatePage(entry)
  )
}

function buildPortalEntries(entryName, pageMap, index) {
  const pageChildren = pageMap[entryName]?.children || []
  const childEntries = pageChildren.map(child => {
    const subentry = findEntry(child, index)

    return `<li>
      <a href="${child}.html">${subentry.header.title}</a>: ${subentry.header.description}
</li>`
  }).join('\n')

  return `<ul>
  ${childEntries}
  </ul>`
}

async function build(ctx) {
  console.time('build')
  let writeOps = []

  await mkdirCond(ctx.dest)

  for (let entry of ctx.index) {
    const objPath = path.join(ctx.dest, `${entry.name}.html`)
    // build portal entries if portal
    if (entry.header.isportal) {
      entry.portalEntries = buildPortalEntries(entry.name, ctx.pageMap, ctx.index)
    }
    writeOps.push(buildPage(entry, objPath, ctx.index, ctx.pageMap))
  }

  await Promise.all(writeOps)
  console.timeEnd('build')
  return ctx
}

function buildMeta(dest, index, pageMap) {
  const body = `<ul>
  ${index.map(entry => `<li><a href="${entry.name}.html">${entry.header.title}</a></li>`).join('\n')}
  </ul>`

  const entry = {
    name: 'meta',
    header: { title: 'Meta' },
    body,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  return buildPage(entry, dest, index, pageMap)
}

function buildHome(dest, index, pageMap) {
  const body = `
    <p>${SITEDESCRIPTION}</p> 
    <h2>recent</h2>
    <ul>
    ${index
      .sort((a, b) => {
        const aDate = a.header.crtdate || a.createdAt
        const bDate = b.header.crtdate || b.createdAt
        return aDate - bDate
      })
      .reverse()
      .slice(0, RECENTLIMIT)
      .map(entry => {
        const date = entry.header.crtdate || entry.createdAt
        return `<li> <time datetime="${date}">${dateFormater.format(date)}</time> <a href="${entry.name}.html">${entry.header.title}</a></li>`
      })
      .join('\n')
    }
    </ul>
  `
  const entry = {
    name: 'home',
    header: { title: SITENAME },
    body,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  return buildPage(entry, dest, index, pageMap)
}

function buildRssFeed(dest, index) {
  const now = new Date()
  const timeToLiveMinutes = 24 * 60
  const rss = `<rss version="2.0">
<channel>
 <title>${SITENAME}</title>
 <description>${SITEDESCRIPTION}</description>
 <link>${SITEURL}</link>
 <copyright>2022 ${SITEAUTHOR} All rights reserved</copyright>
 <lastBuildDate>${now}</lastBuildDate>
 <pubDate>${now}</pubDate>
 <ttl>${timeToLiveMinutes}</ttl>
 <generator>binder</generator>

${index
      .sort((a, b) => {
        const aDate = a.header.crtdate || a.createdAt
        const bDate = b.header.crtdate || b.createdAt
        return bDate - aDate
      })
      .map((entry, i, arr) => {
        const date = entry.header.crtdate || entry.createdAt
        return `<item>
  <title>${entry.header.title}</title>
  <description>${entry.header.description}</description>
  <author>${SITEAUTHOR}</author>
  <link>${SITEURL + entry.name}.html</link>
  <guid isPermaLink="false">${arr.length - i}</guid>
  <pubDate>${date}</pubDate>
 </item>`
      })
      .join('\n')
    }
</channel>
</rss>
`

  return writeFile(
    dest,
    rss
  )
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

  // generate home page
  const indexPath = path.join(ctx.dest, `index.html`)
  const homePage = buildHome(indexPath, ctx.index, ctx.pageMap)

  // generate meta page
  const metaPath = path.join(ctx.dest, `meta.html`)
  const metaPage = buildMeta(metaPath, ctx.index, ctx.pageMap)

  // generate rss feed
  const rssDest = path.join(ctx.dest, SITERSSPATH)
  const rssPage = buildRssFeed(rssDest, ctx.index)

  await Promise.all([metaPage, homePage, rssPage])

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

async function createEntry(name) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const title = (await rl.question(`title? (default: ${name}) `)) || name
  const parent = await rl.question('parent? (default: none) ')
  const description = await rl.question('description? (default: none) ')
  const isPortal = (await rl.question('portal(y/n)? (default: n) ')) === 'y' ? true : false
  rl.close()

  const crtDate = new Date().toISOString().replace('T', ' ').split('.')[0]

  const content = `${parent ? `parent: ${parent}\n` : ""}title: ${title}
description: ${description}
crtdate: ${crtDate}
isportal: ${isPortal}
---
`

  return writeFile(
    `${name}.bndr`,
    content
  )
}

module.exports = {
  run,
  createEntry,
}

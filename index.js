const {argv} = require('process')
const { constants } = require('fs')
const { access, mkdir, readdir, readFile, writeFile } = require('fs/promises')
const path = require('path')

const [, , ...args] = argv
main(args).catch(err => console.error('binder:', err.message))

async function main(args) {
  if (args.length < 2) {
    usage('not enough args')
  }
  const [src, obj] = args

  if(!await exists(obj)) await mkdir(obj)

  const sheets = await scanSrc(src)
  return buildObj(obj, sheets)

}

function usage(message) {
  console.error(`${message ? message + " ": ""}\nUsage: binder [src] [obj]`)
}

async function exists(path) {
  try {
    await access(path, constants.F_OK)
  } catch (err) {
    return false
  }
  return true
}

async function scanSrc(src) {
  const files = await readdir(src)
  const sheets = []
  for (const file of files) {
    BODY_DELIMITER = '---'
    const filePath = path.join('src', file)
    const content = await readFile(filePath, {encoding: 'utf8'})
    const [headerPart, bodyPart] = content.split(BODY_DELIMITER)
    
    const sheet = {}
    sheet['srcPath'] = filePath
    sheet['filename'] = file.split('.')[0]
    // parse header
    sheet['header'] = parseHeader(headerPart)
    // parse body
    sheet['body'] = parseBody(bodyPart)

    sheets.push(sheet)
  }
  
  return sheets
}

function parseHeader(headerLines) {
  const NL = /\r?\n/
  const ASSIGNMENT_DELIMITER = ':'
  const header = {}
  for (const headerLine of headerLines.split(NL)) {
    let [key, value] = headerLine.split(ASSIGNMENT_DELIMITER)
    if (key) {
      value = value.trim()

      switch(key) {
        case 'date':
          value = new Date(value)
          break
      }

      header[key] = value
    }
  }

  return header
}

function parseBody(bodyText) {
  const DOUBLE_NL = /\n\n/
  let parsed = ''

  for (const paragraph of bodyText.split(DOUBLE_NL)) {
     parsed += `<p>${paragraph.trim()}</p>\n`
  }

  return parsed
}

async function buildObj(obj, sheets) {
  const ops = []
  let indexBody = ''
  for (const sheet of sheets) {
    ops.push(
      writeFile(
        path.join(obj, `${sheet.filename}.html`),
        generatePage(sheet.header, sheet.body)
      )
    )

    indexBody += `
    <a href="${sheet.filename}.html">${sheet.header.title}</a>\n<br/>\n
    `
  }
  
  await Promise.all(ops)

  await writeFile(
    path.join(obj, 'index.html'),
    generatePage({title: 'Index', date: new Date()}, indexBody)
  )
}

function generatePage(header, body) {
  const dateFormater = new Intl.DateTimeFormat(
    'en-GB',
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  )

  return `
  <html>
    <head>
      <title>${header.title}</title>
    </head>
    <body>
      <h1>${header.title}</h1>
      ${body}
      <hr>
      Edited on ${dateFormater.format(header.date).toLowerCase()}
    </body>
  </html>
  `
}

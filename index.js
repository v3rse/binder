const {argv} = require('process')
const { constants } = require('fs')
const { access, mkdir, readdir, readFile, writeFile } = require('fs/promises')
const path = require('path')
const NL = /\r?\n/
const HASHTAG = '#'
const DASH = '-'
const BACKTICK = '`' 
const BACKTICKS = '```' 
const OPENBRACKET = '['
const CLOSEDBRACKET = ']'
const PIPE = '|'
const BANG = '!'
const ASTERISK = '*'
const UNDERSCORE = '_'

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
  let parsed = ''
  const bodyLines = bodyText.split(NL)
  let listLock = false
  let blockLock = false

  const orderedListParser = listParser(startOList, generateOList, endOList)
  const unorderedListParser = listParser(startUList, generateUList, endUList)

  for (let i = 0; i < bodyLines.length; i++) {
    const curr = bodyLines[i].trim()
    const next = bodyLines[i+1]?.trim()

    if(!curr) {
      continue
    }

    switch(curr[0]){
      // parse blocks first
      // and then lines
      case HASHTAG:
        // headings
        if(!isNaN(parseInt(curr[1]))) {
          parsed += generateHeading(curr[1], curr.substring(3, curr.length))
        } else {
        // ordered lists
          const unlock = !(next[0] === HASHTAG) 
          let [val, lck] = orderedListParser(curr, listLock, unlock)
          parsed += val
          listLock = lck
        }
        break
      case DASH:
        // unordered lists
        const unlock = !(next[0] === DASH) 
        let [val, lck] = unorderedListParser(curr, listLock, unlock)
        parsed += val
        listLock = lck
        break
      case BACKTICK:
        // code block
        if(curr.substring(0) == BACKTICKS) {
          if(!blockLock) {
            // start
            parsed += startCodeBlock()
            blockLock = true
          } else {
            // end
            parsed += endCodeBlock()
            blockLock = false
          }
          break
        }
      default:
        if(blockLock) {
          // handle block items
          parsed += ` ${curr}\n`
          break
        }
        parsed += generateParagraph(curr)
    }
  }

  return parsed
}

function listParser(start, item, end) {
  return function(currLine, locked, unlock) {
    let compiledList = ''
    let lck = locked
    const text = currLine.substring(2, currLine.length)

    // start list
    if(!locked) {
      lck = true
      compiledList += start()
    }

    // add list item
    compiledList += item(text)

    // end list
    if(unlock) {
      lck = false
      compiledList += end()
    }

    return [compiledList, lck]
  }
}

function generateHeading(level, text) {
  return `<h${level}>${parseLine(text)}</h${level}>\n`
}

function startOList() {
  return '<ol>\n'
}

function generateOList(text) {
  return `  <li>${parseLine(text)}</li>\n`
}

function endOList() {
  return '</ol>\n'
}

function startUList() {
  return '<ul>\n'
}

function generateUList(text) {
  return `  <li>${parseLine(text)}</li>\n`
}

function endUList() {
  return '</ul>\n'
}

function startCodeBlock() {
  return '<pre>\n'
}

function endCodeBlock() {
  return '</pre>\n'
}

function generateParagraph(text) {
  return `<p>${parseLine(text)}</p>\n`
}

function parseLine(line) {
  const chars = line.split('')
  let comp = ''

  const 
  parseBold = lineParser(ASTERISK)
  const parseItalics = lineParser(UNDERSCORE)
  const parseCode = lineParser(BACKTICK)

  for (let i = 0; i < chars.length; i++) {
    const curr = chars[i]
    const next = chars[i+1]

    switch(curr) {
      case OPENBRACKET:
        // skip to the next
        i++

        // parse
        const [ltext, lsrc, lindex] = parseLinkOrImageAttributes(i, chars)
        comp += generateLink(ltext, lsrc)

        // set final index
        i = lindex
        break
      case BANG:
        if(OPENBRACKET === next) {
          // skip to the first 2 symbols
          i+=2
            
          // parse
          const [itext, isrc, iindex] = parseLinkOrImageAttributes(i, chars)
          comp += generateImage(itext, isrc)

          // set final index
          i = iindex
          break
        }
      case ASTERISK:
        i++
        const [btext, bindex] = parseBold(i, chars)
        comp += generateBold(btext)
        i = bindex
        break
      case UNDERSCORE:
        i++
        const [ittext, itindex] = parseItalics(i, chars)
        comp += generateItalics(ittext)
        i = itindex
        break
      case BACKTICK:
        i++
        const [ctext, cindex] = parseCode(i, chars)
        comp += generateCode(ctext)
        i = cindex
        break
      default:
        comp += curr
    }
  }

  return comp
}

function lineParser(endSymbol) {
 return function (i, chars) {
  let text = ''
  
  while(!(chars[i] === endSymbol || chars[i] ===  NL)) {
    text += chars[i]
    i++
  }

  return [text, i]
 }
}

function generateBold(text) {
  return `<strong>${text}</strong>\n`
}

function generateItalics(text) {
  return `<em>${text}</em>\n`
}

function generateCode(text) {
  return `<code>${text}</code>\n`
}

function parseLinkOrImageAttributes(i, chars) {
  let text = ''
  let src = ''
  let srcSwitch = false

  // seek until closing bracket or end of line
  while(!(chars[i] === CLOSEDBRACKET || chars[i] ===  NL)) {
    // start accepting src when pipe encountered and skip
    if(!(chars[i] === PIPE)) {
      if(!srcSwitch) {
        text += chars[i]
      }else{
        src += chars[i]
      }
    }else{
      srcSwitch = true
    }
    // advance head
    i++
  }

  return [text, src, i]
}

function generateLink(text, src) {
  return `<a href=${src}>${text}</a>`
}

function generateImage(text, src) {
  return `<img src=${src} alt=${text}>`
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

  return `<html>
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

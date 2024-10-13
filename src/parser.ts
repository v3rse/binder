import { readFile } from 'fs/promises'

const BODY_DELIMITER = '---'
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
const RIGHTANGLEBRACKET = '>'
const LEFTANGLEBRACKET = '<'

export async function parseFile(filePath: string) {
  const content = await readFile(filePath, { encoding: 'utf8' })
  const [headerPart, bodyPart] = content.split(BODY_DELIMITER)

  const header = parseHeader(headerPart)
  const [body, sources] = parseBody(bodyPart)
  return {
    header,
    body,
    sources
  }
}


function parseHeader(headerLines: string) {
  const ASSIGNMENT_DELIMITER = ':'
  const header: any = {}
  for (const headerLine of headerLines.split(NL)) {
    const delimiterIndex = headerLine.indexOf(ASSIGNMENT_DELIMITER)
    const key = headerLine.substring(0, delimiterIndex)
    let value: any = headerLine.substring(delimiterIndex + 1)

    if (key) {
      value = value.trim()

      switch (key) {
        case 'crtdate':
          value = new Date(value)
          break
        case 'isportal':
          value = value === 'true'
      }

      header[key] = value
    }
  }

  return header
}

function encodeHtmlCharacters(s: string) {
  return s.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function parseBody(bodyText: string) {
  // collect links here
  let links = {ext: [], int: []}
  let parsed = ''
  const bodyLines = bodyText.split(NL)
  let listLock = false
  let blockLock = false
  let blockText = ""

  const orderedListParser = listParser(startOList, generateOList, endOList, links)
  const unorderedListParser = listParser(startUList, generateUList, endUList, links)

  for (let i = 0; i < bodyLines.length; i++) {
    const curr = bodyLines[i].trim()
    const next = bodyLines[i + 1]?.trim()

    if (!curr) {
      continue
    }

    switch (curr[0]) {
      // parse blocks first
      // and then lines
      case HASHTAG:
        // headings
        if (!isNaN(parseInt(curr[1]))) {
          parsed += generateHeading(curr[1], curr.substring(3, curr.length), links)
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
        if (curr.substring(0) == BACKTICKS) {
          if (!blockLock) {
            // start
            parsed += startCodeBlock()
            blockLock = true
          } else {
            // end
            parsed += encodeHtmlCharacters(blockText) + endCodeBlock()
            blockLock = false
            blockText = ""
          }
          break
        }
      case LEFTANGLEBRACKET:
        parsed += curr
        break
      default:
        if (blockLock) {
          // handle block items 
          // not using curr here because trim removes desire whitespace
          blockText += ` ${bodyLines[i]}\n`
          break
        }
        parsed += generateParagraph(curr, links)
    }
  }

  return [parsed, links]
}

function listParser(start: any, item: any, end: any, links: any) {
  return function(currLine: any, locked: any, unlock: any) {
    let compiledList = ''
    let lck = locked
    const text = currLine.substring(2, currLine.length)

    // start list
    if (!locked) {
      lck = true
      compiledList += start()
    }

    // add list item
    compiledList += item(text, links)

    // end list
    if (unlock) {
      lck = false
      compiledList += end()
    }

    return [compiledList, lck]
  }
}

function generateHeading(level, text, links) {
  return `<h${level}>${parseLine(text, links)}</h${level}>\n`
}

function startOList() {
  return '<ol>\n'
}

function generateOList(text, links) {
  return `  <li>${parseLine(text, links)}</li>\n`
}

function endOList() {
  return '</ol>\n'
}

function startUList() {
  return '<ul>\n'
}

function generateUList(text, links) {
  return `  <li>${parseLine(text, links)}</li>\n`
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

function generateParagraph(text, links) {
  return `<p>${parseLine(text, links)}</p>\n`
}

function parseLine(line, links) {
  const chars = line.split('')
  let comp = ''

  const
    parseBold = lineParser(ASTERISK)
  const parseItalics = lineParser(UNDERSCORE)
  const parseCode = lineParser(BACKTICK)

  for (let i = 0; i < chars.length; i++) {
    const curr = chars[i]
    const next = chars[i + 1]

    switch (curr) {
      case OPENBRACKET:
        // skip to the next
        i++

        // parse
        const [ltext, lsrc, lindex] = parseLinkOrImageAttributes(i, chars)
        comp += generateExtLink(ltext, lsrc)
        links.ext.push({text: ltext, src: lsrc})

        // set final index
        i = lindex
        break
      case BANG:
        if (OPENBRACKET === next) {
          // skip to the first 2 symbols
          i += 2

          // parse
          const [itext, isrc, iindex] = parseLinkOrImageAttributes(i, chars)
          comp += generateImage(itext, isrc)
          links.ext.push({text: itext, src: isrc})

          // set final index
          i = iindex
        }
        break
      case RIGHTANGLEBRACKET:
        if (OPENBRACKET === next) {
          // skip to the first 2 symbols
          i += 2

          // parse
          const [itext, _, iindex] = parseLinkOrImageAttributes(i, chars)
          comp += generateIntLink(itext.replace('-', ' '), `${itext}.html`)
          links.int.push({text: itext.replace('-', ' '), src: `${itext}.html`})

          // set final index
          i = iindex
        }
        break
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
  return function(i, chars) {
    let text = ''

    while (!(chars[i] === endSymbol || chars[i] === NL)) {
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
  while (!(chars[i] === CLOSEDBRACKET || chars[i] === NL)) {
    // start accepting src when pipe encountered and skip
    if (!(chars[i] === PIPE)) {
      if (!srcSwitch) {
        text += chars[i]
      } else {
        src += chars[i]
      }
    } else {
      srcSwitch = true
    }
    // advance head
    i++
  }

  return [text, src, i]
}

function generateIntLink(text, src) {
  return `<a href="${src}">${text}</a>`
}

function generateExtLink(text, src) {
  return `<a href="${src}" target="_blank" rel="noopener norefferer">${text}</a>`
}

function generateImage(text, src) {
  return `<img src="${src}" alt="${text}">`
}


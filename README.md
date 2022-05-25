# binder
a build tool for my thoughts.

not for general consumption. this initially started out as a regular static site generator for a blog see [v0](https://github.com/v3rse/binder/tree/v0).

however, I thought it would be better to make a static wiki engine to capture my thoughts, learnings and projects. this project is highly influenced by [XXIIVV](wiki.xxiivv.com) and sites like it.

the aim of this tool is to make writing, organising and publishing entries as easy as possible.

in addition to the aims above it should be available to most broswer hence no `javascript` and minimal `css`.

features include:
- [x] simplified markup (see below)
- [x] opinionated static site generator
- [x] page linking
- [x] portal pages (used to group topics of similar content)
- [x] rss feed generation

[find a live example here](http://www.nanaadane.com/)
[find example source here](https://github.com/v3rse/site)

## installation
```
npm install . -g
```

## usage
- build a site:
```
binder [src] [dest]
```

try the following in this directory:
```
binder docs wiki
```
__NB: the build process requires you have a `links` and `media` directory in your source folder for css__ 

- initialize entry file
```
binder entry [name]
```

this provides you wizard
```bash
$ binder entry sample                                                           main ⬆
title? (default: sample)
parent? (default: none)
description? (default: none)
portal(y/n)? (default: n) y
```

## `bndr` markup
this is a really simplified markdown clone. It's design goal is to quickly
allow me to write quickly and then generate some relatively readable HTML files

find examples [here](docs/example.bndr).

### the spec

#### header
defined at the start of the file. just key-value pairs

```yaml
# this links the current entry to another (optional)
parent: linux
# this the displayed title
title: x11
# this is the displayed description
description: client-server architecture with communication...
# this is the creation date for the entry
crtdate: 2022-05-25 04:08:00
# this is flag to indicate is the entry is a portal
isportal: true
---
```

#### body

##### headings
`#<number> <text>`

```
#1 Heading 1
#2 Heading 2
#3 Heading 3
#4 Heading 4
#5 Heading 5
#6 Heading 6
```

generates:

```
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<h3>Heading 3</h3>
<h4>Heading 4</h4>
<h5>Heading 5</h5>
<h6>Heading 6</h6>
```

##### internal links
links to another entry

```
>[entry-name]
```

generates:

```
<a href="./entry-name.html">entry name</a>
```

##### external links

```
[text|src]
```

generates:

```
<a href="src">text</a>
```

##### image

```
![alt|src]
```

generates:

```
<img alt="alt" src="src">
```

##### formatting

```
*bold*
_italics_
`code`

<3 backticks>
code block
<3 backtick>
```

generates:

```
<strong>bold</strong>
<em>italics</em>
<code>code</code>

<pre>
code block
</pre>
```

##### lists

```
- first
- second
- third

# first
# second
# third
```

generates:

```
<ul>
  <li>first<\li>
  <li>second<\li>
  <li>third<\li>
</ul>

<ol>
  <li>first<\li>
  <li>second<\li>
  <li>third<\li>
</ol>
```

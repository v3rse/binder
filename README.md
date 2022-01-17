# binder
a build tool for my thoughts. not for general consumption.

## `.bndr` markup
this is a really simplified markdown clone. It's design goal is to quickly
allow me to write quickly and then generate some relatively readable HTML files

### the spec

#### header
defined at the start of the file. not really

```yaml
title: x11
date: 2021-01-01
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
<h1> Heading </h1>
<h2> Heading </h2>
<h3> Heading </h3>
<h4> Heading </h4>
<h5> Heading </h5>
<h6> Heading </h6>
```

##### links

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

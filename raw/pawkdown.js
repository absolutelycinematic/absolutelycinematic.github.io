const escapeHtml=s=>String(s).replace(/[&<>"']/g,m=>m==="&"?"&amp;":m==="<"?"&lt;":m===">"?"&gt;":m==='"'?"&quot;":"&#39;")

const slugify=s=>String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[`~!@#$%^&*()+=\[\]{}|\\:;"'<>,.?/]+/g,"").replace(/\s+/g,"-").replace(/-+/g,"-")

const blockId=()=>"block-"+Math.random().toString(36).slice(2,11)

const splitFenceInfo=s=>{
  const v=String(s||"").trim()
  if(!v)return{lang:"",meta:""}
  const i=v.indexOf(" ")
  return i===-1?{lang:v,meta:""}:{lang:v.slice(0,i),meta:v.slice(i+1).trim()}
}

const parseWikilink=raw=>{
  const body=raw.slice(2,-2)
  let left=body
  let display=""
  const pipeIndex=body.indexOf("|")
  if(pipeIndex!==-1){
    left=body.slice(0,pipeIndex)
    display=body.slice(pipeIndex+1)
  }
  let target=left
  let heading=""
  let block=""
  const hashIndex=left.indexOf("#")
  const blockIndex=left.indexOf("^")
  if(hashIndex!==-1){
    target=left.slice(0,hashIndex)
    const after=left.slice(hashIndex+1)
    if(after.startsWith("^")) block=after.slice(1)
    else heading=after
  }else if(blockIndex!==-1){
    target=left.slice(0,blockIndex)
    block=left.slice(blockIndex+1)
  }
  if(target==="#"&&block) target=""
  return{
    raw,
    target:target.trim(),
    heading:heading.trim(),
    block:block.trim(),
    display:(display||heading||block||target||raw).trim()
  }
}

const extractWikilinks=text=>{
  const out=[]
  const re=/\[\[[^\]]+\]\]/g
  let m
  while((m=re.exec(String(text)))) out.push(parseWikilink(m[0]))
  return out
}

const extractBlockIds=text=>{
  const out=[]
  const lines=String(text).split(/\r?\n/)
  for(const line of lines){
    const m=line.match(/\^([A-Za-z0-9._:-]+)\s*$/)
    if(m) out.push(m[1])
  }
  return out
}

const defaultHighlight=(code,lang)=>`<pre class="bm-code-block"><code${lang?` class="language-${escapeHtml(lang)}"`:""}>${escapeHtml(code)}</code></pre>`

const defaultStyles=`
.better-markdown{
  color:#e6edf3;
  font:16px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
  word-break:break-word
}
.better-markdown *{box-sizing:border-box}
.better-markdown h1,.better-markdown h2,.better-markdown h3,.better-markdown h4,.better-markdown h5,.better-markdown h6{
  line-height:1.25;
  margin:1.2em 0 .55em;
  font-weight:700;
  color:#f0f6fc
}
.better-markdown h1{font-size:2rem;border-bottom:1px solid #30363d;padding-bottom:.3em}
.better-markdown h2{font-size:1.55rem;border-bottom:1px solid #30363d;padding-bottom:.25em}
.better-markdown h3{font-size:1.25rem}
.better-markdown p{margin:.8em 0}
.better-markdown hr{
  border:0;
  height:1px;
  background:linear-gradient(90deg,transparent,#8b949e55,transparent);
  margin:1.5rem 0
}
.better-markdown a{color:#8ab4ff;text-decoration:none}
.better-markdown a:hover{text-decoration:underline}
.better-markdown strong{font-weight:700}
.better-markdown em{font-style:italic}
.better-markdown u{text-underline-offset:2px}
.better-markdown mark{
  background:#fff3a31f;
  color:#fff7cc;
  padding:.08em .32em;
  border-radius:.35em
}
.better-markdown del{color:#8b949e}
.better-markdown code{
  font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  background:#161b22;
  color:#f2cc60;
  border:1px solid #30363d;
  border-radius:6px;
  padding:.15em .38em
}
.better-markdown pre{
  margin:1rem 0;
  overflow:auto
}
.better-markdown .bm-code-block,
.better-markdown .bm-diff-block,
.better-markdown .bm-math-block,
.better-markdown .bm-diagram{
  background:#0d1117;
  border:1px solid #30363d;
  border-radius:14px;
  box-shadow:0 10px 30px rgba(0,0,0,.18)
}
.better-markdown .bm-code-block{
  padding:16px 18px
}
.better-markdown .bm-code-block code{
  display:block;
  padding:0;
  border:0;
  background:transparent;
  color:#e6edf3;
  white-space:pre
}
.better-markdown ul,.better-markdown ol{margin:.8em 0 .8em 1.4em}
.better-markdown li{margin:.24em 0}
.better-markdown .bm-checklist,
.better-markdown .bm-radio-list{
  list-style:none;
  margin:.8em 0;
  padding:0
}
.better-markdown .bm-check-item,
.better-markdown .bm-radio-item{
  margin:.45em 0;
  padding:.2em 0
}
.better-markdown .bm-check-item label,
.better-markdown .bm-radio-item label{
  display:flex;
  gap:.6rem;
  align-items:flex-start
}
.better-markdown input[type="checkbox"],
.better-markdown input[type="radio"]{
  margin-top:.2rem;
  accent-color:#f778ba
}
.better-markdown .bm-table{
  width:100%;
  border-collapse:collapse;
  margin:1rem 0;
  display:table;
  overflow:hidden;
  border:1px solid #30363d;
  border-radius:12px;
  background:#0d1117
}
.better-markdown .bm-table thead{
  background:#161b22
}
.better-markdown .bm-table th,
.better-markdown .bm-table td{
  padding:12px 14px;
  border:1px solid #30363d
}
.better-markdown .bm-table th{
  font-weight:600;
  color:#f0f6fc
}
.better-markdown .bm-table tbody tr:nth-child(2n){
  background:#0f141b
}
.better-markdown .bm-alert,
.better-markdown .bm-callout{
  margin:1rem 0;
  border:1px solid #30363d;
  border-left-width:4px;
  border-radius:12px;
  padding:14px 16px;
  background:#11161d
}
.better-markdown .bm-alert-title,
.better-markdown .bm-callout-title{
  font-weight:700;
  margin-bottom:.35rem;
  letter-spacing:.02em
}
.better-markdown .bm-alert-note,
.better-markdown .bm-callout-note{border-left-color:#58a6ff;background:#0d1a2b}
.better-markdown .bm-alert-tip,
.better-markdown .bm-callout-tip{border-left-color:#3fb950;background:#0d1f17}
.better-markdown .bm-alert-important,
.better-markdown .bm-callout-important{border-left-color:#a371f7;background:#1a1426}
.better-markdown .bm-alert-warning,
.better-markdown .bm-callout-warning{border-left-color:#d29922;background:#231c0b}
.better-markdown .bm-alert-caution,
.better-markdown .bm-callout-caution,
.better-markdown .bm-alert-danger,
.better-markdown .bm-callout-danger{border-left-color:#f85149;background:#2a1314}
.better-markdown .bm-details{
  margin:1rem 0;
  border:1px solid #30363d;
  border-radius:12px;
  background:#0d1117;
  overflow:hidden
}
.better-markdown .bm-details summary{
  cursor:pointer;
  padding:14px 16px;
  background:#161b22;
  font-weight:600
}
.better-markdown .bm-details > :not(summary){
  padding:14px 16px
}
.better-markdown .bm-footnotes{
  margin-top:1.6rem;
  padding-top:1rem;
  border-top:1px solid #30363d
}
.better-markdown .bm-footnotes ol{margin-left:1.2em}
.better-markdown .bm-footnote-ref a,
.better-markdown .bm-footnote-backref{
  color:#f778ba;
  text-decoration:none
}
.better-markdown .bm-hashtag{
  display:inline-flex;
  align-items:center;
  gap:.3rem;
  padding:.18rem .6rem;
  border-radius:999px;
  background:#f778ba1f;
  border:1px solid #f778ba55;
  color:#ffb3d1;
  font-weight:600;
  text-decoration:none
}
.better-markdown .bm-wikilink{
  color:#79c0ff;
  font-weight:500
}
.better-markdown .bm-diff-block{
  padding:0;
  overflow:auto
}
.better-markdown .bm-diff-block code{
  display:block;
  padding:14px 0;
  border:0;
  background:transparent;
  color:#e6edf3
}
.better-markdown .bm-diff-line{
  display:block;
  padding:0 18px;
  white-space:pre
}
.better-markdown .bm-diff-add{
  background:#132a1b;
  color:#aff5b4
}
.better-markdown .bm-diff-del{
  background:#2d1117;
  color:#ffdcd7
}
.better-markdown .bm-diff-meta{
  background:#111827;
  color:#8ab4ff
}
.better-markdown .bm-diff-ctx{
  color:#c9d1d9
}
.better-markdown .bm-diagram{
  padding:16px 18px
}
.better-markdown .bm-diagram-title{
  font-size:.85rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.08em;
  color:#8b949e;
  margin-bottom:.7rem
}
.better-markdown .bm-diagram pre{
  margin:0
}
.better-markdown .bm-diagram pre code,
.better-markdown .bm-diagram code{
  background:transparent;
  border:0;
  padding:0;
  color:#d2a8ff
}
.better-markdown .bm-math-inline{
  display:inline-block;
  padding:.12em .42em;
  border-radius:6px;
  background:#1b1f24;
  border:1px solid #30363d;
  color:#a5d6ff;
  font-family:Cambria,"Times New Roman",serif
}
.better-markdown .bm-math-block{
  padding:16px 18px;
  text-align:center;
  overflow:auto;
  color:#c9e7ff;
  font-family:Cambria,"Times New Roman",serif
}
`

const createState=()=>({
  headings:[],
  footnotes:[],
  footnoteIndex:new Map(),
  blockIds:new Set(),
  checkboxIndex:0,
  radioIndex:0
})

const normalizeCalloutKind=s=>{
  const v=String(s||"").toLowerCase()
  if(v==="info") return "note"
  if(v==="error") return "danger"
  return v
}

const tokenizeInline=(src,state,options)=>{
  const out=[]
  let i=0
  const pushText=t=>{if(t)out.push({type:"text",value:t})}
  while(i<src.length){
    const rest=src.slice(i)
    if(rest.startsWith("[[")){
      const end=src.indexOf("]]",i+2)
      if(end!==-1){
        out.push({type:"wikilink",value:parseWikilink(src.slice(i,end+2))})
        i=end+2
        continue
      }
    }
    if(rest.startsWith("[^")){
      const m=rest.match(/^\[\^([^\]]+)\]/)
      if(m){
        const key=m[1]
        let idx=state.footnoteIndex.get(key)
        if(!idx){
          idx=state.footnotes.length+1
          state.footnoteIndex.set(key,idx)
          state.footnotes.push({key,index:idx,body:""})
        }
        out.push({type:"footnote_ref",value:{key,index:idx}})
        i+=m[0].length
        continue
      }
    }
    if(rest.startsWith("$")){
      const block=rest.match(/^\$\$([\s\S]+?)\$\$/)
      if(block){
        out.push({type:"math_block_inline",value:block[1].trim()})
        i+=block[0].length
        continue
      }
      const inline=rest.match(/^\$([^$\n]+?)\$/)
      if(inline){
        out.push({type:"math_inline",value:inline[1].trim()})
        i+=inline[0].length
        continue
      }
    }
    if(rest.startsWith("`")){
      const m=rest.match(/^`([^`]+)`/)
      if(m){
        out.push({type:"code_inline",value:m[1]})
        i+=m[0].length
        continue
      }
    }
    const syntax=options.customSyntax!==false?[
      {re:/^\*\*([^*]+?)\*\*/,type:"strong"},
      {re:/^\*([^*\n]+?)\*/,type:"strong"},
      {re:/^\/\/([^/\n]+?)\/\//,type:"em"},
      {re:/^\/([^/\n]+?)\//,type:"em"},
      {re:/^__([^_\n]+?)__/,type:"underline"},
      {re:/^_([^_\n]+?)_/,type:"underline"},
      {re:/^==([^=\n]+?)==/,type:"mark"},
      {re:/^--([^-\n]+?)--/,type:"del"},
      {re:/^\^([^\^\n]+?)\^/,type:"sup"},
      {re:/^~([^~\n]+?)~/,type:"sub"}
    ]:[]
    let matched=false
    for(const rule of syntax){
      const m=rest.match(rule.re)
      if(m){
        out.push({type:rule.type,value:tokenizeInline(m[1],state,options)})
        i+=m[0].length
        matched=true
        break
      }
    }
    if(matched) continue
    if(options.autolink!==false){
      const url=rest.match(/^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/)
      if(url){
        out.push({type:"link",value:{href:url[1],text:url[1],external:true}})
        i+=url[1].length
        continue
      }
      const email=rest.match(/^([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/)
      if(email){
        out.push({type:"link",value:{href:`mailto:${email[1]}`,text:email[1],external:true}})
        i+=email[1].length
        continue
      }
      const hashtag=rest.match(/^(#[\p{L}\p{N}_-]+)/u)
      if(hashtag&&options.hashtags!==false){
        const tag=hashtag[1].slice(1)
        out.push({type:"hashtag",value:{tag,text:hashtag[1]}})
        i+=hashtag[1].length
        continue
      }
    }
    let next=src.length
    const probes=["[[","[^","$","`","*","/","_","-","^","~","#","h"]
    for(const p of probes){
      const idx=src.indexOf(p,i+1)
      if(idx!==-1&&idx<next) next=idx
    }
    if(next===i) next=i+1
    pushText(src.slice(i,next))
    i=next
  }
  return out
}

const getKatex=()=>{
  if(typeof globalThis!=="undefined"&&globalThis.katex&&typeof globalThis.katex.renderToString==="function") return globalThis.katex
  return null
}

const renderMath=(expr,block,options)=>{
  if(options.math===false){
    return block?`<pre class="bm-math-block"><code>${escapeHtml(expr)}</code></pre>`:`<span class="bm-math-inline">${escapeHtml(expr)}</span>`
  }
  if(typeof options.renderMath==="function") return options.renderMath(expr,{block})
  const katex=getKatex()
  if(katex){
    try{
      return katex.renderToString(expr,{displayMode:block,throwOnError:false,output:"htmlAndMathml"})
    }catch{}
  }
  return block?`<div class="bm-math-block">${escapeHtml(expr)}</div>`:`<span class="bm-math-inline">${escapeHtml(expr)}</span>`
}

const renderInline=(tokens,state,options)=>tokens.map(token=>{
  if(token.type==="text") return escapeHtml(token.value)
  if(token.type==="wikilink"){
    const v=token.value
    const attrs=[`class="bm-wikilink"`,`data-target="${escapeHtml(v.target)}"`]
    if(v.heading) attrs.push(`data-heading="${escapeHtml(v.heading)}"`)
    if(v.block) attrs.push(`data-block="${escapeHtml(v.block)}"`)
    const href=options.wikilinkHref?options.wikilinkHref(v):`#${escapeHtml(v.block||slugify(v.heading||v.target||v.display))}`
    return `<a ${attrs.join(" ")} href="${href}">${escapeHtml(v.display)}</a>`
  }
  if(token.type==="footnote_ref"){
    const v=token.value
    return `<sup class="bm-footnote-ref"><a href="#bm-fn-${v.index}" id="bm-fnref-${v.index}">${v.index}</a></sup>`
  }
  if(token.type==="code_inline") return `<code>${escapeHtml(token.value)}</code>`
  if(token.type==="math_inline") return renderMath(token.value,false,options)
  if(token.type==="math_block_inline") return renderMath(token.value,true,options)
  if(token.type==="strong") return `<strong>${renderInline(token.value,state,options)}</strong>`
  if(token.type==="em") return `<em>${renderInline(token.value,state,options)}</em>`
  if(token.type==="underline") return `<u>${renderInline(token.value,state,options)}</u>`
  if(token.type==="mark") return `<mark>${renderInline(token.value,state,options)}</mark>`
  if(token.type==="del") return `<del>${renderInline(token.value,state,options)}</del>`
  if(token.type==="sup") return `<sup>${renderInline(token.value,state,options)}</sup>`
  if(token.type==="sub") return `<sub>${renderInline(token.value,state,options)}</sub>`
  if(token.type==="link") return `<a href="${escapeHtml(token.value.href)}"${token.value.external?` target="_blank" rel="noreferrer noopener"`:""}>${escapeHtml(token.value.text)}</a>`
  if(token.type==="hashtag"){
    const href=typeof options.hashtags==="function"?options.hashtags(token.value.tag):`#tag-${slugify(token.value.tag)}`
    return `<a class="bm-hashtag" href="${escapeHtml(href)}">${escapeHtml(token.value.text)}</a>`
  }
  return ""
}).join("")

const parseBlocks=(markdown,state,options)=>{
  const lines=String(markdown).replace(/\r\n?/g,"\n").split("\n")
  const blocks=[]
  let i=0
  while(i<lines.length){
    const line=lines[i]
    if(!line.trim()){
      i++
      continue
    }

    const footnoteDef=line.match(/^\[\^([^\]]+)\]:\s*(.*)$/)
    if(footnoteDef){
      const key=footnoteDef[1]
      const body=[footnoteDef[2]]
      i++
      while(i<lines.length&&(lines[i].startsWith("  ")||lines[i].startsWith("\t")||!lines[i].trim())){
        body.push(lines[i].replace(/^(?:\t| {2,})/,""))
        i++
      }
      let idx=state.footnoteIndex.get(key)
      if(!idx){
        idx=state.footnotes.length+1
        state.footnoteIndex.set(key,idx)
        state.footnotes.push({key,index:idx,body:body.join("\n")})
      }else{
        const entry=state.footnotes.find(x=>x.key===key)
        if(entry) entry.body=body.join("\n")
      }
      continue
    }

    const hr=line.match(/^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/)
    if(hr){
      blocks.push({type:"hr"})
      i++
      continue
    }

    const fence=line.match(/^```([^`]*)$/)
    if(fence){
      const {lang,meta}=splitFenceInfo(fence[1])
      const body=[]
      i++
      while(i<lines.length&&!/^```\s*$/.test(lines[i])){
        body.push(lines[i])
        i++
      }
      i++
      blocks.push({type:"fence",lang,meta,body:body.join("\n")})
      continue
    }

    const heading=line.match(/^(#{1,6})\s+(.+)$/)
    if(heading){
      const depth=heading[1].length
      const rawText=heading[2].trim()
      const id=slugify(rawText)
      state.headings.push({depth,text:rawText,id})
      blocks.push({type:"heading",depth,text:rawText,id})
      i++
      continue
    }

    const ghAlert=line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i)
    if(ghAlert){
      const kind=normalizeCalloutKind(ghAlert[1])
      const title=ghAlert[1].toUpperCase()
      const first=ghAlert[2]
      const body=[]
      if(first) body.push(first)
      i++
      while(i<lines.length&&/^> ?/.test(lines[i])){
        body.push(lines[i].replace(/^> ?/,""))
        i++
      }
      blocks.push({type:"alert",kind,title,body:body.join("\n")})
      continue
    }

    const detailsStart=line.match(/^:::details\s*(.*)$/i)
    if(detailsStart){
      const summary=detailsStart[1]||"Details"
      const body=[]
      i++
      while(i<lines.length&&!/^:::\s*$/.test(lines[i])){
        body.push(lines[i])
        i++
      }
      i++
      blocks.push({type:"details",summary,body:body.join("\n")})
      continue
    }

    const calloutBlock=line.match(/^:::(note|tip|important|warning|caution|info|danger|error)\s*(.*)$/i)
    if(calloutBlock){
      const kind=normalizeCalloutKind(calloutBlock[1])
      const title=(calloutBlock[2]||calloutBlock[1]).trim()
      const body=[]
      i++
      while(i<lines.length&&!/^:::\s*$/.test(lines[i])){
        body.push(lines[i])
        i++
      }
      i++
      blocks.push({type:"callout_block",kind,title,body:body.join("\n")})
      continue
    }

    const calloutInline=line.match(/^\(:\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*:\)$/)
    if(calloutInline){
      blocks.push({type:"callout",kind:normalizeCalloutKind(calloutInline[1]),title:calloutInline[1],body:calloutInline[2]})
      i++
      continue
    }

    const ul=line.match(/^[-*+]\s+(.*)$/)
    if(ul){
      const items=[]
      while(i<lines.length){
        const m=lines[i].match(/^[-*+]\s+(.*)$/)
        if(!m) break
        items.push(m[1])
        i++
      }
      blocks.push({type:"ul",items})
      continue
    }

    const ol=line.match(/^(\d+)\.\s+(.*)$/)
    if(ol){
      const start=Number(ol[1])||1
      const items=[]
      while(i<lines.length){
        const m=lines[i].match(/^(\d+)\.\s+(.*)$/)
        if(!m) break
        items.push(m[2])
        i++
      }
      blocks.push({type:"ol",start,items})
      continue
    }

    if(/^\|.+\|$/.test(line)&&i+1<lines.length&&/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[i+1])){
      const headers=line.trim().replace(/^\||\|$/g,"").split("|").map(s=>s.trim())
      const alignRaw=lines[i+1].trim().replace(/^\||\|$/g,"").split("|").map(s=>s.trim())
      const align=alignRaw.map(s=>s.startsWith(":")&&s.endsWith(":")?"center":s.endsWith(":")?"right":s.startsWith(":")?"left":"")
      const rows=[]
      i+=2
      while(i<lines.length&&/^\|.+\|$/.test(lines[i])){
        rows.push(lines[i].trim().replace(/^\||\|$/g,"").split("|").map(s=>s.trim()))
        i++
      }
      blocks.push({type:"table",headers,align,rows})
      continue
    }

    const radio=line.match(/^\(( |x)\)\s+(.*)$/i)
    if(radio){
      const group=`bm-radio-${++state.radioIndex}`
      const items=[]
      while(i<lines.length){
        const m=lines[i].match(/^\(( |x)\)\s+(.*)$/i)
        if(!m) break
        items.push({checked:m[1].toLowerCase()==="x",text:m[2]})
        i++
      }
      blocks.push({type:"radio_group",group,items})
      continue
    }

    const checkbox=line.match(/^\[( |x|-)\]\s+(.*)$/i)
    if(checkbox){
      const items=[]
      while(i<lines.length){
        const m=lines[i].match(/^\[( |x|-)\]\s+(.*)$/i)
        if(!m) break
        items.push({state:m[1].toLowerCase(),text:m[2]})
        i++
      }
      blocks.push({type:"checkbox_group",items})
      continue
    }

    const paragraph=[]
    while(
      i<lines.length&&
      lines[i].trim()&&
      !/^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(lines[i])&&
      !/^```/.test(lines[i])&&
      !/^(#{1,6})\s+/.test(lines[i])&&
      !/^>\s*\[!/.test(lines[i])&&
      !/^:::details/.test(lines[i])&&
      !/^:::(note|tip|important|warning|caution|info|danger|error)\b/i.test(lines[i])&&
      !/^\(:\s*[A-Za-z0-9_-]+\s*:/.test(lines[i])&&
      !/^[-*+]\s+/.test(lines[i])&&
      !/^(\d+)\.\s+/.test(lines[i])&&
      !/^\(( |x)\)\s+/i.test(lines[i])&&
      !/^\[( |x|-)\]\s+/i.test(lines[i])&&
      !/^\|.+\|$/.test(lines[i])&&
      !/^\[\^([^\]]+)\]:/.test(lines[i])
    ){
      paragraph.push(lines[i])
      i++
    }

    let text=paragraph.join("\n")
    let bid=""
    const m=text.match(/\s\^([A-Za-z0-9._:-]+)\s*$/)
    if(m){
      bid=m[1]
      state.blockIds.add(bid)
      text=text.replace(/\s\^[A-Za-z0-9._:-]+\s*$/,"")
    }
    blocks.push({type:"paragraph",text,bid})
  }
  return blocks
}

const renderDiff=code=>{
  const lines=String(code).split("\n").map(v=>{
    const cls=v.startsWith("+++")||v.startsWith("---")||v.startsWith("@@")?"bm-diff-meta":v.startsWith("+")?"bm-diff-add":v.startsWith("-")?"bm-diff-del":"bm-diff-ctx"
    return `<span class="bm-diff-line ${cls}">${escapeHtml(v)}</span>`
  }).join("")
  return `<pre class="bm-diff-block"><code>${lines}</code></pre>`
}

const renderDiagram=(kind,source,options)=>{
  if(typeof options.renderDiagram==="function") return options.renderDiagram(kind,source)
  return `<div class="bm-diagram bm-diagram-${escapeHtml(kind)}"><div class="bm-diagram-title">${escapeHtml(kind)}</div><pre><code>${escapeHtml(source)}</code></pre></div>`
}

const renderFence=(block,options)=>{
  const lang=String(block.lang||"").toLowerCase()
  if(["mermaid","geojson","topojson","stl","dot","graphviz","plantuml"].includes(lang)) return renderDiagram(lang,block.body,options)
  if(lang==="math"||lang==="latex") return renderMath(block.body,true,options)
  if(lang==="diff") return renderDiff(block.body)
  if(typeof options.highlight==="function") return options.highlight(block.body,lang,block.meta)
  return defaultHighlight(block.body,lang)
}

const renderBlocks=(blocks,state,options)=>blocks.map(block=>{
  if(block.type==="heading") return `<h${block.depth} id="${escapeHtml(block.id)}">${renderInline(tokenizeInline(block.text,state,options),state,options)}</h${block.depth}>`
  if(block.type==="paragraph"){
    const body=renderInline(tokenizeInline(block.text,state,options),state,options)
    return `<p${block.bid?` id="${escapeHtml(block.bid)}" data-block-id="${escapeHtml(block.bid)}"`:""}>${body}</p>`
  }
  if(block.type==="hr") return `<hr>`
  if(block.type==="ul") return `<ul>${block.items.map(item=>`<li>${renderInline(tokenizeInline(item,state,options),state,options)}</li>`).join("")}</ul>`
  if(block.type==="ol") return `<ol start="${block.start}">${block.items.map(item=>`<li>${renderInline(tokenizeInline(item,state,options),state,options)}</li>`).join("")}</ol>`
  if(block.type==="checkbox_group") return `<ul class="bm-checklist">${block.items.map(item=>{const idx=++state.checkboxIndex;const checked=item.state==="x";const mixed=item.state==="-";return `<li class="bm-check-item"><label><input type="checkbox" data-bm-checkbox="${idx}"${checked?" checked":""}${mixed?' data-indeterminate="true"':""}> <span>${renderInline(tokenizeInline(item.text,state,options),state,options)}</span></label></li>`}).join("")}</ul>`
  if(block.type==="radio_group") return `<ul class="bm-radio-list">${block.items.map((item,index)=>`<li class="bm-radio-item"><label><input type="radio" name="${escapeHtml(block.group)}" value="${index}"${item.checked?" checked":""}> <span>${renderInline(tokenizeInline(item.text,state,options),state,options)}</span></label></li>`).join("")}</ul>`
  if(block.type==="callout") return `<div class="bm-callout bm-callout-${escapeHtml(block.kind)}"><div class="bm-callout-title">${escapeHtml(String(block.title||block.kind).toUpperCase())}</div><div class="bm-callout-body">${renderInline(tokenizeInline(block.body,state,options),state,options)}</div></div>`
  if(block.type==="callout_block") return `<div class="bm-callout bm-callout-${escapeHtml(block.kind)}"><div class="bm-callout-title">${escapeHtml(block.title)}</div><div class="bm-callout-body">${renderBlocks(parseBlocks(block.body,state,options),state,options)}</div></div>`
  if(block.type==="alert") return `<div class="bm-alert bm-alert-${escapeHtml(block.kind)}"><div class="bm-alert-title">${escapeHtml(block.title)}</div><div class="bm-alert-body">${renderBlocks(parseBlocks(block.body,state,options),state,options)}</div></div>`
  if(block.type==="details") return `<details class="bm-details"><summary>${escapeHtml(block.summary)}</summary>${renderBlocks(parseBlocks(block.body,state,options),state,options)}</details>`
  if(block.type==="fence") return renderFence(block,options)
  if(block.type==="table") return `<table class="bm-table"><thead><tr>${block.headers.map((h,i)=>`<th${block.align[i]?` style="text-align:${block.align[i]}"`:""}>${renderInline(tokenizeInline(h,state,options),state,options)}</th>`).join("")}</tr></thead><tbody>${block.rows.map(row=>`<tr>${row.map((cell,i)=>`<td${block.align[i]?` style="text-align:${block.align[i]}"`:""}>${renderInline(tokenizeInline(cell,state,options),state,options)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
  return ""
}).join("\n")

const renderFootnotes=(state,options)=>{
  const list=state.footnotes.filter(v=>v.body)
  if(!list.length) return ""
  return `<section class="bm-footnotes"><ol>${list.map(item=>`<li id="bm-fn-${item.index}">${renderBlocks(parseBlocks(item.body,state,options),state,options)} <a href="#bm-fnref-${item.index}" class="bm-footnote-backref">↩</a></li>`).join("")}</ol></section>`
}

const ensureStyles=id=>{
  if(typeof document==="undefined") return
  if(document.getElementById(id)) return
  const style=document.createElement("style")
  style.id=id
  style.textContent=defaultStyles
  document.head.appendChild(style)
}

const hydrate=(root,options={})=>{
  if(!root||typeof root.querySelectorAll!=="function") return root
  ensureStyles(options.styleId||"better-markdown-default-styles")
  root.querySelectorAll('input[data-indeterminate="true"]').forEach(el=>{el.indeterminate=true})
  if(options.interactive!==false){
    root.querySelectorAll(".bm-wikilink").forEach(el=>{
      el.addEventListener("click",e=>{
        if(typeof options.onWikilinkClick==="function"){
          e.preventDefault()
          options.onWikilinkClick({
            target:el.dataset.target||"",
            heading:el.dataset.heading||"",
            block:el.dataset.block||"",
            text:el.textContent||"",
            element:el,
            event:e
          })
        }
      })
    })
  }
  return root
}

const renderToHtml=(markdown,options={})=>{
  const state=createState()
  const blocks=parseBlocks(markdown,state,options)
  let html=renderBlocks(blocks,state,options)+renderFootnotes(state,options)
  if(options.wrapper!==false) html=`<div class="better-markdown">${html}</div>`
  return{html,state}
}

const render= (markdown,options={})=>renderToHtml(markdown,options).html

const mount=(target,markdown,options={})=>{
  if(!target) return null
  ensureStyles(options.styleId||"better-markdown-default-styles")
  const {html}=renderToHtml(markdown,options)
  target.innerHTML=html
  hydrate(target,options)
  return target
}

const createBetterMarkdown=(baseOptions={})=>{
  const api={
    options:{...baseOptions},
    render(markdown,options={}){
      return render(markdown,{...api.options,...options})
    },
    renderToHtml(markdown,options={}){
      return renderToHtml(markdown,{...api.options,...options})
    },
    mount(target,markdown,options={}){
      return mount(target,markdown,{...api.options,...options})
    },
    hydrate(target,options={}){
      return hydrate(target,{...api.options,...options})
    },
    use(name,value){
      api.options[name]=value
      return api
    }
  }
  return api
}

const renderMarkdown=(markdown,options={})=>render(markdown,options)

const wikilinkUtils={extractWikilinks,extractBlockIds,generateBlockId:blockId,slugify}

export {createBetterMarkdown,renderMarkdown,renderToHtml,render,mount,hydrate,wikilinkUtils,extractWikilinks,extractBlockIds,blockId as generateBlockId,slugify}

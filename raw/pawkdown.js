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
  if(target==="#"&&block){
    target=""
  }
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

const hasPackage=name=>{
  try{return !!globalThis?.process?.versions?.node&&!!eval("require")(name)}catch{return false}
}

const loadPackage=name=>{
  try{return eval("require")(name)}catch{return null}
}

const createDefaultSanitizer=()=>{
  const DOMPurifyPkg=loadPackage("dompurify")
  const jsdomPkg=loadPackage("jsdom")
  if(DOMPurifyPkg&&jsdomPkg){
    const createDOMPurify=DOMPurifyPkg.default||DOMPurifyPkg
    const {JSDOM}=jsdomPkg
    const window=new JSDOM("").window
    const purifier=createDOMPurify(window)
    return html=>purifier.sanitize(html,{USE_PROFILES:{html:true,svg:true,svgFilters:true,mathMl:true}})
  }
  return html=>html
}

const defaultHighlight=(code,lang)=>`<pre class="bm-code"><code${lang?` class="language-${escapeHtml(lang)}"`:""}>${escapeHtml(code)}</code></pre>`

const createState=()=>({
  headings:[],
  footnotes:[],
  footnoteIndex:new Map(),
  blockIds:new Set(),
  references:[],
  diagrams:[],
  math:[],
  radios:new Map(),
  checkboxIndex:0,
  radioIndex:0
})

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
        out.push({type:"math_block_inline",value:block[1]})
        i+=block[0].length
        continue
      }
      const inline=rest.match(/^\$([^$\n]+?)\$/)
      if(inline){
        out.push({type:"math_inline",value:inline[1]})
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
      {re:/^=([^=\n]+?)=/,type:"mark"},
      {re:/^--([^-\n]+?)--/,type:"del"},
      {re:/^-([^-\n]+?)-/,type:"del"},
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
      if(hashtag&&options.hashtags){
        const tag=hashtag[1].slice(1)
        out.push({type:"hashtag",value:{tag,text:hashtag[1]}})
        i+=hashtag[1].length
        continue
      }
    }
    let next=src.length
    const probes=["[[","[^","$","`","*","/","_","=","-","^","~","h","#"]
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

const renderMath=(expr,block,options)=>{
  if(options.math===false) return block?`<pre class="bm-math-raw">${escapeHtml(expr)}</pre>`:`<code class="bm-math-raw">${escapeHtml(expr)}</code>`
  if(typeof options.renderMath==="function") return options.renderMath(expr,{block})
  const katex=loadPackage("katex")
  if(katex){
    try{return katex.renderToString(expr,{displayMode:block,throwOnError:false,output:"htmlAndMathml"})}catch{}
  }
  return block?`<div class="bm-math" data-math="block">${escapeHtml(expr)}</div>`:`<span class="bm-math" data-math="inline">${escapeHtml(expr)}</span>`
}

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
    const footnoteDef=line.match(/^\[\*?\^?([^\]]+)\]\s+(.*)$/)
    if(footnoteDef&&/^[*^]?[A-Za-z0-9_-]+/.test(footnoteDef[1])){
      const key=footnoteDef[1].replace(/^\^/,"")
      const body=[footnoteDef[2]]
      i++
      while(i<lines.length&&(/^\s{2,}\S/.test(lines[i])||!lines[i].trim())){
        body.push(lines[i].replace(/^\s{2,}/,""))
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
    const ghAlert=line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i)
    if(ghAlert){
      const kind=ghAlert[1].toLowerCase()
      const body=[]
      i++
      while(i<lines.length&&/^> ?/.test(lines[i])){
        body.push(lines[i].replace(/^> ?/,""))
        i++
      }
      blocks.push({type:"alert",kind,body:body.join("\n")})
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
    const callout=line.match(/^\(:([A-Za-z0-9_-]+):\s*(.*?)\s*:\)$/)
    if(callout){
      blocks.push({type:"callout",kind:callout[1].toLowerCase(),body:callout[2]})
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
    if(/^\|.+\|$/.test(line)&&i+1<lines.length&&/^\|?\s*:?-{3,}/.test(lines[i+1])){
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
    while(i<lines.length&&lines[i].trim()&&!/^```/.test(lines[i])&&!/^(#{1,6})\s+/.test(lines[i])&&!/^>\s*\[!/.test(lines[i])&&!/^:::details/.test(lines[i])&&!/^\(:/.test(lines[i])&&!/^[-*+]\s+/.test(lines[i])&&!/^(\d+)\.\s+/.test(lines[i])&&!/^\(( |x)\)\s+/i.test(lines[i])&&!/^\[( |x|-)\]\s+/i.test(lines[i])){
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

const renderFence=(block,options)=>{
  const lang=String(block.lang||"").toLowerCase()
  if(lang==="mermaid") return renderDiagram("mermaid",block.body,options)
  if(lang==="geojson") return renderDiagram("geojson",block.body,options)
  if(lang==="topojson") return renderDiagram("topojson",block.body,options)
  if(lang==="stl") return renderDiagram("stl",block.body,options)
  if(lang==="dot"||lang==="graphviz") return renderDiagram("graphviz",block.body,options)
  if(lang==="plantuml") return renderDiagram("plantuml",block.body,options)
  if(lang==="math"||lang==="latex") return renderMath(block.body,true,options)
  if(lang==="diff") return renderDiff(block.body)
  if(typeof options.highlight==="function") return options.highlight(block.body,lang,block.meta)
  return defaultHighlight(block.body,lang)
}

const renderDiff=line=>{
  const rows=String(line).split("\n").map(v=>{
    const cls=v.startsWith("+")?"bm-diff-add":v.startsWith("-")?"bm-diff-del":"bm-diff"
    return `<div class="${cls}">${escapeHtml(v)}</div>`
  }).join("")
  return `<pre class="bm-diff-block">${rows}</pre>`
}

const renderDiagram=(kind,source,options)=>{
  if(typeof options.renderDiagram==="function") return options.renderDiagram(kind,source)
  if(kind==="plantuml"&&options.plantumlServer){
    const encoded=encodePlantUml(source)
    return `<img class="bm-diagram bm-diagram-plantuml" alt="plantuml diagram" src="${escapeHtml(options.plantumlServer.replace(/\/$/,""))+"/svg/"+encoded}">`
  }
  return `<div class="bm-diagram bm-diagram-${escapeHtml(kind)}" data-kind="${escapeHtml(kind)}"><pre>${escapeHtml(source)}</pre></div>`
}

const encodePlantUml=text=>{
  const chars="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
  const bytes=typeof Buffer!=="undefined"?Buffer.from(String(text),"utf8"):new TextEncoder().encode(String(text))
  let out=""
  for(let i=0;i<bytes.length;i+=3){
    const b1=bytes[i]
    const b2=i+1<bytes.length?bytes[i+1]:0
    const b3=i+2<bytes.length?bytes[i+2]:0
    const c1=b1>>2
    const c2=((b1&0x3)<<4)|(b2>>4)
    const c3=((b2&0xf)<<2)|(b3>>6)
    const c4=b3&0x3f
    out+=chars[c1]+chars[c2]+chars[c3]+chars[c4]
  }
  return out
}

const renderBlocks=(blocks,state,options)=>blocks.map(block=>{
  if(block.type==="heading") return `<h${block.depth} id="${escapeHtml(block.id)}">${renderInline(tokenizeInline(block.text,state,options),state,options)}</h${block.depth}>`
  if(block.type==="paragraph"){
    const body=renderInline(tokenizeInline(block.text,state,options),state,options)
    return `<p${block.bid?` id="${escapeHtml(block.bid)}" data-block-id="${escapeHtml(block.bid)}"`:""}>${body}</p>`
  }
  if(block.type==="ul") return `<ul>${block.items.map(item=>`<li>${renderInline(tokenizeInline(item,state,options),state,options)}</li>`).join("")}</ul>`
  if(block.type==="ol") return `<ol start="${block.start}">${block.items.map(item=>`<li>${renderInline(tokenizeInline(item,state,options),state,options)}</li>`).join("")}</ol>`
  if(block.type==="checkbox_group") return `<ul class="bm-checklist">${block.items.map(item=>{
    const idx=++state.checkboxIndex
    const checked=item.state==="x"
    const mixed=item.state==="-"
    return `<li class="bm-check-item"><label><input type="checkbox" data-bm-checkbox="${idx}"${checked?" checked":""}${mixed?" data-indeterminate=\"true\"":""}> <span>${renderInline(tokenizeInline(item.text,state,options),state,options)}</span></label></li>`
  }).join("")}</ul>`
  if(block.type==="radio_group") return `<ul class="bm-radio-list">${block.items.map((item,index)=>`<li class="bm-radio-item"><label><input type="radio" name="${escapeHtml(block.group)}" value="${index}"${item.checked?" checked":""}> <span>${renderInline(tokenizeInline(item.text,state,options),state,options)}</span></label></li>`).join("")}</ul>`
  if(block.type==="callout") return `<div class="bm-callout bm-callout-${escapeHtml(block.kind)}"><div class="bm-callout-body">${renderInline(tokenizeInline(block.body,state,options),state,options)}</div></div>`
  if(block.type==="alert") return `<div class="bm-alert bm-alert-${escapeHtml(block.kind)}"><div class="bm-alert-title">${escapeHtml(block.kind.toUpperCase())}</div><div class="bm-alert-body">${renderBlocks(parseBlocks(block.body,state,options),state,options)}</div></div>`
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

const hydrate=(root,options={})=>{
  if(!root||typeof root.querySelectorAll!=="function") return root
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
  if(options.sanitize!==false){
    const sanitize=typeof options.sanitize==="function"?options.sanitize:createDefaultSanitizer()
    html=sanitize(html)
  }
  if(options.wrapper!==false) html=`<div class="better-markdown">${html}</div>`
  return{html,state}
}

const render=(markdown,options={})=>renderToHtml(markdown,options).html

const mount=(target,markdown,options={})=>{
  if(!target) return null
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

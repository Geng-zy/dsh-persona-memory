(function(){
const PACKAGE="dsh-qq-gateway";
window.__ModuleLoader__.load({id: PACKAGE,factory:require=>{
 const R=require('react'),React=R.createElement?R:R.default,h=React.createElement,P=require('@deepseek-ai/dsh-client-ui-primitives');
 const modules=["ui-bridge", "ui-extra"].map(x=>require(PACKAGE+'/'+x)),Layout=require(PACKAGE+'/ui-layout');
 const NS=PACKAGE.replaceAll('-',''),categoryLabels={"overview": "运行概览", "connection": "连接与权限", "chat": "聊天与回复", "memory": "消息存档", "life": "主动聊天", "media": "图片、语音与视频", "backup": "备份与迁移", "maintenance": "维护与提醒"},title="QQ 接入助手";
 function Editor(props){
  if(props.view==='summary')return title;
  const english=props.t?.('language')==='en',title=english?"QQ Gateway":"QQ 接入助手",categories=english?{overview:'Overview',connection:'Connection & access',chat:'Chat & context',memory:"Message archives",life:"Proactive chat",media:'Images, voice & video',backup:'Backup & migration',maintenance:'Maintenance'}:categoryLabels;
  const states=modules.map((_,i)=>props['useForm'+i](s=>s));
  const [category,setCategory]=React.useState(()=>{try{const previous=localStorage.getItem(PACKAGE+':category');return Object.hasOwn(categories,previous)?previous:'overview'}catch{return 'overview'}}),[query,setQuery]=React.useState(''),[activeSection,setActiveSection]=React.useState(()=>{try{return localStorage.getItem(PACKAGE+':active-section')||'companion-status'}catch{return 'companion-status'}}),[documents,setDocuments]=React.useState({});
  React.useEffect(()=>{try{localStorage.setItem(PACKAGE+':active-section',activeSection)}catch{}},[activeSection]);
  const dirty=states.some(s=>s.dirty),documentDirty=Object.values(documents).some(Boolean),saving=states.some(s=>s.saving),invalid=states.some(s=>s.invalid),available=states.every(s=>s.available),writable=states.every(s=>s.writable);
  React.useEffect(()=>{const warn=e=>{if(dirty||documentDirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty,documentDirty]);
  function translate(ui){const language=english?'en':'zh';return(key,vars)=>String(ui.dictionaries[language][key]||key).replace(/\{(\w+)\}/g,(all,name)=>vars&&vars[name]!==undefined?String(vars[name]):all)}
  const documentChanged=React.useCallback((name,value)=>setDocuments(previous=>previous[name]===value?previous:{...previous,[name]:value}),[]);
  return h('div',{className:'sc-app'},h('header',{className:'sc-hero'},h('div',{className:'sc-brand-mark','aria-hidden':true},"Q"),h('div',null,h('p',{className:'sc-eyebrow'},PACKAGE),h('h2',null,title))),
   h('div',{className:'sc-layout'},h('nav',{className:'sc-nav','aria-label':title},Object.entries(categories).map(([id,label],i)=>h('button',{key:id,type:'button',className:'sc-nav-item'+(category===id&&!query?' sc-active':''),onClick:()=>{setCategory(id);setQuery('');try{localStorage.setItem(PACKAGE+':category',id)}catch{}}},h('span',{className:'sc-nav-number'},String(i+1).padStart(2,'0')),label))),
    h('main',{className:'sc-main'},h('div',{className:'sc-search-row'},h('input',{type:'search',className:'sc-search',placeholder:(english?"Search settings…":"搜索设置与说明…"),'aria-label':(english?"Search all settings":"搜索全部设置"),value:query,onChange:e=>setQuery(e.target.value)}),h('button',{type:'button',className:'sc-tool',onClick:()=>setActiveSection('')},(english?"Collapse all":"全部收起"))),
     h('div',{className:'sc-page-heading'},h('h3',null,query?(english?"Search results":"搜索结果"):categories[category])),
     !available?h('p',{role:'status'},(english?"Settings are unavailable":"插件设置暂不可用")):null,
     states.some(s=>s.failed)?h('p',{role:'alert',className:'compc-error'},(english?"Settings could not be saved. Review the error and retry.":"设置保存失败，请检查错误后重试。")):null,
     available?h('div',{className:'sc-settings'},h(Layout.Context.Provider,{value:{category,query,activeSection,setActiveSection,documentChanged}},modules.map((ui,i)=>h(ui.SettingsPage,{key:i,t:translate(ui),useSnowlumaForm:props['useForm'+i],useCompanionForm:props['useForm'+i],edit:props.edit[i],resetField:props.reset[i]})))):null)),
   h('footer',{className:'sc-save'+(dirty||documentDirty?' sc-dirty':' sc-clean')},h('div',null,h('strong',null,saving?(english?"Saving…":"正在保存…"):dirty?(english?"Unsaved settings":"有未保存的设置"):documentDirty?(english?"Unsaved document drafts":"有未保存的文档草稿"):(english?"All settings saved":"所有设置已保存")),h('p',null,(english?"Use each document editor to save its text.":"文档正文使用各自编辑器中的保存按钮。"))),
    h('div',{className:'sc-save-actions'},h(P.Button,{disabled:saving||!dirty,onClick:props.discard},(english?"Discard changes":"放弃设置改动")),h(P.Button,{disabled:saving||!dirty||!writable||invalid,onClick:props.save},(english?"Save settings":"保存设置")))));
 }
 class SettingsBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return{error}}
  render(){return this.state.error?h('div',{className:'sc-app',role:'alert'},h('p',null,'Settings could not render / 设置页显示出错'),h('p',null,this.state.error.message),h(P.Button,{onClick:()=>window.location.reload()},'Reload / 刷新页面')):this.props.children}
 }
 function SettingsPage(props){if(props.view==='summary')return props.t?.('summary')||title;return h(SettingsBoundary,null,h(Editor,props))}
 function apply(ctx){
  const scopes=["snowluma-bridge", "snowluma-bridge"].map(ns=>ctx.configForms.get(ns)),definitions=modules.map((ui,i)=>ui.createForm(scopes[i]));
  definitions.forEach(m=>m.form.dispose());
  // Both visual panels edit one namespace. Commit their fields together at one revision.
  const sharedForm=new P.SettingsFormModel(scopes[0],definitions.flatMap(m=>m.specs),definitions.flatMap(m=>m.secrets)),models=modules.map((ui,i)=>ui.createForm(scopes[i],sharedForm)),actions=models.map(m=>m.form.actions());let disposed=false;
  modules.forEach(ui=>ctx.effect(()=>ctx.locale.register(ui.namespace,ui.dictionaries),'settings: dictionaries '+ui.namespace));
  ctx.effect(()=>ctx.locale.register(NS,{zh:{language:'zh',title:"QQ 接入助手",summary:"QQ 接入助手"},en:{language:'en',title:"QQ Gateway",summary:"QQ Gateway"}}),'settings: title');
  ctx.effect(()=>()=>{disposed=true;sharedForm.dispose()},'settings: dispose forms');
  function refreshSecrets(){ctx.remote.settings.describe().then(response=>{if(disposed||!response.ok)return;["snowluma-bridge", "snowluma-bridge"].forEach((ns,i)=>{const row=response.value.namespaces.find(n=>n.ns===ns),flags={};(row?.secrets||[]).forEach(s=>{if(s.path.length===1)flags[s.path[0]]=s.set===true});models[i].setSecrets(flags)})},()=>{})}
  refreshSecrets();scopes.forEach(scope=>ctx.effect(()=>scope.subscribe(refreshSecrets),'settings: secrets'));
  const edits=actions.map((a,i)=>(field,text)=>{
   if(i===0&&field.startsWith('typing')){const f=models[0].form;if(f.field('typingAdminPrivate').text==='')a.edit('typingAdminPrivate',f.field('typingPrivate').text);['AdminPrivate','Private','Group'].forEach(c=>['CharsPerMinute','MinSeconds','MaxSeconds'].forEach(s=>{const key='typing'+c+s,legacy=s==='CharsPerMinute'?'typingCharsPerMinute':'typing'+s;if(f.field(key).text==='')a.edit(key,s==='MaxSeconds'?String(c==='AdminPrivate'?5:8):f.field(legacy).text)}))}
   a.edit(field,text)
  });
  const injected=()=>({hooks:Object.fromEntries(models.map((m,i)=>['form'+i,m.store])),edit:edits,reset:actions.map(a=>a.resetField),save:async()=>{if(models.some(m=>m.form.shell().invalid||!m.form.shell().writable))return;await sharedForm.save()},discard:()=>actions.forEach(a=>a.discard())});
  ctx.effect(()=>ctx.configForms.whileServed([...new Set(["snowluma-bridge", "snowluma-bridge"])],()=>ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:PACKAGE,locale:NS,inject:injected},SettingsPage))),'settings: plugin entry');
  ctx.effect(()=>ctx.configForms.whileServed([...new Set(["snowluma-bridge", "snowluma-bridge"])],()=>ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:PACKAGE,order:46,label:()=>"QQ 接入助手",locale:NS,inject:injected},props=>h('div',{className:'sc-settings-entry'},h(SettingsPage,props))))),'settings: main entry');
 }
 return{inject:['slots','locale','configForms','remote','remote.settings'],apply,SettingsPage}
}});

})();

(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const config=window.TEAMFEST_CONFIG;
  const STORAGE="teamfest_hughes_admin_session_v1";
  const BASE="https://god-d-mihawk.github.io/CyberSOC-TeamFest-2026/";
  const DATE_A=Date.parse("2026-12-18T00:00:00+04:00");
  const DATE_B=Date.parse("2026-12-19T12:00:00+04:00");
  let session,model=null,busy=false,activeTab="overview";
  try{session=JSON.parse(sessionStorage.getItem(STORAGE)||"null")}catch{session=null}
  const msg=(v,type="")=>{$("message").textContent=v;$("message").className=type==="error"?"msgerr":type==="ok"?"msgok":""};
  if(!config?.url||!config?.key){msg("Configuration missing. Check config.js.","error");return}
  const root=config.url.replace(/\/$/,"");
  function saveSession(data){
    if(data?.access_token&&data?.refresh_token){
      session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+Number(data.expires_in||3600)*1000};
      sessionStorage.setItem(STORAGE,JSON.stringify(session));
    }
  }
  function signout(){session=null;sessionStorage.removeItem(STORAGE);model=null;$("dashboard").classList.add("hidden");$("auth").classList.remove("hidden");$("pin").value=""}
  async function request(path,method,body,token){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const headers={"apikey":config.key,"Content-Type":"application/json"};
      if(token)headers.Authorization="Bearer "+token;
      const response=await fetch(root+path,{method,headers,signal:controller.signal,cache:"no-store",body:body===undefined?undefined:JSON.stringify(body)});
      const raw=await response.text();
      let result;try{result=raw?JSON.parse(raw):{}}catch{result={error:raw.slice(0,200)}}
      if(!response.ok||result.error)throw new Error((result.error_description||result.msg||result.message||result.error||"Request failed")+" [HTTP "+response.status+"]");
      return result;
    }catch(e){if(e.name==="AbortError")throw Error("Supabase request timed out");throw e}
    finally{clearTimeout(timeout)}
  }
  async function token(){
    if(!session?.access_token)return null;
    if(session.expires_at-Date.now()<60000){
      try{saveSession(await request("/auth/v1/token?grant_type=refresh_token","POST",{refresh_token:session.refresh_token}))}
      catch{signout();return null}
    }
    return session.access_token;
  }
  async function api(action,body={}){
    const jwt=await token();
    if(!jwt)throw Error("Sign in first");
    return request("/functions/v1/tf-admin-v2","POST",{action,...body},jwt);
  }
  const busyCall=async fn=>{
    if(busy)return;busy=true;
    try{await fn()}catch(error){msg("⚠️ "+(error?.message||String(error)),"error")}
    finally{busy=false}
  };
  function text(tag,value,klass){const e=document.createElement(tag);e.textContent=String(value??"");if(klass)e.className=klass;return e}
  function button(label,click,klass="alt btnsmall",disabled=false){
    const el=document.createElement("button");el.type="button";el.className=klass;el.textContent=label;el.disabled=disabled;el.onclick=click;return el
  }
  function formatDate(raw){return new Intl.DateTimeFormat("en-GB",{timeZone:"Indian/Mauritius",dateStyle:"medium",timeStyle:"short"}).format(new Date(raw))+" MUT"}
  function switchTab(tab){
    activeTab=tab;
    document.querySelectorAll("[data-tab]").forEach(el=>el.classList.toggle("active",el.dataset.tab===tab));
    document.querySelectorAll(".panel").forEach(el=>el.classList.toggle("on",el.id==="tab-"+tab));
  }
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  function render(data){
    model=data;
    $("auth").classList.add("hidden");$("dashboard").classList.remove("hidden");$("who").textContent="Hughes ADM · "+data.admin.display_name;
    $("statTotal").textContent=data.summary.total;
    $("statActive").textContent=data.summary.activated;
    $("statInvited").textContent=data.summary.invited+" / "+data.summary.with_email;
    $("statVotes").textContent=data.summary.voted;
    $("voteDeadline").textContent=formatDate(data.settings.vote_deadline);
    const readiness=[
      "Participant emails: "+data.summary.with_email+" / 20",
      "Activated logins: "+data.summary.activated+" / 20",
      "Invitations marked sent: "+data.summary.invited+" / 20",
      "Draw readiness: "+(data.summary.draw_ready?"Ready for authorisation":"Incomplete"),
      "Encrypted draw: "+(data.settings.draw_executed_at?"COMMITTED":"Not performed")
    ];
    $("readiness").textContent=readiness.join("\n");
    $("drawstatus").textContent=data.settings.draw_executed_at
      ?"One-time draw committed on "+formatDate(data.settings.draw_executed_at)+". Assignments are individually accessible."
      :data.settings.draw_enabled?"Draw authorised. Ready to perform sealed draw once all accounts are verified.":"Draw not authorised. Registration must be complete.";
    $("enableDraw").disabled=!!data.settings.draw_enabled||!!data.settings.draw_executed_at||!data.summary.draw_ready;
    $("executeDraw").disabled=!!data.settings.draw_executed_at||!data.settings.draw_enabled||!data.summary.draw_ready;
    $("getA").disabled=!data.release.a||!data.settings.draw_executed_at;
    $("getB").disabled=!data.release.b||!data.settings.draw_executed_at;
    $("unlockMaster").disabled=!data.release.b||!data.settings.draw_executed_at;
    $("votingVisibility").textContent=data.votes?"Voting closed. Final results released.":"Voting remains open. Only turnout is visible until the deadline.";
    const voteResults=$("voteResults");voteResults.replaceChildren();
    if(data.votes){
      for(const [id,label] of [["flat","Flat Island"],["gabriel","Gabriel Island"],["cerfs","Île aux Cerfs"],["chamarel","Chamarel"]])voteResults.append(text("p",label+": "+(data.votes[id]||0)+" votes","choice"));
    }else voteResults.append(text("p","Turnout: "+data.summary.voted+" / "+data.summary.total,"muted"));
    const logs=$("logs");logs.replaceChildren();
    for(const row of data.audit||[])logs.append(text("div",formatDate(row.occurred_at)+" — "+row.action+" "+JSON.stringify(row.details||{})));
    if(!(data.audit||[]).length)logs.textContent="No admin activity recorded yet.";
    renderRoster();
  }
  function renderRoster(){
    if(!model)return;
    const rows=$("roster");rows.replaceChildren();
    const filter=$("filter").value.toLowerCase();
    const members=model.participants.filter(p=>[p.display_name,p.slug,p.invited_email||"",p.job_title||""].some(x=>x.toLowerCase().includes(filter)));
    for(const p of members){
      const tr=document.createElement("tr");
      const name=document.createElement("td");name.append(text("strong",p.display_name),text("div",p.slug,"muted"));
      const team=document.createElement("td");team.append(text("strong",p.team),text("div",p.job_title||"","muted"));
      const email=text("td",p.invited_email||"Not added");
      const activated=document.createElement("td");activated.append(text("span",p.activated?"Verified":"Pending","tag"+(p.activated?"":" alert")));
      const invite=document.createElement("td");invite.append(text("span",p.invited_at?"Sent (recorded)":p.invited_email?"Ready":"Missing email","tag"+(!p.invited_at?" alert":"")));
      const actions=document.createElement("td");actions.className="inline";
      actions.append(
        button("Edit",()=>openEdit(p)),
        button("Copy invite",()=>copyInvite(p),"alt btnsmall",!p.invited_email),
        button("Mark sent",()=>markInvited(p),"alt btnsmall",!p.invited_email||!!p.invited_at)
      );tr.append(name,team,email,activated,invite,actions);rows.append(tr);
    }
  }
  $("filter").addEventListener("input",renderRoster);
  function openEdit(p){
    $("editId").value=p.id;$("editName").value=p.display_name;$("editSlug").value=p.slug;
    $("editRole").value=p.job_title||"";$("editTeam").value=p.team;$("editEmail").value=p.invited_email||"";
    $("editEmail").disabled=!!p.activated;$("editPrevious").checked=p.previous_tb;
    $("editModal").classList.remove("hidden");
  }
  $("cancelEdit").onclick=()=>$("editModal").classList.add("hidden");
  $("savePerson").onclick=()=>busyCall(async()=>{
    const data={id:$("editId").value,display_name:$("editName").value,slug:$("editSlug").value,job_title:$("editRole").value,team:$("editTeam").value,invited_email:$("editEmail").value,previous_tb:$("editPrevious").checked};
    await api("update_participant",data);$("editModal").classList.add("hidden");await refresh("Participant updated");
  });
  async function copyInvite(p){
    const url=BASE+encodeURIComponent(p.slug);
    const textValue="🎄 CyberSOC TeamFest 2026 — Personal Invitation\n\nHello "+p.display_name+",\n\nYou're invited to our end-of-year celebration on Saturday 19 December! Choose your outing and create your Secret Santa wishlist.\n\nYour private activation link:\n"+url+"\n\nOpen the link, verify your email address and create an eight-digit PIN.\n\nSee you there! 🎁";
    try{await navigator.clipboard.writeText(textValue);msg("✅ Invitation copied for "+p.display_name+". Send it from your Outlook account.","ok")}
    catch{msg("Clipboard blocked: open your browser permissions or select and copy the invitation manually.","error")}
  }
  const markInvited=p=>busyCall(async()=>{if(!confirm("Only confirm if you actually sent "+p.display_name+"'s invitation from Outlook."))return;await api("mark_invited",{id:p.id});await refresh("Invitation status saved")});
  async function refresh(success=""){
    const data=await api("status");render(data);
    msg(success?("✅ "+success):"✅ Admin data loaded.","ok");
  }
  $("refresh").onclick=()=>busyCall(()=>refresh());
  $("testDraw").onclick=()=>busyCall(async()=>{
    const r=await api("test_draw");
    $("testinfo").textContent="Test result: "+(r.ok?"PASS":"FAIL")+"\nGivers: "+r.unique_givers+" · Recipients: "+r.unique_recipients+" · Self-matches: "+r.self_matches+"\nNothing was stored.";
    msg(r.ok?"✅ Draw rules passed dry-run test.":"⚠️ Dry-run failed.",r.ok?"ok":"error");
  });
  $("extendVote").onclick=()=>busyCall(async()=>{
    const value=$("newDeadline").value;
    if(!/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error("Choose a valid date.");
    await api("extend_vote",{vote_deadline:value+":00+04:00"});
    await refresh("Voting deadline extended");
  });
  $("enableDraw").onclick=()=>busyCall(async()=>{
    if(!confirm("Authorise a single Secret Santa draw after all 20 accounts have been verified?"))return;
    await api("enable_draw");await refresh("Draw authorised");
  });
  $("executeDraw").onclick=()=>busyCall(async()=>{
    if(prompt("This is irreversible. Type DRAW to perform the sealed draw:")!=="DRAW")return;
    const r=await api("execute_draw");
    await refresh("Encrypted Secret Santa draw committed for "+r.assignments+" colleagues");
  });
  for(const part of ["A","B"])$("get"+part).onclick=()=>busyCall(async()=>{
    const r=await api("release_code",{part});
    $("code"+part).value=r.code;msg("✅ Code "+part+" retrieved. Keep this code private.","ok");
  });
  $("unlockMaster").onclick=()=>busyCall(async()=>{
    const r=await api("unlock_master",{code_a:$("codeA").value.trim(),code_b:$("codeB").value.trim()});
    const area=$("master");area.replaceChildren();
    area.append(text("h3","Decrypted assignment list"));
    r.pairs.forEach(p=>area.append(text("div",p.giver+" → "+p.recipient)));
    msg("✅ Master list unlocked. Do not share it.","ok");
  });
  $("signin").onclick=()=>busyCall(async()=>{
    const email=$("email").value.trim().toLowerCase(),pin=$("pin").value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Enter your Outlook email.");
    if(!/^[0-9]{8}$/.test(pin))throw Error("PIN must be eight digits.");
    msg("Signing in...");
    const data=await request("/auth/v1/token?grant_type=password","POST",{email,password:pin});
    saveSession(data);await refresh();
  });
  $("activate").onclick=()=>busyCall(async()=>{
    const email=$("email").value.trim().toLowerCase(),pin=$("pin").value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Enter your Outlook email.");
    if(!/^[0-9]{8}$/.test(pin))throw Error("PIN must be eight digits.");
    const data=await request("/auth/v1/signup?redirect_to="+encodeURIComponent(BASE+"admin.html"),"POST",{email,password:pin});
    if(data.access_token){saveSession(data);await refresh()}
    else msg("✅ Activation submitted. Check Outlook for email verification. If you already have an account, select Sign in.","ok");
  });
  $("logout").onclick=()=>{signout();msg("Signed out.","ok")};
  const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1));
  if(h.get("access_token")&&h.get("refresh_token")){
    saveSession({access_token:h.get("access_token"),refresh_token:h.get("refresh_token"),expires_in:Number(h.get("expires_in")||3600)});
    history.replaceState(null,"",location.pathname);
  }
  if(q.get("error_description")||h.get("error_description"))msg("Authentication callback error: "+(q.get("error_description")||h.get("error_description")),"error");
  else if(session)busyCall(()=>refresh());
  else msg("Sign in with your Outlook email and administrator PIN.");
})();
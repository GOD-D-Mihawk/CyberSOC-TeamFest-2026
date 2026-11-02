(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const cfg=window.TEAMFEST_CONFIG;
  const base="https://god-d-mihawk.github.io/CyberSOC-TeamFest-2026/";
  const project=cfg?.url?.replace(/\/$/,"");
  const storage="teamfest_participant_session_v2";
  const rawSlug=sessionStorage.getItem("tf_path")||new URLSearchParams(location.search).get("person")||location.pathname.replace(/^\/CyberSOC-TeamFest-2026\/?/,"");
  const slug=rawSlug.split("/").filter(Boolean).pop()?.toLowerCase()||"";
  sessionStorage.removeItem("tf_path");
  const plans=[["flat","🏝️","Flat Island Catamaran","08:45–16:00 · Grand Bay","Rs 2,030"],["gabriel","⛵","Gabriel Island Catamaran","09:00–16:00 · Grand Baie","Rs 2,030"],["cerfs","🌴","Île aux Cerfs","09:30–18:00 · Pointe Maurice","Rs 1,950"],["chamarel","🌿","Chamarel","09:00–16:00 · Chamarel","Rs 700 + lunch"]];
  let deadline=Date.parse("2026-12-04T00:00:00+04:00"),choice="gabriel",person=null,session=null;
  try{session=JSON.parse(sessionStorage.getItem(storage)||"null")}catch{session=null}
  const msg=x=>$("message").textContent=x;
  $("personal").textContent=slug?"Personal link: /"+slug+" · Use your invited email.":"Open the personalised invitation sent by your organiser.";
  if(!cfg?.key||!project){msg("Site configuration missing.");return}
  const save=s=>{if(s?.access_token&&s?.refresh_token){session={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Date.now()+Number(s.expires_in||3600)*1000};sessionStorage.setItem(storage,JSON.stringify(session))}};
  const drop=()=>{session=null;person=null;sessionStorage.removeItem(storage);$("portal").classList.add("hide");$("auth").classList.remove("hide");document.body.classList.remove("ready")};
  const send=async(path,method="GET",body,token,extra={})=>{
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),18000);
    try{const headers={apikey:cfg.key,"Content-Type":"application/json",...extra};if(token)headers.Authorization="Bearer "+token;
      const res=await fetch(project+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:ctrl.signal});
      const raw=await res.text();let data;try{data=raw?JSON.parse(raw):{}}catch{data={error:raw.slice(0,200)}}
      if(!res.ok||data.error)throw Error((data.message||data.error_description||data.msg||data.error||"Request failed")+" [HTTP "+res.status+"]");
      return data;
    }finally{clearTimeout(timeout)}
  };
  const authenticated=async()=>{if(!session)return null;if(session.expires_at-Date.now()<60000){try{save(await send("/auth/v1/token?grant_type=refresh_token","POST",{refresh_token:session.refresh_token}))}catch{drop();return null}}return session?.access_token};
  const userRequest=async(path,method="GET",body,extra)=>{const token=await authenticated();if(!token)throw Error("Please sign in.");return send(path,method,body,token,extra)};
  const safe=async fn=>{try{await fn()}catch(e){msg("⚠️ "+(e.message||String(e)))}};
  function navigate(name){if(name==="admin"){location.assign(base+"admin.html");return}document.querySelectorAll(".screen").forEach(e=>e.classList.toggle("on",e.id===name));document.querySelectorAll("[data-go]").forEach(e=>e.classList.toggle("active",e.dataset.go===name))}
  document.querySelectorAll("[data-go],[data-action]").forEach(e=>e.onclick=()=>navigate(e.dataset.go||e.dataset.action));
  function countdown(){const sec=Math.max(0,Math.floor((deadline-Date.now())/1000));const values=[Math.floor(sec/86400),Math.floor(sec%86400/3600),Math.floor(sec%3600/60),sec%60];["d","h","m","s"].forEach((id,i)=>$(id).textContent=String(values[i]).padStart(2,"0"));$("vstatus").textContent=sec?"OPEN":"CLOSED";$("savevote").disabled=!sec}
  setInterval(countdown,1000);countdown();
  async function getSettings(){const r=await send("/rest/v1/tf_event_settings?select=vote_deadline&singleton=eq.true");if(r[0]?.vote_deadline){deadline=Date.parse(r[0].vote_deadline);countdown()}}
  function trips(){$("trips").replaceChildren();for(const p of plans){const b=document.createElement("button");b.className="trip"+(choice===p[0]?" on":"");for(const [tag,txt] of [["span",p[1]],["strong",p[2]],["small",p[3]],["b",p[4]]]){const el=document.createElement(tag);el.textContent=txt;b.append(el)}b.onclick=()=>{choice=p[0];trips()};$("trips").append(b)}}trips();
  async function loadVote(){const items=await userRequest("/rest/v1/tf_votes?select=choice&participant_id=eq."+person.id);if(items[0]?.choice)choice=items[0].choice;trips();$("myvote").textContent=items.length?"Your vote: "+(plans.find(x=>x[0]===choice)?.[2]||choice):"You haven't voted yet."}
  async function loadWish(){const items=await userRequest("/rest/v1/tf_wishlists?select=likes,avoid,ideas,surprise&participant_id=eq."+person.id),wish=items[0];$("likes").value=wish?.likes||"";$("avoid").value=wish?.avoid||"";$("ideas").value=wish?.ideas||"";$("surprise").checked=wish?.surprise??true}
  async function load(){
    await getSettings();
    const token=await authenticated();if(!token)return drop();
    if(!slug||slug==="index.html"||slug==="admin.html"||slug==="admin-v2.html")return msg("Open your own personal invitation URL.");
    await userRequest("/rest/v1/rpc/tf_claim_account","POST",{});
    const profiles=await userRequest("/rest/v1/tf_participants?select=id,display_name,slug&auth_user_id=eq."+(await send("/auth/v1/user","GET",undefined,token)).id);
    if(!profiles.length||profiles[0].slug!==slug)return msg("The signed-in account does not match this personal link. Sign out and use your invited address.");
    person=profiles[0];$("welcome").textContent="Welcome, "+person.display_name+" 🎄";$("auth").classList.add("hide");$("portal").classList.remove("hide");document.body.classList.add("ready");document.querySelectorAll('[data-go="admin"]').forEach(e=>e.classList.add("hide"));msg("✅ Login verified.");
    await Promise.all([loadVote(),loadWish()]);
  }
  $("signup").onclick=()=>safe(async()=>{
    if(!slug)return msg("Open your invitation link first.");
    const email=$("email").value.trim().toLowerCase(),pin=$("pin").value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[0-9]{8}$/.test(pin))return msg("Enter a valid email and an eight-digit PIN.");
    const out=await send("/auth/v1/signup?redirect_to="+encodeURIComponent(base+"?person="+encodeURIComponent(slug)),"POST",{email,password:pin});
    if(out.access_token){save(out);await load()}else msg("✅ Activation requested. Verify your email, then sign in.");
  });
  $("login").onclick=()=>safe(async()=>{
    const email=$("email").value.trim().toLowerCase(),pin=$("pin").value;
    if(!email||!/^[0-9]{8}$/.test(pin))return msg("Enter your email and eight-digit PIN.");
    const out=await send("/auth/v1/token?grant_type=password","POST",{email,password:pin});save(out);await load();
  });
  $("logout").onclick=()=>{drop();msg("Signed out.")};
  $("savevote").onclick=()=>safe(async()=>{
    if(!person)return msg("Sign in first.");
    await getSettings();if(Date.now()>=deadline)return msg("Voting is closed.");
    await userRequest("/rest/v1/tf_votes?on_conflict=participant_id","POST",{participant_id:person.id,choice},{Prefer:"resolution=merge-duplicates,return=minimal"});
    await loadVote();msg("✅ Your vote has been saved.");
  });
  $("savewishlist").onclick=()=>safe(async()=>{
    if(!person)return msg("Sign in first.");
    await userRequest("/rest/v1/tf_wishlists?on_conflict=participant_id","POST",{participant_id:person.id,likes:$("likes").value,avoid:$("avoid").value,ideas:$("ideas").value,surprise:$("surprise").checked},{Prefer:"resolution=merge-duplicates,return=minimal"});
    msg("✅ Wishlist saved.");
  });
  $("myrecipient").onclick=()=>safe(async()=>{
    const r=await userRequest("/functions/v1/tf-my-recipient","POST",{});
    $("recipient").textContent=r.recipient
      ?"Recipient: "+r.recipient.display_name+"\nLikes: "+(r.recipient.likes||"Not specified")+"\nAvoid: "+(r.recipient.avoid||"Not specified")+"\nIdeas: "+(r.recipient.ideas||"Not specified")
      :"The Secret Santa draw has not been completed.";
  });
  $("getstatus").onclick=()=>navigate("admin");
  const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1));
  if(h.get("access_token")&&h.get("refresh_token")){
    save({access_token:h.get("access_token"),refresh_token:h.get("refresh_token"),expires_in:Number(h.get("expires_in")||3600)});
    history.replaceState(null,"",base+(q.get("person")?"?person="+encodeURIComponent(q.get("person")):""));
  }
  if(session)safe(load);else safe(getSettings);
})();
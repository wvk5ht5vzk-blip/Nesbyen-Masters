let userId = localStorage.getItem("userId");

if(!userId){
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}

// STATE
let state = {
  user: null,
  tid: null,
  roundId: null,
  players: [],
  screen: "leaderboard",
  selectedPlayer: null,
  openPlayers: {},
  tournamentName: "",
  currentRoundNumber: null,
};

const fileInput = document.getElementById("fileInput");

// COURSE (default)
let course = {
  name: "Standard",
  pars: [4,4,3,5,4,4,3,5,4,4,3,5,4,4,3,5,4,4]
};

// ----------------------
// INIT
// ----------------------

function loadLocal(){

  const params = new URLSearchParams(window.location.search);

  const urlTid = params.get("tid");
  const urlName = params.get("name");

  // 🔥 TID (turnering)
if(urlTid && !localStorage.getItem("tid")){
  // 🔥 kun første gang via invitasjon
  state.tid = urlTid;
  localStorage.setItem("tid", urlTid);
}else{
  state.tid = localStorage.getItem("tid");
}

  // 🔥 USER
  state.user = localStorage.getItem("user");

  if(!state.user && urlName){
    state.user = urlName;
    localStorage.setItem("user", urlName);
  }

  // 🔥 RUNDE (per turnering)
  if(state.tid){
  state.roundId = localStorage.getItem("roundId_" + state.tid) || null;
}else{
  state.roundId = null;
}

  // 🔥 HENT TURNERINGSNAVN
if(state.tid){
  db.collection("tournaments").doc(state.tid)
    .get()
    .then(doc=>{
      const data = doc.data();

      if(data){
        state.tournamentName = data.name || "Turnering";
      }else{
        state.tournamentName = "Velg turnering";
      }

      render();
    });
}else{
  state.tournamentName = "Velg turnering";
  render();
}

  console.log("TID:", state.tid);
  console.log("ROUND:", state.roundId);
}

// ----------------------
// LOGIN
// ----------------------

function showLogin(){
  login.innerHTML = `
    <div class="card">
      <h2>Nesbyen Masters</h2>

      <input id="name" placeholder="Navn"><br><br>

      ${
        state.tid 
        ? `<button onclick="quickJoin()">Bli med i spill</button>`
        : `
          <button onclick="createGame()">➕ Nytt spill</button>
          <br><br>
          <input id="code" placeholder="Spillkode">
          <button onclick="joinGame()">🔑 Bli med</button>
        `
      }
    </div>
  `;
}

function createGame(){
  const nameInput = document.getElementById("name").value;
  if(!nameInput) return alert("Skriv navn");

  state.user = nameInput;
  localStorage.setItem("user", nameInput); // 🔥 LEGG TIL

  const code = Math.floor(1000 + Math.random() * 9000);

  db.collection("tournaments").add({
    code,
    created: Date.now()
  }).then(doc=>{
    state.tid = doc.id;
    saveLocal();

    const url = window.location.origin + "?tid=" + doc.id + "&name=" + state.user;

    navigator.clipboard.writeText(url);

    alert("Spill opprettet!\n\nLink kopiert:\n" + url);

    newRound();
    start();
  });
}

function joinGame(){
  const nameInput = document.getElementById("name").value;
  const codeInput = parseInt(document.getElementById("code").value);

  if(!nameInput || !codeInput) return alert("Fyll ut navn og kode");

  state.user = nameInput;
  localStorage.setItem("user", nameInput); // 🔥 LEGG TIL

  db.collection("tournaments")
    .where("code","==",codeInput)
    .get()
    .then(snap=>{
      if(snap.empty) return alert("Fant ikke spill");

      state.tid = snap.docs[0].id;
      saveLocal();
      start();
    });
}

function quickJoin(){
  const nameInput = document.getElementById("name").value;

  if(!nameInput){
    alert("Skriv navn");
    return;
  }

  state.user = nameInput;
  localStorage.setItem("user", nameInput);

  start();
}
// ----------------------
// START
// ----------------------

function start(){

  state.tid = localStorage.getItem("tid");

  if(!state.user){
    showLogin();
    return;
  }

  if(!state.tid){
    showLogin();
    return;
  }

  login.innerHTML = "";

  db.collection("tournaments").doc(state.tid)
    .onSnapshot(doc=>{
      const data = doc.data();

      if(data && data.course){
        course = data.course;
        render();
      }
    });

  listenRounds();
}
// ----------------------
// ROUNDS
// ----------------------
function newRound(){

  console.log("NEW ROUND CLICK");

  if(!state.tid){
    alert("Ingen spill funnet");
    return;
  }

  db.collection("tournaments").doc(state.tid)
    .collection("rounds")
    .add({created: Date.now()})
    .then(()=>{
      console.log("Runde opprettet");
      showToast("➕ Ny runde startet!");
    })
    .catch(err=>{
      console.error(err);
      alert("Feil ved opprettelse av runde");
    });
}

function listenRounds(){
  if(!state.tid) return;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds")
    .onSnapshot(snap=>{
      let rounds = [];

      snap.forEach(d=>rounds.push({id:d.id,...d.data()}));
      rounds.sort((a,b)=>a.created-b.created);

      if(rounds.length){

        const savedRound = localStorage.getItem("roundId_" + state.tid);
        const exists = rounds.find(r => r.id === savedRound);

        if(savedRound && exists){
          state.roundId = savedRound;
        }else{
          state.roundId = rounds[rounds.length-1].id;
        }

        listenPlayers();

      } else {
        state.roundId = null;
      const index = rounds.findIndex(r => r.id === state.roundId);
      state.currentRoundNumber = index !== -1 ? index + 1 : null;
      }

    }); // ✅ DENNE manglet!
}


// ----------------------
// PLAYERS
// ----------------------

function listenPlayers(){
  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players")
    .onSnapshot(snap=>{
      state.players = [];

      snap.forEach(d=>{
        let p = d.data();

        state.players.push({
          id: d.id,
          name: p.name || "Spiller",
          hcp: p.hcp || 0,
          scores: p.scores || Array(18).fill(0),
          image: p.image || "",
          longest: p.longest || 0,
          closest: p.closest || 0
        });
      });

const params = new URLSearchParams(window.location.search);
const urlName = params.get("name");

if(urlName){

  const exists = state.players.find(p => p.name === urlName);

  if(!exists){
    db.collection("tournaments").doc(state.tid)
      .collection("rounds").doc(state.roundId)
      .collection("players")
      .add({
        name: urlName,
        hcp: 0,
        scores: Array(18).fill(0),
        image: "",
        longest: 0,
        closest: 0
      });
  }

}

render();

// 🔥 start events når alt er klart
if(!state.eventsStarted){
  state.eventsStarted = true;
  listenEvents();
}
    });
}

function addPlayer(){
  const name = prompt("Navn");
  if(!name) return;

  const hcp = parseInt(prompt("HCP")) || 0;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players")
    .add({
      name,
      hcp,
      scores: Array(18).fill(0),
      image: "",
      longest: 0,
      closest: 0
    });
}

function deletePlayer(id){
  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(id)
    .delete();
}

function shareGame(){
const url = window.location.origin + window.location.pathname + "?tid=" + state.tid;
  if (navigator.share) {
    navigator.share({
      title: "Nesbyen Masters",
      text: "Bli med på spillet!",
      url: url
    });
  } else {
    navigator.clipboard.writeText(url);
    alert("Link kopiert 👍\n" + url);
  }
}

// ----------------------
// SCORE
// ----------------------

function updateScore(id, hole, val){
  const p = state.players.find(x=>x.id===id);
  p.scores[hole] += val;
  if(p.scores[hole] < 0) p.scores[hole] = 0;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(id)
    .update({scores:p.scores});
}

// handicap per hull
function netScore(p){
  const base = Math.floor(p.hcp / 18);
  const extra = p.hcp % 18;

  let h = Array(18).fill(base);
  for(let i=0;i<extra;i++) h[i]++;

  return p.scores.reduce((sum,s,i)=>sum+(s-h[i]),0);
}

// ----------------------
// EXTRA FEATURES
// ----------------------

function addEvent(text){
  db.collection("tournaments").doc(state.tid)
    .collection("events")
    .add({
      text,
      time: Date.now(),
      user: state.user
    });
}

function listenEvents(){

  let initialized = false;

  db.collection("tournaments").doc(state.tid)
    .collection("events")
    .orderBy("time", "desc")
    .limit(1)
    .onSnapshot(snap=>{

      if(!initialized){
        initialized = true;
        return;
      }

      snap.forEach(d=>{
        const e = d.data();

        // 🔥 SIKKERHET
        if(!e.text) return;

        showToast(e.text);
      });

    });
}

function openProfile(id){

  const p = state.players.find(x => x.id === id);

  if(!p){
    alert("Fant ikke spiller 😬");
    return;
  }

  const modal = document.getElementById("profileModal");

  modal.innerHTML = `
    <div class="card" style="width:80%; text-align:center;">
      <h2>${p.name}</h2>

      <img src="${p.image||''}" 
           class="avatar" 
           style="width:90px;height:90px;cursor:pointer;"
           onclick="uploadImage('${p.id}')">

      <p>📸 Trykk for å endre bilde</p>

      <p>🏌️ Drive: ${p.longest || 0}m</p>
      <p>🎯 Closest: ${p.closest || 0}cm</p>

      <button onclick="closeProfile()">Lukk</button>
    </div>
  `;

  modal.style.display = "flex";
}

function closeProfile(){
  const modal = document.getElementById("profileModal");
  modal.style.display = "none";
  modal.classList.remove("active");
}

function updateExtra(id,type){
  let val = parseFloat(prompt(type==="longest"?"Meter":"CM")) || 0;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(id)
    .update({[type]:val});
}

function chulligan(){

  showToast("🍺🔥 " + state.user + " tok en CHULLIGAN!");

  addEvent(state.user + " tok en CHULLIGAN 🍺🔥");

  sendPush("🍺 CHULLIGAN", state.user + " tok en chulligan!");
}


function spinWheel(){

  const wheelItems = [
    "🎉 GRATIS MULLIGAN",
    "➖ -1 SLAG",

    "🍺 CHUGG 🍺",
    "🍺 CHUGG 🍺",

    "🥃 SHOT 🥃",
    "🥃 SHOT 🥃",

    "🍻 ALLE DRIKKER 🍻",
    "🍻 ALLE DRIKKER 🍻",

    "😈 VELG EN SOM MÅ DRIKKE",
    "😈 VELG EN SOM MÅ DRIKKE"
  ];

  const index = Math.floor(Math.random() * wheelItems.length);
  const result = wheelItems[index];

  const modal = document.getElementById("wheelModal");
  const wheel = document.getElementById("wheel");
  const labels = document.getElementById("wheelLabels");
  
  modal.style.display = "flex";

  const degPerSlice = 360 / wheelItems.length;

  // 🎯 midt i slice
  const sliceCenter = index * degPerSlice + degPerSlice / 2;

  // 🔥 spins
  const spins = 360 * (5 + Math.floor(Math.random() * 3));

  const finalDeg = spins + sliceCenter + 0;

// 🔄 reset wheel (uten labels!)
wheel.style.transition = "none";
wheel.style.transform = "rotate(0deg)";

// ⏳ liten delay så reset faktisk skjer
setTimeout(() => {

  // 🎡 smooth spin med slowdown
  wheel.style.transition = "transform 5.5s cubic-bezier(0.1, 0.7, 0.2, 1)";
  wheel.style.transform = `rotate(-${finalDeg}deg)`;

}, 50);

  // ⏳ vis resultat etter spin
  setTimeout(() => {

    let text = "🎰 " + result;

    if(result.includes("MULLIGAN") || result.includes("-1")){
      text = "🔥🔥 " + result + " 🔥🔥";
    }

    showToast(text);
    addEvent(state.user + " spant hjulet → " + result);
    sendPush("🎰 HJUL", state.user + " fikk: " + result);
  }, 5600);
}

function closeWheel(){
  const modal = document.getElementById("wheelModal");
  const wheel = document.getElementById("wheel");

  modal.style.display = "none";

  wheel.style.transition = "none";
  wheel.style.transform = "rotate(0deg)";
}

function showToast(text){

  const el = document.getElementById("toast");
  const txt = document.getElementById("toastText");

el.innerHTML = `
  <span id="toastText">${text}</span>
  <button onclick="closeToast()" style="
    margin-left:10px;
    background:none;
    border:none;
    color:white;
    font-size:18px;
  ">❌</button>
`;

  // 🔥 fjern gamle klasser
  el.className = "";

// 🟢 CHULLIGAN = grønn
if(text.includes("CHULLIGAN")){
  el.style.background = "#22c55e";
}
// 🔴 Reverse = rød
else if(text.includes("💀")){
  el.style.background = "#ef4444";
}
// fallback
else{
  el.style.background = "#334155";
}

  el.style.display = "block";
}

function closeToast(){
  document.getElementById("toast").style.display = "none";
}

function reverseMulligan(id){

  let p = state.players.find(x=>x.id===id);

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(id)
    .update({scores:p.scores});

  showToast("💀 " + p.name + " fikk en REVERSE MULLIGAN!");

  addEvent(state.user + " ga " + p.name + " reverse mulligan 🍺");

  sendPush("💀 REVERSE", p.name + " fikk reverse mulligan!");
}

// ----------------------
// IMAGE UPLOAD
// ----------------------

fileInput.addEventListener("change", e=>{
  const file = e.target.files[0];
  if(!file || !state.selectedPlayer) return;

  const reader = new FileReader();

  reader.onload = ()=>{
    db.collection("tournaments").doc(state.tid)
      .collection("rounds").doc(state.roundId)
      .collection("players").doc(state.selectedPlayer)
      .update({image:reader.result});
  };

  reader.readAsDataURL(file);
});

function uploadImage(id){
  state.selectedPlayer = id;

  const fileInput = document.getElementById("fileInput");

  if(!fileInput){
    alert("Finner ikke fileInput 😬");
    return;
  }

  fileInput.click();
}

// ----------------------
// COURSE
// ----------------------

function addCourse(){
  const name = prompt("Banenavn");
  const pars = prompt("Pars (4,4,3...)");

  if(!name || !pars) return;

  const newCourse = {
    name,
    pars: pars.split(",").map(x=>parseInt(x))
  };

  db.collection("tournaments").doc(state.tid)
    .update({
      course: newCourse
    });

  course = newCourse;

  showToast("🏌️ Bane lagret!");
}

function chooseRound(){


  if(!state.tid){
    alert("Ingen spill funnet");
    return;
  }

  const modal = document.getElementById("roundModal");

  if(!modal){
    alert("Finner ikke modal");
    return;
  }

  db.collection("tournaments").doc(state.tid)
    .collection("rounds")
    .get()
    .then(snap=>{

      let rounds = [];
      snap.forEach(d=>rounds.push({id:d.id,...d.data()}));

      rounds.sort((a,b)=>a.created-b.created);

      modal.innerHTML = `
        <div class="card" style="width:85%; max-height:80%; overflow:auto;">
          <h3>📜 Runder</h3>

          ${rounds.map((r,i)=>`
            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              padding:10px;
              border-bottom:1px solid #333;
            ">

              <div onclick="selectRound('${r.id}')" style="cursor:pointer;">
                Runde ${i+1}
              </div>

              <button style="background:#dc2626"
                onclick="deleteRound('${r.id}')">
                🗑️
              </button>

            </div>
          `).join("")}

          <button onclick="closeRoundModal()">Lukk</button>
        </div>
      `;

      modal.style.display = "flex";

      console.log("Runder lastet:", rounds.length);
    })
    .catch(err=>{
      console.error(err);
      alert("Feil ved henting av runder");
    });
}

function chooseTournament(){

  const modal = document.getElementById("roundModal"); // vi gjenbruker denne

  db.collection("tournaments")
    .get()
    .then(snap=>{

      let tournaments = [];
      snap.forEach(d=>tournaments.push({id:d.id,...d.data()}));

      modal.innerHTML = `
        <div class="card" style="width:85%; max-height:80%; overflow:auto;">
          <h3>🏆 Turneringer</h3>

          <div style="
            padding:10px;
            border-bottom:1px solid #333;
            cursor:pointer;
            font-weight:bold;
          " onclick="createNewTournament()">
            ➕ Ny turnering
          </div>

          ${tournaments.map(t=>`
  <div style="
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:10px;
    border-bottom:1px solid #333;
  ">

    <div onclick="selectTournament('${t.id}')" style="cursor:pointer;">
      ${t.name || "Uten navn"}
    </div>

    <button style="background:#dc2626"
      onclick="deleteTournament('${t.id}')">
      🗑️
    </button>

  </div>
`).join("")}

          <button onclick="closeRoundModal()">Lukk</button>
        </div>
      `;

      modal.style.display = "flex";
    });
}

function selectTournament(id){

  state.tid = id;

  // 🔥 lagre turnering
  localStorage.setItem("tid", id);

  // 🔥 reset runde riktig (per turnering)
  state.roundId = null;

  db.collection("tournaments").doc(id).get().then(doc=>{
    const data = doc.data();

    state.tournamentName = data?.name || "Turnering";

    render();
    closeRoundModal();

    listenRounds();
  });
}

function createNewTournament(){

  const name = prompt("Navn på turnering");

  if(!name) return;

  db.collection("tournaments").add({
    name: name,
    created: Date.now()
  }).then(doc=>{

    state.tid = doc.id;
    state.tournamentName = name;

    localStorage.setItem("tid", doc.id);

    closeRoundModal();
    render();
    listenRounds();
  });
}

function deleteTournament(id){

  if(!confirm("Slette denne turneringen?")) return;

  db.collection("tournaments").doc(id).delete();

  showToast("🗑️ Turnering slettet");

  chooseTournament(); // refresh liste
}

function selectRound(id){

  state.roundId = id;

  localStorage.setItem("roundId_" + state.tid, id);

  // 🔥 hent runder og sett riktig nummer
  db.collection("tournaments").doc(state.tid)
    .collection("rounds")
    .get()
    .then(snap=>{

      let rounds = [];
      snap.forEach(d=>rounds.push({id:d.id,...d.data()}));

      rounds.sort((a,b)=>a.created-b.created);

      const index = rounds.findIndex(r => r.id === id);
      state.currentRoundNumber = index !== -1 ? index + 1 : null;

      render();
    });

  closeRoundModal();
  listenPlayers();
}
  
function closeRoundModal(){
  const modal = document.getElementById("roundModal");
  modal.style.display = "none";
  modal.innerHTML = "";
}

function deleteRound(id){

  if(!confirm("Slette denne runden?")) return;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(id)
    .delete();

  showToast("🗑️ Runde slettet");

  chooseRound(); // refresh liste
}

// ----------------------
// NAV
// ----------------------

function setScreen(s){
  state.screen = s;
  render();
}

function togglePlayer(id){
  state.openPlayers[id] = !state.openPlayers[id];
  render();
}
// ----------------------
// RENDER
// ----------------------

function render(){

  let html = "";

  // LEADERBOARD
  if(state.screen==="leaderboard"){

  html += `
<div style="padding:10px; text-align:center;">

<h3 onclick="chooseTournament()" style="cursor:pointer;">
  🏌️ ${state.tournamentName || "Velg turnering"} ▾
</h3>

<div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:10px;">
<button onclick="newRound()">➕ Ny runde</button>
<button onclick="addCourse()">🏌️ Bane</button>
<button onclick="chooseRound()">
  📜 ${state.currentRoundNumber ? "Runde " + state.currentRoundNumber : "Velg runde"}
</button>
<button onclick="shareGame()">🔗 Inviter</button>
<button onclick="setupPush()">🔔 Aktiver varsler</button>
  </div>

</div>
`;

    let sorted = [...state.players].sort((a,b)=>netScore(a)-netScore(b));

    html += sorted.map((p,i)=>{

      const totalPar = course.pars.reduce((a,b)=>a+b,0);
      const diff = netScore(p) - totalPar;
      const sign = diff>0?"+":"";
      const gross = p.scores.reduce((sum,s)=>sum+s,0);
      
      return `
<div class="card" style="position:relative; ${i===0?'border:2px solid gold':''}">

<div style="display:flex; justify-content:space-between; align-items:center;">
  <b>${i+1}. ${p.name} (HCP ${p.hcp})</b>
  <span>⛳ ${gross}</span>
</div>

<div style="margin-top:10px; display:flex; align-items:center;">
  <img src="${p.image||''}" 
     class="avatar"
     style="cursor:pointer;"
     onclick="openProfile('${p.id}')">
</div>
<div style="font-size:20px; font-weight:bold;">
  ${sign}${diff}
</div>

  <br>🏌️ ${p.longest}m | 🎯 ${p.closest}cm

  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">



    <button style="
  position:absolute;
  right:15px;
  bottom:15px;
  background:#dc2626;
  z-index:2;
" onclick="reverseMulligan('${p.id}')">
  💀
   </button>

  </div>

 <div style="position:relative; margin-top:10px;">

  <!-- 🎰 SPIN (flytende over skull) -->
  <button onclick="spinWheel()" style="
    position:absolute;
    right:0px;
    bottom:80px;
    z-index:1;

    width:60px;
    height:60px;
    font-size:22px;

    background:linear-gradient(135deg,#0ea5e9,#22c55e);
    box-shadow:0 0 15px rgba(34,197,94,0.6);
    border-radius:16px;
  ">
    🎰
  </button>

  <!-- 🔘 VANLIGE KNAPPER -->
  <div style="display:flex; gap:10px;">
    <button onclick="updateExtra('${p.id}','longest')">🏌️</button>
    <button onclick="updateExtra('${p.id}','closest')">🎯</button>
    <button onclick="chulligan()">🍺</button>
  </div>

</div>

</div>
`;
    }).join("");
  }

  // SCORE
  if(state.screen==="score"){
  html += state.players.map(p=>`
    <div class="card">

      <h3 onclick="togglePlayer('${p.id}')" style="cursor:pointer;">
  ${p.name} ${state.openPlayers[p.id] === false ? "▼" : "▲"}
</h3>

      ${state.openPlayers[p.id] !== false ? p.scores.map((s,i)=>{
  const diff = s - course.pars[i];
  const sign = diff>0?"+":"";

  const color = diff < 0 ? "#22c55e" : diff > 0 ? "#ef4444" : "#fff";

  return `
  <div class="score" style="
    display:flex;
    justify-content:space-between;
    align-items:center;
  ">

    <div>
      Hull ${i+1} (par ${course.pars[i]}): ${sign}${diff}
    </div>

    <div style="display:flex; align-items:center; gap:12px;">
      <button onclick="updateScore('${p.id}',${i},-1)">➖</button>

      <span style="
        font-size:20px;
        font-weight:bold;
        color:${color};
        min-width:24px;
        text-align:center;
      ">
        ${s}
      </span>

      <button onclick="updateScore('${p.id}',${i},1)">➕</button>
    </div>

  </div>
  `;
}).join("") : ""}

      

    </div>
  `).join("");
}
  // PLAYERS
  if(state.screen==="players"){
    html = `
      <button onclick="addPlayer()">+ spiller</button>

      ${state.players.map(p=>`
        <div class="card">
          ${p.name}
          <button onclick="deletePlayer('${p.id}')">🗑️</button>
        </div>
      `).join("")}
    `;
  }

  app.innerHTML = html;


}

// ----------------------
// INIT
// ----------------------

window.onload = () => {
  loadLocal();

  document.getElementById("roundModal").style.display = "none";
  document.getElementById("profileModal").style.display = "none";
  document.getElementById("toast").style.display = "none";

  start();
};

window.newRound = newRound;
window.addCourse = addCourse;
window.chooseRound = chooseRound;
window.shareGame = shareGame;
window.uploadImage = uploadImage;
window.chooseTournament = chooseTournament;
window.selectTournament = selectTournament;
window.createNewTournament = createNewTournament;
window.deleteTournament = deleteTournament;


function notify(title, body){
  if(Notification.permission === "granted"){
    new Notification(title, { body });
  }
}

async function setupPush(){
  try{

    const permission = await Notification.requestPermission();

    if(permission !== "granted"){
      alert("Du må tillate varsler 😄");
      return;
    }

    // 🔥 REGISTRER SERVICE WORKER RIKTIG
    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");

    const messaging = firebase.messaging();

    // 🔥 VIKTIG: send med registration
    const token = await messaging.getToken({
      vapidKey: "BF4OfwmrOXrgMJuPT49o-nLoXDKRSV3G-zubruRqhkR6In_8D8Ei7lGVqE-EwVD7b58Qv5AUJkvLKl25fKa30UQ",
      serviceWorkerRegistration: registration
    });

    console.log("TOKEN:", token);
    alert("TOKEN: " + token);

    await db.collection("tokens").doc(token).set({
  token: token,
  userId: userId,
  userName: state.user,
  tid: state.tid
});

    alert("Lagret i Firebase!");

  } catch(err){
    console.error(err);
    alert("ERROR: " + err.message);
  }
}

async function sendPush(title, body){

  try{
    await fetch("https://sendnotificationeu-x3yitk2fxa-ew.a.run.app", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        body,
        userId: userId,
        tid: state.tid
      })
    });
  }catch(err){
    console.error("Push error:", err);
  }

}

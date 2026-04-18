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
  courseId: null,
  players: [],
  screen: "leaderboard",
  selectedPlayer: null,
  openPlayers: {},
  tournamentName: "",
  currentRoundNumber: null,
};

state.userId = userId;
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

// 🔥 HUSK VALGT BANE
if(state.tid){
  state.courseId = localStorage.getItem("courseId_" + state.tid) || null;
}else{
  state.courseId = null;
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
    <div style="
      position:fixed;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:rgba(0,0,0,0.95);
      display:flex;
      justify-content:center;
      align-items:center;
      z-index:9999;
    ">

      <div class="card" style="text-align:center; width:80%;">

        <h2 class="gold">Birdies & Beer 🍺</h2>

        <p>Skriv inn navn for å starte</p>

        <input id="name" placeholder="Navn" style="
          padding:10px;
          border-radius:10px;
          border:none;
          width:80%;
        ">

        <br><br>

        <button onclick="saveUser()">Start</button>

      </div>

    </div>
  `;
}

function saveUser(){

  const name = document.getElementById("name").value;

  if(!name){
    alert("Skriv navn 😄");
    return;
  }

  state.user = name;
  localStorage.setItem("user", name);

  login.innerHTML = "";

  start(); // 🔥 starter app igjen
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

  // 🔥 TRIM + sikker lagring
  const cleanName = nameInput.trim();

  state.user = cleanName;
  localStorage.setItem("user", cleanName);

  console.log("USER SET:", cleanName); // debug

  start();
}
// ----------------------
// START
// ----------------------

function start(){
  state.user = localStorage.getItem("user");
  state.tid = localStorage.getItem("tid");

  if(!state.user){
    showLogin();
    return;
  }

  if(!state.tid){
  // 🔥 la appen starte uten turnering
  login.innerHTML = "";
  render();
  return;
}

  login.innerHTML = "";

  listenRounds();
  loadCourse();
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

      // 🔥 INGEN RUNDER → lag en
      if(!rounds.length){

        console.log("Ingen runder → lager ny");

        db.collection("tournaments").doc(state.tid)
          .collection("rounds")
          .add({
            created: Date.now()
          });

        return;
      }

      // ✅ VANLIG FLOW
      const savedRound = localStorage.getItem("roundId_" + state.tid);
      const exists = rounds.find(r => r.id === savedRound);

      if(savedRound && exists){
        state.roundId = savedRound;
      } else {
        state.roundId = rounds[rounds.length-1].id;
      }
    
     state.hole9Done = false; 
      
      const index = rounds.findIndex(r => r.id === state.roundId);
      state.currentRoundNumber = index !== -1 ? index + 1 : null;

      listenPlayers();

    });
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

  // 🔥 finn eksisterende spiller (fra før render)
  const existing = state.players.find(x => x.id === d.id);

 state.players.push({
  id: d.id,
  userId: p.userId || null,

  name: p.name || "Spiller",
  hcp: p.hcp || 0,
  scores: p.scores || Array(18).fill(0),

  // 🔥 LEGG TIL DISSE
  teamId: p.teamId || null,
  teamName: p.teamName || null,
  teamHcp: p.teamHcp || 0,

  image: p.image || existing?.image || "",
  lockedHoles: p.lockedHoles || existing?.lockedHoles || Array(18).fill(false),

  longest: p.longest || 0,
  closest: p.closest || 0
}); 
});


render();

// 🔥 start events når alt er klart
if(!state.eventsStarted){
  state.eventsStarted = true;
  listenEvents();
}
    });
}

function addPlayer(){
 console.log("ADD PLAYER CLICK");
console.log("TID:", state.tid);
console.log("ROUND:", state.roundId); 
  
  const name = prompt("Navn");
  if(!name) return;

  const hcp = parseInt(prompt("HCP")) || 0;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players")
  .add({
  userId: state.userId, // 🔥 NY
  name,
  hcp,
  scores: Array(18).fill(0),
  image: "",
  longest: 0,
  closest: 0
}); 
}

function joinRound(){

  const exists = state.players.find(p => p.userId === state.userId);

  if(exists){
    alert("Du er allerede med 😄");
    return;
  }

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players")
    .add({
      userId: state.userId,
      name: state.user,
      hcp: 0,
      scores: Array(18).fill(0),
      image: "",
      longest: 0,
      closest: 0
    });

  showToast("🙋‍♂️ Du ble med!");
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


function lockHole(playerId, hole){

  const p = state.players.find(x=>x.id===playerId);

  if(!p.lockedHoles){
    p.lockedHoles = Array(18).fill(false);
  }

  // 🔄 TOGGLE
  p.lockedHoles[hole] = !p.lockedHoles[hole];

  // 👉 hvis vi låser (ikke unlock), kjør logikk
  if(p.lockedHoles[hole]){

    const score = p.scores[hole];
    const par = course.pars[hole];
    const diff = score - par;

    let text = "";

    if(diff === 1) text = "🍺 Bogey!";
    else if(diff === 2) text = "🍺🍺 Double bogey!";
    else if(diff >= 3){
    text = "💀 TRIPLE! SPIN THE WHEEL!";
}
    else if(diff === -1) text = "🎉 Birdie! Gi bort en slurk";
    else if(diff <= -2) text = "🔥 Eagle! Del ut 2 slurker";
    else text = "😎 Par";

    
   if(diff >= 3 || diff <= -1){
  let title = "🏌️ Score";

if(diff >= 3) title = "💀 TRIPLE!";
else if(diff <= -2) title = "🔥 EAGLE!";
else if(diff === -1) title = "🎉 BIRDIE!";

sendPush(title, p.name + " – Hull " + (hole+1) + " → " + text);
}
    if(diff >= 3){
  setTimeout(()=>{
    spinWheel();
  }, 1200);
}
    const holeNumber = hole + 1;
    addEvent(`${p.name} – Hull ${holeNumber} → ${text}`);

    // 🔥 scroll kun når vi låser
    setTimeout(()=>{
      const next = document.getElementById(`hole-${playerId}-${hole+1}`);
      if(next){
        next.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);

    if(hole === 17){
  sendPush("🏁 Ferdig runde!", p.name + " er ferdig!");
}

    if(hole === 8){

  setTimeout(()=>{

    const allLocked = state.players.every(pl => pl.lockedHoles?.[8]);

    if(allLocked){

      if(state.hole9Done) return;
      state.hole9Done = true;

      // 🔥 sorter spillere etter score (høyest = dårligst)
      let sorted = [...state.players].sort((a,b)=>{
        const totalA = a.scores.reduce((sum,s)=>sum+s,0);
        const totalB = b.scores.reduce((sum,s)=>sum+s,0);
        return totalB - totalA;
      });

      const loser = sorted[0];
      const text = "🍺 Sisteplass: " + loser.name + " → SHOT!";

      addEvent(text);
      sendPush("🍺 LAST PLACE", text);
    }

  }, 300);
  }
  
  }
  // 🔥 lagre uansett (både lock og unlock)
  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(playerId)
    .update({
      lockedHoles: p.lockedHoles
    });

  render(); // 🔥 viktig!
}
// ----------------------
// EXTRA FEATURES
// ----------------------

function openEditPlayer(playerId){

  const p = state.players.find(x => x.id === playerId);

  if(!p) return;

  const modal = document.getElementById("profileModal");

  modal.innerHTML = `
    <div class="card" style="width:80%; text-align:center;">

      <h2>⚙️ Rediger spiller</h2>

      <input 
        id="editName"
        value="${p.name}"
        placeholder="Navn"
        style="
          padding:10px;
          border-radius:10px;
          border:none;
          width:80%;
          margin-bottom:10px;
        "
      >

      <input 
        id="editHcp"
        type="number"
        value="${p.hcp}"
        placeholder="HCP"
        style="
          padding:10px;
          border-radius:10px;
          border:none;
          width:80%;
        "
      >

      <br><br>

      <button onclick="savePlayerEdit('${p.id}')">
        💾 Lagre
      </button>

      <br><br>

      <button onclick="closeProfile()">
        ❌ Avbryt
      </button>

    </div>
  `;

  modal.style.display = "flex";
}

function openTeams(){

  const modal = document.getElementById("profileModal");

  modal.innerHTML = `
    <div class="card" style="width:85%; max-height:80%; overflow:auto;">

      <h2>👥 Velg lag</h2>

 ${state.players.map(p=>{

  const selected = state.selectedTeam?.includes(p.id);

  return `
    <div style="
      display:flex;
      justify-content:space-between;
      padding:10px;
      border-bottom:1px solid #333;
    ">

      <span>${p.name}</span>

      <button onclick="toggleTeam('${p.id}')"
        style="
          background:${selected ? '#22c55e' : '#16a34a'};
        "
      >
        ${selected ? "✅ Lagt til" : "Velg"}
      </button>

    </div>
  `;
}).join("")}

      <br>

      <button onclick="saveTeam()">💾 Lag lag</button>
      <button onclick="closeProfile()">❌ Lukk</button>

    </div>
  `;

  modal.style.display = "flex";

  if(!state.selectedTeam){
  state.selectedTeam = [];
}
}

function saveTeam(){

  if(!state.selectedTeam || state.selectedTeam.length < 2){
    alert("Velg minst 2 spillere");
    return;
  }

  const teamId = Date.now().toString();

  // 🔥 1. fjern ALLE gamle lag først
  state.players.forEach(p=>{
    if(p.teamId){
      db.collection("tournaments").doc(state.tid)
        .collection("rounds").doc(state.roundId)
        .collection("players").doc(p.id)
        .update({
          teamId: null,
          teamName: null,
          teamHcp: 0
        });
    }
  });

  // 🔥 2. legg til nye lag
  state.selectedTeam.forEach(id=>{
    db.collection("tournaments").doc(state.tid)
      .collection("rounds").doc(state.roundId)
      .collection("players").doc(id)
      .update({
        teamId: teamId,
        teamName: "DITT NAVN HER",
        teamHcp: 0
      });
  });

  showToast("👥 Lag opprettet!");
  closeProfile();
}

function savePlayerEdit(playerId){

  const newName = document.getElementById("editName").value.trim();
  const newHcp = parseInt(document.getElementById("editHcp").value) || 0;

  if(!newName){
    alert("Skriv navn 😄");
    return;
  }

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(playerId)
    .update({
      name: newName,
      hcp: newHcp
    });

  closeProfile(); // 🔥 lukker modal
}

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
  const img = reader.result;

  // 🔥 vis bildet med en gang (lokalt)
  const player = state.players.find(p => p.id === state.selectedPlayer);
  if(player){
    player.image = img;
    render();
  }

  // 🔥 lagre i Firestore
  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(state.selectedPlayer)
    .update({image: img});
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

        <div style="
         padding:10px;       
         border-bottom:1px solid #333;
         cursor:pointer;
         font-weight:bold;
         " onclick="newRound()">
        ➕ Ny runde
       </div>

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

function selectCourse(id){

  state.courseId = id;

  localStorage.setItem("courseId_" + state.tid, id);

  db.collection("tournaments").doc(state.tid)
    .collection("courses").doc(id)
    .get()
    .then(doc=>{
      const data = doc.data();

      if(data){
        course = data;
        render();
      }
    });

  closeRoundModal();
}

function deleteCourse(id){

  if(!confirm("Slette denne banen?")) return;

  db.collection("tournaments").doc(state.tid)
    .collection("courses").doc(id)
    .delete();

  showToast("🗑️ Bane slettet");

  chooseCourse(); // refresh liste
}

function loadCourse(){

  if(!state.tid) return;

  db.collection("tournaments").doc(state.tid)
    .collection("courses")
    .get()
    .then(snap=>{

      let courses = [];
      snap.forEach(d=>courses.push({id:d.id,...d.data()}));

      if(!courses.length) return;

      const saved = localStorage.getItem("courseId_" + state.tid);

      const exists = courses.find(c => c.id === saved);

      if(saved && exists){
        state.courseId = saved;
        course = exists;
      }else{
        state.courseId = courses[0].id;
        course = courses[0];
      }

      render();
    });
}

function createCourse(){

  const name = prompt("Banenavn");
  const pars = prompt("Pars (4,4,3...)");

  if(!name || !pars) return;

  const newCourse = {
    name,
    pars: pars.split(",").map(x=>parseInt(x.trim())).filter(x=>!isNaN(x)),
    created: Date.now()
  };

  db.collection("tournaments").doc(state.tid)
    .collection("courses")
    .add(newCourse)
    .then(doc=>{

      state.courseId = doc.id;
      course = newCourse;

      localStorage.setItem("courseId_" + state.tid, doc.id);

      closeRoundModal();
      render();

      showToast("🏌️ Bane lagret!");
    });
}

function chooseCourse(){

  if(!state.tid){
    alert("Ingen turnering valgt");
    return;
  }

  const modal = document.getElementById("roundModal"); // gjenbruker samme modal

  db.collection("tournaments").doc(state.tid)
    .collection("courses")
    .get()
    .then(snap=>{

      let courses = [];
      snap.forEach(d=>courses.push({id:d.id,...d.data()}));

      courses.sort((a,b)=>a.created-b.created);

      modal.innerHTML = `
        <div class="card" style="width:85%; max-height:80%; overflow:auto;">
          <h3>🏌️ Baner</h3>

          <div style="
            padding:10px;
            border-bottom:1px solid #333;
            cursor:pointer;
            font-weight:bold;
          " onclick="createCourse()">
            ➕ Ny bane
          </div>

          ${courses.map(c=>`
            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              padding:10px;
              border-bottom:1px solid #333;
            ">

              <div onclick="selectCourse('${c.id}')" style="cursor:pointer;">
                ${c.name || "Uten navn"}
              </div>

              <button style="background:#dc2626"
                onclick="deleteCourse('${c.id}')">
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

  localStorage.setItem("tid", id);

  // 🔥 RESET ALT SOM HØRER TIL GAMMEL TURNERING
  state.roundId = null;
  state.players = [];
  state.currentRoundNumber = null;

  localStorage.removeItem("roundId_" + id); // 🔥 viktig

  // 🔥 TØM UI med en gang
  render();

  db.collection("tournaments").doc(id).get().then(doc=>{
    const data = doc.data();

    state.tournamentName = data?.name || "Turnering";

    localStorage.setItem("tournamentName", state.tournamentName);

    closeRoundModal();

    // 🔥 START NY LYTTER
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
<div style="text-align:center; margin-top:10px;">
<img src="E8053741-68F9-44DC-B374-D98DCA0410A8.png" class="logo">
</div>

<h3 onclick="chooseTournament()" style="cursor:pointer;">
  🏌️ ${state.tournamentName || "Velg turnering"} ▾
</h3>

<div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:10px;">
<button onclick="chooseCourse()">
  🏌️ ${course.name || "Velg bane"} ▾
</button>
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

      <h3 onclick="togglePlayer('${p.id}')" style="
        cursor:pointer;
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        <span>${p.name}</span>
        <span style="opacity:0.6;">
          ${state.openPlayers[p.id] === false ? "▼" : "▲"}
        </span>
      </h3>

      ${state.openPlayers[p.id] !== false ? p.scores.map((s,i)=>{
        const diff = s - course.pars[i];
        const sign = diff>0?"+":"";

        const color =
          diff < 0 ? "#22c55e" :
          diff > 0 ? "#ef4444" :
          "#e5e7eb";

        const locked = p.lockedHoles?.[i];

        return `
        <div id="hole-${p.id}-${i}" class="score" style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:10px;
          border-radius:12px;
          margin-bottom:6px;

          background:${locked ? "rgba(255,255,255,0.03)" : "transparent"};
          opacity:${locked ? 0.5 : 1};
          transition:0.2s;
        ">

          <!-- LEFT SIDE -->
          <div style="font-size:14px;">
            <div>
              Hull ${i+1} 
              ${locked ? "🔒" : ""}
            </div>
            <div style="opacity:0.6;">
              Par ${course.pars[i]}
            </div>
          </div>

          <!-- RIGHT SIDE -->
          <div style="display:flex; align-items:center; gap:10px;">

            <button 
              onclick="updateScore('${p.id}',${i},-1)"
              ${locked ? "disabled" : ""}
              style="opacity:${locked ? 0.3 : 1}"
            >➖</button>

            <div style="
              font-size:20px;
              font-weight:bold;
              color:${color};
              min-width:28px;
              text-align:center;
            ">
              ${s}
            </div>

            <button 
              onclick="updateScore('${p.id}',${i},1)"
              ${locked ? "disabled" : ""}
              style="opacity:${locked ? 0.3 : 1}"
            >➕</button>

            <button 
              onclick="lockHole('${p.id}', ${i})"
              style="
                background:${locked ? '#ef4444' : '#22c55e'};
                color:white;
                border-radius:10px;
                width:44px;
                height:44px;
                font-size:18px;
                box-shadow:${locked 
                  ? "0 0 10px rgba(239,68,68,0.6)" 
                  : "0 0 10px rgba(34,197,94,0.6)"};
                transition:0.2s;
              "
            >
              ${locked ? "🔒" : "🔓"}
            </button>

          </div>

        </div>
        `;
      }).join("") : ""}

    </div>
  `).join("");
}
  // PLAYERS
if(state.screen==="players"){

  let teams = {};
  let solo = [];

  state.players.forEach(p=>{
    if(p.teamId){

      if(!teams[p.teamId]){
        teams[p.teamId] = {
          name: p.teamName || "Lag",
          hcp: p.teamHcp || 0,
          players: []
        };
      }

      teams[p.teamId].players.push(p);

    } else {
      solo.push(p);
    }
  });

  html = `
    <button onclick="joinRound()">🙋‍♂️ Bli med</button>
    <button onclick="openTeams()">👥 Lagspill</button>
  `;

  // 🟢 VIS LAG
  Object.values(teams).forEach(team=>{
    html += `
      <div class="card">

        <b>🏷️ ${team.name} (HCP ${team.hcp})</b>

        ${team.players.map(p=>`
  <div style="
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-top:6px;
  ">

    <span>${p.name}</span>

    <button onclick="removeFromTeam('${p.id}')" style="
      background:#ef4444;
      font-size:12px;
      padding:4px 8px;
    ">
      ❌
    </button>

 </div>
      `).join("")}

    </div>
  `;
});

  // 🟢 SOLO SPILLERE
  solo.forEach(p=>{
    html += `
      <div class="card" style="
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">

        <div>
          ${p.name}
          <div style="opacity:0.6; font-size:12px;">
            HCP ${p.hcp}
          </div>
        </div>

      </div>
    `;
  });
}

  app.innerHTML = html;


}

function toggleTeam(id){

  if(!state.selectedTeam) state.selectedTeam = [];

  if(state.selectedTeam.includes(id)){
    state.selectedTeam = state.selectedTeam.filter(x => x !== id);
  }else{
    state.selectedTeam.push(id);
  }

  openTeams(); // 🔥 redraw modal
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
window.createCourse = createCourse;
window.selectCourse = selectCourse;
window.deleteCourse = deleteCourse;
window.lockHole = lockHole;


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

function removeFromTeam(playerId){

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(playerId)
    .update({
      teamId: null,
      teamName: null,
      teamHcp: 0,
      teamScores: Array(18).fill(0)
    });

  showToast("❌ Fjernet fra lag");
}

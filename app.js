// STATE
let state = {
  user: null,
  tid: null,
  roundId: null,
  players: [],
  screen: "leaderboard",
  selectedPlayer: null,

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

  if(urlTid){
    state.tid = urlTid;
  }else{
    state.tid = localStorage.getItem("tid");
  }

  if(urlName){
    state.user = urlName;
  }else{
    state.user = localStorage.getItem("user");
  }
}

function saveLocal(){
  localStorage.setItem("user", state.user);
  localStorage.setItem("tid", state.tid);
}

// ----------------------
// LOGIN
// ----------------------

function showLogin(){
  login.innerHTML = `
    <div class="card">
      <h2>Nesbyen Masters</h2>

      <input id="name" placeholder="Navn"><br><br>

      <button onclick="createGame()">➕ Nytt spill</button>

      <br><br>

      <input id="code" placeholder="Spillkode">
      <button onclick="joinGame()">🔑 Bli med</button>
    </div>
  `;
}

function createGame(){
  const nameInput = document.getElementById("name").value;
  if(!nameInput) return alert("Skriv navn");

  state.user = nameInput;

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

// ----------------------
// START
// ----------------------

function start(){
  login.innerHTML = "";

  db.collection("tournaments").doc(state.tid)
    .onSnapshot(doc=>{
      const data = doc.data();

      if(data && data.course){
        course = data.course;
        render(); // 🔥 DETTE ER FIXEN
      }
    });

  listenRounds();
}

// ----------------------
// ROUNDS
// ----------------------

function newRound(){
  db.collection("tournaments").doc(state.tid)
    .collection("rounds")
    .add({created: Date.now()});
}

function listenRounds(){
  db.collection("tournaments").doc(state.tid)
    .collection("rounds")
    .onSnapshot(snap=>{
      let rounds = [];

      snap.forEach(d=>rounds.push({id:d.id,...d.data()}));
      rounds.sort((a,b)=>a.created-b.created);

      if(rounds.length){
        state.roundId = rounds[rounds.length-1].id;
        listenPlayers();
      }
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
  const url = window.location.origin + "/Nesbyen-Masters/?tid=" + state.tid;

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

function openProfile(p){
  const modal = document.getElementById("profileModal");

  modal.innerHTML = `
    <div class="card" style="width:80%; text-align:center;">
      <h2>${p.name}</h2>

      <img src="${p.image||''}" 
           class="avatar" 
           style="width:90px;height:90px;cursor:pointer;"
           onclick="uploadImage('${p.id}')">

      <p>📸 Trykk for å endre bilde</p>

      <p>🏌️ Drive: ${p.longest}m</p>
      <p>🎯 Closest: ${p.closest}cm</p>

      <button onclick="closeProfile()">Lukk</button>
    </div>
  `;

  modal.style.display = "flex";
}

function closeProfile(){
  document.getElementById("profileModal").style.display = "none";
}

function updateExtra(id,type){
  let val = parseFloat(prompt(type==="longest"?"Meter":"CM")) || 0;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(id)
    .update({[type]:val});
}

function mulligan(id){

  let p = state.players.find(x=>x.id===id);

  // legg til 1 slag (enkelt)
  p.scores[0] += 1;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(id)
    .update({scores:p.scores});

  // 🔥 SKÅL toast (samme type som reverse)
  showToast("🍻 SKÅL! " + p.name + "!");
}

function showToast(text){
  const el = document.getElementById("toast");
  const txt = document.getElementById("toastText");

  txt.innerText = text;
  el.style.display = "block";
}

function closeToast(){
  document.getElementById("toast").style.display = "none";
}

function reverseMulligan(id){

  let p = state.players.find(x=>x.id===id);

  // legg til 1 slag (enkelt)
  p.scores[0] += 1;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(id)
    .update({scores:p.scores});

  // 🔥 NY TEKST
  showToast("💀 " + p.name + " fikk en REVERSE MULLIGAN!");

  addEvent(state.user + " ga " + p.name + " reverse mulligan 🍺");
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

  const modal = document.getElementById("roundModal");

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
    });
}

function selectRound(id){
  state.roundId = id;
  closeRoundModal();
  listenPlayers();
}

function closeRoundModal(){
  document.getElementById("roundModal").style.display = "none";
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

// ----------------------
// RENDER
// ----------------------

function render(){

  let html = "";

  // LEADERBOARD
  if(state.screen==="leaderboard"){

    html += `
  <h3 style="text-align:center;margin-top:10px;">
    🏌️ ${course.name}
  </h3>

  <button onclick="newRound()">➕ Ny runde</button>
  <button onclick="addCourse()">🏌️ Bane</button>
  <button onclick="chooseRound()">📜 Runder</button>
  <button class="green" onclick="shareGame()">🔗 Inviter</button>
`;

    let sorted = [...state.players].sort((a,b)=>netScore(a)-netScore(b));

    html += sorted.map((p,i)=>{

      const totalPar = course.pars.reduce((a,b)=>a+b,0);
      const diff = netScore(p) - totalPar;
      const sign = diff>0?"+":"";
      const isOpen = state.openPlayers[i];
      return `
<div class="card" style="${i===0?'border:2px solid gold':''}">

  <b>
    ${i+1}. ${p.name}
  </b> (${sign}${diff})

  <br> 🏌️ ${p.longest}m | 🎯 ${p.closest}cm

  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px">
    <img src="${p.image||''}" class="avatar">
    
    <button style="background:#dc2626" onclick="deletePlayer('${p.id}')">
      💀
    </button>
  </div>

  <div style="margin-top:10px; display:flex; gap:6px">
    <button onclick="updateExtra('${p.id}',1)">+1</button>
    <button onclick="updateExtra('${p.id}',-1)">-1</button>
    <button onclick="mulligan('${p.id}')">🍺</button>
  </div>

</div>
`;

</div>
`;
    }).join("");
  }

  // SCORE
  if(state.screen==="score"){
  html += state.players.map(p=>`
    <div class="card">

      <h3>${p.name}</h3>

      ${p.scores.map((s,i)=>{
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
}).join("")}

      <div style="margin-top:10px; display:flex; gap:10px;">
        <button onclick="updateExtra('${p.id}','longest')">🏌️ Drive</button>
        <button onclick="updateExtra('${p.id}','closest')">🎯 Pin</button>
      </div>

      <div style="margin-top:10px; display:flex; justify-content:space-between;">
        <button onclick="mulligan('${p.id}')">🍺 Mulligan</button>

        <button style="background:#dc2626" onclick="reverseMulligan('${p.id}')">
          💀 Reverse
        </button>
      </div>

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

loadLocal();

document.getElementById("roundModal").style.display = "none";
document.getElementById("profileModal").style.display = "none";
document.getElementById("toast").style.display = "none";

start();

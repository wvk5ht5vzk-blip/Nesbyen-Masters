// STATE
let state = {
  user: null,
  tid: null,
  roundId: null,
  players: [],
  screen: "leaderboard",
  selectedPlayer: null
};

// COURSE (default)
let course = {
  name: "Standard",
  pars: [4,4,3,5,4,4,3,5,4,4,3,5,4,4,3,5,4,4]
};

// ----------------------
// INIT
// ----------------------

function loadLocal(){
  state.user = localStorage.getItem("user");
  state.tid = localStorage.getItem("tid");
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

    alert("Kode: " + code);

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

function updateExtra(id,type){
  let val = parseFloat(prompt(type==="longest"?"Meter":"CM")) || 0;

  db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(id)
    .update({[type]:val});
}

function mulligan(id){
  let hole = parseInt(prompt("Hull (1-18)"))-1;
  if(hole<0||hole>17) return;

  updateScore(id,hole,1);
}

function showToast(text){
  const el = document.getElementById("toast");
  el.innerText = text;
  el.style.display = "block";

  setTimeout(()=>{
    el.style.display = "none";
  }, 2500);
}

function reverseMulligan(id){
  let hole = parseInt(prompt("Hull (1-18)")) - 1;
  if(hole < 0 || hole > 17) return;

  updateScore(id, hole, 1);

  let p = state.players.find(x=>x.id===id);

  showToast("💀 " + p.name + " ble sabotert!");

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

  course = {
    name,
    pars: pars.split(",").map(x=>parseInt(x))
  };

  alert("Bane lagret!");
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
      <button onclick="newRound()">➕ Ny runde</button>
      <button onclick="addCourse()">🏌️ Bane</button>
    `;

    let sorted = [...state.players].sort((a,b)=>netScore(a)-netScore(b));

    html += sorted.map((p,i)=>{

      const totalPar = course.pars.reduce((a,b)=>a+b,0);
      const diff = netScore(p) - totalPar;
      const sign = diff>0?"+":"";

      return `
      <div class="card" style="${i===0?'border:2px solid gold':''}">
        <b>${i+1}. ${p.name}</b> (${sign}${diff})

        <br>🏌️ ${p.longest}m | 🎯 ${p.closest}cm

        <br>
        <img src="${p.image||''}" class="avatar" onclick="uploadImage('${p.id}')">
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

          return `
          <div class="score">
            Hull ${i+1} (par ${course.pars[i]}): ${sign}${diff}

            <button onclick="updateScore('${p.id}',${i},-1)">➖</button>
            <button onclick="updateScore('${p.id}',${i},1)">➕</button>
          </div>
          `;
        }).join("")}

        <div style="margin-top:10px">
  <button onclick="updateExtra('${p.id}','longest')">🏌️ Drive</button>
  <button onclick="updateExtra('${p.id}','closest')">🎯 Pin</button>
</div>

<div style="margin-top:10px">
  <button onclick="mulligan('${p.id}')">🍺 Mulligan</button>
</div>

<div style="margin-top:10px">
  <button style="background:#dc2626" onclick="reverseMulligan('${p.id}')">
    💀 Reverse Mulligan
  </button>
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

if(state.user && state.tid){
  start();
}else{
  showLogin();
}

let state={
  user:null,
  tid:null,
  roundId:null,
  players:[],
  screen:"leaderboard",
  selectedPlayer:null
};

// INIT
function loadLocal(){
  state.user=localStorage.getItem("user");
  state.tid=localStorage.getItem("tid");
}
function saveLocal(){
  localStorage.setItem("user",state.user);
  localStorage.setItem("tid",state.tid);
}

// LOGIN
function showLogin(){
  login.innerHTML=`
    <div class="card">
      <input id="name" placeholder="Navn"><br><br>
      <button onclick="createGame()">➕ Nytt spill</button><br><br>
      <input id="code" placeholder="Kode">
      <button onclick="joinGame()">🔑 Bli med</button>
    </div>
  `;
}

// CREATE
function createGame(){
  state.user=name.value;
  if(!state.user) return alert("Navn!");

  const code=Math.floor(1000+Math.random()*9000);

  db.collection("tournaments").add({code,created:Date.now()})
  .then(doc=>{
    state.tid=doc.id;
    saveLocal();
    alert("Kode: "+code);
    newRound();
    start();
  });
}

// JOIN
function joinGame(){
  state.user=name.value;

  db.collection("tournaments")
  .where("code","==",parseInt(code.value))
  .get()
  .then(snap=>{
    if(snap.empty) return alert("Feil kode");
    state.tid=snap.docs[0].id;
    saveLocal();
    start();
  });
}

// START
function start(){
  login.innerHTML="";
  listenRounds();
}

// ROUNDS
function newRound(){
  db.collection("tournaments").doc(state.tid)
  .collection("rounds")
  .add({created:Date.now()});
}

function listenRounds(){
  db.collection("tournaments").doc(state.tid)
  .collection("rounds")
  .onSnapshot(snap=>{
    let r=[];
    snap.forEach(d=>r.push({id:d.id,...d.data()}));
    r.sort((a,b)=>a.created-b.created);

    if(r.length){
      state.roundId=r[r.length-1].id;
      listenPlayers();
    }
  });
}

// PLAYERS
function listenPlayers(){
  db.collection("tournaments").doc(state.tid)
  .collection("rounds").doc(state.roundId)
  .collection("players")
  .onSnapshot(snap=>{
    state.players=[];
    snap.forEach(d=>{
      let p=d.data();
      if(!p.scores)p.scores=Array(18).fill(0);
      if(!p.image)p.image="";
      if(!p.longest)p.longest=0;
      if(!p.closest)p.closest=0;
      state.players.push({id:d.id,...p});
    });
    render();
  });
}

// ADD PLAYER
function addPlayer(){
  const n=prompt("Navn");
  const h=parseInt(prompt("HCP"))||0;

  db.collection("tournaments").doc(state.tid)
  .collection("rounds").doc(state.roundId)
  .collection("players")
  .add({
    name:n,hcp:h,
    scores:Array(18).fill(0),
    image:"",
    longest:0,
    closest:0
  });
}

// DELETE PLAYER
function deletePlayer(id){
  if(!confirm("Slette spiller?")) return;

  db.collection("tournaments").doc(state.tid)
  .collection("rounds").doc(state.roundId)
  .collection("players").doc(id)
  .delete();
}

// SCORE
function updateScore(id,hole,val){
  let p=state.players.find(x=>x.id===id);
  p.scores[hole]+=val;
  if(p.scores[hole]<0)p.scores[hole]=0;

  db.collection("tournaments").doc(state.tid)
  .collection("rounds").doc(state.roundId)
  .collection("players").doc(id)
  .update({scores:p.scores});
}

// NET
function net(p){
  const base=Math.floor((p.hcp||0)/18);
  return p.scores.reduce((sum,s)=>sum+(s-base),0);
}

// IMAGE
fileInput.addEventListener("change", e=>{
  const file=e.target.files[0];
  if(!file||!state.selectedPlayer)return;

  const reader=new FileReader();
  reader.onload=()=>{
    db.collection("tournaments").doc(state.tid)
    .collection("rounds").doc(state.roundId)
    .collection("players").doc(state.selectedPlayer)
    .update({image:reader.result});
  };
  reader.readAsDataURL(file);
});

function uploadImage(id){
  state.selectedPlayer=id;
  fileInput.click();
}

// EXTRA
function updateExtra(id,type){
  let val=parseFloat(prompt(type==="longest"?"Meter":"CM"))||0;

  db.collection("tournaments").doc(state.tid)
  .collection("rounds").doc(state.roundId)
  .collection("players").doc(id)
  .update({[type]:val});
}

// MULLIGAN
function mulligan(id){
  let hole=parseInt(prompt("Hull (1-18)"))-1;
  if(hole<0||hole>17)return;

  updateScore(id,hole,1);
}

// NAV
function setScreen(s){
  state.screen=s;
  render();
}

// RENDER
function render(){

  let html="";

  if(state.screen==="leaderboard"){
    html+=`<button onclick="newRound()">➕ Ny runde</button>`;

    html+=state.players.sort((a,b)=>net(a)-net(b))
    .map((p,i)=>`
      <div class="card">
        <b>${i+1}. ${p.name}</b> (${net(p)})
        <br>
        🏌️ ${p.longest}m | 🎯 ${p.closest}cm
        <br>
        <img src="${p.image||''}" class="avatar" onclick="uploadImage('${p.id}')">
      </div>
    `).join("");
  }

  if(state.screen==="score"){
    html+=state.players.map(p=>`
      <div class="card">
        <h3>${p.name}</h3>

        ${p.scores.map((s,i)=>`
          <div class="score">
            Hull ${i+1}: ${s}
            <button onclick="updateScore('${p.id}',${i},-1)">➖</button>
            <button onclick="updateScore('${p.id}',${i},1)">➕</button>
          </div>
        `).join("")}

        <button onclick="mulligan('${p.id}')">🍺 Mulligan</button>
        <button onclick="updateExtra('${p.id}','longest')">🏌️ Drive</button>
        <button onclick="updateExtra('${p.id}','closest')">🎯 Pin</button>
      </div>
    `).join("");
  }

  if(state.screen==="players"){
    html=`
      <button onclick="addPlayer()">+ spiller</button>

      ${state.players.map(p=>`
        <div class="card">
          ${p.name}
          <button onclick="deletePlayer('${p.id}')">❌</button>
        </div>
      `).join("")}
    `;
  }

  app.innerHTML=html;
}

// INIT
loadLocal();
if(state.user && state.tid) start();
else showLogin();

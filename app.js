let state={
  user:null,
  tid:null,
  roundId:null,
  players:[],
  screen:"leaderboard",
  selectedPlayer:null
};

// LOCAL
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

// CREATE / JOIN
function createGame(){
  state.user=name.value;
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
  listenEvents();
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
      if(!p.stats)p.stats={wins:0,rounds:0};
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
    stats:{wins:0,rounds:0},
    image:"",
    longest:0,
    closest:0
  });
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

// HANDICAP
function net(p){
  const base=Math.floor(p.hcp/18);
  return p.scores.reduce((sum,s)=>sum+(s-base),0);
}

// EVENTS 🍺
function addEvent(text){
  db.collection("tournaments").doc(state.tid)
  .collection("events")
  .add({text,time:Date.now()});
}

function listenEvents(){
  db.collection("tournaments").doc(state.tid)
  .collection("events")
  .orderBy("time","desc")
  .limit(1)
  .onSnapshot(snap=>{
    snap.forEach(d=>{
      feed.innerText=d.data().text;
      setTimeout(()=>feed.innerText="",3000);
    });
  });
}

// MULLIGAN
function mulligan(id){
  let hole=parseInt(prompt("Hull"))-1;
  let p=state.players.find(x=>x.id===id);
  p.scores[hole]+=1;

  updateScore(id,hole,1);
  addEvent(state.user+" ga "+p.name+" mulligan 🍺");
}

// IMAGE UPLOAD
fileInput.addEventListener("change",e=>{
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

// NAV
function setScreen(s){
  state.screen=s;
  render();
}

// RENDER
function render(){

  let html="";

  if(state.screen==="leaderboard"){
    html+=state.players.sort((a,b)=>net(a)-net(b))
    .map(p=>`
      <div class="card">
        <img src="${p.image||''}" class="avatar" onclick="uploadImage('${p.id}')">
        ${p.name} (${net(p)})
        <br>🏌️ ${p.longest}m | 🎯 ${p.closest}cm
      </div>
    `).join("");
  }

  if(state.screen==="score"){
    html+=state.players.map(p=>`
      <div class="card">
        <h3>${p.name}</h3>
        ${p.scores.map((s,i)=>`
          <div class="score">
            ${i+1}: ${s}
            <button onclick="updateScore('${p.id}',${i},1)">+</button>
            <button onclick="updateScore('${p.id}',${i},-1)">-</button>
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
        <div class="card">${p.name}</div>
      `).join("")}
    `;
  }

  app.innerHTML=html;
}

// INIT
loadLocal();
if(state.user && state.tid) start();
else showLogin();

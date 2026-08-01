import {ATTACK_CARDS,SUPPORT_CARDS,DEFENSE_CARDS,CARD_BY_ID,ALL_CARDS} from "./data/cards.js";

const $ = (s) => document.querySelector(s);
const clone = (v) => structuredClone(v);
const shuffle = (items) => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const maxHearts = 3;

const el = {setup:$("#setup"),game:$("#game"),arena:$(".arena"),setupForm:$("#setupForm"),p1:$("#player1"),p2:$("#player2"),turn:$("#turnLabel"),phase:$("#phaseMessage"),opp:$("#opponentZone"),player:$("#playerZone"),played:$("#playedCards"),support:$("#supportBtn"),attack:$("#attackBtn"),defense:$("#defenseBtn"),supportCount:$("#supportCount"),defenseCount:$("#defenseCount"),scrim:$("#scrim"),drawer:$("#drawer"),modal:$("#modal"),pass:$("#passScreen"),passName:$("#passName"),passBtn:$("#passBtn"),log:$("#logBtn"),menu:$("#menuBtn"),catalog:$("#catalogBtn")};

let state=null, passAction=null;

const attackTraits={
  "dino-might":{fly:true},"snailzooka":{noLegs:true},"joe-flyden":{fly:true},"bad-asp":{noLegs:true},"lady-thug":{fly:true},"worm-and-peace":{noLegs:true},"bull-ship":{noLegs:true},"we-suck":{fly:true},"bass-masher":{noLegs:true}
};

function freshPlayer(name,index,attackDeck,supportDeck,defenseDeck){
  return {name,index,attacks:attackDeck.splice(0,2).map(id=>({id,hearts:3,specialUsed:false,specialDisabled:false,dead:false,unrevivable:false})),active:0,support:supportDeck.splice(0,2),defense:defenseDeck.splice(0,2),deadAttacks:[],skipTurns:0,defenseBlockedNext:false,glunicornStage:0};
}

function startGame(names){
  const attacks=shuffle(ATTACK_CARDS.map(c=>c.id)), support=shuffle(SUPPORT_CARDS.map(c=>c.id)), defense=shuffle(DEFENSE_CARDS.map(c=>c.id));
  state={players:[],supportDeck:support,defenseDeck:defense,supportDiscard:[],defenseDiscard:[],turn:0,viewer:0,phase:"setup",selectedSupport:null,selectedSupportChoice:0,selectedAttackMode:null,forcedDefense:null,playedDefense:null,log:[],winner:null};
  state.players=[freshPlayer(names[0],0,attacks,support,defense),freshPlayer(names[1],1,attacks,support,defense)];
  el.setup.classList.add("hidden");el.game.classList.remove("hidden");
  chooseStartingAttack(0);
}

function chooseStartingAttack(playerIndex){
  const p=state.players[playerIndex];
  showModal(`<h2>${p.name}, choose your first attacker</h2><p>Your other Attack card remains in reserve.</p><div class="card-grid">${p.attacks.map((a,i)=>cardButton(CARD_BY_ID[a.id],`data-start="${i}"`,true)).join("")}</div>`,false);
  el.modal.querySelectorAll("[data-start]").forEach(btn=>btn.onclick=()=>{p.active=Number(btn.dataset.start);closeModal();if(playerIndex===0)passTo(1,()=>chooseStartingAttack(1));else passTo(0,beginTurn);});
}

function active(index){return state.players[index].attacks[state.players[index].active];}
function cardOfAttack(index){return CARD_BY_ID[active(index).id];}
function aliveAttackCount(index){return state.players[index].attacks.filter(a=>!a.dead).length;}
function opponentOf(i){return i===0?1:0;}
function heal(player,amount){const before=active(player).hearts;active(player).hearts=Math.min(maxHearts,active(player).hearts+amount);return active(player).hearts-before;}
function lose(player,amount){const before=active(player).hearts;active(player).hearts=Math.max(0,active(player).hearts-amount);return before-active(player).hearts;}
function log(message){state.log.unshift(message);}
function draw(type,player,count=1){const deck=type==="support"?state.supportDeck:state.defenseDeck, discard=type==="support"?state.supportDiscard:state.defenseDiscard, hand=state.players[player][type];for(let i=0;i<count;i++){if(!deck.length&&discard.length){deck.push(...shuffle(discard.splice(0)));}if(deck.length&&hand.length<3)hand.push(deck.shift());}}
function randomTake(hand){return hand.length?hand.splice(Math.floor(Math.random()*hand.length),1)[0]:null;}
function discardRandom(type,player){const hand=state.players[player][type],id=randomTake(hand);if(id)(type==="support"?state.supportDiscard:state.defenseDiscard).push(id);return id;}

function spriteStyle(c){const col=c.slot%3,row=Math.floor(c.slot/3),x=col===0?0:col===1?50:100,y=c.sheetRows===1?0:(row/(c.sheetRows-1))*100;return `--sheet:url('assets/sprites/sheet-${String(c.sheet).padStart(2,"0")}.webp');--size-y:${c.sheetRows*100}%;--x:${x}%;--y:${y}%`;}
function art(c){return `<div class="card-art" style="${spriteStyle(c)}"></div>`;}
function cardButton(c,attrs="",compact=false){return `<button class="hand-card" ${attrs}> <div class="card-thumb">${art(c)}</div><h3>${c.name}</h3>${compact?"":`<p>${c.text}</p>`}</button>`;}
function activeCardMarkup(playerIndex){const c=cardOfAttack(playerIndex);return `<button class="active-card" data-inspect="${c.id}" aria-label="Inspect ${c.name}">${art(c)}<span class="card-badge">${c.name}</span></button>`;}
function heartsMarkup(n){return `<div class="hearts">${[0,1,2].map(i=>`<span class="heart ${i<n?"live":""}">♥</span>`).join("")}</div>`;}

function fighterMarkup(index,isBottom){const p=state.players[index],a=active(index);return `<div class="fighter-meta ${isBottom?"":"right"}"><div class="fighter-name">${p.name}</div><div class="fighter-state">${aliveAttackCount(index)} attacker${aliveAttackCount(index)===1?"":"s"} remaining</div>${heartsMarkup(a.hearts)}</div>${activeCardMarkup(index)}<div class="reserve-stack"><span class="mini-back"></span><span>${Math.max(0,aliveAttackCount(index)-1)} reserve</span></div>`;}

function render(){
  if(!state)return; const bottom=state.viewer,top=opponentOf(bottom);
  el.player.innerHTML=fighterMarkup(bottom,true);el.opp.innerHTML=fighterMarkup(top,false);
  el.turn.textContent=state.winner?`${state.players[state.winner].name} wins`:`Turn: ${state.players[state.turn].name}`;
  const attacker=state.turn,defender=opponentOf(attacker),battleActive=["attack","defense","result"].includes(state.phase);
  [el.player,el.opp].forEach(zone=>zone.classList.remove("is-attacker","is-defender"));
  const playerZoneFor=index=>index===bottom?el.player:el.opp;
  if(battleActive){playerZoneFor(attacker).classList.add("is-attacker");playerZoneFor(defender).classList.add("is-defender");}
  el.arena.classList.toggle("battle-active",battleActive);
  el.arena.classList.toggle("attack-from-left",battleActive&&attacker===top);
  el.arena.classList.toggle("attack-from-right",battleActive&&attacker===bottom);
  const matchup=`${state.players[attacker].name} attacks → ${state.players[defender].name} defends`;
  const messages={attack:`${matchup} — choose Support or attack`,defense:`${matchup} — choose Defense`,result:`${matchup} — resolved`,setup:"Choose your attacker",over:"Battle complete"};
  el.phase.textContent=messages[state.phase]||"";
  el.played.innerHTML=[state.selectedSupport?`<span class="played-pill support">Support: ${CARD_BY_ID[state.selectedSupport].name}</span>`:"",state.playedDefense?`<span class="played-pill defense">Defense: ${CARD_BY_ID[state.playedDefense].name}</span>`:""].join("");
  el.supportCount.textContent=`${state.players[bottom].support.length} cards`;el.defenseCount.textContent=`${state.players[bottom].defense.length} cards`;
  const isAttacker=bottom===state.turn&&state.phase==="attack",isDefender=bottom===opponentOf(state.turn)&&state.phase==="defense";
  el.support.disabled=!isAttacker;el.attack.disabled=!isAttacker;el.defense.disabled=!isDefender;
  document.querySelectorAll("[data-inspect]").forEach(b=>b.onclick=()=>inspectCard(CARD_BY_ID[b.dataset.inspect]));
}

function beginTurn(){
  if(state.winner!==null)return; const p=state.players[state.turn];
  if(p.skipTurns>0){p.skipTurns--;log(`${p.name} loses this turn.`);state.turn=opponentOf(state.turn);passTo(state.turn,beginTurn);return;}
  state.viewer=state.turn;state.phase="attack";state.selectedSupport=null;state.selectedSupportChoice=0;state.selectedAttackMode=null;state.playedDefense=null;state.forcedDefense=null;render();
}

function passTo(player,callback){state.viewer=player;render();el.passName.textContent=state.players[player].name;el.pass.classList.remove("hidden");passAction=()=>{el.pass.classList.add("hidden");callback();};}
el.passBtn.onclick=()=>passAction?.();

function showDrawer(title,body){el.drawer.innerHTML=`<div class="drawer-head"><h2>${title}</h2><button class="close-btn" data-close>×</button></div>${body}`;el.scrim.classList.remove("hidden");el.drawer.classList.remove("hidden");el.drawer.querySelector("[data-close]").onclick=closeDrawer;}
function closeDrawer(){el.scrim.classList.add("hidden");el.drawer.classList.add("hidden");}
function showModal(html,dismiss=true){el.modal.innerHTML=html;el.scrim.classList.remove("hidden");el.modal.classList.remove("hidden");if(dismiss)el.modal.insertAdjacentHTML("beforeend",`<div class="modal-actions"><button class="ghost" data-modal-close>Close</button></div>`),el.modal.querySelector("[data-modal-close]").onclick=closeModal;}
function closeModal(){el.modal.classList.add("hidden");el.scrim.classList.add("hidden");}
el.scrim.onclick=()=>{closeDrawer();if(!el.modal.classList.contains("hidden"))closeModal();};

function inspectCard(c){showModal(`<div class="modal-card"><div class="card-thumb">${art(c)}</div><div><p class="eyebrow">${c.type}</p><h2>${c.name}</h2><p class="ability-copy">${c.text}</p></div></div>`);}

function openSupport(){const p=state.players[state.turn];showDrawer("Choose Support",`<div class="card-grid">${p.support.map(id=>cardButton(CARD_BY_ID[id],`data-support="${id}"`)).join("")}</div><div class="drawer-action"><button class="ghost" data-no-support>Attack without Support</button></div>`);el.drawer.querySelectorAll("[data-support]").forEach(b=>b.onclick=()=>selectSupport(b.dataset.support));el.drawer.querySelector("[data-no-support]").onclick=()=>{state.selectedSupport=null;closeDrawer();render();openAttack();};}
function selectSupport(id){const c=CARD_BY_ID[id];const commit=(choice=0)=>{state.selectedSupport=id;state.selectedSupportChoice=choice;closeModal();closeDrawer();render();};if(c.choices){showChoices(c.name,c.choices,commit);}else commit();}
function showChoices(title,choices,callback){showModal(`<h2>${title}</h2><p>Choose how to use this card.</p><div class="choice-list">${choices.map((v,i)=>`<button data-choice="${i}">${v}</button>`).join("")}</div>`,false);el.modal.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>callback(Number(b.dataset.choice)));}

function openAttack(){const a=active(state.turn),c=CARD_BY_ID[a.id],specialAvailable=!a.specialUsed&&!a.specialDisabled;showDrawer("Choose attack",`<div class="choice-list"><button data-mode="basic"><b>Basic attack</b><br><small>Deals 1 heart unless modified by Support.</small></button><button data-mode="special" ${specialAvailable?"":"disabled"}><b>${c.name} special</b><br><small>${specialAvailable?c.text:"Special ability already used or disabled."}</small></button></div>`);el.drawer.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>declareAttack(b.dataset.mode));}

function declareAttack(mode){closeDrawer();state.selectedAttackMode=mode;const attackCard=cardOfAttack(state.turn);if(mode==="special"&&attackCard.choices){showChoices(attackCard.name,attackCard.choices,(choice)=>{state.attackChoice=choice;closeModal();prepareAttack();});}else{state.attackChoice=0;prepareAttack();}}

function makeContext(){const ai=state.turn,di=opponentOf(ai);return {ai,di,attacker:state.players[ai],defender:state.players[di],attack:cardOfAttack(ai),support:state.selectedSupport?CARD_BY_ID[state.selectedSupport]:null,defense:null,isSpecial:state.selectedAttackMode==="special",power:1,block:0,counter:false,allowDefense:true,noAttack:false,attackerGain:0,defenderGain:0,damage:0,killed:false,defensePlayed:false,preventCounter:false,noDefenseDraw:false,extraSupport:0,extraDefense:0,notes:[],snapshot:clone(state.players)};}

function prepareAttack(){const ctx=makeContext();state.context=ctx;if(ctx.isSpecial){active(ctx.ai).specialUsed=true;applyAttackSpecial(ctx,ctx.attack.effect);}applySupportPre(ctx);if(ctx.paused)return;if(ctx.defender.defenseBlockedNext){ctx.allowDefense=false;ctx.defender.defenseBlockedNext=false;}if(ctx.noAttack){resolveAttack(ctx,null);return;}if(!ctx.allowDefense||!ctx.defender.defense.length){resolveAttack(ctx,null);return;}state.phase="defense";passTo(ctx.di,()=>{render();openDefense();});}

function applyAttackSpecial(ctx,effect){switch(effect){
  case"dino":ctx.flags={...(ctx.flags||{}),dino:true};break;case"snailzooka":if(active(ctx.ai).hearts===3&&active(ctx.di).hearts===3)ctx.power=3;ctx.flags={snail:true};break;
  case"noBunny":ctx.flags={noBunny:true};break;case"sickPuppy":if(active(ctx.ai).hearts<active(ctx.di).hearts)ctx.allowDefense=false;break;case"forgetta":ctx.power=2;ctx.attacker.skipTurns++;break;
  case"joeFlyden":if(active(ctx.di).hearts===2)ctx.power=2;break;case"badAsp":{const copied=cardOfAttack(ctx.di).effect;if(copied!=="badAsp")applyAttackSpecial(ctx,copied);}break;
  case"gatorDone":ctx.power=2;ctx.flags={gator:true};break;case"ladyThug":{const t=active(ctx.ai).hearts;active(ctx.ai).hearts=active(ctx.di).hearts;active(ctx.di).hearts=t;}break;
  case"wormPeace":if(state.attackChoice===0){heal(ctx.ai,99);ctx.noAttack=true;}else{ctx.power=1;ctx.extraSupport++;}break;
  case"gorilla":ctx.power=2;ctx.allowDefense=false;ctx.flags={gorilla:true};break;case"mooster":ctx.attackerGain+=heal(ctx.ai,1);discardRandom("defense",ctx.di);break;
  case"prawnold":heal(ctx.ai,99);reviveAttack(ctx.ai);break;case"kellen":ctx.attackerGain+=heal(ctx.ai,1);if(aliveAttackCount(ctx.di)>1)ctx.power=2;break;
  case"bullShip":active(ctx.di).specialDisabled=true;break;case"weSuck":if(active(ctx.di).hearts>1)ctx.attackerGain+=heal(ctx.ai,1);break;
  case"bassMasher":if(state.attackChoice===0){ctx.attackerGain+=heal(ctx.ai,1);ctx.noAttack=true;}else if(active(ctx.di).hearts===2)ctx.power=2;break;
}}

function applySupportPre(ctx){if(!ctx.support)return;const e=ctx.support.effect,choice=state.selectedSupportChoice;switch(e){
  case"warHog":if(ctx.isSpecial){ctx.support=null;state.selectedSupport=null;}break;case"pantryRaid":{const id=randomTake(ctx.defender.defense);if(id)ctx.attacker.defense.push(id);}break;
  case"pelicannon":if(choice===0)ctx.power=2;else discardRandom("defense",ctx.di);break;case"danGiraffe":ctx.power=2;ctx.flags={...(ctx.flags||{}),dan:true};break;
  case"skiHorse":if(aliveAttackCount(ctx.ai)===1&&active(ctx.di).hearts>1)ctx.allowDefense=false;break;case"miniPearl":ctx.attackerGain+=heal(ctx.ai,1);break;
  case"grasshooper":if(active(ctx.ai).hearts<active(ctx.di).hearts)ctx.allowDefense=false;break;case"dolph":if(ctx.isSpecial)ctx.allowDefense=false;break;
  case"scaredCrow":if(aliveAttackCount(ctx.di)>1)swapToReserve(ctx.di,true);break;case"lostrich":returnChosenDefense(ctx);break;
  case"eggcited":if(active(ctx.ai).hearts<active(ctx.di).hearts)ctx.power=2;break;case"highScorpion":ctx.forcedDefense=state.defenseDiscard.pop()||state.defenseDeck.shift()||null;state.forcedDefense=ctx.forcedDefense;ctx.noDefenseDraw=true;break;
  case"octopurse":if(active(ctx.di).hearts===3)ctx.allowDefense=false;break;case"slothWrath":returnRandomDefense(ctx.di);break;case"veryEmusing":if(active(ctx.ai).hearts===1)ctx.allowDefense=false;break;
  case"telephant":active(ctx.ai).specialUsed=false;break;case"superMonkey":ctx.attackerGain+=heal(ctx.ai,1);ctx.preventCounter=true;break;
  case"geckommander":if(ctx.attacker.support.length<2){const id=randomTake(ctx.defender.support);if(id)ctx.attacker.support.push(id);}if(ctx.attacker.defense.length<2){const id=randomTake(ctx.defender.defense);if(id)ctx.attacker.defense.push(id);}break;
  case"immunityDove":ctx.preventCounter=true;if(active(ctx.ai).hearts<2)ctx.allowDefense=false;break;case"combOver":ctx.attackerGain+=heal(ctx.ai,1);break;
  case"brokenSparrow":if(active(ctx.ai).hearts<2)ctx.attackerGain+=heal(ctx.ai,1);break;case"goatastic":case"starkRaven":ctx.power=2;break;
  case"bombsAway":swapRandomDefense(ctx.ai,ctx.di);break;case"slobster":returnRandomDefense(ctx.di);ctx.defenderGain+=heal(ctx.di,1);break;
  case"butIDontLie":if(active(ctx.ai).hearts<3)ctx.allowDefense=false;break;case"sonOfBee":ctx.attackerGain+=heal(ctx.ai,1);ctx.defenderGain+=heal(ctx.di,1);break;
}}

function returnChosenDefense(ctx){if(!ctx.defender.defense.length)return;const items=ctx.defender.defense.map(id=>CARD_BY_ID[id]);showModal(`<h2>Lostrich sees the Defense hand</h2><p>Choose one card to return to the draw pile.</p><div class="card-grid">${items.map(c=>cardButton(c,`data-return="${c.id}"`,true)).join("")}</div>`,false);el.modal.querySelectorAll("[data-return]").forEach(b=>b.onclick=()=>{const i=ctx.defender.defense.indexOf(b.dataset.return);if(i>=0)state.defenseDeck.push(ctx.defender.defense.splice(i,1)[0]);state.defenseDeck=shuffle(state.defenseDeck);closeModal();continuePrepared(ctx);});ctx.paused=true;}
function continuePrepared(ctx){ctx.paused=false;if(!ctx.allowDefense||!ctx.defender.defense.length)resolveAttack(ctx,null);else{state.phase="defense";passTo(ctx.di,()=>{render();openDefense();});}}

function openDefense(){const ctx=state.context;const ids=state.forcedDefense?[state.forcedDefense]:ctx.defender.defense;showDrawer("Choose Defense",`<div class="card-grid">${ids.map(id=>cardButton(CARD_BY_ID[id],`data-defense="${id}"`)).join("")}</div><div class="drawer-action"><button class="ghost" data-no-defense>Take the attack</button></div>`);el.drawer.querySelectorAll("[data-defense]").forEach(b=>b.onclick=()=>chooseDefense(b.dataset.defense));el.drawer.querySelector("[data-no-defense]").onclick=()=>{closeDrawer();resolveAttack(ctx,null);};}
function chooseDefense(id){closeDrawer();const c=CARD_BY_ID[id];if(c.choices){showChoices(c.name,c.choices,(choice)=>{state.defenseChoice=choice;closeModal();resolveAttack(state.context,c);});}else{state.defenseChoice=0;resolveAttack(state.context,c);}}

function resolveAttack(ctx,defense){
  if(ctx.paused)return;ctx.defense=defense;ctx.defensePlayed=!!defense;state.playedDefense=defense?.id||null;
  if(defense){const forced=state.forcedDefense===defense.id;if(!forced){const i=ctx.defender.defense.indexOf(defense.id);if(i>=0)ctx.defender.defense.splice(i,1);}state.forcedDefense=null;applyDefense(ctx,defense);}
  if(ctx.flags?.dino&&defense){ctx.attackerGain+=heal(ctx.ai,1);if(defense.effect==="counterBattack"||defense.effect==="abra"||defense.effect==="wastingRay")ctx.counter=false;}
  if(ctx.support?.effect==="warHog"&&defense){if(["spayingMantis","barack","oldWhale","scowlingOwl","toucan","counterBattack","flamingoalie","starwish","poleVulture","flowBackwards"].includes(defense.effect))ctx.attackerGain+=heal(ctx.ai,1);else ctx.power=2;}
  if(ctx.support?.effect==="sadHamster"&&defense)ctx.attackerGain+=heal(ctx.ai,2);
  if(ctx.support?.effect==="wellDung"&&defense)heal(ctx.ai,99);
  if(ctx.support?.effect==="pantryRaid"&&defense)draw("support",ctx.di,1);
  if(ctx.support?.effect==="mongooseGoose"&&defense)ctx.flags={...(ctx.flags||{}),mongoose:true};
  if(ctx.support?.effect==="blastypus"&&defense)ctx.noDefenseDraw=true;
  if(ctx.support?.effect==="centipede"&&defense)ctx.defender.defenseBlockedNext=true;
  if(!ctx.noAttack){const incoming=Math.max(0,ctx.power-ctx.block);ctx.damage=lose(ctx.di,incoming);if(ctx.counter&&!ctx.preventCounter&&ctx.damage)lose(ctx.ai,ctx.damage);}
  if(defense?.effect==="beave"&&active(ctx.di).hearts===0)active(ctx.di).hearts=1;
  if(defense?.effect==="antaClaus"&&ctx.damage)lose(ctx.ai,1);
  if(ctx.flags?.gorilla)lose(ctx.ai,2);
  ctx.killed=active(ctx.di).hearts===0;
  applyPost(ctx);consumeCards(ctx);handleDefeats(ctx);finishTurn(ctx);
}

function applyDefense(ctx,d){const e=d.effect,support=!!ctx.support,basic=!ctx.isSpecial;switch(e){
  case"tortoise":ctx.block=support?99:(active(ctx.di).hearts<active(ctx.ai).hearts?1:0);break;case"kangaroothless":ctx.block=99;ctx.flags={...(ctx.flags||{}),giveSupport:true};break;
  case"jackHammer":ctx.defenderGain+=heal(ctx.di,2);break;case"stopLion":if(active(ctx.di).hearts<2)ctx.block=99;if(support)ctx.defenderGain+=heal(ctx.di,1);break;
  case"penguin":if(basic)ctx.block=99;ctx.attackerGain+=heal(ctx.ai,1);break;case"looneyMoth":ctx.block=1;break;
  case"abra":if(ctx.isSpecial)ctx.block=99;else ctx.counter=true;break;case"spayingMantis":ctx.extraDefense++;break;case"barack":ctx.block=99;ctx.flags={...(ctx.flags||{}),barack:true};break;
  case"guardShark":if(active(ctx.ai).hearts>1||active(ctx.di).hearts>1)ctx.block=99;if(ctx.attackerGain)lose(ctx.ai,1);break;case"buffaloSoldier":if(active(ctx.di).hearts<active(ctx.ai).hearts)ctx.block=1;break;
  case"glunicorn":if(!ctx.defender.glunicornStage){ctx.block=99;ctx.defender.glunicornStage=1;ctx.flags={...(ctx.flags||{}),keepDefense:true};}else{ctx.block=1;ctx.defender.glunicornStage=0;}break;
  case"tickMagnet":if(active(ctx.di).hearts===active(ctx.ai).hearts)ctx.block=1;break;case"flamingoalie":if(state.defenseChoice===0)ctx.block=99;else{const alt=state.defenseDiscard.pop();if(alt)applyDefense(ctx,CARD_BY_ID[alt]);}break;
  case"starwish":if(ctx.support){state.players=clone(ctx.snapshot);ctx.attacker=state.players[ctx.ai];ctx.defender=state.players[ctx.di];ctx.support=null;state.selectedSupport=null;}break;
  case"bearShorts":if(active(ctx.ai).hearts<3)ctx.block=99;break;case"wastingRay":ctx.counter=true;if(ctx.attackerGain)ctx.defenderGain+=heal(ctx.di,ctx.attackerGain);break;
  case"oldWhale":if(support)ctx.block=99;break;case"scowlingOwl":if(!support)ctx.block=ctx.isSpecial?2:1;break;case"toucan":if(active(ctx.di).hearts>1)ctx.block=1;break;
  case"counterBattack":ctx.counter=true;break;case"fred":if(ctx.isSpecial)ctx.block=1;else if(active(ctx.ai).hearts>1)ctx.block=1;break;case"wallRuss":if(basic)ctx.block=1;break;
  case"sirHump":ctx.defenderGain+=heal(ctx.di,1);ctx.extraDefense+=2;break;case"pbJellyfish":lose(ctx.di,1);ctx.block=99;ctx.flags={...(ctx.flags||{}),swapEnd:true};break;
  case"headlessCow":heal(ctx.di,99);if(support)ctx.block=1;break;case"antaClaus":if(active(ctx.di).hearts<active(ctx.ai).hearts)ctx.block=1;break;
  case"instaRam":{const t=attackTraits[ctx.attack.id]||{};if(t.fly||t.noLegs)ctx.block=99;}break;case"armadrillo":if(support)ctx.flags={...(ctx.flags||{}),stealSupport:true};break;
  case"poleVulture":ctx.block=support?1:2;break;case"trisnoratops":if(active(ctx.ai).hearts<3&&active(ctx.di).hearts<3)ctx.block=99;if(support)ctx.flags={...(ctx.flags||{}),drawSupport:true};break;
  case"billySquid":if(support)ctx.defenderGain+=heal(ctx.di,2);if(ctx.power===2)ctx.power=1;break;case"spyder":if(aliveAttackCount(ctx.ai)>1||aliveAttackCount(ctx.di)>1||active(ctx.ai).hearts<3||active(ctx.di).hearts<3)ctx.block=1;break;
  case"lordAlfred":if(basic)ctx.block=1;break;case"hipposnotamus":ctx.block=1;break;case"flowBackwards":if(support)ctx.block=1;break;
}}

function applyPost(ctx){const e=ctx.support?.effect;if(e==="dragonQueen"&&!ctx.damage)draw("defense",ctx.ai);if(e==="youreShrewed"&&ctx.killed)heal(ctx.ai,2);if(e==="zebra"&&ctx.damage)heal(ctx.ai,1);if(e==="motherDucker"&&ctx.damage)heal(ctx.ai,99);if(e==="skunkzilla"&&active(ctx.di).hearts<active(ctx.ai).hearts)ctx.extraSupport++;if(e==="stupidThanksgiving"&&ctx.damage)heal(ctx.ai,1);if(e==="stupidThanksgiving"&&ctx.killed)lose(ctx.ai,1);if(e==="combOver"&&!ctx.damage)heal(ctx.ai,1);if(e==="sodaSquirrel"){if(!ctx.damage)heal(ctx.ai,1);else if(ctx.damage===1)lose(ctx.ai,1);}if(e==="trashRaider"&&!ctx.damage)heal(ctx.ai,1);if(ctx.flags?.mongoose&&active(ctx.ai).hearts>0)heal(ctx.ai,99);if(ctx.flags?.dan&&ctx.killed)lose(ctx.ai,1);
  if(ctx.defense?.effect==="barack"){heal(ctx.ai,1);heal(ctx.di,1);}if(ctx.flags?.swapEnd){const t=active(ctx.ai).hearts;active(ctx.ai).hearts=active(ctx.di).hearts;active(ctx.di).hearts=t;}if(ctx.flags?.giveSupport){const id=randomTake(ctx.defender.support);if(id&&ctx.attacker.support.length<3)ctx.attacker.support.push(id);}if(ctx.flags?.drawSupport)draw("support",ctx.di);if(ctx.flags?.stealSupport&&state.selectedSupport){const i=state.supportDiscard.indexOf(state.selectedSupport);if(i>=0&&ctx.defender.support.length<3)ctx.defender.support.push(state.supportDiscard.splice(i,1)[0]);}
}

function consumeCards(ctx){if(ctx.support){const i=ctx.attacker.support.indexOf(ctx.support.id);if(i>=0)ctx.attacker.support.splice(i,1);state.supportDiscard.push(ctx.support.id);}if(ctx.defense){if(ctx.flags?.keepDefense){if(!ctx.defender.defense.includes(ctx.defense.id))ctx.defender.defense.push(ctx.defense.id);}else state.defenseDiscard.push(ctx.defense.id);}if(ctx.support?.effect==="giftHorse"){const id=randomTake(ctx.defender.support);if(id&&ctx.attacker.support.length<3)ctx.attacker.support.push(id);}if(ctx.support?.effect==="fishStick"&&ctx.defensePlayed)ctx.extraDefense++;}
function handleDefeats(ctx){if(ctx.support?.effect==="eightLives"&&(ctx.damage||active(ctx.ai).hearts<3)){killActive(ctx.ai,true);killActive(ctx.di,true);return;}if(active(ctx.di).hearts<=0){killActive(ctx.di,false);if(ctx.flags?.noBunny&&aliveAttackCount(ctx.di))killActive(ctx.di,false);}if(active(ctx.ai).hearts<=0)killActive(ctx.ai,false);}
function killActive(player,unrevivable){const p=state.players[player],a=active(player);if(a.dead)return;a.dead=true;a.unrevivable=unrevivable;p.deadAttacks.push(a.id);const next=p.attacks.findIndex(x=>!x.dead);if(next>=0){p.active=next;p.attacks[next].hearts=3;p.attacks[next].specialUsed=false;while(p.support.length<2)draw("support",player);while(p.defense.length<2)draw("defense",player);log(`${p.name} sends in ${CARD_BY_ID[p.attacks[next].id].name}.`);}else{state.winner=opponentOf(player);state.phase="over";}}
function reviveAttack(player){const p=state.players[player],a=p.attacks.find(x=>x.dead&&!x.unrevivable);if(a){a.dead=false;a.hearts=3;a.specialUsed=false;p.deadAttacks=p.deadAttacks.filter(id=>id!==a.id);}}
function swapToReserve(player,disable){const p=state.players[player],next=p.attacks.findIndex((a,i)=>i!==p.active&&!a.dead);if(next>=0){p.active=next;if(disable)p.attacks[next].specialDisabled=true;}}
function returnRandomDefense(player){const p=state.players[player],id=randomTake(p.defense);if(id){state.defenseDeck.push(id);state.defenseDeck=shuffle(state.defenseDeck);}}
function swapRandomDefense(a,b){const pa=state.players[a],pb=state.players[b];if(!pa.defense.length||!pb.defense.length)return;const ia=Math.floor(Math.random()*pa.defense.length),ib=Math.floor(Math.random()*pb.defense.length);[pa.defense[ia],pb.defense[ib]]=[pb.defense[ib],pa.defense[ia]];}

function finishTurn(ctx){
  if(ctx.flags?.snail&&ctx.killed)lose(ctx.ai,1);if(ctx.flags?.gator&&ctx.defensePlayed)heal(ctx.ai,1);
  if(!ctx.noDefenseDraw&&ctx.defensePlayed)draw("defense",ctx.di,1);draw("defense",ctx.di,ctx.extraDefense);if(ctx.support)draw("support",ctx.ai,1);draw("support",ctx.ai,ctx.extraSupport);
  log(`${ctx.attacker.name}'s ${ctx.attack.name} dealt ${ctx.damage} heart${ctx.damage===1?"":"s"}${ctx.defense?` against ${ctx.defense.name}`:""}.`);
  state.phase=state.winner!==null?"over":"result";state.viewer=ctx.ai;render();
  const summary=state.winner!==null?`<h2>${state.players[state.winner].name} wins!</h2><p>The arena belongs to ${cardOfAttack(state.winner).name}.</p><div class="modal-actions"><button class="primary" data-new>New game</button></div>`:`<h2>Attack resolved</h2><p>${ctx.attacker.name} dealt <b>${ctx.damage}</b> heart${ctx.damage===1?"":"s"}. ${ctx.defense?`${ctx.defender.name} used ${ctx.defense.name}.`:"No Defense was played."}</p><div class="modal-actions"><button class="primary" data-next>Next turn</button></div>`;
  showModal(summary,false);if(state.winner!==null)el.modal.querySelector("[data-new]").onclick=()=>location.reload();else el.modal.querySelector("[data-next]").onclick=()=>{closeModal();state.turn=opponentOf(state.turn);passTo(state.turn,beginTurn);};
}

function showLog(){showDrawer("Battle history",`<div class="log-list">${state?.log.length?state.log.map(x=>`<div class="log-item">${x}</div>`).join(""):"<p>No attacks yet.</p>"}</div>`);}
function showCatalog(){showDrawer("All 97 cards",`<div class="card-grid">${ALL_CARDS.map(c=>cardButton(c,`data-catalog="${c.id}"`,true)).join("")}</div>`);el.drawer.querySelectorAll("[data-catalog]").forEach(b=>b.onclick=()=>inspectCard(CARD_BY_ID[b.dataset.catalog]));}

el.setupForm.onsubmit=(e)=>{e.preventDefault();startGame([el.p1.value.trim()||"Player 1",el.p2.value.trim()||"Player 2"]);};
el.catalog.onclick=showCatalog;el.support.onclick=openSupport;el.attack.onclick=openAttack;el.defense.onclick=openDefense;el.log.onclick=showLog;el.menu.onclick=()=>{showDrawer("Game menu",`<div class="choice-list"><button data-catalog-menu>View all 97 cards</button><button data-restart>Restart game</button></div>`);$("[data-catalog-menu]").onclick=showCatalog;$("[data-restart]").onclick=()=>location.reload();};

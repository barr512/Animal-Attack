import {ATTACK_CARDS,SUPPORT_CARDS,DEFENSE_CARDS,CARD_BY_ID,ALL_CARDS} from "./data/cards.js";

const $ = (s) => document.querySelector(s);
const clone = (v) => structuredClone(v);
const shuffle = (items) => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const maxHearts = 3;

const el = {setup:$("#setup"),game:$("#game"),arena:$(".arena"),battle:$("#battleScene"),setupForm:$("#setupForm"),p1:$("#player1"),p2:$("#player2"),turn:$("#turnLabel"),phase:$("#phaseMessage"),opp:$("#opponentZone"),player:$("#playerZone"),played:$("#playedCards"),support:$("#supportBtn"),attack:$("#attackBtn"),defense:$("#defenseBtn"),supportCount:$("#supportCount"),defenseCount:$("#defenseCount"),scrim:$("#scrim"),drawer:$("#drawer"),modal:$("#modal"),pass:$("#passScreen"),passName:$("#passName"),passBtn:$("#passBtn"),log:$("#logBtn"),menu:$("#menuBtn"),catalog:$("#catalogBtn")};

let state=null, passAction=null;

const attackTraits={
  "dino-might":{fly:true},"snailzooka":{noLegs:true},"joe-flyden":{fly:true},"bad-asp":{noLegs:true},"lady-thug":{fly:true},"worm-and-peace":{noLegs:true},"bull-ship":{noLegs:true},"we-suck":{fly:true},"bass-masher":{noLegs:true}
};

const animatedCharacters={
  "gorilla-warfare":{ready:"assets/characters/gorilla-warfare-ready.webp?v=2",attack:"assets/characters/gorilla-warfare-attack.webp?v=2",recoil:"assets/characters/gorilla-warfare-recoil.webp?v=2",style:"gorilla"},
  "kellen-me-softly":{ready:"assets/characters/kellen-me-softly-ready.webp?v=2",attack:"assets/characters/kellen-me-softly-attack.webp?v=2",recoil:"assets/characters/kellen-me-softly-recoil.webp?v=2",style:"kellen"}
};
const enhancedCardArtwork={
  "pantry-raid":"assets/cards/enhanced/pantry-raid-v1.webp",
  "goatastic":"assets/cards/enhanced/goatastic-v1.webp",
  "wall-russ":"assets/cards/enhanced/wall-russ-v1.webp",
  "flow-backwards":"assets/cards/enhanced/flow-backwards-v1.webp"
};

function freshPlayer(name,index,attackDeck,supportDeck,defenseDeck,startingSupport=null,startingDefense=null){
  return {name,index,attacks:attackDeck.splice(0,2).map(id=>({id,hearts:3,specialUsed:false,specialDisabled:false,dead:false,unrevivable:false})),active:0,support:startingSupport||supportDeck.splice(0,2),defense:startingDefense||defenseDeck.splice(0,2),deadAttacks:[],skipTurns:0,defenseBlockedNext:false,glunicornStage:0};
}

function startGame(names){
  const forcedSupports=["pantry-raid","goatastic"],forcedDefenses=["wall-russ","flow-backwards"],attacks=shuffle(ATTACK_CARDS.map(c=>c.id).filter(id=>!["gorilla-warfare","kellen-me-softly"].includes(id))),support=shuffle(SUPPORT_CARDS.map(c=>c.id).filter(id=>!forcedSupports.includes(id))),defense=shuffle(DEFENSE_CARDS.map(c=>c.id).filter(id=>!forcedDefenses.includes(id)));
  state={players:[],supportDeck:support,defenseDeck:defense,supportDiscard:[],defenseDiscard:[],turn:0,viewer:0,phase:"setup",selectedSupport:null,selectedSupportChoice:0,selectedAttackMode:null,forcedDefense:null,playedDefense:null,log:[],winner:null};
  const player1Attacks=["gorilla-warfare",attacks.shift()],player2Attacks=["kellen-me-softly",attacks.shift()];
  state.players=[freshPlayer(names[0],0,player1Attacks,support,defense,forcedSupports),freshPlayer(names[1],1,player2Attacks,support,defense,null,forcedDefenses)];
  el.setup.classList.add("hidden");el.game.classList.remove("hidden");
  beginTurn();
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
function heal(player,amount){const before=active(player).hearts;active(player).hearts=Math.min(maxHearts,active(player).hearts+amount);const gained=active(player).hearts-before;if(gained&&state?.context?.heartRewards)state.context.heartRewards[player]+=gained;return gained;}
function lose(player,amount){const before=active(player).hearts;active(player).hearts=Math.max(0,active(player).hearts-amount);return before-active(player).hearts;}
function log(message){state.log.unshift(message);}
function recordCardReward(ctx,player,type,count=1){if(ctx?.cardRewards)ctx.cardRewards[player][type]+=count;}
function draw(type,player,count=1,reward=false){const deck=type==="support"?state.supportDeck:state.defenseDeck, discard=type==="support"?state.supportDiscard:state.defenseDiscard, hand=state.players[player][type];let drawn=0;for(let i=0;i<count;i++){if(!deck.length&&discard.length){deck.push(...shuffle(discard.splice(0)));}if(deck.length&&hand.length<3){hand.push(deck.shift());drawn++;}}if(reward&&drawn)recordCardReward(state.context,player,type,drawn);return drawn;}
function randomTake(hand){return hand.length?hand.splice(Math.floor(Math.random()*hand.length),1)[0]:null;}
function discardRandom(type,player){const hand=state.players[player][type],id=randomTake(hand);if(id)(type==="support"?state.supportDiscard:state.defenseDiscard).push(id);return id;}

function spriteStyle(c){const col=c.slot%3,row=Math.floor(c.slot/3),x=col===0?0:col===1?50:100,y=c.sheetRows===1?0:(row/(c.sheetRows-1))*100;return `--sheet:url('assets/sprites/sheet-${String(c.sheet).padStart(2,"0")}.webp');--size-y:${c.sheetRows*100}%;--x:${x}%;--y:${y}%`;}
function art(c){return `<div class="card-art" style="${spriteStyle(c)}"></div>`;}
function illustratedCardContent(c){const portrait=animatedCharacters[c.id]?.ready||enhancedCardArtwork[c.id];return portrait?`<div class="battle-card-type">${c.type.toUpperCase()}</div><div class="battle-portrait"><img src="${portrait}" alt="${c.name}"></div><div class="battle-card-rule">${c.text}</div>`:null;}
function illustratedClass(c){return c.type==="attack"?"illustrated-attack":`illustrated-${c.type}`;}
function battleCard(c,className){const illustrated=illustratedCardContent(c);return `<div class="battle-card ${className}${illustrated?` ${illustratedClass(c)}`:""}">${illustrated||art(c)}<span>${c.name}</span></div>`;}
function cardButton(c,attrs="",compact=false){const illustrated=illustratedCardContent(c);return `<button class="hand-card" ${attrs}> <div class="card-thumb${illustrated?` ${illustratedClass(c)}`:""}">${illustrated||art(c)}${illustrated?`<span class="card-badge">${c.name}</span>`:""}</div><h3>${c.name}</h3>${compact?"":`<p>${c.text}</p>`}</button>`;}
function activeCardMarkup(playerIndex){const c=cardOfAttack(playerIndex),illustrated=illustratedCardContent(c);return `<button class="active-card${illustrated?` ${illustratedClass(c)}`:""}" data-inspect="${c.id}" aria-label="Inspect ${c.name}">${illustrated||art(c)}<span class="card-badge">${c.name}</span></button>`;}
function heartsMarkup(n){return `<div class="hearts">${[0,1,2].map(i=>`<span class="heart ${i<n?"live":""}">♥</span>`).join("")}</div>`;}

function fighterMarkup(index,isBottom){const p=state.players[index],a=active(index);return `<div class="fighter-meta ${isBottom?"":"right"}"><div class="fighter-name">${p.name}</div><div class="fighter-state">${aliveAttackCount(index)} attacker${aliveAttackCount(index)===1?"":"s"} remaining</div>${heartsMarkup(a.hearts)}</div>${activeCardMarkup(index)}<div class="reserve-stack"><span class="mini-back"></span><span>${Math.max(0,aliveAttackCount(index)-1)} reserve</span></div>`;}

function render(){
  if(!state)return; const viewer=state.viewer,left=0,right=1;
  el.opp.innerHTML=fighterMarkup(left,false);el.player.innerHTML=fighterMarkup(right,true);
  el.turn.textContent=state.winner?`${state.players[state.winner].name} wins`:`Turn: ${state.players[state.turn].name}`;
  const attacker=state.turn,defender=opponentOf(attacker),battleActive=["attack","defense","result"].includes(state.phase);
  [el.player,el.opp].forEach(zone=>zone.classList.remove("is-attacker","is-defender"));
  const playerZoneFor=index=>index===left?el.opp:el.player;
  if(battleActive){playerZoneFor(attacker).classList.add("is-attacker");playerZoneFor(defender).classList.add("is-defender");}
  el.arena.classList.toggle("battle-active",battleActive);
  el.arena.classList.toggle("attack-from-left",battleActive&&attacker===left);
  el.arena.classList.toggle("attack-from-right",battleActive&&attacker===right);
  const matchup=`${state.players[attacker].name} attacks → ${state.players[defender].name} defends`;
  const messages={attack:`${matchup} — choose Support or attack`,defense:`${matchup} — choose Defense`,result:`${matchup} — resolved`,setup:"Choose your attacker",over:"Battle complete"};
  el.phase.textContent=messages[state.phase]||"";
  el.played.innerHTML=[state.selectedSupport?`<span class="played-pill support">Support: ${CARD_BY_ID[state.selectedSupport].name}</span>`:"",state.playedDefense?`<span class="played-pill defense">Defense: ${CARD_BY_ID[state.playedDefense].name}</span>`:""].join("");
  el.supportCount.textContent=`${state.players[viewer].support.length} cards`;el.defenseCount.textContent=`${state.players[viewer].defense.length} cards`;
  const isAttacker=viewer===state.turn&&state.phase==="attack",isDefender=viewer===opponentOf(state.turn)&&state.phase==="defense";
  el.support.disabled=!isAttacker;el.attack.disabled=!isAttacker;el.defense.disabled=!isDefender;
  document.querySelectorAll("[data-inspect]").forEach(b=>b.onclick=()=>inspectCard(CARD_BY_ID[b.dataset.inspect]));
}

function beginTurn(){
  if(state.winner!==null)return; const p=state.players[state.turn];
  if(p.skipTurns>0){p.skipTurns--;log(`${p.name} loses this turn.`);state.turn=opponentOf(state.turn);passTo(state.turn,beginTurn);return;}
  state.context=null;state.viewer=state.turn;state.phase="attack";state.selectedSupport=null;state.selectedSupportChoice=0;state.selectedAttackMode=null;state.playedDefense=null;state.forcedDefense=null;render();
}

function passTo(player,callback){state.viewer=player;render();el.passName.textContent=state.players[player].name;el.pass.classList.remove("hidden");passAction=()=>{el.pass.classList.add("hidden");callback();};}
el.passBtn.onclick=()=>passAction?.();

function drawerBattleStatus(){if(!state)return"";return `<div class="drawer-battle-status">${state.players.map((p,i)=>`<div class="drawer-fighter ${i===state.turn?"attacking":"defending"}"><span class="drawer-role">${i===state.turn?"Attacking":"Defending"}</span><strong>${p.name}</strong>${heartsMarkup(active(i).hearts)}</div>`).join(`<span class="drawer-versus">VS</span>`)}</div>`;}
function showDrawer(title,body){el.drawer.innerHTML=`<div class="drawer-head"><h2>${title}</h2><button class="close-btn" data-close>×</button></div>${drawerBattleStatus()}${body}`;el.scrim.classList.remove("hidden");el.drawer.classList.remove("hidden");el.drawer.querySelector("[data-close]").onclick=closeDrawer;}
function closeDrawer(){el.scrim.classList.add("hidden");el.drawer.classList.add("hidden");}
function showModal(html,dismiss=true){el.modal.innerHTML=html;el.scrim.classList.remove("hidden");el.modal.classList.remove("hidden");if(dismiss)el.modal.insertAdjacentHTML("beforeend",`<div class="modal-actions"><button class="ghost" data-modal-close>Close</button></div>`),el.modal.querySelector("[data-modal-close]").onclick=closeModal;}
function closeModal(){el.modal.classList.add("hidden");el.scrim.classList.add("hidden");}
el.scrim.onclick=()=>{closeDrawer();if(!el.modal.classList.contains("hidden"))closeModal();};

function inspectCard(c){const illustrated=illustratedCardContent(c);showModal(`<div class="modal-card${illustrated?" illustrated-modal":""}"><div class="card-thumb${illustrated?` ${illustratedClass(c)}`:""}">${illustrated||art(c)}${illustrated?`<span class="card-badge">${c.name}</span>`:""}</div><div class="modal-card-copy"><p class="eyebrow">${c.type}</p><h2>${c.name}</h2><p class="ability-copy">${c.text}</p></div></div>`);}

function openSupport(){const p=state.players[state.turn];showDrawer("Choose Support",`<div class="card-grid">${p.support.map(id=>cardButton(CARD_BY_ID[id],`data-support="${id}"`)).join("")}</div><div class="drawer-action"><button class="ghost" data-no-support>Attack without Support</button></div>`);el.drawer.querySelectorAll("[data-support]").forEach(b=>b.onclick=()=>selectSupport(b.dataset.support));el.drawer.querySelector("[data-no-support]").onclick=()=>{state.selectedSupport=null;closeDrawer();render();openAttack();};}
function selectSupport(id){const c=CARD_BY_ID[id];const commit=(choice=0)=>{state.selectedSupport=id;state.selectedSupportChoice=choice;closeModal();closeDrawer();render();};if(c.choices){showChoices(c.name,c.choices,commit);}else commit();}
function showChoices(title,choices,callback){showModal(`<h2>${title}</h2><p>Choose how to use this card.</p><div class="choice-list">${choices.map((v,i)=>`<button data-choice="${i}">${v}</button>`).join("")}</div>`,false);el.modal.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>callback(Number(b.dataset.choice)));}

function openAttack(){const a=active(state.turn),c=CARD_BY_ID[a.id],specialAvailable=!a.specialUsed&&!a.specialDisabled;showDrawer("Choose attack",`<div class="choice-list"><button data-mode="basic"><b>Basic attack</b><br><small>Deals 1 heart unless modified by Support.</small></button><button data-mode="special" ${specialAvailable?"":"disabled"}><b>${c.name} special</b><br><small>${specialAvailable?c.text:"Special ability already used or disabled."}</small></button></div>`);el.drawer.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>declareAttack(b.dataset.mode));}

function declareAttack(mode){closeDrawer();state.selectedAttackMode=mode;const attackCard=cardOfAttack(state.turn);if(mode==="special"&&attackCard.choices){showChoices(attackCard.name,attackCard.choices,(choice)=>{state.attackChoice=choice;closeModal();prepareAttack();});}else{state.attackChoice=0;prepareAttack();}}

function makeContext(){const ai=state.turn,di=opponentOf(ai);return {ai,di,attacker:state.players[ai],defender:state.players[di],attack:cardOfAttack(ai),support:state.selectedSupport?CARD_BY_ID[state.selectedSupport]:null,defense:null,isSpecial:state.selectedAttackMode==="special",power:1,block:0,counter:false,allowDefense:true,noAttack:false,attackerGain:0,defenderGain:0,heartRewards:[0,0],animatedHeartRewards:[0,0],cardRewards:[{support:0,defense:0},{support:0,defense:0}],damage:0,killed:false,defensePlayed:false,preventCounter:false,noDefenseDraw:false,extraSupport:0,extraDefense:0,notes:[],snapshot:clone(state.players)};}

function prepareAttack(){const ctx=makeContext();state.context=ctx;if(ctx.isSpecial){active(ctx.ai).specialUsed=true;applyAttackSpecial(ctx,ctx.attack.effect);}applySupportPre(ctx);if(ctx.paused)return;if(ctx.support?.effect==="pantryRaid"||(ctx.support?.effect==="goatastic"&&!ctx.isSpecial)){playSupportPreparation(ctx,()=>continueAfterSupportPreparation(ctx));return;}continueAfterSupportPreparation(ctx);}
function continueAfterSupportPreparation(ctx){const immediate=ctx.heartRewards.map((hearts,i)=>hearts?`<li><b>${state.players[i].name}</b> gained ${hearts} heart${hearts===1?"":"s"} and now has ${active(i).hearts}.</li>`:"").filter(Boolean);if(immediate.length){render();showModal(`<h2>Immediate ability</h2><ul class="immediate-results">${immediate.join("")}</ul>${drawerBattleStatus()}<div class="modal-actions"><button class="primary" data-continue-attack>Continue</button></div>`,false);el.modal.querySelector("[data-continue-attack]").onclick=()=>{closeModal();continueAttackPreparation(ctx);};return;}continueAttackPreparation(ctx);}
function continueAttackPreparation(ctx){if(ctx.defender.defenseBlockedNext){ctx.allowDefense=false;ctx.defender.defenseBlockedNext=false;}if(ctx.noAttack){resolveAttack(ctx,null);return;}if(!ctx.allowDefense||(!ctx.defender.defense.length&&!state.forcedDefense)){resolveAttack(ctx,null);return;}state.phase="defense";passTo(ctx.di,()=>{render();openDefense();});}

function applyAttackSpecial(ctx,effect){switch(effect){
  case"dino":ctx.flags={...(ctx.flags||{}),dino:true};break;case"snailzooka":if(active(ctx.ai).hearts===3&&active(ctx.di).hearts===3)ctx.power=3;ctx.flags={snail:true};break;
  case"noBunny":ctx.flags={noBunny:true};break;case"sickPuppy":if(active(ctx.ai).hearts<active(ctx.di).hearts)ctx.allowDefense=false;break;case"forgetta":ctx.power=2;ctx.attacker.skipTurns++;break;
  case"joeFlyden":if(active(ctx.di).hearts===2)ctx.power=2;break;case"badAsp":{const copied=cardOfAttack(ctx.di).effect;if(copied!=="badAsp")applyAttackSpecial(ctx,copied);}break;
  case"gatorDone":ctx.power=2;ctx.flags={gator:true};break;case"ladyThug":{const t=active(ctx.ai).hearts;active(ctx.ai).hearts=active(ctx.di).hearts;active(ctx.di).hearts=t;}break;
  case"wormPeace":if(state.attackChoice===0){heal(ctx.ai,99);ctx.noAttack=true;}else{ctx.power=1;ctx.extraSupport++;}break;
  case"gorilla":ctx.power=2;ctx.allowDefense=false;ctx.flags={gorilla:true};break;case"mooster":ctx.attackerGain+=heal(ctx.ai,1);discardRandom("defense",ctx.di);break;
  case"prawnold":heal(ctx.ai,99);reviveAttack(ctx.ai);break;case"kellen":ctx.attackerGain+=heal(ctx.ai,1);if(aliveAttackCount(ctx.di)>1)ctx.power=2;break;
  case"bullShip":active(ctx.di).specialDisabled=true;break;case"weSuck":if(active(ctx.di).hearts>1)ctx.attackerGain+=heal(ctx.ai,1);break;
  case"bassMasher":if(state.attackChoice===0)ctx.attackerGain+=heal(ctx.ai,1);else if(active(ctx.di).hearts===2)ctx.power=2;break;
}}

function applySupportPre(ctx){if(!ctx.support)return;const e=ctx.support.effect,choice=state.selectedSupportChoice;switch(e){
  case"warHog":if(ctx.isSpecial){ctx.support=null;state.selectedSupport=null;}break;case"pantryRaid":{const id=randomTake(ctx.defender.defense);if(id){ctx.attacker.defense.push(id);ctx.flags={...(ctx.flags||{}),pantryStolen:true};}}break;
  case"pelicannon":if(choice===0)ctx.power=2;else discardRandom("defense",ctx.di);break;case"danGiraffe":ctx.power=2;ctx.flags={...(ctx.flags||{}),dan:true};break;
  case"skiHorse":if(aliveAttackCount(ctx.ai)===1&&active(ctx.di).hearts>1)ctx.allowDefense=false;break;case"miniPearl":ctx.attackerGain+=heal(ctx.ai,1);break;
  case"grasshooper":if(active(ctx.ai).hearts<active(ctx.di).hearts)ctx.allowDefense=false;break;case"dolph":if(ctx.isSpecial)ctx.allowDefense=false;break;
  case"scaredCrow":if(aliveAttackCount(ctx.di)>1)swapToReserve(ctx.di,true);break;case"lostrich":returnChosenDefense(ctx);break;
  case"eggcited":if(active(ctx.ai).hearts<active(ctx.di).hearts)ctx.power=2;break;case"highScorpion":ctx.forcedDefenseSource=state.defenseDiscard.length?"discard":"draw";ctx.forcedDefense=(ctx.forcedDefenseSource==="discard"?state.defenseDiscard.pop():state.defenseDeck.shift())||null;state.forcedDefense=ctx.forcedDefense;ctx.noDefenseDraw=true;break;
  case"octopurse":if(active(ctx.di).hearts===3)ctx.allowDefense=false;break;case"slothWrath":returnRandomDefense(ctx.di);break;case"veryEmusing":if(active(ctx.ai).hearts===1)ctx.allowDefense=false;break;
  case"telephant":active(ctx.ai).specialUsed=false;break;case"superMonkey":ctx.attackerGain+=heal(ctx.ai,1);ctx.preventCounter=true;break;
  case"geckommander":if(ctx.attacker.support.length<2){const id=randomTake(ctx.defender.support);if(id){ctx.attacker.support.push(id);recordCardReward(ctx,ctx.ai,"support");}}if(ctx.attacker.defense.length<2){const id=randomTake(ctx.defender.defense);if(id){ctx.attacker.defense.push(id);recordCardReward(ctx,ctx.ai,"defense");}}break;
  case"immunityDove":ctx.preventCounter=true;if(active(ctx.ai).hearts<2)ctx.allowDefense=false;break;case"combOver":ctx.attackerGain+=heal(ctx.ai,1);break;
  case"brokenSparrow":if(active(ctx.ai).hearts<2)ctx.attackerGain+=heal(ctx.ai,1);break;case"goatastic":if(!ctx.isSpecial)ctx.power=2;break;case"starkRaven":ctx.power=2;break;
  case"bombsAway":swapRandomDefense(ctx.ai,ctx.di);break;case"slobster":ctx.defenderGain+=heal(ctx.di,1);chooseOwnDefenseToReturn(ctx);break;
  case"butIDontLie":if(active(ctx.ai).hearts<3)ctx.allowDefense=false;break;case"sonOfBee":ctx.attackerGain+=heal(ctx.ai,1);ctx.defenderGain+=heal(ctx.di,1);break;
}}

function returnChosenDefense(ctx){if(!ctx.defender.defense.length)return;const items=ctx.defender.defense.map(id=>CARD_BY_ID[id]);showModal(`<h2>Lostrich sees the Defense hand</h2><p>Choose one card to return to the draw pile.</p><div class="card-grid">${items.map(c=>cardButton(c,`data-return="${c.id}"`,true)).join("")}</div>`,false);el.modal.querySelectorAll("[data-return]").forEach(b=>b.onclick=()=>{const i=ctx.defender.defense.indexOf(b.dataset.return);if(i>=0)state.defenseDeck.push(ctx.defender.defense.splice(i,1)[0]);state.defenseDeck=shuffle(state.defenseDeck);closeModal();continuePrepared(ctx);});ctx.paused=true;}
function chooseOwnDefenseToReturn(ctx){if(!ctx.defender.defense.length)return;ctx.paused=true;passTo(ctx.di,()=>{const items=ctx.defender.defense.map(id=>CARD_BY_ID[id]);showModal(`<h2>Slobster</h2><p>${ctx.defender.name}, choose one of your Defense cards to return to the draw pile.</p><div class="card-grid">${items.map(c=>cardButton(c,`data-slobster-return="${c.id}"`,true)).join("")}</div>`,false);el.modal.querySelectorAll("[data-slobster-return]").forEach(b=>b.onclick=()=>{const i=ctx.defender.defense.indexOf(b.dataset.slobsterReturn);if(i>=0)state.defenseDeck.push(ctx.defender.defense.splice(i,1)[0]);state.defenseDeck=shuffle(state.defenseDeck);closeModal();continuePrepared(ctx);});});}
function continuePrepared(ctx){ctx.paused=false;if(!ctx.allowDefense||!ctx.defender.defense.length)resolveAttack(ctx,null);else{state.phase="defense";if(state.viewer===ctx.di){render();openDefense();}else passTo(ctx.di,()=>{render();openDefense();});}}

function openDefense(){const ctx=state.context,forced=!!state.forcedDefense;const ids=forced?[state.forcedDefense]:ctx.defender.defense;showDrawer(forced?"High Scorpion — required Defense":"Choose Defense",`<div class="card-grid">${ids.map(id=>cardButton(CARD_BY_ID[id],`data-defense="${id}"`)).join("")}</div>${forced?`<p class="forced-card-note">This card was drawn from the ${ctx.forcedDefenseSource} pile and must be used.</p>`:`<div class="drawer-action"><button class="ghost" data-no-defense>Take the attack</button></div>`}`);el.drawer.querySelectorAll("[data-defense]").forEach(b=>b.onclick=()=>chooseDefense(b.dataset.defense));if(!forced)el.drawer.querySelector("[data-no-defense]").onclick=()=>{closeDrawer();resolveAttack(ctx,null);};}
function chooseDefense(id){closeDrawer();const c=CARD_BY_ID[id];if(c.choices){showChoices(c.name,c.choices,(choice)=>{state.defenseChoice=choice;closeModal();resolveAttack(state.context,c);});}else{state.defenseChoice=0;resolveAttack(state.context,c);}}

function resolveAttack(ctx,defense){
  if(ctx.paused)return;ctx.defense=defense;ctx.defensePlayed=!!defense;state.playedDefense=defense?.id||null;
  if(defense){const forced=state.forcedDefense===defense.id;if(!forced){const i=ctx.defender.defense.indexOf(defense.id);if(i>=0)ctx.defender.defense.splice(i,1);}state.forcedDefense=null;applyDefense(ctx,defense);}
  if(ctx.flags?.dino&&defense){ctx.attackerGain+=heal(ctx.ai,1);if(defense.effect==="counterBattack"||defense.effect==="abra"||defense.effect==="wastingRay")ctx.counter=false;}
  if(ctx.support?.effect==="warHog"&&defense){if(["spayingMantis","barack","oldWhale","scowlingOwl","toucan","counterBattack","flamingoalie","starwish","poleVulture","flowBackwards"].includes(defense.effect))ctx.attackerGain+=heal(ctx.ai,1);else ctx.power=2;}
  if(ctx.support?.effect==="sadHamster"&&defense)ctx.attackerGain+=heal(ctx.ai,2);
  if(ctx.support?.effect==="wellDung"&&defense)heal(ctx.ai,99);
  if(ctx.support?.effect==="pantryRaid"&&defense)ctx.pantryRaidSupportDraw=draw("support",ctx.di,1,true);
  if(ctx.support?.effect==="mongooseGoose"&&defense)ctx.flags={...(ctx.flags||{}),mongoose:true};
  if(ctx.support?.effect==="blastypus"&&defense)ctx.noDefenseDraw=true;
  if(ctx.support?.effect==="centipede"&&defense)ctx.defender.defenseBlockedNext=true;
  if(!ctx.noAttack){const incoming=Math.max(0,ctx.power-ctx.block);ctx.damage=lose(ctx.di,incoming);if(ctx.counter&&!ctx.preventCounter&&ctx.damage)lose(ctx.ai,ctx.damage);}
  if(defense?.effect==="beave"&&active(ctx.di).hearts===0)active(ctx.di).hearts=1;
  if(defense?.effect==="antaClaus"&&ctx.damage)lose(ctx.ai,1);
  if(ctx.flags?.gorilla)lose(ctx.ai,2);
  ctx.killed=active(ctx.di).hearts===0;
  playBattleAnimation(ctx,()=>{if(ctx.flags?.giveSupport&&ctx.defender.support.length)chooseKangaroothlessSupport(ctx);else completeResolvedAttack(ctx);});
}

function playSupportPreparation(ctx,done){
  const pantry=ctx.support.effect==="pantryRaid",direction=ctx.ai===0?"from-left":"from-right",originZone=ctx.ai===0?el.opp:el.player,targetZone=ctx.di===0?el.opp:el.player,originCard=originZone.querySelector(".active-card"),targetCard=targetZone.querySelector(".active-card");
  el.battle.className=`battle-scene support-scene ${direction} ${pantry?"pantry-scene":"goatastic-scene"}`;
  el.battle.innerHTML=`<button class="battle-skip" type="button">Skip</button><div class="support-showcase">${battleCard(ctx.support,"support-effect-card")}</div>${pantry?`<div class="pantry-mouse" aria-hidden="true">🐭</div><div class="stolen-defense-card" aria-hidden="true"><b>DEFENSE</b></div>`:""}<div class="support-alert"></div>`;
  const alert=el.battle.querySelector(".support-alert"),showcase=el.battle.querySelector(".support-showcase"),mouse=el.battle.querySelector(".pantry-mouse"),stolen=el.battle.querySelector(".stolen-defense-card");
  if(pantry){const arenaRect=el.arena.getBoundingClientRect(),from=originCard.getBoundingClientRect(),to=targetCard.getBoundingClientRect(),cardX=ctx.ai===0?from.right-arenaRect.left+10:from.left-arenaRect.left-155,cardY=from.top-arenaRect.top+10,mouseX=ctx.ai===0?cardX+105:cardX+8,mouseY=cardY+90,targetX=ctx.ai===0?to.left-arenaRect.left+18:to.right-arenaRect.left-68,targetY=to.top-arenaRect.top+to.height*.42;showcase.classList.add("anchored");showcase.style.left=`${cardX}px`;showcase.style.top=`${cardY}px`;mouse.style.left=`${mouseX}px`;mouse.style.right="auto";mouse.style.top=`${mouseY}px`;mouse.style.setProperty("--raid-x",`${targetX-mouseX}px`);mouse.style.setProperty("--raid-y",`${targetY-mouseY}px`);stolen.style.left=`${targetX}px`;stolen.style.right="auto";stolen.style.top=`${targetY}px`;stolen.style.setProperty("--return-x",`${mouseX-targetX}px`);stolen.style.setProperty("--return-y",`${mouseY-targetY}px`);}
  let finished=false;const timers=[];const later=(fn,ms)=>timers.push(setTimeout(fn,ms));const finish=()=>{if(finished)return;finished=true;timers.forEach(clearTimeout);originCard.classList.remove("goat-boosting");if(!pantry)originCard.classList.add("goat-boosted");el.battle.classList.add("ending");setTimeout(()=>{el.battle.className="battle-scene hidden";el.battle.innerHTML="";done();},280);};
  el.battle.querySelector(".battle-skip").onclick=finish;requestAnimationFrame(()=>el.battle.classList.add("started"));
  if(pantry){later(()=>el.battle.classList.add("stealing"),650);later(()=>{alert.textContent=ctx.flags?.pantryStolen?"Defense card stolen!":"No Defense card available to steal.";alert.classList.add("shown");},2300);later(finish,3500);}else{later(()=>{originCard.classList.add("goat-boosting");alert.textContent="Basic attack boosted to 2 hearts!";alert.classList.add("shown");},850);later(finish,2850);}
}

function playBattleAnimation(ctx,done){
  const character=animatedCharacters[ctx.attack.id];if(!character){done();return;}
  const direction=ctx.ai===0?"from-left":"from-right",target=cardOfAttack(ctx.di),blocked=ctx.damage===0,defenseEffect=ctx.defense?.effect||"none",partialDefense=ctx.block>0&&ctx.damage>0;
  const losses=[0,1].map(i=>Math.max(0,ctx.snapshot[i].attacks[ctx.snapshot[i].active].hearts-active(i).hearts)),gains=[0,1].map(i=>Math.max(0,ctx.heartRewards[i]-(ctx.animatedHeartRewards[i]||0)));
  el.battle.className=`battle-scene table-effects ${direction} ${character.style} defense-${defenseEffect} ${partialDefense?"partial-defense":"full-defense"}`;
  const projectile=character.style==="gorilla"?`<img class="club-projectile-image" src="assets/effects/gorilla-club.svg?v=1" alt="">`:`<span>♪</span><span>♫</span><span>♪</span>`;
  const lostHearts=losses.flatMap((count,i)=>Array.from({length:count},(_,n)=>`<span class="lost-heart" data-player="${i}" data-order="${n}">♥</span>`)).join(""),gainedHearts=gains.flatMap((count,i)=>Array.from({length:count},(_,n)=>`<span class="gained-heart" data-player="${i}" data-order="${n}">♥</span>`)).join("");
  el.battle.innerHTML=`<button class="battle-skip" type="button">Skip</button>${ctx.support?battleCard(ctx.support,"battle-support"):""}${ctx.defense?`${battleCard(ctx.defense,"battle-defense")}<div class="defense-played-alert">${ctx.defense.name} played!</div>`:""}<div class="battle-projectile" aria-hidden="true">${projectile}</div>${defenseEffect==="wallRuss"?`<div class="wall-barrier" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`:""}${defenseEffect==="flowBackwards"?`<div class="flow-howl" aria-hidden="true"><i></i><i></i><i></i></div>`:""}<div class="heart-effects" aria-hidden="true">${lostHearts}${gainedHearts}</div><div class="battle-impact"></div><div class="battle-outcome"></div>`;
  const zones=[el.opp,el.player],cards=zones.map(z=>z.querySelector(".active-card")),originCard=cards[ctx.ai],targetCard=cards[ctx.di],supportCard=el.battle.querySelector(".battle-support"),defenseCard=el.battle.querySelector(".battle-defense"),projectileEl=el.battle.querySelector(".battle-projectile"),impactEl=el.battle.querySelector(".battle-impact"),outcome=el.battle.querySelector(".battle-outcome");
  const placeEffect=()=>{const arenaRect=el.arena.getBoundingClientRect(),rects=cards.map(c=>c.getBoundingClientRect()),from=rects[ctx.ai],to=rects[ctx.di],startX=ctx.ai===0?from.right-arenaRect.left-12:from.left-arenaRect.left-98,defenseX=ctx.di===1?to.left-arenaRect.left-205:to.right-arenaRect.left+15,targetEndX=ctx.ai===0?to.left-arenaRect.left+18:to.right-arenaRect.left-18,endX=blocked&&defenseCard?(ctx.ai===0?defenseX+15:defenseX+180):targetEndX,startY=from.top-arenaRect.top+from.height*.42,endY=to.top-arenaRect.top+to.height*.42;projectileEl.style.left=`${startX}px`;projectileEl.style.right="auto";projectileEl.style.top=`${startY}px`;projectileEl.style.setProperty("--travel-x",`${endX-startX}px`);projectileEl.style.setProperty("--travel-y",`${endY-startY}px`);impactEl.style.left=`${endX}px`;impactEl.style.top=`${endY}px`;if(supportCard){supportCard.style.left=`${ctx.ai===0?from.right-arenaRect.left+12:from.left-arenaRect.left-142}px`;supportCard.style.right="auto";supportCard.style.top=`${from.top-arenaRect.top+from.height*.08}px`;}if(defenseCard){defenseCard.style.left=`${defenseX}px`;defenseCard.style.right="auto";defenseCard.style.top=`${to.top-arenaRect.top+to.height*.02}px`;defenseCard.style.bottom="auto";}el.battle.querySelectorAll(".lost-heart").forEach(h=>{const r=rects[Number(h.dataset.player)],order=Number(h.dataset.order),x=r.left-arenaRect.left+r.width*.5,y=r.top-arenaRect.top+r.height*.38;h.style.left=`${x}px`;h.style.top=`${y}px`;h.style.animationDelay=`${order*.18}s`;h.style.setProperty("--burst-x",`${(order%3-1)*72}px`);h.style.setProperty("--burst-y",`${-78-order*18}px`);});el.battle.querySelectorAll(".gained-heart").forEach(h=>{const r=rects[Number(h.dataset.player)],order=Number(h.dataset.order),x=r.left-arenaRect.left+r.width*.5,y=r.top-arenaRect.top+r.height*.38;h.style.left=`${arenaRect.width*.5+(order-1)*54}px`;h.style.top="13%";h.style.animationDelay=`${order*.18}s`;h.style.setProperty("--gain-x",`${x-arenaRect.width*.5-(order-1)*54}px`);h.style.setProperty("--gain-y",`${y-arenaRect.height*.13}px`);});};
  gains.forEach((n,i)=>{ctx.animatedHeartRewards[i]=(ctx.animatedHeartRewards[i]||0)+n;});
  let finished=false;const timers=[];const later=(fn,ms)=>timers.push(setTimeout(fn,ms));const finish=()=>{if(finished)return;finished=true;timers.forEach(clearTimeout);originCard.classList.remove("attacking","hit","goat-boosted","goat-boosting","heart-received");targetCard.classList.remove("hit","blocked","defeated","heart-received");defenseCard?.classList.remove("absorbed-hit");el.battle.classList.add("ending");setTimeout(()=>{el.battle.className="battle-scene hidden";el.battle.innerHTML="";done();},280);};
  el.battle.querySelector(".battle-skip").onclick=finish;
  placeEffect();if(ctx.support?.effect==="goatastic")originCard.classList.add("goat-boosted");requestAnimationFrame(()=>el.battle.classList.add("started"));
  later(()=>{gains.forEach((count,i)=>{if(count)cards[i].classList.add("heart-received");});},1050);
  later(()=>{if(supportCard)supportCard.classList.add("presented");},250);
  later(()=>{if(defenseCard){defenseCard.classList.add("presented");el.battle.classList.add("defense-presented");}},900);
  later(()=>{if(["wallRuss","flowBackwards"].includes(defenseEffect))el.battle.classList.add("defense-activated");},1350);
  later(()=>{originCard.classList.add("attacking");el.battle.classList.add(character.style==="kellen"?"projectile-fired":"club-thrown");},1650);
  later(()=>{el.battle.classList.add("impacting");if(losses[ctx.ai])originCard.classList.add("hit");if(blocked){defenseCard?.classList.add("absorbed-hit");targetCard.classList.add("blocked");outcome.textContent=ctx.defense?`${ctx.defense.name} blocks the attack!`:"Attack causes no damage!";}else{targetCard.classList.add(ctx.killed?"defeated":"hit");outcome.textContent=partialDefense?`${ctx.defense.name} blocks 1 heart. ${target.name} still loses ${ctx.damage}!`:`${target.name} loses ${ctx.damage} heart${ctx.damage===1?"":"s"}!`;}outcome.classList.add("shown");},2750);
  later(()=>{if(active(ctx.ai).hearts===0)originCard.classList.add("defeated");},3350);
  later(finish,4700);
}

function chooseKangaroothlessSupport(ctx){const items=ctx.defender.support.map(id=>CARD_BY_ID[id]);showModal(`<h2>Kangaroothless</h2><p>${ctx.defender.name}, choose which Support card to give ${ctx.attacker.name}.</p><div class="card-grid">${items.map(c=>cardButton(c,`data-kangaroo-give="${c.id}"`,true)).join("")}</div>`,false);el.modal.querySelectorAll("[data-kangaroo-give]").forEach(b=>b.onclick=()=>{const i=ctx.defender.support.indexOf(b.dataset.kangarooGive);if(i>=0){const id=ctx.defender.support.splice(i,1)[0];ctx.attacker.support.push(id);recordCardReward(ctx,ctx.ai,"support");}closeModal();completeResolvedAttack(ctx);});}
function completeResolvedAttack(ctx){applyPost(ctx);consumeCards(ctx);handleDefeats(ctx);finishTurn(ctx);}

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

function applyPost(ctx){const e=ctx.support?.effect;if(e==="dragonQueen"&&!ctx.damage)draw("defense",ctx.ai,1,true);if(e==="youreShrewed"&&ctx.killed)heal(ctx.ai,2);if(e==="zebra"&&ctx.damage)heal(ctx.ai,1);if(e==="motherDucker"&&ctx.damage)heal(ctx.ai,99);if(e==="skunkzilla"&&active(ctx.di).hearts<active(ctx.ai).hearts)ctx.extraSupport++;if(e==="stupidThanksgiving"&&ctx.damage)heal(ctx.ai,1);if(e==="stupidThanksgiving"&&ctx.killed)lose(ctx.ai,1);if(e==="combOver"&&!ctx.damage)heal(ctx.ai,1);if(e==="sodaSquirrel"){if(!ctx.damage)heal(ctx.ai,1);else if(ctx.damage===1)lose(ctx.ai,1);}if(e==="trashRaider"&&!ctx.damage)heal(ctx.ai,1);if(ctx.flags?.mongoose&&active(ctx.ai).hearts>0)heal(ctx.ai,99);if(ctx.flags?.dan&&ctx.killed)lose(ctx.ai,1);
  if(ctx.defense?.effect==="barack"){heal(ctx.ai,1);heal(ctx.di,1);}if(ctx.flags?.swapEnd){const t=active(ctx.ai).hearts;active(ctx.ai).hearts=active(ctx.di).hearts;active(ctx.di).hearts=t;}if(ctx.flags?.drawSupport)draw("support",ctx.di,1,true);
}

function consumeCards(ctx){if(ctx.support){const i=ctx.attacker.support.indexOf(ctx.support.id);if(i>=0)ctx.attacker.support.splice(i,1);if(ctx.flags?.stealSupport){ctx.defender.support.push(ctx.support.id);recordCardReward(ctx,ctx.di,"support");}else state.supportDiscard.push(ctx.support.id);}if(ctx.defense){if(ctx.flags?.keepDefense){if(!ctx.defender.defense.includes(ctx.defense.id))ctx.defender.defense.push(ctx.defense.id);}else state.defenseDiscard.push(ctx.defense.id);}if(ctx.support?.effect==="giftHorse"){const id=randomTake(ctx.defender.support);if(id&&ctx.attacker.support.length<3){ctx.attacker.support.push(id);recordCardReward(ctx,ctx.ai,"support");}}if(ctx.support?.effect==="fishStick"&&ctx.defensePlayed)ctx.extraDefense++;}
function handleDefeats(ctx){if(ctx.support?.effect==="eightLives"&&(ctx.damage||active(ctx.ai).hearts<3)){killActive(ctx.ai,true);killActive(ctx.di,true);return;}if(active(ctx.di).hearts<=0){killActive(ctx.di,false);if(ctx.flags?.noBunny&&aliveAttackCount(ctx.di))killActive(ctx.di,false);}if(active(ctx.ai).hearts<=0)killActive(ctx.ai,false);}
function killActive(player,unrevivable){const p=state.players[player],a=active(player);if(a.dead)return;a.dead=true;a.unrevivable=unrevivable;p.deadAttacks.push(a.id);const next=p.attacks.findIndex(x=>!x.dead);if(next>=0){p.active=next;p.attacks[next].hearts=3;p.attacks[next].specialUsed=false;while(p.support.length<2)draw("support",player);while(p.defense.length<2)draw("defense",player);log(`${p.name} sends in ${CARD_BY_ID[p.attacks[next].id].name}.`);}else{state.winner=opponentOf(player);state.phase="over";}}
function reviveAttack(player){const p=state.players[player],a=p.attacks.find(x=>x.dead&&!x.unrevivable);if(a){a.dead=false;a.hearts=3;a.specialUsed=false;p.deadAttacks=p.deadAttacks.filter(id=>id!==a.id);}}
function swapToReserve(player,disable){const p=state.players[player],next=p.attacks.findIndex((a,i)=>i!==p.active&&!a.dead);if(next>=0){p.active=next;if(disable)p.attacks[next].specialDisabled=true;}}
function returnRandomDefense(player){const p=state.players[player],id=randomTake(p.defense);if(id){state.defenseDeck.push(id);state.defenseDeck=shuffle(state.defenseDeck);}}
function swapRandomDefense(a,b){const pa=state.players[a],pb=state.players[b];if(!pa.defense.length||!pb.defense.length)return;const ia=Math.floor(Math.random()*pa.defense.length),ib=Math.floor(Math.random()*pb.defense.length);[pa.defense[ia],pb.defense[ib]]=[pb.defense[ib],pa.defense[ia]];}

function finishTurn(ctx){
  if(ctx.flags?.snail&&ctx.killed)lose(ctx.ai,1);if(ctx.flags?.gator&&ctx.defensePlayed)heal(ctx.ai,1);
  if(!ctx.noDefenseDraw&&ctx.defensePlayed)draw("defense",ctx.di,1);draw("defense",ctx.di,ctx.extraDefense,true);if(ctx.support)draw("support",ctx.ai,1);draw("support",ctx.ai,ctx.extraSupport,true);
  log(`${ctx.attacker.name}'s ${ctx.attack.name} dealt ${ctx.damage} heart${ctx.damage===1?"":"s"}${ctx.defense?` against ${ctx.defense.name}`:""}.`);
  state.phase=state.winner!==null?"over":"result";state.viewer=ctx.ai;render();
  const rewards=[];state.players.forEach((p,i)=>{const hearts=ctx.heartRewards[i],support=ctx.cardRewards[i].support,defense=ctx.cardRewards[i].defense;if(hearts)rewards.push(`<li><b>${p.name}</b> gained ${hearts} heart${hearts===1?"":"s"}.</li>`);if(support)rewards.push(i===ctx.di&&ctx.pantryRaidSupportDraw?`<li class="pantry-reward"><b>${p.name}</b> drew ${support} Support card because a Defense card was played against <b>Pantry Raid</b>.</li>`:`<li><b>${p.name}</b> gained ${support} additional Support card${support===1?"":"s"}.</li>`);if(defense)rewards.push(`<li><b>${p.name}</b> gained ${defense} additional Defense card${defense===1?"":"s"}.</li>`);});
  const rewardSummary=rewards.length?`<div class="result-rewards"><h3>Ability rewards</h3><ul>${rewards.join("")}</ul></div>`:`<div class="result-rewards quiet">No additional hearts or cards were gained.</div>`;
  rewards.forEach(item=>log(item.replace(/<[^>]+>/g,"")));
  const summary=state.winner!==null?`<h2>${state.players[state.winner].name} wins!</h2><p>The arena belongs to ${cardOfAttack(state.winner).name}.</p>${rewardSummary}<div class="modal-actions"><button class="primary" data-new>New game</button></div>`:`<h2>Attack resolved</h2><p>${ctx.attacker.name} dealt <b>${ctx.damage}</b> heart${ctx.damage===1?"":"s"}. ${ctx.defense?`${ctx.defender.name} used ${ctx.defense.name}.`:"No Defense was played."}</p>${rewardSummary}<div class="modal-actions"><button class="primary" data-next>Next turn</button></div>`;
  showModal(summary,false);if(state.winner!==null)el.modal.querySelector("[data-new]").onclick=()=>location.reload();else el.modal.querySelector("[data-next]").onclick=()=>{closeModal();state.turn=opponentOf(state.turn);passTo(state.turn,beginTurn);};
}

function showLog(){showDrawer("Battle history",`<div class="log-list">${state?.log.length?state.log.map(x=>`<div class="log-item">${x}</div>`).join(""):"<p>No attacks yet.</p>"}</div>`);}
function showCatalog(){showDrawer("All 97 cards",`<div class="card-grid">${ALL_CARDS.map(c=>cardButton(c,`data-catalog="${c.id}"`,true)).join("")}</div>`);el.drawer.querySelectorAll("[data-catalog]").forEach(b=>b.onclick=()=>inspectCard(CARD_BY_ID[b.dataset.catalog]));}

el.setupForm.onsubmit=(e)=>{e.preventDefault();startGame([el.p1.value.trim()||"Player 1",el.p2.value.trim()||"Player 2"]);};
el.catalog.onclick=showCatalog;el.support.onclick=openSupport;el.attack.onclick=openAttack;el.defense.onclick=openDefense;el.log.onclick=showLog;el.menu.onclick=()=>{showDrawer("Game menu",`<div class="choice-list"><button data-catalog-menu>View all 97 cards</button><button data-restart>Restart game</button></div>`);$("[data-catalog-menu]").onclick=showCatalog;$("[data-restart]").onclick=()=>location.reload();};

# The HUD

How BUZZ's Wild Ride's in-play readout is built. Source is
`games/src/coaster-run-template.html`; line numbers from commit `85057aa`.

![the HUD in play](hud-ref.webp)

Four things on screen: **identity** (top-left), **level**, **score** (top-right), and **the
token wallet** as a mechanical drum counter. Plus one always-available control, the pause chip.

The organising decision is that **the HUD is DOM, not canvas** — and one other thing on screen
deliberately is not. That split is section 6, and it is the part most worth copying.

---

## 1. It is one 960px layout, scaled bodily

```css
#hud{position:fixed;width:960px;box-sizing:border-box;z-index:20;display:none;
  align-items:flex-start;justify-content:space-between;padding:14px 18px;
  pointer-events:none;transform-origin:top left;}
```
```js
// resize(): HUD is designed at 960px, scaled as ONE
const hud=document.getElementById('hud');
if(hud){hud.style.left=OX+'px';hud.style.top=OY+'px';hud.style.transform=`scale(${S})`;}
```

**Authored once at the design width, then scaled and pinned to the stage's top-left corner.**
Nothing inside it knows about screen pixels — every font-size, gap and padding below is in
design px and gets multiplied by `S`. `transform-origin:top left` is what makes `left/top = OX/OY`
land it exactly on the stage corner rather than somewhere near it.

`justify-content:space-between` on a fixed 960 width does the whole layout: left block pushes
to one edge, right block to the other, no positioning maths.

Two details that matter more than they look:

- **`pointer-events:none`.** The HUD sits at `z-index:20` over the full stage, and the game is
  driven by tapping anywhere. Without this the readout silently eats jumps.
- **`display:none` until the run starts**, flipped to `flex` in `startRun()`. It never shows on
  the title screen.

**Hiding it during transitions is `visibility`, not `display`:**

```js
{const hid=curT>=CONT_SHUT||wipeOutT>=0;
 const hv=$('hud').style.visibility;
 if(hid&&hv!=='hidden')$('hud').style.visibility='hidden';
 else if(!hid&&hv==='hidden')$('hud').style.visibility='';}
```

Because `startRun()` writes `display:flex` on its way past and the two would fight. The HUD is
DOM, so it floats over the shut curtain unless hidden — and while the curtain is down the big
counter on the continue panel is the one doing the talking. Two counters ticking at once defeats
the point of moving the tick there.

---

## 2. The type

```css
#hud .brand{font-family:var(--disp);font-size:20px;letter-spacing:.06em;opacity:.75;}
#lvl{font-family:var(--body);font-weight:700;font-size:13px;
  letter-spacing:.12em;text-transform:uppercase;color:var(--rust);margin-top:3px;}
#score{font-family:var(--disp);font-size:38px;line-height:1;text-align:right;
  color:var(--charcoal);text-shadow:2px 2px 0 var(--mustard);letter-spacing:.04em;}
#records{font-family:var(--body);font-weight:700;font-size:15px;
  letter-spacing:.08em;text-transform:uppercase;text-align:right;
  display:flex;align-items:center;gap:6px;justify-content:flex-end;}
```

**Three sizes, and the hierarchy is size plus face, not colour.** Score is the display face at
38px; the brand is the same face at 20px and 75% opacity so it recedes; everything else is the
body face at 13–15px, uppercase and letterspaced.

**The score's mustard offset shadow is the house grammar** — a hard 2px copy, no blur, the same
second-printing-pass idea as every button and panel. It also does real work: it keeps a charcoal
number legible over a backdrop that changes constantly underneath it.

> **One caveat, honestly.** `#lvl` is `--rust` on `--cream`, which measures **3.37:1** — fine
> for large/UI text, under the 4.5:1 wanted for 13px body text. It is letterspaced small caps so
> it reads better than the number suggests, but it is the weakest text in the HUD. See
> `palette-and-style.md`.

---

## 3. The token wallet is a real drum counter

The most-copied thing here, probably. Four number wheels in a housing — and each wheel is a
**true cylinder**, not a strip that slides.

```js
const ODO_N=4, ODO_H=19, ODO_BIG_H=62, ODO_ASPECT=13/19;

function buildOdo(box,h){
  const R=(h/2)/Math.tan(Math.PI/10), w=Math.round(h*ODO_ASPECT);
  for(let p=ODO_N-1;p>=0;p--){
    /* .ow window → .obl (perspective + blur) → .os (preserve-3d) → ten .od digits */
    bl.style.perspective=Math.round(h*17.9)+'px';
    s.style.transform=`translateZ(${-R}px)`;
    for(let i=0;i<10;i++){
      d.style.transform=`rotateX(${-i*36}deg) translateZ(${R}px)`;
      d.style.fontSize=(h*0.74).toFixed(1)+'px';
    }
  }
}
```

**Ten digits pinned 36° apart around a ring, pushed out to radius `R = (h/2)/tan(π/10)`** — the
radius at which exactly one digit fills the window. Then the browser's own perspective supplies
the foreshortening for free.

**A flat strip sliding vertically reads as a slot machine. The squash toward the edges is the
whole tell**, and you only get it from real 3D.

Three things that had to be right:

- **Perspective scales with the wheel** (`h*17.9`). A fixed perspective on a 5× wheel flattens
  the cylinder back into a sliding strip — the one thing this is not allowed to look like. The
  HUD wheel is 19px and the continue panel's is 62px; both read as the same object.
- **The motion blur goes on the wrapper, not the wheel.** Blurring the wheel softens the
  housing's edges with it, and the housing is metal.
- **Cream drums, charcoal digits, charcoal housing** — the inked variant, not the industrial
  dark one. On the charcoal curtain that earns its keep: a dark housing on a dark curtain had
  almost no separation, and only the lighter wheel faces read as an object at all.

### Carry, which is what makes it look mechanical

```js
const p=ODO_N-1-k, pv=Math.pow(10,p), r=n%pv;
const v = p===0 ? n : Math.floor(n/pv)+(r>=pv-1 ? r-(pv-1) : 0);
```

**A wheel only turns while the wheels below it are rolling past 9.** A real drum counter turns
its hundreds only across 199→200 — one unit — because the tens drives it and the ones drives the
tens.

The first version scaled each wheel to the whole remainder instead, which left the hundreds
visibly half-turned across 190→200, so **195 read as a blur between 1 and 2 when it should be a
clean 1.** The thousands was ten times worse.

### The blur, and the argument it settles

```js
const px=(rate||0)/pv/60*inst.h;
const fl = px>inst.h*0.105 ? `blur(${Math.min(inst.h*0.18,px*0.22).toFixed(2)}px)` : '';
if(fl!==w._fl){w._fl=fl;w.style.filter=fl;}
```

Blur by **how far this wheel travels in one frame**. Past a few pixels the digit cannot be read
and stepping it only strobes. Both the threshold and the cap are expressed in units of the wheel
(`inst.h`), so the big counter smears by the same *fraction of a digit* as the small one instead
of looking sharper.

**`rate` is declared by the caller, never inferred from the frame-to-frame delta**, and this is
the subtle one. Every other write to the counter is a teleport — a coin lands +1, `startRun`
blanks it to 0, `reviveRun` restores the balance. **A delta cannot tell a teleport from a spin**,
so inferring it smeared the wheels on every restart and left them stuck that way.

The value may be **fractional**: the continue tick hands over a real-valued wallet so the wheels
*turn* rather than step.

Note also `if(fl!==w._fl)` — the filter string is cached and only written when it changes.
Same pattern as the text writes:

```js
const sc=score();
if(sc!==scoreShown){scoreShown=sc;$('score').textContent=sc;setTokens(tokens);}
const lt='Level '+level;
if($('lvl').textContent!==lt)$('lvl').textContent=lt;
```

**Never write DOM every frame.** Compare and write on change only.

---

## 4. The pause chip: fixed size, deliberately outside the scaled layout

```css
:root{--chip:26px;}
@media (pointer:coarse){:root{--chip:44px;}}
#pauseBtn{position:fixed;z-index:45;width:var(--chip);height:var(--chip); /* … */}
```

**`position:fixed`, so its size is SCREEN px and never scales with `S`.** That is the entire
point: an earlier row of chips lived in the scaled layout at 15px design px and measured ~10px on
a landscape phone — untappable. Anything a finger has to hit is either fixed-size, or gets its
number from `resize()`.

`@media (pointer:coarse)` takes it to a full 44px on touch, which means it needs no hit-area
pseudo-element at all. The old four-chip row *did* need one, because four 44px targets on a 5px
pitch steal each other's taps.

Pause is the only setting-like control in the corner because it is the only one you need *while
playing*; everything else moved into the manual panel.

The general rule, from `resize()`:

```js
rt.setProperty('--tapMin', (44/S).toFixed(2)+'px');   // 44 REAL px, in panel units
rt.setProperty('--txtUp',  String(Math.max(1,Math.min(TXT_UP_CAP,1/S)).toFixed(3)));
```

`44/S` is the design height that lands on 44 real px. On desktop (`S≥1`) it falls below the
natural button height and is inert — **it only ever grows controls that were actually too small.**

---

## 5. Score is derived, never accumulated

```js
function score(){return Math.floor(distScore)+recPts;}
```

The HUD renders a **function of state**, not a counter it increments. Nothing anywhere does
`score += n`. Distance drives `distScore`, pickups drive `recPts`, and the readout is their sum
floored at paint time — so the display can never drift out of step with the thing it reports, and
a revive or restart just changes the inputs.

---

## 6. What is NOT in the HUD, and why

**The coffee meter lives on canvas**, pinned above the player:

```js
function drawBoostMeter(){
  if(state!=='run'||boostT<=0)return;
  const x=wx2s(buzz.looping?loopX:buzzX()+(buzz.dx||0));
  const yT=Math.max(OY+52*S, wy2s(buzz.y)-158*S);   // above the glow, ducking under the HUD line
  /* … */
}
```

**The split is by what the information is attached to.** Score, level and wallet are facts about
the *run*, so they live in fixed furniture at the edges of the screen. The caffeine timer is a
fact about *the player right now*, so it travels with him and you read it without looking away
from what you are dodging.

The `Math.max(OY+52*S, …)` clamp is the seam between the two systems: the meter follows BUZZ but
**ducks under the HUD line** rather than colliding with the score.

The other consequence of the DOM/canvas split is the one from section 1 — **DOM floats over
everything drawn**, including full-screen curtains and wipes, so anything in DOM needs an explicit
hide during transitions. Canvas elements are simply painted in order and never have this problem.

---

## 7. Port checklist

1. **One fixed-width block at the design width**, `transform-origin:top left`, positioned at the
   stage corner and scaled by `S` from `resize()`.
2. **`pointer-events:none`** on it, always.
3. **`display:none` until the run starts; `visibility` for transient hides**, so the two writes
   cannot fight.
4. **Hierarchy from size and face, not colour.** One display face, one body face, three sizes.
5. **Hard offset shadow on the primary number** so it survives a moving backdrop.
6. **Write on change only** — text and filter strings both.
7. **Derive the score, never accumulate it.**
8. **Anything a finger touches is `position:fixed` at screen px, or gets `44/S` from `resize()`.**
9. **Player-attached information belongs on the canvas with the player**, not in the corner —
   and clamp it out of the HUD's lane.

If you want the drum counter: it is `buildOdo` + `setTokens`, about 60 lines, and its only
dependencies are the two CSS variables for colour. The three things to keep are the **radius
formula**, **perspective scaling with wheel height**, and **carry driven by the wheel below** —
drop any one and it reads as a slot machine.

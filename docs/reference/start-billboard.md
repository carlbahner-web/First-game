# The start screen — a highway billboard

How BUZZ's Wild Ride's title screen is built, so the same screen can be made for another
game. Source is `games/src/coaster-run-template.html`; line numbers are from commit `c918ba9`,
so search for `#start` or `.bbSign` if they have drifted.

![the start billboard](billboard-ref.webp)

**The idea in one line:** the title screen is not a dialog over a game, it is **a roadside
billboard standing in the game's own world**. Everything below serves that — the legs reach
the ground, the floodlights are mounted on it, the maintenance catwalk crosses in front, and
when you press start the whole structure **sinks into the floor** rather than fading out.

---

## 1. Anatomy: five layers, and the z-order is the whole trick

```
#start (.overlay, position:fixed, inset:0, z-index:40)
└─ .panel                      ← positioning box only. Holds the inline transform.
   ├─ svg.bbTopLights   z 0    ← lamp arms + heads, BEHIND the sign
   ├─ div.bbStand       z 0    ← two charcoal legs, BEHIND the sign
   ├─ div.bbSign        z 1    ← OPAQUE teal face. Occludes everything at z 0.
   │  ├─ #coverWrap
   │  │  ├─ #coverArt   ← clipped, rounded: #coverBack + #coverScene
   │  │  ├─ #coverSign  ← the logo oval, OUTSIDE the clip, overhangs top-left
   │  │  ├─ #floatBuzz  ← the animated character, over the art
   │  │  └─ #coverBtns  ← START + HOW TO PLAY, absolute at the bottom
   │  └─ #credit        ← text nameplate on the teal frame
   ├─ svg.bbGlow        z 2    ← the emitted light, IN FRONT, washing down the face
   ├─ svg.bbWalk        z 2    ← catwalk + truss, IN FRONT, straddling the junction
   └─ #creditSign       z 3    ← Carl's marquee sign, in front of the catwalk
```

**Read that again as one rule: the structure is at z 0, the board is at z 1, and the light and
walkway are at z 2.** That is what makes the lamps read as *rising from behind* the board and
the catwalk as *crossing in front of* it. The lamp arms and the leg tops are drawn in full and
simply hidden by an opaque sign face — no clipping, no masking, no matching cut-outs. Get the
z-order wrong and it collapses into flat stickers immediately.

The lights, glow and catwalk all use **the same horizontal geometry** — `left:-7%; width:114%` —
so the fixtures, the beams and the walkway all overhang the face by the same amount and line up
without per-element fiddling.

```css
.bbStand   {position:absolute;left:10%;right:10%;top:100%;height:0;z-index:0;}
.bbTopLights{position:absolute;left:-7%;width:114%;bottom:100%;z-index:0;transform:translateY(24%);}
.bbGlow    {position:absolute;left:-7%;width:114%;bottom:100%;z-index:2;transform:translateY(24%);}
.bbWalk    {position:absolute;left:-7%;width:114%;top:100%;   z-index:2;transform:translateY(-22%);}
```

`top:100%` / `bottom:100%` park each piece just outside the sign, then a percentage
`translateY` pulls it back so it *straddles* the seam. That is why the truss looks bolted on
rather than butted up against an edge.

---

## 2. The panel is a positioning box, not a panel

Every other overlay in the game uses `.panel` — cream fill, charcoal border, hard drop shadow.
The start screen **strips all of it** and re-applies the same treatment to `.bbSign` instead:

```css
#start .panel{background:none;border:none;box-shadow:none;padding:0;overflow:visible;}
.bbSign{background:var(--teal);border:4px solid var(--charcoal);border-radius:16px;
  box-shadow:8px 10px 0 rgba(44,44,42,.85);padding:20px;position:relative;z-index:1;}
```

This matters for a port: **`.panel` keeps owning position and scale, `.bbSign` owns the look.**
Anything hung off `.panel` (legs, lights, catwalk) scales and slides with the sign for free,
without being clipped by it. `overflow:visible` is required or the overhanging pieces vanish.

---

## 3. Scale and the legs — the one bit of real maths

```js
const BILLBOARD_SCALE=0.9;   // the sign renders at 90% of stage scale so the legs have room
```

Every other overlay scales by `S` (the stage's contain-fit factor). The billboard scales by
`S * 0.9`, which buys vertical room for the legs to reach the floor. In `resize()`:

```js
const f=S*BILLBOARD_SCALE;
pn.style.transform='translate(-50%,-50%) scale('+f+')';
if(st&&pn.offsetHeight>0){
  const pr=pn.getBoundingClientRect();                    // sign bottom, post-transform
  st.style.height=Math.max(0,(OY+playH-pr.bottom)/f)+'px'; // stretch legs to the play floor
}
```

**Divide by `f`.** The legs are inside the scaled element, so their height is in panel-local
units; assigning screen pixels there gets multiplied by the scale a second time and they
overshoot the floor by ~11%.

`OY+playH` is the bottom of the **play area**, not the window — so the legs land exactly on the
letterbox edge and never run into the black bar.

### Three ordering traps that cost real time

- **The cover image defines the sign's height**, and therefore the leg length. Layout must
  re-run once it decodes, or the legs are measured against a zero-height sign:
  ```js
  const ci=document.getElementById('coverBack');
  if(ci){ if(ci.complete)resize(); else ci.addEventListener('load',resize); }
  ```
- **Never recompute while it is sliding.** `resize()` writes `#start .panel`'s transform
  directly, so a resize mid-flight snaps it back. The guard is
  `if(sp && !sp.classList.contains('slide'))` — and note the generic
  `.overlay.slide` skip elsewhere does *not* cover this write, because it targets `#start`
  specifically. That gap broke the slide once.
- **Guard on `offsetHeight>0`.** A hidden panel measures zero and the legs collapse.

---

## 4. The exit: it sinks, it does not fade

```js
function slideDownOverlay(id){
  const s=$(id);
  if(getComputedStyle(s).display==='none'){s.classList.remove('slide');return;}
  const pn=s.querySelector('.panel');
  const sc=(id==='start')?S*BILLBOARD_SCALE:S;
  s.classList.add('slide');
  let D=playH+OY+80;
  const lamp=s.querySelector('.bbTopLights');
  if(pn){ const top=(lamp||pn).getBoundingClientRect().top; D=(OY+playH)-top+40; }
  if(pn)pn.style.transform='translateY('+D+'px) translate(-50%,-50%) scale('+sc+')';
  setTimeout(()=>{
    s.style.display='none';s.classList.remove('slide');
    if(pn)pn.style.transform='translate(-50%,-50%) scale('+sc+')';   // restore for a re-show
  },820);
}
```

```css
.overlay.slide{pointer-events:none;}
.overlay.slide .panel{transition:transform .8s cubic-bezier(.5,0,.3,1);}
```

Four details worth copying:

- **The distance is measured from the topmost part — the lamps, not the sign.** A fixed
  distance leaves the lamp heads poking above the letterbox for the last 200 ms.
- **The transition lives on `.slide`, not on `.panel`.** Otherwise every `resize()` and the
  initial load animate too, and the screen visibly slides into place on first paint.
- **Prepend the translate**, don't replace the transform: `resize()` owns the resting
  `translate(-50%,-50%) scale(f)` and the slide rides on top of it.
- **Restore the transform on cleanup** so the overlay can be shown again.

The game is already running behind it, and `#lbMask` — a charcoal bar from the play floor to
the window bottom, `z-index:41`, above the overlay — is what it disappears *into*.

---

## 5. Assets, and the fallback contract

| slot | file | pixels | size | notes |
|---|---|---|---|---|
| `{{COVERBACK}}` | `cover-back.webp` | 1264 × 848 | 31.7 KB | flat paper backing; **defines the sign's size** |
| `{{COVERSCENE}}` | `cover-scene.webp` | 1264 × 848 | 323.8 KB | the scene, transparent sky |
| `{{COVERSIGN}}` | `cover-sign.webp` | 505 × 410 | 61.6 KB | the logo oval |
| `{{CREDITSIGN}}` | `credit-sign.webp` | 1000 × 476 | 73.2 KB | the marquee credit |
| `{{STARTBUZZ}}` | `start-buzz.webp` | 499 × 500 | 66.4 KB | the floating character |

**The cover is split into a backing and a scene on purpose**, both clipped to the rounded
frame, while the logo and the character live *outside* the clip so they can overhang it.

Every slot follows the house contract — **present overrides, absent falls back silently**:

```js
(function(){
  const a=$('creditSign');
  if(!a)return;
  if(a.getAttribute('src'))$('start').classList.add('hasCreditSign');
  else a.remove();
})();
```
```css
#start.hasCreditSign #credit{display:none;}   /* the sign says it; the text stands down */
```

**`a.remove()` is not tidiness — it is required.** An `<img>` with an empty `src` makes the
browser re-request the page.

---

## 6. The motion

**The floating character: three nested transform layers**, because one element can only run one
transform animation. Outer bob, middle squash, and the `<img>` carries the boil filter.

```css
#floatBuzz{position:absolute;left:33.78%;top:4.58%;width:39.5%;
  transform-origin:50% 65%; animation:fbBob 2.6s ease-in-out infinite;}
#floatBuzz .fbSquash{transform-origin:50% 96%;   /* origin at the wheels */
  animation:fbSquash 2.6s ease-in-out infinite;}
```

Both run on **the same 2.6 s clock and the same phase**, so the stretch lands on the launch.
The keyframes are a launch rhythm, not a sine: crouch at 10%, fast pop to apex at 32%, hang at
46%, ease down. Squash `scale(1.05,.93)` on the crouch, stretch `scale(.955,1.06)` through the
pop — origin at the wheels so he grows *upward*.

**The floodlight glow** is a 3.4 s opacity pulse between .62 and 1, on soft-edged gradient
polygons (`feGaussianBlur stdDeviation="6"` — a beam with a clean edge reads as a shape, not
light).

**Everything honours reduced motion:**
```css
@media (prefers-reduced-motion:reduce){
  #floatBuzz,#floatBuzz .fbSquash{animation:none;}
  .bbGlow{animation:none;}}
```

---

## 7. The boil, on DOM elements

Canvas linework boils by redrawing. **DOM and SVG can't do that, so they use
`feTurbulence` + `feDisplacementMap` and the render loop drives the seed:**

```html
<filter id="signBoil" x="-8%" y="-8%" width="116%" height="116%">
  <feTurbulence id="signBoilTurb" type="fractalNoise" baseFrequency="0.013" numOctaves="1" seed="2" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0.3 0 0 0 0.35  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="nb"/>
  <feDisplacementMap in="SourceGraphic" in2="nb" scale="2.7" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```
```js
const BTN_BOIL_SEED=[2,9,15];
if(boilTurbStart){const bf=boil();if(bf!==lastBtnBoil){lastBtnBoil=bf;
  signBoilTurb.setAttribute('seed',BTN_BOIL_SEED[bf]);
  floatBoilTurb.setAttribute('seed',BTN_BOIL_SEED[bf]);
  creditBoilTurb.setAttribute('seed',BTN_BOIL_SEED[bf]);
  /* …every other inked surface, same flip */ }}
```

- **SMIL cannot drive the seed reliably** — the render loop must do it. That also keeps the
  title screen in lockstep with the rails behind it.
- **Three seeds, re-rolled only when `boil()` flips** (~8 fps), never per frame.
- **Every new inked surface must be added to that list or it ships as a still frame** — a dead
  giveaway sitting beside everything that moves.
- **Filter order matters.** `#coverSign` runs the boil first, *then* four hard 1.4px charcoal
  drop-shadows as a keyline, then a soft depth shadow. The keyline exists because the oval's
  own outer edge is cream and would dissolve into the cream sky.
- **The credit sign deliberately has no keyline** — its outer edge is already charcoal, so the
  stroke only added a muddy fringe and the displacement smeared it.
- **The two buttons hand the boil to each other**: START boils by default, HOW TO PLAY only
  while hovered, and START freezes while it does.

---

## 8. Small decisions that carry the fiction

- **The credit is a nameplate riveted to the frame**, in the 20 px of teal padding around the
  art — the only empty real estate the board has. It is **never boiled**: it is a label, and
  labels stay legible. Two other placements were tried and rejected: over the art's
  bottom-right (lands on the explosion smoke), and stencilled on the catwalk deck (the most
  authentic idea, and it simply does not fit — the deck band is ~10 design px tall and the
  railing posts cross straight through the text).
- **The marquee sign is tilted 5° and overhangs bottom-right**, mirroring the logo oval's
  top-left overhang: two boards mounted proud of the face on a diagonal, the credit smaller
  because it is subordinate. **Rotation widens the footprint** — at 34% wide a 5° turn drops
  the left end ~9 design px, so clearances must be measured against the *rotated* bounds.
- **It sits on the board face, clear above the walkway, not overhanging into it.** It was hung
  over the catwalk first and that was wrong: a marquee is bolted to the sign it advertises, not
  to a maintenance gangway.
- **The legs splay.** `skewX(3deg)` / `skewX(-3deg)` with `transform-origin:top` — dead-vertical
  posts read as a diagram.
- **The lamp heads point down and carry a mustard lens on the underside**, so the fixture reads
  as a fixture even before the beam is drawn.
- **Framing clouds are pinned into the sky beside the board while `state==='menu'`.** The
  drifting cloud field is phase-random at load, so the space either side of the billboard was
  sometimes bare. Four pinned clouds, each with its own slow sway so they never read frozen.

---

## 9. Starting the game

```js
function startRun(startLevel){
  audioPoke();   // starting is always a user gesture — unlock sound here too
  oilPrime();    // …and the one chance iOS gives us to start fetching video
  /* … */
  slideDownOverlay('start'); slideDownOverlay('gameover');
  $('hud').style.display='flex';
  state='run';
}
$('startBtn').addEventListener('click',startRun);
```

**The start button is the audio unlock, and it is not optional.** Browsers refuse to start an
`AudioContext` without a real gesture, and iOS ignores `preload` entirely — so anything that
needs decoded media must be primed here. Miss it and sound works in every desktop test and
fails silently on a phone.

---

## 10. Port checklist

1. **`.overlay` fixed inset 0 → `.panel` as a bare positioning box → your sign div at z 1.**
   Structure at z 0, light and walkway at z 2.
2. **One scale constant** (`0.9`) and one `resize()` block that writes the panel transform and
   derives the leg height by dividing by that same factor.
3. **Re-run layout on the cover image's `load`**, and guard every write with
   `!classList.contains('slide')` and `offsetHeight>0`.
4. **A letterbox mask above the overlay** for it to sink into.
5. **Measure the slide distance from the topmost element**, put the transition on `.slide`,
   prepend the translate, restore it on cleanup.
6. Every art slot gets **present-overrides / absent-falls-back**, and absent means `.remove()`.
7. If you want the boil: one `<filter>` per surface, three seeds, re-seeded from the render
   loop only when the boil phase flips — and **add every new surface to that list.**
8. `@media (prefers-reduced-motion:reduce)` on every animation.
9. **The start button unlocks audio and primes media.**

The theme is transferable even if the billboard is not: **pick a real object from the game's
world that a title could plausibly be printed on, then build it as layers with the sign face
occluding its own structure.** A cinema marquee, an arcade cabinet bezel, a pinball backglass —
the z-order rule and the scale/leg maths are the same in all of them.

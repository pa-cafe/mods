



import { blastMeters, blastTokens, type BlastHit, type BlastKind, type BlastLook, type BlastRun } from '../rules.ts';
import type { TextKey } from './i18n.ts';
import { atlasLook, canvas, cheerBody, cheerReady, CREAM, cutinReady, divineReady, drawPose, figureReady, houseFont, INK, loadAtlas, MONO, poseBox } from './art';
import type { CardLook } from './card-look';
import { wordCard } from './cards';
import { hitCopy, nodeOf } from './nodes';
import { flatStreet } from './graphics';
import { formatTokens } from './numbers';
import { blastFace, blastPicture } from './pictures';
import { placeAt } from './places';
import { sceneAt, scenes } from './scenes';

type Words = (key: TextKey, values?: Record<string, string | number>) => string;
const W = 1600, H = 900, GOLD = '#FFC83D';

const DIVINE_FROM = scenes[scenes.length - 2].from;
const ACROSS = 5;

const SIGHT_FRAME = { left: 600, top: 50, right: 1040, bottom: 560 };

const FIGURE_TALL = 700, FIGURE_X = 0.28;
/** A lying figure is wider than tall; it is kept this wide at most, so it stays on the right of the card, clear of the numbers. */
const LYING_WIDE = 600;

/**
 * Where the chibi card changes pose, in metres (`blastMeters`). From 5,400 runs each of three simulated players (one who
 * plays carefully, one who taps at random, one who launches and never taps; tools/pilots.ts' players over seeds 1 to 600,
 * every resident and the barista as pilot): a run under 50 m is a crash at the launch or a launch nobody played (none of the
 * careful runs, 30% of the random ones, 69% of the idle ones); 1,000 m is a little under the median of the careful (2,160)
 * and the random (1,640) and leaves 18%, 13% and 26% of them in the middle band. The divine realm opens at 1e11 tokens,
 * about 3,580 m, as `scenes` has it.
 */
export const cardPoseAt = { short: 50, middle: 1000 } as const;
/** `lie`: flat on the ground, a little sheepish. `thumb`: standing, thumb up. `cheer`: both arms up, in her robe in the divine realm. */
export type CardPose = 'lie' | 'thumb' | 'cheer';
export const cardPoseFor = (meters: number, robed: boolean): CardPose => robed || meters >= cardPoseAt.middle ? 'cheer' : meters >= cardPoseAt.short ? 'thumb' : 'lie';

/**
 * Who stands on a chibi bill, in what pose. The one who boosted most, as before; with nobody hit, the run's own lead:
 * the resident who flew it, or else the barista, whose look the page passes in `barista`. Null when there is nobody to
 * draw, which is a run flown by a barista whose look the page did not say.
 */
export type CardFigure = { look: BlastLook; hit: BlastHit | null; robed: boolean; pose: CardPose };
export function cardFigure(run: BlastRun, barista: BlastLook | null = null): CardFigure | null {
  const hit = bestBoost(run), look = hit ? hit.as as BlastLook : run.pilot ?? barista;
  if (!look) return null;
  const robed = blastTokens(hit ? hit.x : run.x) >= DIVINE_FROM;
  return { look, hit, robed, pose: cardPoseFor(blastMeters(run), robed) };
}


export function bestBoost(run: Pick<BlastRun, 'hits'>): BlastHit | null {
  const boosts = run.hits.filter(hit => hit.outcome === 'boost' && hit.as !== 'window');
  if (boosts.length) return boosts.reduce((best, hit) => hit.x > best.x ? hit : best);
  const residents = run.hits.filter(hit => hit.as !== 'window');
  if (!residents.length) return null;
  const counts = new Map<BlastKind, number>();
  for (const hit of residents) counts.set(hit.as, (counts.get(hit.as) ?? 0) + 1);
  const most = Math.max(...counts.values());
  return residents.find(hit => counts.get(hit.as) === most) ?? null;
}


const hitCounts = (run: Pick<BlastRun, 'hits'>) => {
  const counts = new Map<BlastKind, number>();
  for (const hit of run.hits) counts.set(hit.kind, (counts.get(hit.kind) ?? 0) + 1);
  return [...counts].sort(([a, x], [b, y]) => Number(a === 'window') - Number(b === 'window') || y - x);
};

export type ShareCardFacts = {
  run: BlastRun;
  /** The cafe the run was played at, and who flew. */
  cafe: string; pilot: string;
  /** The address the card shows at its foot: short, for reading, not for clicking. */
  address: string;
  /** How the boosting resident is drawn: her cut-in picture, or her small figure from the street. */
  look?: CardLook;
  /** The look the barista flies in, for a run nobody was hit in and no resident flew: she is the one drawn on the chibi bill. Without it that bill has no figure. */
  barista?: BlastLook;
};


async function backdrop(x: number) {
  if (flatStreet()) return null;
  const { Street3d } = await import('./street3d');
  return Street3d.postcard(x, W, H, SIGHT_FRAME);
}

/** The card as a PNG. It waits for the street, the cut-in picture and the residents' sheet, for at most a few seconds, and draws without them after that. */
export async function shareCard(facts: ShareCardFacts, words: Words): Promise<Blob | null> {
  const best = bestBoost(facts.run), chibi = facts.look === 'chibi', star = chibi ? cardFigure(facts.run, facts.barista ?? null) : null;
  const robed = star ? star.robed : best ? blastTokens(best.x) >= DIVINE_FROM : false, pose = star?.pose, starLook = star ? atlasLook[star.look] : null;
  const wait = <T>(promise: Promise<T>, ms = 4000) => Promise.race([promise.catch(() => null), new Promise<null>(done => setTimeout(() => done(null), ms))]);
  const [atlas, cutin, street, divine, cheer, extra] = await Promise.all([
    wait(loadAtlas()), best && !chibi ? wait(cutinReady(atlasLook[best.as as BlastLook], robed)) : null, wait(backdrop(facts.run.x), 8000),
    starLook && robed ? wait(divineReady()) : null, starLook && pose === 'cheer' ? wait(cheerReady(starLook, robed)) : null,
    starLook && pose && pose !== 'cheer' ? wait(figureReady(starLook, pose)) : null,
  ]);
  const image = canvas(W, H), ctx = image.getContext('2d')!, font = houseFont();
  const text = (value: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = 900, family = font, max = W - 120) => {
    ctx.font = `${weight} ${size}px ${family}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y, max);
  };


  const place = scenes[Math.max(0, sceneAt(blastTokens(facts.run.x)))];
  if (street) {

    ctx.save(); ctx.filter = 'blur(3px) saturate(.85)'; ctx.drawImage(street, -12, -12, W + 24, H + 24); ctx.restore();
    ctx.fillStyle = 'rgba(27,16,54,.38)'; ctx.fillRect(0, 0, W, H);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    place.sky.forEach((color, at) => sky.addColorStop(at / Math.max(1, place.sky.length - 1), color));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  }

  const shade = ctx.createLinearGradient(0, 0, 760, 0);
  shade.addColorStop(0, 'rgba(27,16,54,.92)'); shade.addColorStop(0.62, 'rgba(27,16,54,.72)'); shade.addColorStop(1, 'rgba(27,16,54,0)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, 760, H);
  const foot = ctx.createLinearGradient(0, H - 260, 0, H);
  foot.addColorStop(0, 'rgba(27,16,54,0)'); foot.addColorStop(1, 'rgba(27,16,54,.7)');
  ctx.fillStyle = foot; ctx.fillRect(0, H - 260, W, 260);


  ctx.save(); ctx.shadowColor = 'rgba(15,10,36,.9)'; ctx.shadowBlur = 14;
  const title = wordCard('BARISTA BLAST!!', 58, 1, 'gold', -4);
  ctx.drawImage(title.image, 48, 30);
  text(words('{cafe} / {pilot}', { cafe: facts.cafe, pilot: facts.pilot }), 60, 54 + title.height, 32, CREAM, 'left', 900, font, 600);


  text(words('{meters} m', { meters: blastMeters(facts.run).toFixed(1) }), 56, 270, 112, CREAM, 'left', 900, MONO, 640);
  text(`${formatTokens(blastTokens(facts.run.x))} ${words('TOKENS')}`, 60, 360, 50, GOLD, 'left', 900, MONO, 600);

  const reached = placeAt(facts.run.x);
  text(words('Reached: {place} (area {area})', { place: words(reached.name), area: reached.area }), 60, 414, 30, CREAM, 'left', 800, font, 640);
  ctx.restore();


  const hits = hitCounts(facts.run).slice(0, ACROSS * 2);
  if (hits.length) {
    text(words('Who got hit'), 60, 462, 28, '#E9C9A2', 'left', 800);
    const r = 34, step = 144;
    hits.forEach(([kind, count], index) => {
      const cx = 60 + r + (index % ACROSS) * step, cy = 518 + Math.floor(index / ACROSS) * (r * 2 + 12);
      const face = atlas ? blastFace(kind, r * 2, 1, atlas) : null, picture = face ?? (atlas || kind === 'window' ? blastPicture(kind, r * 2 - 8, 1, atlas, words) : null);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = kind === 'window' ? '#CFEFDC' : '#EFE6D2'; ctx.fill();
      if (picture) { ctx.save(); ctx.clip(); ctx.drawImage(picture, cx - picture.width / 2, cy - picture.height / 2); ctx.restore(); }
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      text(`×${count}`, cx + r + 6, cy + 3, 28, CREAM, 'left', 800, MONO, 70);
    });
  }


  const middle = 700, band = 150;
  ctx.save(); ctx.translate(W / 2, middle); ctx.rotate(-0.04);
  ctx.fillStyle = 'rgba(38,63,53,.94)'; ctx.fillRect(-W, -band / 2, W * 2, band);
  ctx.fillStyle = GOLD; ctx.fillRect(-W, -band / 2 - 7, W * 2, 7);
  const right = W * FIGURE_X;
  if (starLook && atlas) {

    const look = starLook, tall = FIGURE_TALL, scale = tall / poseBox(look, 'cheer', 1, robed && divine !== null).height;
    ctx.save(); ctx.shadowColor = 'rgba(15,10,36,.55)'; ctx.shadowBlur = 18;

    if (extra) {
      // Her body as tall as the victory pose stands her, whichever pose; lying, she is held to LYING_WIDE.
      const k = Math.min(cheerBody(look, tall) / extra.body, pose === 'lie' ? LYING_WIDE / extra.image.naturalWidth : Infinity);
      ctx.drawImage(extra.image, right - extra.image.naturalWidth * k / 2, band / 2 - extra.image.naturalHeight * k, extra.image.naturalWidth * k, extra.image.naturalHeight * k);
    } else if (cheer) { const box = poseBox(look, 'cheer', scale, robed && divine !== null); ctx.drawImage(cheer, right - box.width / 2, band / 2 - box.height, box.width, box.height); }
    else drawPose(ctx, atlas, look, 'cheer', right, band / 2, scale, true, robed ? divine : null);
    ctx.restore();
  } else if (cutin) {
    const high = FIGURE_TALL, across = high * cutin.naturalWidth / cutin.naturalHeight;
    ctx.save(); ctx.beginPath(); ctx.rect(-W, -H, W * 2, H + band / 2); ctx.clip();
    ctx.drawImage(cutin, right - across / 2, band / 2 + 2 - high, across, high);
    ctx.restore();
  } else if (best && atlas) {
    const picture = blastPicture(best.as, 480, 1, atlas, words);
    if (picture) ctx.drawImage(picture, right - 240, band / 2 - 480);
  }
  ctx.fillStyle = GOLD; ctx.fillRect(-W, band / 2, W * 2, 7);
  if (best) {
    const said = hitCopy(best), card = wordCard(words(said.card), 54, 1, 'gold', -4);
    const left = -W / 2 + 60, fit = Math.min(1, 560 / card.width);
    ctx.drawImage(card.image, left, -band * 0.56, card.width * fit, card.height * fit);
    text(words(nodeOf(best.as).name), left + 8, band * 0.2, 34, CREAM, 'left', 800, font, 560);
  } else if (star) text(facts.pilot, -W / 2 + 68, 0, 56, CREAM, 'left', 900, font, 560);
  ctx.restore();


  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.roundRect(48, H - 104, W - 96, 72, 36); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  text(words('Watch this run, then try to beat it'), 90, H - 68, 30, INK, 'left', 900, font, 820);
  text(facts.address, W - 90, H - 68, 30, INK, 'right', 700, MONO, 560);
  return new Promise(done => image.toBlob(blob => done(blob), 'image/png'));
}

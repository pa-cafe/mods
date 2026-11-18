import type { BlastHit } from '../rules.ts';

type Move = 'help' | 'hurt';
/** What the street keeps for each resident hit: when, in game milliseconds, whether it was her boost, and her move. */
export type Reaction = { at: number; boost: boolean; pose?: Move };

const REACT_SECONDS = 1.1;
const BOOST_HELP_SECONDS = 0.55, BOOST_CHEER_SECONDS = 1.4;

/**
 * The move for an ordinary hit. A state that helps (a kick, a cup, a combo's two halves) is `help`; one that hurts, and
 * one that does nothing much, is `hurt`: she gave the run nothing, and her look says so. A hurt the shield stopped is
 * still her trying. One still waiting on a tap stands until the tap decides it. Who she acted as after a made-up
 * answer decides it too, since that is the trick the run felt.
 */
export function moveFor(hit: Pick<BlastHit, 'as' | 'mood' | 'combo'>, landed: boolean): Move | undefined {
  if (!landed || hit.as === 'window') return undefined;
  return hit.combo || hit.mood === 'one' || hit.mood === 'two' ? 'help' : 'hurt';
}

/** The pose a resident stands in `since` game seconds after `reaction`, or standing when she has none. */
export function poseAfter(reaction: Reaction | undefined, since: number): Move | 'cheer' | 'stand' {
  if (!reaction) return 'stand';
  if (reaction.boost) return since < BOOST_HELP_SECONDS ? 'help' : since < BOOST_CHEER_SECONDS ? 'cheer' : 'stand';
  return reaction.pose && since < REACT_SECONDS ? reaction.pose : 'stand';
}

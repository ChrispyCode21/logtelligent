// The built-in exercise bank (SPEC §9.1, slice 2). Pure data: picking an exercise copies its
// defaults into a normal program exercise, and nothing links back here.
import type { EquipmentType, RepRange, Tier } from '../engine'

export type BodyArea = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core'

/** Display order and labels. A grouping for browsing, not a muscle-group model (SPEC §11). */
export const BODY_AREAS: { id: BodyArea; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
]

export interface BankExercise {
  /** Stable slug, unique within the bank. */
  id: string
  name: string
  area: BodyArea
  tier: Tier
  equipment: EquipmentType
  sets: number
  repRange: RepRange
  unilateral: boolean
  /** Placeholder for the seed prompt's weight (lb; per hand for dumbbells, added for bodyweight). */
  seedPlaceholder: number
  description: string
  /** Common nicknames search also matches. */
  aliases: string[]
}

interface Options {
  aliases?: string[]
  unilateral?: boolean
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function ex(
  area: BodyArea,
  name: string,
  equipment: EquipmentType,
  tier: Tier,
  sets: number,
  [min, max]: [number, number],
  seedPlaceholder: number,
  description: string,
  { aliases = [], unilateral = false }: Options = {},
): BankExercise {
  const repRange = { min, max }
  return {
    id: slug(name),
    name,
    area,
    tier,
    equipment,
    sets,
    repRange,
    unilateral,
    seedPlaceholder,
    description,
    aliases,
  }
}

// prettier-ignore
export const BANK: BankExercise[] = [
  // Chest
  ex('chest', 'Bench Press', 'barbell', 'primary', 3, [5, 7], 95, 'Lie on a flat bench and press the bar from your chest to straight arms.', { aliases: ['bench', 'flat bench', 'barbell bench'] }),
  ex('chest', 'Incline Bench Press', 'barbell', 'primary', 3, [6, 8], 75, 'Bench press on a bench inclined about 30°, working the upper chest.', { aliases: ['incline bench', 'incline press'] }),
  ex('chest', 'Dumbbell Bench Press', 'dumbbell', 'accessory', 3, [8, 12], 30, 'Press a pair of dumbbells up from your chest on a flat bench.', { aliases: ['db bench', 'dumbbell press'] }),
  ex('chest', 'Incline Dumbbell Press', 'dumbbell', 'accessory', 3, [8, 12], 25, 'Press dumbbells up on an inclined bench, for the upper chest.', { aliases: ['incline db press', 'incline press'] }),
  ex('chest', 'Machine Chest Press', 'machine', 'accessory', 3, [8, 12], 70, 'Seated press on a machine; a stable way to load the chest.', { aliases: ['chest press'] }),
  ex('chest', 'Cable Fly', 'cable', 'accessory', 3, [12, 15], 15, 'Bring two cable handles together in front of your chest with slightly bent arms.', { aliases: ['cable crossover', 'pec fly', 'chest fly'] }),
  ex('chest', 'Dumbbell Fly', 'dumbbell', 'accessory', 3, [12, 15], 15, 'Lying on a bench, open your arms wide with dumbbells and bring them back together.', { aliases: ['db fly', 'flyes', 'chest fly'] }),
  ex('chest', 'Push-Up', 'bodyweight', 'accessory', 3, [8, 15], 0, 'From a plank, lower your chest to the floor and push back up.', { aliases: ['pushup', 'press-up'] }),
  ex('chest', 'Dip', 'bodyweight', 'accessory', 3, [6, 10], 0, 'Lower yourself between parallel bars until your shoulders are below your elbows, then press up.', { aliases: ['dips', 'chest dip', 'parallel bar dip'] }),

  // Back
  ex('back', 'Deadlift', 'barbell', 'primary', 3, [3, 5], 135, 'Lift the bar from the floor to standing, keeping your back flat.', { aliases: ['conventional deadlift', 'dl'] }),
  ex('back', 'Barbell Row', 'barbell', 'primary', 3, [6, 8], 75, 'Hinge forward and row the bar to your lower ribs.', { aliases: ['bent-over row', 'bb row', 'bent over row'] }),
  ex('back', 'Pull-Up', 'bodyweight', 'accessory', 3, [5, 10], 0, 'Hang from a bar with an overhand grip and pull your chin over it.', { aliases: ['pullup', 'pull ups'] }),
  ex('back', 'Chin-Up', 'bodyweight', 'accessory', 3, [5, 10], 0, 'A pull-up with palms facing you, which brings in more biceps.', { aliases: ['chinup', 'chin ups'] }),
  ex('back', 'Lat Pulldown', 'cable', 'accessory', 3, [8, 12], 70, 'Seated, pull a wide bar down to your upper chest.', { aliases: ['pulldown', 'lat pull down'] }),
  ex('back', 'Seated Cable Row', 'cable', 'accessory', 3, [8, 12], 70, 'Seated, pull a cable handle to your stomach, squeezing your shoulder blades together.', { aliases: ['cable row', 'low row'] }),
  ex('back', 'One-Arm Dumbbell Row', 'dumbbell', 'accessory', 3, [8, 12], 35, 'One hand and knee on a bench, row a dumbbell to your hip.', { aliases: ['db row', 'dumbbell row', 'single-arm row'], unilateral: true }),
  ex('back', 'Chest-Supported Row', 'machine', 'accessory', 3, [8, 12], 70, 'Chest against a pad, row the handles back; keeps the lower back out of it.', { aliases: ['machine row', 'supported row'] }),
  ex('back', 'Face Pull', 'cable', 'accessory', 3, [12, 15], 25, 'Pull a rope toward your face with elbows high, for the rear shoulders and upper back.', { aliases: ['rope face pull'] }),
  ex('back', 'Straight-Arm Pulldown', 'cable', 'accessory', 3, [12, 15], 25, 'Standing, sweep a bar or rope down to your thighs with straight arms.', { aliases: ['straight arm pushdown', 'lat pushdown'] }),
  ex('back', 'Back Extension', 'bodyweight', 'accessory', 3, [10, 15], 0, 'On a back-extension bench, lower your torso and raise it until your body is straight.', { aliases: ['hyperextension', 'back raise'] }),

  // Shoulders
  ex('shoulders', 'Overhead Press', 'barbell', 'primary', 3, [5, 7], 65, 'Standing, press the bar from your shoulders to overhead.', { aliases: ['ohp', 'military press', 'standing press', 'shoulder press'] }),
  ex('shoulders', 'Dumbbell Shoulder Press', 'dumbbell', 'accessory', 3, [8, 12], 25, 'Seated or standing, press dumbbells from your shoulders to overhead.', { aliases: ['db shoulder press', 'seated dumbbell press', 'shoulder press'] }),
  ex('shoulders', 'Machine Shoulder Press', 'machine', 'accessory', 3, [8, 12], 50, 'Seated overhead press on a machine.', { aliases: ['shoulder press'] }),
  ex('shoulders', 'Lateral Raise', 'dumbbell', 'accessory', 3, [12, 15], 10, 'Raise dumbbells out to your sides to shoulder height, for the side delts.', { aliases: ['side raise', 'side lateral raise', 'lat raise'] }),
  ex('shoulders', 'Cable Lateral Raise', 'cable', 'accessory', 3, [12, 15], 10, 'One arm at a time, raise a low cable handle out to your side.', { aliases: ['cable side raise'], unilateral: true }),
  ex('shoulders', 'Rear Delt Fly', 'dumbbell', 'accessory', 3, [12, 15], 10, 'Bent forward, raise dumbbells out to your sides, for the back of the shoulders.', { aliases: ['reverse fly', 'bent-over fly', 'rear fly'] }),
  ex('shoulders', 'Reverse Pec Deck', 'machine', 'accessory', 3, [12, 15], 40, 'Facing the pec deck, sweep the handles back with straight arms.', { aliases: ['rear delt machine', 'reverse fly machine'] }),
  ex('shoulders', 'Dumbbell Shrug', 'dumbbell', 'accessory', 3, [10, 15], 40, 'Holding dumbbells at your sides, lift your shoulders toward your ears.', { aliases: ['shrug', 'shrugs', 'traps'] }),

  // Arms
  ex('arms', 'Barbell Curl', 'barbell', 'accessory', 3, [8, 12], 45, 'Standing, curl the bar from your thighs to your shoulders.', { aliases: ['bb curl', 'bicep curl', 'biceps curl'] }),
  ex('arms', 'Dumbbell Curl', 'dumbbell', 'accessory', 3, [8, 12], 20, 'Curl dumbbells from your sides to your shoulders, palms up.', { aliases: ['db curl', 'bicep curl', 'biceps curl'] }),
  ex('arms', 'Hammer Curl', 'dumbbell', 'accessory', 3, [8, 12], 20, 'A dumbbell curl with palms facing each other, for the biceps and forearms.', { aliases: ['neutral grip curl'] }),
  ex('arms', 'Incline Dumbbell Curl', 'dumbbell', 'accessory', 3, [10, 15], 15, 'Curl dumbbells while leaning back on an inclined bench, stretching the biceps.', { aliases: ['incline curl'] }),
  ex('arms', 'Cable Curl', 'cable', 'accessory', 3, [10, 15], 30, 'Curl a bar or rope attached to a low cable.', { aliases: ['bicep curl', 'biceps curl'] }),
  ex('arms', 'Preacher Curl', 'machine', 'accessory', 3, [8, 12], 40, 'Curl with your upper arms resting on an angled pad.', { aliases: ['scott curl', 'preacher curl machine'] }),
  ex('arms', 'Triceps Pushdown', 'cable', 'accessory', 3, [10, 15], 40, 'Push a bar or rope down from chest height until your arms are straight.', { aliases: ['tricep pushdown', 'rope pushdown', 'pressdown'] }),
  ex('arms', 'Overhead Triceps Extension', 'cable', 'accessory', 3, [10, 15], 30, 'Facing away from a cable, extend a rope from behind your head to overhead.', { aliases: ['overhead extension', 'tricep extension', 'triceps extension'] }),
  ex('arms', 'Skull Crusher', 'barbell', 'accessory', 3, [8, 12], 45, 'Lying on a bench, lower the bar toward your forehead by bending only at the elbows, then extend.', { aliases: ['lying triceps extension', 'skullcrusher', 'tricep extension'] }),
  ex('arms', 'Close-Grip Bench Press', 'barbell', 'accessory', 3, [6, 10], 85, 'Bench press with hands about shoulder-width apart, for the triceps.', { aliases: ['cgbp', 'close grip bench'] }),

  // Legs
  ex('legs', 'Back Squat', 'barbell', 'primary', 3, [5, 7], 95, 'With the bar on your upper back, squat until your thighs are at least parallel, then stand.', { aliases: ['squat', 'barbell squat'] }),
  ex('legs', 'Front Squat', 'barbell', 'primary', 3, [5, 7], 75, 'Squat with the bar resting on the front of your shoulders; more upright, more quads.', { aliases: ['squat'] }),
  ex('legs', 'Romanian Deadlift', 'barbell', 'primary', 3, [6, 8], 95, 'With soft knees, hinge at the hips to lower the bar along your legs, then stand; for the hamstrings.', { aliases: ['rdl', 'stiff-leg deadlift', 'stiff leg deadlift'] }),
  ex('legs', 'Leg Press', 'machine', 'accessory', 3, [8, 12], 140, 'Seated in the machine, press the platform away with your feet.', { aliases: ['sled press'] }),
  ex('legs', 'Hack Squat', 'machine', 'accessory', 3, [8, 12], 90, 'Squat on a hack squat machine, back against the pad.', { aliases: ['machine squat'] }),
  ex('legs', 'Bulgarian Split Squat', 'dumbbell', 'accessory', 3, [8, 12], 20, 'Rear foot on a bench, lower into a lunge on the front leg; one leg at a time.', { aliases: ['bss', 'split squat', 'rear-foot-elevated split squat'], unilateral: true }),
  ex('legs', 'Walking Lunge', 'dumbbell', 'accessory', 3, [10, 12], 20, 'Holding dumbbells, step forward into a lunge, alternating legs as you walk.', { aliases: ['lunge', 'lunges', 'dumbbell lunge'], unilateral: true }),
  ex('legs', 'Goblet Squat', 'dumbbell', 'accessory', 3, [8, 12], 35, 'Hold one dumbbell at your chest and squat; a good way to learn the squat.', { aliases: ['dumbbell squat'] }),
  ex('legs', 'Hip Thrust', 'barbell', 'accessory', 3, [8, 12], 95, 'Upper back on a bench and the bar across your hips, drive your hips up.', { aliases: ['barbell hip thrust', 'glute bridge'] }),
  ex('legs', 'Leg Extension', 'machine', 'accessory', 3, [10, 15], 50, 'Seated, straighten your knees against the pad, for the quads.', { aliases: ['quad extension'] }),
  ex('legs', 'Lying Leg Curl', 'machine', 'accessory', 3, [10, 15], 50, 'Face down on the machine, curl the pad toward your glutes, for the hamstrings.', { aliases: ['leg curl', 'hamstring curl'] }),
  ex('legs', 'Seated Leg Curl', 'machine', 'accessory', 3, [10, 15], 50, 'Seated, curl the pad down and under, for the hamstrings.', { aliases: ['leg curl', 'hamstring curl'] }),
  ex('legs', 'Standing Calf Raise', 'machine', 'accessory', 3, [10, 15], 90, 'Rise onto your toes under the machine’s pads, then lower slowly.', { aliases: ['calf raise', 'calves'] }),
  ex('legs', 'Seated Calf Raise', 'machine', 'accessory', 3, [12, 15], 45, 'Seated with a pad on your knees, raise your heels.', { aliases: ['calf raise', 'calves'] }),

  // Core
  ex('core', 'Hanging Leg Raise', 'bodyweight', 'accessory', 3, [8, 15], 0, 'Hanging from a bar, raise your legs (or knees) toward your chest.', { aliases: ['leg raise', 'hanging knee raise'] }),
  ex('core', 'Cable Crunch', 'cable', 'accessory', 3, [10, 15], 50, 'Kneeling under a cable, crunch down with a rope held by your head.', { aliases: ['kneeling cable crunch', 'rope crunch', 'abs'] }),
  ex('core', 'Ab Wheel Rollout', 'bodyweight', 'accessory', 3, [8, 12], 0, 'From your knees, roll an ab wheel forward as far as you can control, then back.', { aliases: ['ab roller', 'rollout', 'abs'] }),
  ex('core', 'Decline Sit-Up', 'bodyweight', 'accessory', 3, [10, 15], 0, 'Feet hooked on a decline bench, sit up until your torso is upright.', { aliases: ['situp', 'sit up', 'abs'] }),
  ex('core', 'Pallof Press', 'cable', 'accessory', 3, [10, 12], 15, 'Standing side-on to a cable, press the handle straight out and resist the twist.', { aliases: ['anti-rotation press'], unilateral: true }),
]

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/**
 * Bank exercises whose name or a nickname contains every word typed, ignoring case and
 * punctuation ("db row" → One-Arm Dumbbell Row). An empty query returns the whole bank.
 */
export function searchBank(query: string, bank: BankExercise[] = BANK): BankExercise[] {
  const typed = words(query)
  if (typed.length === 0) return bank
  return bank.filter((e) =>
    [e.name, ...e.aliases].some((text) => {
      const haystack = words(text).join(' ')
      return typed.every((w) => haystack.includes(w))
    }),
  )
}

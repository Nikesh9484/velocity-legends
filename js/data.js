// Velocity Legends — game data: cars, tracks, disciplines, upgrades, paints
export const VERSION = '1.18';

// Car stats: hp (power), kg (mass), top (km/h top speed), grip (lateral g on tarmac), aero (downforce factor), brake (g), steer (lock rad),
// wb (wheelbase m), len (model length m), drive ('rwd'|'awd'), loose (grip multiplier on dirt), cyl (engine sound), redline (rpm), gears
// Model: f = file in assets/cars, ry = yaw fix so the nose points +Z, paint = material-name regex for the body colour, wheel = regex for spinning wheel parts
export const CARS = [
  // ---------- HYPERCARS ----------
  { id: 'chiron', n: 'Aurelion W16 Super Sport', cls: 'hyper', origin: 'France', price: 0, hp: 1578, kg: 1995, top: 440, grip: 1.25, aero: 0.7, brake: 1.35, steer: 0.5, wb: 2.71, len: 4.54, drive: 'awd', loose: 0.55, cyl: 16, redline: 7100, gears: 7,
    f: 'chiron', ry: 0, paint: /CarPaint|Coloured/i, wheel: /Wheel1A_Rim|Wheel1A_Tire|Rotor/i, col: '#0e2a5c', desc: 'Quad-turbo W16. The king of top speed.' },
  { id: 'jesko', n: 'Valkyr Jaeger Absolut', cls: 'hyper', origin: 'Sweden', price: 120000, hp: 1600, kg: 1390, top: 450, grip: 1.35, aero: 0.9, brake: 1.45, steer: 0.52, wb: 2.70, len: 4.61, drive: 'rwd', loose: 0.5, cyl: 8, redline: 8500, gears: 9,
    f: 'jesko', ry: 0, paint: /mm_ext1|mm_chassis/i, wheel: /TYRE|WHEEL|ROTOR|CALIPER/i, col: '#d9dde2', desc: 'Twin-turbo V8 with a 9-speed light-speed gearbox.' },
  { id: 'huayra', n: 'Vento Zefiro BC', cls: 'hyper', origin: 'Italy', price: 95000, hp: 791, kg: 1218, top: 370, grip: 1.4, aero: 1.0, brake: 1.4, steer: 0.55, wb: 2.80, len: 4.60, drive: 'rwd', loose: 0.5, cyl: 12, redline: 7200, gears: 7,
    f: 'huayra', ry: 0, paint: /Coloured|Base_Material/i, wheel: /Wheel1A/i, col: '#c8c9cc', desc: 'Hand-built carbon art with a V12 heart.' },
  { id: 'revuelto', n: 'Toro Furia V12 Hybrid', cls: 'hyper', origin: 'Italy', price: 70000, hp: 1001, kg: 1772, top: 350, grip: 1.3, aero: 0.75, brake: 1.35, steer: 0.55, wb: 2.78, len: 4.95, drive: 'awd', loose: 0.6, cyl: 12, redline: 9500, gears: 8,
    f: 'revuelto', ry: 0, paint: /^Body$/i, wheel: /^Tire$|^Logo$|Caliper|Brake_rotor|^material$/i, col: '#f2b705', desc: 'Screaming naturally-aspirated V12 plus three e-motors.' },
  { id: 'p1gtr', n: 'Mercurio P1 GTR', cls: 'gt', origin: 'UK', price: 110000, hp: 986, kg: 1440, top: 350, grip: 1.55, aero: 1.4, brake: 1.6, steer: 0.55, wb: 2.67, len: 4.60, drive: 'rwd', loose: 0.45, cyl: 8, redline: 8500, gears: 7,
    f: 'p1gtr', ry: 0, paint: /main_body/i, wheel: /^tires$|^rims$|^disk|^brake$|tire_logo/i, col: '#ff7a00', desc: 'Track-only hybrid with a giant rear wing.' },
  { id: 'fxxk', n: 'Rosso XX Evo', cls: 'gt', origin: 'Italy', price: 150000, hp: 1036, kg: 1165, top: 350, grip: 1.6, aero: 1.5, brake: 1.65, steer: 0.55, wb: 2.65, len: 4.90, drive: 'rwd', loose: 0.45, cyl: 12, redline: 9200, gears: 7,
    f: 'fxxk', ry: 0, paint: /CARPAINT_Base/i, wheel: /Rim_Base|Rim_Blur|TYRE|DISK_BRAKE/i, col: '#c1121f', desc: 'The rarest track weapon money can buy.' },
  { id: 'rsr', n: 'Stuttgart 911 RSR', cls: 'gt', origin: 'Germany', price: 0, hp: 515, kg: 1245, top: 300, grip: 1.45, aero: 1.1, brake: 1.5, steer: 0.55, wb: 2.46, len: 4.57, drive: 'rwd', loose: 0.55, cyl: 6, redline: 9400, gears: 6,
    f: 'rsr', ry: 0, paint: /part11|21Mtl/i, wheel: /rim191/i, col: '#f4f4f4', desc: 'Le Mans GT racer. Light, loud, balanced.' },
  // ---------- FORMULA ----------
  { id: 'w13', n: 'Silver Arrow W-13', cls: 'formula', origin: 'Germany', price: 0, hp: 1000, kg: 798, top: 345, grip: 1.9, aero: 2.4, brake: 2.2, steer: 0.42, wb: 3.6, len: 5.5, drive: 'rwd', loose: 0.35, cyl: 6, redline: 13000, gears: 8,
    f: 'w13', ry: Math.PI, paint: /Body_Main|Body_Wings/i, wheel: /Tyre|WheelHub/i, col: '#bfc5c9', desc: 'Ground-effect F1 machine. Pure downforce.', open: true },
  { id: 'mcl35', n: 'Papaya F-35 Racer', cls: 'formula', origin: 'UK', price: 60000, hp: 1010, kg: 798, top: 350, grip: 1.95, aero: 2.5, brake: 2.25, steer: 0.42, wb: 3.6, len: 5.6, drive: 'rwd', loose: 0.35, cyl: 6, redline: 13000, gears: 8,
    f: 'mcl35', ry: 0, paint: /mcl35m_png|mcl35m_c/i, wheel: /rim_png|tyrewall|tread/i, col: '#ff8000', desc: 'Papaya-orange F1 car with razor-sharp turn-in.', open: true },
  // ---------- RALLY ----------
  { id: 'yaris', n: 'Kaze GR Rally1', cls: 'rally', origin: 'Japan', price: 0, hp: 500, kg: 1260, top: 220, grip: 1.15, aero: 0.4, brake: 1.25, steer: 0.62, wb: 2.63, len: 4.2, drive: 'awd', loose: 0.92, cyl: 4, redline: 8000, gears: 6,
    f: 'yaris', ry: 0, paint: /car_paint/i, wheel: /x^/, col: '#e8e8e8', desc: 'Hybrid WRC weapon built for gravel and jumps.' },
  { id: 'delta', n: 'Integra Delta Evo II', cls: 'rally', origin: 'Italy', price: 30000, hp: 420, kg: 1150, top: 215, grip: 1.1, aero: 0.3, brake: 1.2, steer: 0.62, wb: 2.48, len: 3.9, drive: 'awd', loose: 0.9, cyl: 4, redline: 7500, gears: 5,
    f: 'delta', ry: 0, paint: /^Paint$/i, wheel: /rim|Tire/i, col: '#d40000', desc: 'Legendary boxy rally champion.' },
  // ---------- OFF-ROAD ----------
  { id: 'buggy', n: 'Dune Buggy RX', cls: 'offroad', origin: 'USA', price: 0, hp: 380, kg: 820, top: 190, grip: 1.0, aero: 0.1, brake: 1.1, steer: 0.65, wb: 2.4, len: 3.6, drive: 'rwd', loose: 1.0, cyl: 4, redline: 7800, gears: 5,
    f: 'buggy', ry: 0, drop: /env_mat/i, paint: /car_mat/i, wheel: /wheels_mat/i, col: '#2a7d3f', desc: 'Long-travel desert buggy. Flies over dunes.', open: true },
  { id: 'raptor', n: 'Bronco Raptor T1', cls: 'offroad', origin: 'USA', price: 25000, hp: 450, kg: 2600, top: 180, grip: 0.95, aero: 0.1, brake: 1.0, steer: 0.6, wb: 3.68, len: 5.9, drive: 'awd', loose: 1.0, cyl: 6, redline: 6500, gears: 10,
    f: 'raptor', ry: Math.PI, paint: /F-150_Paint/i, wheel: /Rim|Offroad_Tires/i, col: '#1c4e9e', desc: 'Twin-turbo trophy-spec pickup on huge tyres.' },
  { id: 'patrol', n: 'Desert Patrol Extreme', cls: 'offroad', origin: 'Japan', price: 35000, hp: 520, kg: 2400, top: 185, grip: 0.98, aero: 0.1, brake: 1.0, steer: 0.6, wb: 3.08, len: 5.3, drive: 'awd', loose: 1.0, cyl: 8, redline: 6800, gears: 7,
    f: 'patrol', ry: Math.PI, paint: /Panel|Chassis/i, wheel: /prochee\.030|zapaska/i, col: '#f0f0f0', desc: 'Rally-raid giant tuned for sand and mud.' },
];
export const CAR = id => CARS.find(c => c.id === id) || CARS[0];

export const CLASSES = {
  formula: { n: 'FORMULA', d: 'Open-wheel Grand Prix cars. Extreme downforce and braking.', icon: 'formula' },
  hyper: { n: 'HYPERCARS', d: 'The world\'s fastest and most exclusive road supercars.', icon: 'hyper' },
  gt: { n: 'GT ENDURANCE', d: 'Le Mans-style GT and track-only racers. Wings, slicks and kerbs.', icon: 'hyper' },
  rally: { n: 'RALLY', d: 'All-wheel-drive rally weapons on gravel and dirt.', icon: 'rally' },
  offroad: { n: 'OFF-ROAD', d: 'Trophy trucks and buggies over dunes and mud.', icon: 'offroad' },
};

// Tracks: control points [x, z, elevation, width]; closed loops (counter-clockwise ok)
export const TRACKS = [
  { id: 'gp', flag: 'mc', place: 'MONTE VELARO · MONACO', n: 'Monte Velaro Grand Prix', cls: ['formula', 'hyper', 'gt'], sky: 'day', surf: 'asphalt', scen: 'gp', laps: 3, km: 0,
    desc: 'Fast sweeping Grand Prix circuit with grandstands, kerbs and gravel traps.',
    pts: [[0, 0, 0, 15], [0, 260, 0, 15], [20, 380, 1, 14], [90, 440, 2, 14], [200, 450, 3, 14], [290, 400, 3, 14], [320, 310, 2, 14], [300, 220, 1, 14], [240, 170, 1, 14], [230, 100, 1, 14], [290, 40, 2, 14], [360, 0, 3, 14], [380, -90, 3, 14], [330, -170, 2, 14], [230, -200, 1, 14], [120, -190, 0, 14], [40, -150, 0, 14], [5, -90, 0, 15]] },
  { id: 'street', flag: 'ae', place: 'MARINA BAY · UAE', n: 'Neon Marina Night Circuit', cls: ['formula', 'hyper', 'gt'], sky: 'night', surf: 'asphalt', scen: 'city', laps: 3, scale: 1.3,
    desc: 'Tight city street circuit under the lights, walls on every side.',
    pts: [[0, 0, 0, 13], [0, 200, 0, 13], [10, 260, 0, 12], [60, 280, 0, 12], [180, 280, 0, 12], [230, 250, 0, 12], [240, 180, 0, 12], [200, 130, 0, 12], [200, 60, 0, 12], [260, 20, 0, 12], [280, -60, 0, 12], [240, -120, 0, 12], [150, -130, 0, 12], [90, -90, 0, 12], [40, -110, 0, 12], [5, -70, 0, 13]] },
  { id: 'coast', flag: 'it', place: 'AMALFI COAST · ITALY', n: 'Sunset Coast Ring', cls: ['hyper', 'formula', 'gt'], sky: 'sunset', surf: 'asphalt', scen: 'coast', laps: 2,
    desc: 'Flowing hillside road above the sea, golden-hour light.',
    pts: [[0, 0, 0, 13], [-20, 180, 6, 13], [10, 330, 14, 12], [110, 420, 20, 12], [240, 430, 18, 12], [340, 360, 12, 12], [380, 240, 8, 12], [470, 160, 10, 12], [500, 40, 6, 12], [440, -80, 2, 12], [330, -150, 0, 12], [200, -160, 2, 12], [90, -110, 1, 13], [30, -60, 0, 13]] },
  { id: 'dunes', flag: 'ma', place: 'ERG CHEBBI · MOROCCO', n: 'Sahara Dune Rally', cls: ['rally', 'offroad'], sky: 'clear', surf: 'gravel', scen: 'desert', laps: 2,
    desc: 'Gravel stage across golden dunes, crests and rocky canyons.',
    pts: [[0, 0, 0, 12], [-30, 160, 4, 11], [20, 300, 10, 11], [140, 360, 6, 11], [260, 300, 12, 11], [300, 180, 4, 11], [400, 120, 8, 11], [470, 0, 3, 11], [400, -120, 9, 11], [260, -160, 2, 11], [150, -90, 6, 11], [60, -120, 1, 11], [10, -70, 0, 12]] },
  { id: 'forest', flag: 'de', place: 'BLACK FOREST · GERMANY', n: 'Black Forest Trail', cls: ['rally', 'offroad'], sky: 'overcast', surf: 'mud', scen: 'forest', laps: 2,
    desc: 'Muddy forest trail with steep climbs, jumps and tall firs.',
    pts: [[0, 0, 0, 11], [10, 140, 8, 10], [80, 240, 16, 10], [200, 260, 12, 10], [260, 180, 20, 10], [230, 80, 14, 10], [300, 10, 6, 10], [270, -110, 12, 10], [160, -160, 4, 10], [60, -120, 9, 10], [0, -60, 2, 11]] },
];
export const TRACK = id => TRACKS.find(t => t.id === id) || TRACKS[0];

export const SKIES = { day: 'DAY', sunset: 'SUNSET', night: 'NIGHT', overcast: 'OVERCAST', rain: 'RAIN' };
export const DIFFS = [{ n: 'ROOKIE', pace: 0.86 }, { n: 'PRO', pace: 0.93 }, { n: 'LEGEND', pace: 0.985 }];

export const PAINTS = ['#c1121f', '#ff7a00', '#f2b705', '#2a7d3f', '#0b6e4f', '#0e2a5c', '#1f4fd1', '#5ac8ff', '#6c2bd9', '#111317', '#3d4247', '#c8c9cc', '#f4f4f4', '#b08d57', '#7a0c2e', '#00b3a4'];
export const FINISH = [{ id: 'gloss', n: 'GLOSS' }, { id: 'metal', n: 'METALLIC' }, { id: 'pearl', n: 'PEARL' }, { id: 'matte', n: 'MATTE' }, { id: 'chrome', n: 'CHROME' }];

export const UPGRADES = [
  { id: 'eng', n: 'ENGINE', d: '+6% power per level', cost: [6000, 14000, 30000] },
  { id: 'turbo', n: 'TURBO & NITRO', d: 'Bigger nitro charge, faster refill', cost: [5000, 12000, 26000] },
  { id: 'tyre', n: 'TYRES', d: '+5% grip per level', cost: [4000, 10000, 22000] },
  { id: 'brake', n: 'BRAKES', d: '+8% braking per level', cost: [3000, 8000, 18000] },
  { id: 'weight', n: 'WEIGHT REDUCTION', d: '-4% mass per level', cost: [5000, 12000, 25000] },
];

export const CHAMPS = [
  { id: 'c_formula', n: 'GRAND PRIX WORLD SERIES', cls: 'formula', races: [['gp', 'day'], ['coast', 'sunset'], ['street', 'night']], prize: 60000 },
  { id: 'c_hyper', n: 'HYPERCAR MILLIONAIRES CUP', cls: 'hyper', races: [['coast', 'sunset'], ['street', 'night'], ['gp', 'overcast']], prize: 80000 },
  { id: 'c_gt', n: 'GT ENDURANCE TROPHY', cls: 'gt', races: [['gp', 'overcast'], ['coast', 'sunset'], ['street', 'night']], prize: 70000 },
  { id: 'c_rally', n: 'WORLD RALLY CHAMPIONSHIP', cls: 'rally', races: [['dunes', 'clear'], ['forest', 'overcast'], ['dunes', 'sunset']], prize: 50000 },
  { id: 'c_off', n: 'BAJA OFF-ROAD SERIES', cls: 'offroad', races: [['forest', 'overcast'], ['dunes', 'clear'], ['forest', 'rain']], prize: 45000 },
];
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const RIVALS = ['M. Verstappo', 'L. Hamiltor', 'C. Leclair', 'L. Norrison', 'F. Alonzo', 'G. Russet', 'O. Piastre', 'C. Sainze', 'S. Perezo', 'K. Kimura', 'A. Albonn', 'Y. Tsunami', 'P. Gasley', 'S. Ogierre', 'K. Rovanpera', 'T. Neuvo', 'N. Al-Attiyeh', 'C. Sainz Sr', 'R. Rana', 'A. Mehta', 'V. Iyer', 'D. Ortega', 'J. Vance', 'E. Moreau'];

// car customisation (Garage → CUSTOMISE)
export const CUSTOM = {
  rim: { n: 'RIMS', o: [['chrome', 'CHROME', '#d9dde2'], ['black', 'GLOSS BLACK', '#15171a'], ['gold', 'GOLD', '#d4a937'], ['red', 'RACE RED', '#c4161c'], ['bronze', 'BRONZE', '#8a5a2b'], ['white', 'WHITE', '#f2f2f2']] },
  tint: { n: 'WINDOW TINT', o: [['clear', 'CLEAR', '#9fb4c2'], ['light', 'LIGHT', '#4b5862'], ['dark', 'DARK', '#1c2228'], ['limo', 'LIMO', '#050607']] },
  glow: { n: 'UNDERGLOW NEON', o: [['off', 'OFF', '#2a2e33'], ['red', 'RED', '#ff2a2a'], ['blue', 'BLUE', '#2a7bff'], ['purple', 'PURPLE', '#b03aff'], ['green', 'GREEN', '#2aff6a'], ['white', 'WHITE', '#ffffff'], ['gold', 'GOLD', '#ffb02a']] },
  nitro: { n: 'NITRO FLAME', o: [['blue', 'BLUE', '#4f8dff'], ['red', 'RED', '#ff3a2a'], ['green', 'GREEN', '#33ff77'], ['purple', 'PURPLE', '#b54dff'], ['gold', 'GOLD', '#ffbb33']] },
  ride: { n: 'RIDE HEIGHT', o: [['stock', 'STOCK', '#8b949b'], ['low', 'LOWERED', '#8b949b'], ['slam', 'SLAMMED', '#8b949b']] },
};
export const customCol = (k, v) => ((CUSTOM[k].o.find(x => x[0] === v) || CUSTOM[k].o[0])[2]);

// simple vector flags for track cards
export const FLAGS = {
  mc: '<svg viewBox="0 0 30 30"><rect width="30" height="15" fill="#ce1126"/><rect y="15" width="30" height="15" fill="#fff"/></svg>',
  ae: '<svg viewBox="0 0 30 30"><rect width="30" height="10" fill="#00732f"/><rect y="10" width="30" height="10" fill="#fff"/><rect y="20" width="30" height="10" fill="#000"/><rect width="9" height="30" fill="#ff0000"/></svg>',
  it: '<svg viewBox="0 0 30 30"><rect width="10" height="30" fill="#009246"/><rect x="10" width="10" height="30" fill="#fff"/><rect x="20" width="10" height="30" fill="#ce2b37"/></svg>',
  ma: '<svg viewBox="0 0 30 30"><rect width="30" height="30" fill="#c1272d"/><path d="M15 8l2.1 6.4h6.7l-5.4 3.9 2.1 6.4-5.5-4-5.5 4 2.1-6.4-5.4-3.9h6.7z" fill="none" stroke="#006233" stroke-width="1.4"/></svg>',
  de: '<svg viewBox="0 0 30 30"><rect width="30" height="10" fill="#000"/><rect y="10" width="30" height="10" fill="#dd0000"/><rect y="20" width="30" height="10" fill="#ffce00"/></svg>',
};
